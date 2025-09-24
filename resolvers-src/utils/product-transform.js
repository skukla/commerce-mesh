/**
 * PRODUCT TRANSFORMATION UTILITIES
 *
 * Centralized product transformation functions for consistent product data
 * across all resolvers. Transforms Adobe's complex product structures into
 * simple, frontend-ready product cards.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 * Dependencies on price-utils and attribute-utils will be injected as well.
 */

/**
 * Transform a product into a card format for listings
 * This is the main transformation function used across all resolvers
 * @param {object} product - Product object from Adobe services
 * @returns {object|null} Transformed product card or null if invalid
 */
const transformProductToCard = (product) => {
  if (!product) return null;

  // Determine product type (handle both Catalog and Search types)
  const isComplex =
    product.__typename === 'Catalog_ComplexProductView' ||
    product.__typename === 'Search_ComplexProductView';

  // Extract prices using price utilities (will be injected)
  const regularPrice = extractPriceValue(product, 'regular', isComplex);
  const finalPrice = extractPriceValue(product, 'final', isComplex);

  // Extract manufacturer using attribute utilities (will be injected)
  const manufacturer = findAttributeValue(product.attributes, 'manufacturer');

  // Determine sale status and discount
  const onSale = isOnSale(regularPrice, finalPrice);
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);

  // Extract variant options (will be injected)
  const variantOptions = extractVariantOptions(product.options);

  // Extract configurable options for smart button logic (will be injected)
  const configurableOptions = transformConfigurableOptions(product.options);

  // Get secure image URL (will be injected)
  const imageUrl = product.images?.[0]?.url;
  const secureImageUrl = ensureHttpsUrl(imageUrl);

  // Build the transformed product card
  return {
    // Basic identification
    id: product.id,
    sku: product.sku,
    name: product.name,
    urlKey: product.urlKey || '',

    // Business fields with transformations
    manufacturer: manufacturer || null,
    price: formatPrice(finalPrice),
    originalPrice: onSale ? formatPrice(regularPrice) : null,
    discountPercent,
    inStock: product.inStock !== undefined ? product.inStock : true,

    // Simplified media structure
    image: imageUrl
      ? {
          url: secureImageUrl,
          altText: product.images[0].label || product.name,
        }
      : null,

    // Dynamic variant options (spread to include memory, colors, etc.)
    ...variantOptions,

    // Configurable options for smart button logic
    configurable_options: configurableOptions,
  };
};

/**
 * Transform products from Live Search response
 * Live Search wraps products in a productView property
 * @param {array} items - Array of Live Search product items
 * @returns {array} Array of transformed product cards
 */
const transformLiveSearchProducts = (items) => {
  if (!items || !Array.isArray(items)) return [];

  return items.map((item) => transformProductToCard(item.productView)).filter(Boolean);
};

/**
 * Transform products from Catalog Service response
 * Catalog Service products may have productView or direct properties
 * @param {array} items - Array of Catalog Service product items
 * @returns {array} Array of transformed product cards
 */
const transformCatalogProducts = (items) => {
  if (!items || !Array.isArray(items)) return [];

  return items
    .map((item) => {
      // Catalog can have productView or direct product
      const product = item.productView || item.product || item;
      return transformProductToCard(product);
    })
    .filter(Boolean);
};

/**
 * Transform product for detailed view (PDP)
 * Includes additional fields not needed in listings
 * @param {object} product - Product object from Adobe services
 * @returns {object|null} Transformed product detail or null if invalid
 */
const transformProductDetail = (product) => {
  if (!product) return null;

  // Start with basic card transformation
  const card = transformProductToCard(product);
  if (!card) return null;

  // Add detailed fields
  return {
    ...card,
    description: product.description?.html || product.description || '',
    shortDescription: product.short_description?.html || product.short_description || '',

    // Additional images
    images: (product.images || []).map((img) => ({
      url: ensureHttpsUrl(img.url),
      label: img.label || product.name,
      position: img.position || 0,
    })),

    // Meta information
    metaTitle: product.meta_title || product.name,
    metaDescription: product.meta_description || product.short_description,
    metaKeywords: product.meta_keywords || '',

    // Additional attributes
    attributes: (product.attributes || []).reduce((acc, attr) => {
      const key = attributeCodeToUrlKey(attr.name);
      acc[key] = attr.value;
      return acc;
    }, {}),

    // Categories
    categories: product.categories || [],

    // Related products (if available)
    relatedProducts: product.related_products || [],
    crossSellProducts: product.crosssell_products || [],
    upSellProducts: product.upsell_products || [],
  };
};

/**
 * Create an empty product card structure
 * Used for error cases to maintain GraphQL schema compliance
 * @param {string} message - Optional message to include
 * @returns {object} Empty product card structure
 */
const createEmptyProductCard = (message = '') => {
  return {
    id: '',
    sku: '',
    name: message || 'Product not available',
    urlKey: '',
    manufacturer: null,
    price: '$0.00',
    originalPrice: null,
    discountPercent: null,
    inStock: false,
    image: null,
    memory: [],
    colors: [],
  };
};

/**
 * Merge products from multiple sources preserving order
 * Used in hybrid search to combine Live Search ranking with Catalog data
 * @param {array} primaryProducts - Products with preferred ordering
 * @param {array} secondaryProducts - Products with additional data
 * @param {string} matchKey - Key to match products on (default: 'sku')
 * @returns {array} Merged product array
 */
const mergeProducts = (primaryProducts, secondaryProducts, matchKey = 'sku') => {
  if (!primaryProducts || !Array.isArray(primaryProducts)) return secondaryProducts || [];
  if (!secondaryProducts || !Array.isArray(secondaryProducts)) return primaryProducts;

  // Create a map of secondary products for fast lookup
  const secondaryMap = new Map(secondaryProducts.map((p) => [p[matchKey], p]));

  // Merge maintaining primary order
  return primaryProducts.map((primary) => {
    const secondary = secondaryMap.get(primary[matchKey]);
    if (secondary) {
      // Merge secondary data into primary (primary takes precedence)
      return { ...secondary, ...primary };
    }
    return primary;
  });
};

/**
 * Extract product pricing information from various product formats
 * @param {object} productData - Product data from Adobe services
 * @param {boolean} isComplex - Whether this is a complex/configurable product
 * @returns {object} Pricing information with formatted values
 */
const extractProductPricing = (productData, isComplex) => {
  // Extract price information
  const regularPrice = isComplex
    ? productData.priceRange?.minimum?.regular?.amount?.value
    : productData.price?.regular?.amount?.value;
  const finalPrice = isComplex
    ? productData.priceRange?.minimum?.final?.amount?.value
    : productData.price?.final?.amount?.value;

  const onSale = isOnSale(regularPrice, finalPrice);
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);

  // Find manufacturer attribute
  const manufacturer = productData.attributes?.find(
    (attr) => attr.name === 'manufacturer' || attr.name === 'cs_manufacturer'
  )?.value;

  return {
    price: formatPrice(finalPrice),
    originalPrice: onSale ? formatPrice(regularPrice) : null,
    discountPercent,
    manufacturer: manufacturer || null,
  };
};

/**
 * Transform product images with secure URLs and proper structure
 * @param {array} images - Array of image objects from Adobe services
 * @param {string} productName - Product name for alt text fallback
 * @returns {array} Transformed images array
 */
const transformProductImages = (images, productName) => {
  return (images || []).map((image, index) => ({
    url: ensureHttpsUrl(image.url),
    altText: image.label || productName || '',
    type: index === 0 ? 'image' : 'thumbnail',
  }));
};

/**
 * Transform product attributes with proper labels
 * @param {array} attributes - Array of attribute objects from Adobe services
 * @returns {array} Transformed attributes array
 */
const transformProductAttributes = (attributes) => {
  return (attributes || []).map((attr) => ({
    key: attr.name || '',
    label: attr.label || attr.name || '',
    value: attr.value || '',
    type: 'text',
  }));
};

/**
 * Transform configurable options for variant selection
 * @param {array} options - Array of configurable options from Adobe services
 * @returns {array} Transformed configurable options
 */
const transformConfigurableOptions = (options) => {
  return (options || []).map((option) => ({
    label: option.title || option.label || '',
    attribute_code: option.id || '',
    values: (option.values || []).map((value) => ({
      label: value.title || value.label || '',
      value: value.value || '',
      swatch_data: value.swatch_data
        ? {
            type: value.swatch_data.type || 'color',
            value: value.swatch_data.value || value.value || '',
          }
        : null,
    })),
  }));
};

/**
 * Transform Commerce GraphQL variants with proper attribute mapping
 * @param {array} commerceVariants - Variants from Commerce GraphQL
 * @param {array} configurable_options - Configurable options for attribute mapping
 * @returns {array} Transformed variants array
 */
const transformProductVariants = (commerceVariants, configurable_options) => {
  return commerceVariants.map((variant) => {
    const variantProduct = variant.product;
    const variantRegularPrice = variantProduct?.price_range?.minimum_price?.regular_price?.value;
    const variantFinalPrice =
      variantProduct?.price_range?.minimum_price?.final_price?.value || variantRegularPrice;

    // Build attributes object from variant attributes
    // Map Commerce GraphQL labels back to configurable option values (especially for colors)
    const attributes = {};
    if (variant.attributes && Array.isArray(variant.attributes)) {
      variant.attributes.forEach((attr) => {
        if (attr.code && attr.label) {
          // For color attributes, map the label back to the hex value
          if (attr.code === 'cs_color') {
            // Find the matching configurable option value
            const colorOption = configurable_options.find(
              (opt) => opt.attribute_code === 'cs_color'
            );
            const colorValue = colorOption?.values.find((val) => val.label === attr.label);
            attributes[attr.code] = colorValue?.value || attr.label;
          } else {
            // For other attributes (like memory), use the label as-is
            attributes[attr.code] = attr.label;
          }
        }
      });
    }

    return {
      id: variantProduct?.sku || '',
      sku: variantProduct?.sku || '',
      attributes,
      price: formatPrice(variantFinalPrice),
      originalPrice:
        variantRegularPrice && variantFinalPrice && variantRegularPrice > variantFinalPrice
          ? formatPrice(variantRegularPrice)
          : null,
      inStock: variantProduct?.stock_status === 'IN_STOCK',
      stockLevel: null, // Not available in Commerce GraphQL
      image: variantProduct?.image
        ? {
            url: ensureHttpsUrl(variantProduct.image.url),
            altText: variantProduct.image.label || `${variantProduct.sku} variant`,
          }
        : null,
    };
  });
};

/**
 * Generate dynamic breadcrumbs based on product attributes
 * @param {array} attributes - Transformed product attributes
 * @param {object} productData - Product data for fallback values
 * @returns {object} Breadcrumbs structure
 */
const generateProductBreadcrumbs = (attributes, productData) => {
  let categoryName = 'Products';
  let categoryPath = '/products';

  if (attributes && attributes.length > 0) {
    const productFamily = attributes.find((attr) => attr.key === 'cs_product_family');
    if (productFamily && productFamily.value) {
      categoryName = productFamily.value;
      categoryPath = `/${categoryName.toLowerCase()}`;
    }
  }

  return {
    items: [
      { name: categoryName, urlPath: categoryPath },
      { name: productData.name || '', urlPath: `/products/${productData.urlKey}` },
    ],
  };
};

// Export for build script to process
module.exports = {
  transformProductToCard,
  transformLiveSearchProducts,
  transformCatalogProducts,
  transformProductDetail,
  createEmptyProductCard,
  mergeProducts,
  extractProductPricing,
  transformProductImages,
  transformProductAttributes,
  transformConfigurableOptions,
  transformProductVariants,
  generateProductBreadcrumbs,
};
