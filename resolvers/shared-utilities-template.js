/**
 * SHARED UTILITIES TEMPLATE
 *
 * This file contains the standard implementations of all common utility functions
 * used across resolvers. Due to API Mesh limitations, these functions must be
 * copied inline into each resolver that needs them.
 *
 * IMPORTANT: When updating utilities here, remember to update them in all
 * resolvers that use them. The build script handles injecting facet mappings,
 * but these utilities must be manually copied.
 *
 * Usage:
 * 1. Copy the functions you need from this template
 * 2. Paste them into your resolver's utility section
 * 3. Keep implementations consistent across all resolvers
 */

// ============================================================================
// FILTER UTILITIES
// ============================================================================

/**
 * Normalize filter values for case-insensitive matching
 * Capitalizes first letter to match how brand names are typically stored
 * Examples: "apple" -> "Apple", "APPLE" -> "Apple", "Apple" -> "Apple"
 */
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

// ============================================================================
// PRICE UTILITIES
// ============================================================================

/**
 * Format price for display
 * Always returns a string for non-nullable price fields
 * Includes currency symbol and thousand separators
 */
const formatPrice = (amount) => {
  // Always return a string for non-nullable price field
  if (!amount && amount !== 0) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Calculate discount percentage from regular and final prices
 * Returns null if no discount or invalid prices
 */
const calculateDiscountPercent = (regularPrice, finalPrice) => {
  if (!regularPrice || !finalPrice || finalPrice >= regularPrice) return null;
  return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
};

/**
 * Extract price value from complex price objects
 * Handles both Live Search and Catalog Service formats
 */
const extractPriceValue = (priceObj) => {
  if (!priceObj) return null;

  // Direct numeric value
  if (typeof priceObj === 'number') return priceObj;

  // Live Search format: { value: 123.45 }
  if (priceObj.value !== undefined) return priceObj.value;

  // Catalog format: { amount: { value: 123.45 } }
  if (priceObj.amount?.value !== undefined) return priceObj.amount.value;

  // Legacy formats
  if (priceObj.regular_price !== undefined) return priceObj.regular_price;
  if (priceObj.final_price !== undefined) return priceObj.final_price;

  return null;
};

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Ensure HTTPS protocol for URLs
 * Handles HTTP, protocol-relative, and relative URLs
 * This is the comprehensive version that should be used everywhere
 */
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  // Handle protocol-relative URLs (//domain.com)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Replace HTTP with HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  // Handle relative URLs (assuming they need full URL)
  if (!url.startsWith('http') && !url.startsWith('//')) {
    // This is a relative URL - you might want to prepend a base URL
    // For now, return as-is since we don't know the base URL
    return url;
  }

  return url;
};

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

/**
 * Extract the best available image URL from product data
 * Prioritizes high-quality images from productView
 */
const extractImageUrl = (product) => {
  // Live Search: productView.images array
  if (product.productView?.images?.length > 0) {
    return ensureHttpsUrl(product.productView.images[0].url);
  }

  // Catalog: images array directly on product
  if (product.images?.length > 0) {
    return ensureHttpsUrl(product.images[0].url);
  }

  // Fallback to small_image
  if (product.small_image?.url) {
    return ensureHttpsUrl(product.small_image.url);
  }

  // Legacy image field
  if (product.image?.url) {
    return ensureHttpsUrl(product.image.url);
  }

  return null;
};

// ============================================================================
// ATTRIBUTE EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract manufacturer from product attributes
 * Handles both Live Search and Catalog formats
 */
const extractManufacturer = (product) => {
  // Direct field
  if (product.manufacturer) return product.manufacturer;

  // From productView
  if (product.productView?.manufacturer) return product.productView.manufacturer;

  // From attributes array
  const manufacturerAttr = product.productView?.attributes?.find(
    (attr) => attr.name === 'manufacturer' || attr.name === 'cs_manufacturer'
  );
  if (manufacturerAttr?.value) return manufacturerAttr.value;

  return null;
};

/**
 * Extract variant options (memory, color, etc.) from product
 * Returns structured data for each variant type
 */
const extractVariantOptions = (options) => {
  if (!options || !Array.isArray(options)) return {};

  const variants = {
    memory: [],
    colors: [],
  };

  options.forEach((option) => {
    // Memory options
    if (option.id === 'cs_memory' || option.id === 'memory') {
      variants.memory = option.values || [];
    }

    // Color options with hex values
    if (option.id === 'cs_color' || option.id === 'color') {
      variants.colors = (option.values || []).map((color) => ({
        name: color,
        hex: getColorHex(color), // You'll need to implement color mapping
      }));
    }
  });

  return variants;
};

/**
 * Get hex color value for color name
 * This is a simplified version - expand as needed
 */
const getColorHex = (colorName) => {
  const colorMap = {
    black: '#000000',
    white: '#FFFFFF',
    silver: '#C0C0C0',
    gold: '#FFD700',
    'rose gold': '#B76E79',
    'space gray': '#4A4A4A',
    blue: '#0000FF',
    red: '#FF0000',
    green: '#00FF00',
    purple: '#800080',
    yellow: '#FFFF00',
    pink: '#FFC0CB',
    orange: '#FFA500',
  };

  return colorMap[colorName?.toLowerCase()] || '#808080'; // Default to gray
};

// ============================================================================
// STOCK UTILITIES
// ============================================================================

/**
 * Determine if product is in stock
 * Handles various stock status formats
 */
const isInStock = (product) => {
  // Direct in_stock field
  if (product.in_stock !== undefined) return product.in_stock;

  // From productView
  if (product.productView?.inStock !== undefined) return product.productView.inStock;

  // Stock status string
  if (product.stock_status) {
    return product.stock_status.toLowerCase() === 'in_stock';
  }

  // Default to true if no stock info (show product, let PDP handle stock)
  return true;
};

// ============================================================================
// EXPORT NOTE
// ============================================================================

/**
 * NOTE: This file is a template only. Functions must be copied inline
 * into resolvers due to API Mesh limitations. We cannot use module.exports
 * or imports in resolver files.
 *
 * The build script handles injecting facet mappings, but these utilities
 * must be manually maintained for consistency.
 */
