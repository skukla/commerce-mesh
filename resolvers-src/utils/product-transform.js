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

  // Determine product type
  const isComplex = product.__typename === 'Catalog_ComplexProductView';

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

// Export for build script to process
module.exports = {
  transformProductToCard,
  transformLiveSearchProducts,
  transformCatalogProducts,
  transformProductDetail,
  createEmptyProductCard,
  mergeProducts,
};
