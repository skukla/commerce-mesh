/**
 * PRICE UTILITIES
 *
 * Centralized price-related functions for consistent price handling across all resolvers.
 * These functions handle price extraction, formatting, and discount calculations.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 */

/**
 * Format price for display with currency symbol and thousands separator
 * @param {number|null} amount - Price amount to format
 * @returns {string} Formatted price string (never null for non-nullable GraphQL fields)
 */
const formatPrice = (amount) => {
  // Always return a string for non-nullable price field
  if (!amount && amount !== 0) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Calculate discount percentage from regular and final prices
 * @param {number|null} regularPrice - Original price
 * @param {number|null} finalPrice - Sale price
 * @returns {number|null} Discount percentage or null if no discount
 */
const calculateDiscountPercent = (regularPrice, finalPrice) => {
  if (!regularPrice || !finalPrice || finalPrice >= regularPrice) return null;
  return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
};

/**
 * Extract price value from nested price structures
 * Handles both simple and complex product types
 * @param {object} product - Product object
 * @param {string} priceType - 'regular' or 'final'
 * @param {boolean} isComplex - Whether product is complex type
 * @returns {number|null} Extracted price value
 */
const extractPriceValue = (product, priceType, isComplex) => {
  if (!product) return null;

  if (isComplex) {
    return priceType === 'regular'
      ? product.priceRange?.minimum?.regular?.amount?.value
      : product.priceRange?.minimum?.final?.amount?.value;
  }

  return priceType === 'regular'
    ? product.price?.regular?.amount?.value
    : product.price?.final?.amount?.value;
};

/**
 * Extract price from various formats (Live Search, Catalog, legacy)
 * @param {object} priceObj - Price object in any format
 * @returns {number|null} Extracted price value
 */
const extractPriceFromAnyFormat = (priceObj) => {
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

/**
 * Determine if a product is on sale
 * @param {number|null} regularPrice - Original price
 * @param {number|null} finalPrice - Current price
 * @returns {boolean} True if product is on sale
 */
const isOnSale = (regularPrice, finalPrice) => {
  return regularPrice && finalPrice && finalPrice < regularPrice;
};

/**
 * Format price range for display
 * @param {number} minPrice - Minimum price in range
 * @param {number} maxPrice - Maximum price in range
 * @returns {string} Formatted price range
 */
const formatPriceRange = (minPrice, maxPrice) => {
  const formattedMin = formatPrice(minPrice);
  const formattedMax = formatPrice(maxPrice);

  // If prices are the same, show single price
  if (minPrice === maxPrice) {
    return formattedMin;
  }

  return `${formattedMin} - ${formattedMax}`;
};

/**
 * Parse price range string (e.g., "300-500") into min/max values
 * @param {string} rangeStr - Price range string
 * @returns {object} Object with from and to properties
 */
const parsePriceRange = (rangeStr) => {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { from: 0, to: 999999 };
  }

  const [min, max] = rangeStr.split('-').map((v) => parseFloat(v));
  return {
    from: min || 0,
    to: max || 999999,
  };
};

// Export for build script to process
module.exports = {
  formatPrice,
  calculateDiscountPercent,
  extractPriceValue,
  extractPriceFromAnyFormat,
  isOnSale,
  formatPriceRange,
  parsePriceRange,
};
