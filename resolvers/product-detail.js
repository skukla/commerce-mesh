
// ============================================================================
// INJECTED FACET MAPPINGS - Added during build from config/facet-mappings.json
// ============================================================================
const FACET_MAPPINGS = {
  "version": "1.0",
  "description": "URL key mappings for SEO-friendly URLs. Display names come from Adobe Commerce.",
  "mappings": {
    "cs_manufacturer": "manufacturer",
    "cs_memory": "storage",
    "cs_color": "color",
    "price": "price",
    "categories": "category",
    "cs_connectivity": "connectivity",
    "cs_screen_size": "screen-size"
  },
  "defaults": {
    "removePrefix": [
      "cs_",
      "attr_",
      "custom_"
    ],
    "replaceUnderscore": true,
    "toLowerCase": true
  }
};

// Helper functions for facet mapping
const attributeCodeToUrlKey = (attributeCode) => {
  // Check for explicit mapping
  if (FACET_MAPPINGS.mappings && FACET_MAPPINGS.mappings[attributeCode]) {
    return FACET_MAPPINGS.mappings[attributeCode];
  }
  
  // Apply default transformations
  let urlKey = attributeCode;
  if (FACET_MAPPINGS.defaults) {
    // Remove prefixes
    (FACET_MAPPINGS.defaults.removePrefix || []).forEach(prefix => {
      if (urlKey.startsWith(prefix)) {
        urlKey = urlKey.substring(prefix.length);
      }
    });
    
    // Replace underscores
    if (FACET_MAPPINGS.defaults.replaceUnderscore) {
      urlKey = urlKey.replace(/_/g, '-');
    }
    
    // Convert to lowercase
    if (FACET_MAPPINGS.defaults.toLowerCase) {
      urlKey = urlKey.toLowerCase();
    }
  }
  
  return urlKey;
};

const urlKeyToAttributeCode = (urlKey) => {
  // Find the attribute code for a URL key
  if (FACET_MAPPINGS.mappings) {
    for (const [attributeCode, mappedKey] of Object.entries(FACET_MAPPINGS.mappings)) {
      if (mappedKey === urlKey) {
        return attributeCode;
      }
    }
  }
  
  // If no mapping found, try to reverse the default transformations
  // This is a best-effort approach
  return urlKey.replace(/-/g, '_');
};

// ============================================================================
// SHARED UTILITY FUNCTIONS - Injected at build time
// ============================================================================

/**
 * Extract configurable options from product options
 * Shared utility function injected into all resolvers that need it
 */
const extractConfigurableOptions = (options) => {
  if (!options || !Array.isArray(options)) return [];

  return options.map(option => ({
    label: option.title || option.label || '',
    attribute_code: option.id || option.attribute_code || '',
    values: (option.values || []).map(value => ({
      label: value.title || value.label || '',
      value: value.value || value.id || '',
      swatch_data: value.swatch_data ? {
        type: value.swatch_data.type || 'text',
        value: value.swatch_data.value || ''
      } : null
    }))
  }));
};

// ============================================================================
// ORIGINAL RESOLVER CODE BELOW
// ============================================================================
/**
 * CITISIGNAL PRODUCT DETAIL - CUSTOM GRAPHQL RESOLVER
 *
 * Fetches comprehensive product information for Product Detail Pages.
 * Orchestrates Catalog Service and Commerce GraphQL to provide complete product data
 * including variants, related products, reviews, and navigation.
 *
 * Service Selection:
 * - Catalog Service: Primary product data, attributes, media, variants
 * - Commerce GraphQL: Related products, categories, breadcrumbs
 * - Future: Live Search for reviews/ratings aggregation
 */

// ============================================================================
// CONSTANTS - Default values and limits
// ============================================================================

const DEFAULT_RELATED_PRODUCTS_LIMIT = 6;
const DEFAULT_CROSS_SELL_LIMIT = 4;

// ============================================================================
// ATTRIBUTE TRANSFORMATION - Clean and extract product attributes
// ============================================================================

/**
 * Transform product attributes to consistent format
 */
const transformAttributes = (attributes) => {
  if (!attributes || !Array.isArray(attributes)) return [];

  return attributes
    .filter(attr => attr.name && attr.value) // Only include attributes with name and value
    .map(attr => ({
      key: attr.name,
      label: cleanAttributeName(attr.name),
      value: attr.value,
      type: attr.type || 'text'
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
};

// ============================================================================
// PRICE UTILITIES - Price extraction and formatting
// ============================================================================

/**
 * Format price for display with currency symbol and thousands separator
 */
const formatPrice = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Calculate discount percentage from regular and final prices
 */
const calculateDiscountPercent = (regularPrice, finalPrice) => {
  if (!regularPrice || !finalPrice || finalPrice >= regularPrice) return null;
  return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
};

/**
 * Extract price value from nested price structure
 */
const extractPriceValue = (product, priceType, isComplex) => {
  if (isComplex) {
    return priceType === 'regular'
      ? product.priceRange?.minimum?.regular?.amount?.value
      : product.priceRange?.minimum?.final?.amount?.value;
  }
  return priceType === 'regular'
    ? product.price?.regular?.amount?.value
    : product.price?.final?.amount?.value;
};

// ============================================================================
// MEDIA TRANSFORMATION - Handle product images and galleries
// ============================================================================

/**
 * Transform product images with enhanced metadata
 */
const transformImages = (images) => {
  if (!images || !Array.isArray(images)) return [];

  return images
    .map((image, index) => ({
      url: ensureHttpsUrl(image.url),
      altText: image.label || image.alt || '',
      type: image.type || (index === 0 ? 'image' : 'thumbnail'),
      position: image.position || index + 1
    }))
    .filter(image => image.url) // Only include images with valid URLs
    .sort((a, b) => a.position - b.position); // Sort by position
};

/**
 * Ensure URL uses HTTPS protocol
 */
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
};

// ============================================================================
// BUSINESS LOGIC HELPERS - Reusable transformation functions
// ============================================================================

/**
 * Clean technical prefixes from attribute names
 */
const cleanAttributeName = (name) => {
  if (!name) return name;
  
  // Remove common prefixes and convert to readable format
  let cleaned = name.startsWith('cs_') ? name.substring(3) : name;
  cleaned = cleaned.replace(/_/g, ' '); // Replace underscores with spaces
  
  // Capitalize first letter of each word
  return cleaned.replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Find attribute value by name (checks both with and without cs_ prefix)
 */
const findAttributeValue = (attributes, name) => {
  if (!attributes || !Array.isArray(attributes)) return null;
  
  // First try with cs_ prefix (more specific)
  let attr = attributes.find((a) => a.name === `cs_${name}`);
  // Then try without prefix
  if (!attr) {
    attr = attributes.find((a) => a.name === name);
  }
  return attr?.value;
};

/**
 * Transform related products to simplified format
 */
const transformRelatedProducts = (products) => {
  if (!products || !Array.isArray(products)) return [];

  return products.map(product => {
    const productData = product.productView || product;
    const isComplex = productData.__typename === 'Catalog_ComplexProductView';
    const regularPrice = extractPriceValue(productData, 'regular', isComplex);
    const finalPrice = extractPriceValue(productData, 'final', isComplex);
    const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);
    const manufacturer = findAttributeValue(productData.attributes, 'manufacturer');

    return {
      id: productData.id || '',
      sku: productData.sku || '',
      urlKey: productData.urlKey || '',
      name: productData.name || '',
      price: formatPrice(finalPrice),
      originalPrice: discountPercent ? formatPrice(regularPrice) : null,
      discountPercent,
      inStock: productData.inStock || false,
      image: productData.images?.[0] ? {
        url: ensureHttpsUrl(productData.images[0].url),
        altText: productData.images[0].label || productData.name || ''
      } : null,
      manufacturer: manufacturer || null
    };
  }).filter(product => product.sku); // Only include products with valid SKUs
};

// ============================================================================
// VARIANT TRANSFORMATION - Simple placeholder for now
// ============================================================================

// ============================================================================
// PRODUCT TRANSFORMATION - Main product data transformation
// ============================================================================

/**
 * Transform detailed product data to our custom shape
 */
const transformProductDetail = (product, relatedData = {}) => {
  if (!product) return null;

  const productData = product.productView || product;
  const isComplex = productData.__typename === 'Catalog_ComplexProductView';
  const regularPrice = extractPriceValue(productData, 'regular', isComplex);
  const finalPrice = extractPriceValue(productData, 'final', isComplex);
  const manufacturer = findAttributeValue(productData.attributes, 'manufacturer');
  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);

  return {
    // Core product information
    id: productData.id || '',
    sku: productData.sku || '',
    name: productData.name || '',
    urlKey: productData.urlKey || '',
    price: formatPrice(finalPrice),
    originalPrice: isOnSale ? formatPrice(regularPrice) : null,
    discountPercent,
    inStock: productData.inStock || false,
    stockLevel: productData.stockLevel || null,
    manufacturer: manufacturer || null,

    // Enhanced product details
    description: productData.description || '',
    shortDescription: productData.shortDescription || '',
    metaTitle: productData.metaTitle || productData.name || '',
    metaDescription: productData.metaDescription || productData.shortDescription || '',

    // Enhanced media gallery
    images: transformImages(productData.images),

    // Product specifications and attributes
    attributes: transformAttributes(productData.attributes),

    // Configurable product options
    configurable_options: extractConfigurableOptions(productData.options),

    // Product variants - temporarily disabled to isolate 500 error
    variants: [],

    // Review and rating information (placeholder for future implementation)
    reviews: productData.reviews || {
      rating_summary: 0,
      review_count: 0
    },

    // Related and cross-sell products from separate queries
    related_products: transformRelatedProducts(relatedData.relatedProducts),
    cross_sell_products: transformRelatedProducts(relatedData.crossSellProducts),

    // Navigation and SEO from separate queries
    breadcrumbs: relatedData.breadcrumbs || { items: [] },

    // Category information from separate queries
    categories: relatedData.categories || []
  };
};

// ============================================================================
// SERVICE QUERIES - Abstracted service calls
// ============================================================================

/**
 * Find product SKU by urlKey using general search
 */
const findProductSkuByUrlKey = async (context, urlKey) => {
  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: urlKey, // Search for the urlKey in the phrase
      filter: [],
      page_size: 50, // Search through more products to find exact match
      current_page: 1
    },
    context,
    selectionSet: `{
      items {
        productView {
          sku
          urlKey
        }
      }
    }`
  });

  // Find exact urlKey match
  const matchingProduct = result?.items?.find(item => 
    item.productView?.urlKey === urlKey
  );

  return matchingProduct?.productView?.sku || null;
};

/**
 * Query product detail from Catalog Service by SKU
 */
const queryProductDetailBySku = async (context, sku) => {
  return await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '', // Required by Catalog Service
      filter: [{
        attribute: 'sku',
        in: [sku]
      }],
      page_size: 1,
      current_page: 1
    },
    context,
    selectionSet: `{
      items {
        productView {
          __typename
          id name sku urlKey inStock stockLevel
          description shortDescription metaTitle metaDescription
          images(roles: ["small_image"]) { url label }
          attributes { name value }
          ... on Catalog_SimpleProductView {
            price {
              regular { amount { value } }
              final { amount { value } }
            }
          }
          ... on Catalog_ComplexProductView {
            priceRange {
              minimum {
                regular { amount { value } }
                final { amount { value } }
              }
            }
            options {
              id
              title
              values {
                ... on Catalog_ProductViewOptionValueSwatch {
                  title
                  value
                }
              }
            }
            variants {
              product {
                sku
                name
                inStock
                stockLevel
                images(roles: ["small_image"]) { url label }
                price {
                  regular { amount { value } }
                  final { amount { value } }
                }
              }
              attributes {
                code
                value_index
                label
              }
            }
          }
        }
      }
    }`
  });
};



/**
 * Query product detail from Catalog Service
 */
const queryProductDetail = async (context, urlKey) => {
  // First, find the SKU by urlKey
  const sku = await findProductSkuByUrlKey(context, urlKey);
  
  if (!sku) {
    return null; // Product not found
  }

  // Then query detailed product data by SKU
  return await queryProductDetailBySku(context, sku);
};

/**
 * Query related products from Catalog Service
 */
const queryRelatedProducts = async (context, sku, limit = DEFAULT_RELATED_PRODUCTS_LIMIT) => {
  // Note: This is a simplified implementation
  // In a real scenario, you'd query related products based on categories, attributes, etc.
  return await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: [], // Would add category or other filters based on main product
      page_size: limit,
      current_page: 1
    },
    context,
    selectionSet: `{
      items {
        productView {
          __typename
          id name sku urlKey inStock
          images(roles: ["small_image"]) { url label }
          attributes { name value }
          ... on Catalog_SimpleProductView {
            price {
              regular { amount { value } }
              final { amount { value } }
            }
          }
          ... on Catalog_ComplexProductView {
            priceRange {
              minimum {
                regular { amount { value } }
                final { amount { value } }
              }
            }
          }
        }
      }
    }`
  });
};

/**
 * Query breadcrumbs from Commerce GraphQL
 * Generates proper category-based breadcrumbs using product categories
 */
const queryBreadcrumbs = async (context, product) => {
  try {
    // First, get the product's categories
    const categories = await queryProductCategories(context, product);
    
    if (!categories || categories.length === 0) {
      // Fallback to simple breadcrumb if no categories
      return {
        items: [
          { name: 'Home', urlPath: '/' },
          { name: product.name, urlPath: `/products/${product.urlKey}` }
        ]
      };
    }

    // Use the first (primary) category to build breadcrumbs
    const primaryCategory = categories[0];
    const breadcrumbItems = [
      { name: 'Home', urlPath: '/' }
    ];

    // Add category breadcrumb
    if (primaryCategory.name && primaryCategory.urlPath) {
      breadcrumbItems.push({
        name: primaryCategory.name,
        urlPath: primaryCategory.urlPath
      });
    }

    // Add product as final breadcrumb
    breadcrumbItems.push({
      name: product.name,
      urlPath: `/products/${product.urlKey}`
    });

    return {
      items: breadcrumbItems
    };
  } catch (error) {
    console.warn('Failed to generate breadcrumbs:', error);
    // Fallback breadcrumbs without hardcoded "Products"
    return {
      items: [
        { name: 'Home', urlPath: '/' },
        { name: product.name, urlPath: `/products/${product.urlKey}` }
      ]
    };
  }
};

/**
 * Query product categories
 */
const queryProductCategories = async (_context, _product) => {
  // This would typically query Commerce GraphQL for category information
  // Simplified implementation for now
  return [];
};

// ============================================================================
// MAIN RESOLVER - Brings it all together
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productDetail: {
        resolve: async (_root, args, context, _info) => {
          try {
            const { urlKey } = args;

            // 1. Query main product data from Catalog Service
            const productResult = await queryProductDetail(context, urlKey);
            
            if (!productResult?.items?.length || !productResult.items[0]?.productView) {
              return null;
            }

            const product = productResult.items[0].productView;


            // Query related data in parallel for better performance
            const [relatedProducts, crossSellProducts, breadcrumbs, categories] = await Promise.all([
              queryRelatedProducts(context, product.sku, DEFAULT_RELATED_PRODUCTS_LIMIT),
              queryRelatedProducts(context, product.sku, DEFAULT_CROSS_SELL_LIMIT),
              queryBreadcrumbs(context, product),
              queryProductCategories(context, product)
            ]);


            // Transform and combine all data
            const relatedData = {
              relatedProducts: relatedProducts?.items || [],
              crossSellProducts: crossSellProducts?.items || [],
              breadcrumbs,
              categories,
              context // Pass context for Commerce GraphQL access
            };

            return transformProductDetail(product, relatedData);

          } catch (error) {
            console.error('Product detail resolver error:', error);
            throw error;
          }
        }
      }
    }
  }
};
