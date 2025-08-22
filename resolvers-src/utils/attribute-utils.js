/**
 * ATTRIBUTE UTILITIES
 *
 * Centralized attribute extraction and manipulation functions for
 * consistent handling of product attributes across resolvers.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 * The attributeCodeToUrlKey function is injected separately from facet mappings.
 */

/**
 * Find attribute value by name
 * Checks both with and without cs_ prefix
 * @param {array} attributes - Array of attribute objects
 * @param {string} name - Attribute name to find
 * @returns {string|null} Attribute value or null
 */
const findAttributeValue = (attributes, name) => {
  if (!attributes || !Array.isArray(attributes)) return null;

  // Check exact match first
  let attr = attributes.find((a) => a.name === name);

  // Check with cs_ prefix
  if (!attr) {
    attr = attributes.find((a) => a.name === `cs_${name}`);
  }

  // Check without cs_ prefix
  if (!attr && name.startsWith('cs_')) {
    const nameWithoutPrefix = name.substring(3);
    attr = attributes.find((a) => a.name === nameWithoutPrefix);
  }

  return attr?.value || null;
};

/**
 * Extract multiple attribute values at once
 * @param {array} attributes - Array of attribute objects
 * @param {array} names - Array of attribute names to extract
 * @returns {object} Object with attribute names as keys and values
 */
const extractAttributes = (attributes, names) => {
  const result = {};

  if (!attributes || !names) return result;

  names.forEach((name) => {
    result[name] = findAttributeValue(attributes, name);
  });

  return result;
};

/**
 * Extract variant options from product options
 * Dynamically handles all cs_ prefixed options
 * @param {array} options - Product options array
 * @returns {object} Variant options object
 */
const extractVariantOptions = (options) => {
  const variantOptions = {};

  if (!options || !Array.isArray(options)) {
    return variantOptions;
  }

  options.forEach((option) => {
    if (!option.id) return;

    // Clean the option name using helper (will be injected)
    const cleanOptionName = option.id.startsWith('cs_')
      ? attributeCodeToUrlKey(option.id)
      : option.id;

    // Special handling for color options (include hex values)
    if (cleanOptionName === 'color' && option.values) {
      variantOptions.colors = option.values.map((v) => ({
        name: v.title || v.value,
        hex: v.value || getColorHex(v.title) || '#000000',
      }));
    }
    // Standard handling for other options (memory, storage, size, etc.)
    else if (option.values) {
      // Use the clean name as the key
      variantOptions[cleanOptionName] = option.values.map((v) => v.title || v.value);
    }
  });

  return variantOptions;
};

/**
 * Get hex color value for color name
 * @param {string} colorName - Name of the color
 * @returns {string} Hex color code
 */
const getColorHex = (colorName) => {
  if (!colorName) return '#808080';

  const colorMap = {
    // Basic colors
    black: '#000000',
    white: '#FFFFFF',
    red: '#FF0000',
    green: '#008000',
    blue: '#0000FF',
    yellow: '#FFFF00',
    orange: '#FFA500',
    purple: '#800080',
    pink: '#FFC0CB',
    brown: '#A52A2A',
    gray: '#808080',
    grey: '#808080',

    // Metal colors
    silver: '#C0C0C0',
    gold: '#FFD700',
    'rose gold': '#B76E79',
    bronze: '#CD7F32',
    copper: '#B87333',

    // Tech colors
    'space gray': '#4A4A4A',
    'space grey': '#4A4A4A',
    midnight: '#003366',
    graphite: '#41424C',
    starlight: '#F9F6EF',

    // Nature colors
    navy: '#000080',
    teal: '#008080',
    turquoise: '#40E0D0',
    coral: '#FF7F50',
    lavender: '#E6E6FA',
    mint: '#98FF98',
    cream: '#FFFDD0',
    beige: '#F5F5DC',
  };

  return colorMap[colorName.toLowerCase()] || '#808080'; // Default to gray
};

/**
 * Ensure URL uses HTTPS protocol
 * Handles HTTP, protocol-relative, and relative URLs
 * @param {string} url - URL to process
 * @returns {string} HTTPS URL
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

  // Already HTTPS or relative URL
  return url;
};

/**
 * Check if product is in stock
 * Handles various stock status formats
 * @param {object} product - Product object
 * @returns {boolean} Stock status
 */
const isInStock = (product) => {
  // Direct inStock field
  if (product.inStock !== undefined) return product.inStock;

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

/**
 * Extract manufacturer from product
 * Handles various locations where manufacturer might be stored
 * @param {object} product - Product object
 * @returns {string|null} Manufacturer name
 */
const extractManufacturer = (product) => {
  // Direct field
  if (product.manufacturer) return product.manufacturer;

  // From productView
  if (product.productView?.manufacturer) return product.productView.manufacturer;

  // From attributes array
  const fromAttributes = findAttributeValue(
    product.attributes || product.productView?.attributes,
    'manufacturer'
  );

  return fromAttributes || null;
};

/**
 * Extract SKU from product
 * Handles various product structures
 * @param {object} product - Product object
 * @returns {string} Product SKU
 */
const extractSku = (product) => {
  return product.sku || product.productView?.sku || product.product?.sku || '';
};

/**
 * Extract product name
 * Handles various product structures
 * @param {object} product - Product object
 * @returns {string} Product name
 */
const extractName = (product) => {
  return product.name || product.productView?.name || product.product?.name || '';
};

/**
 * Extract URL key for product
 * Handles various product structures
 * @param {object} product - Product object
 * @returns {string} Product URL key
 */
const extractUrlKey = (product) => {
  return (
    product.urlKey ||
    product.url_key ||
    product.productView?.urlKey ||
    product.productView?.url_key ||
    product.product?.urlKey ||
    product.product?.url_key ||
    ''
  );
};

/**
 * Transform attributes array to object
 * Converts from [{name: 'color', value: 'red'}] to {color: 'red'}
 * @param {array} attributes - Array of attribute objects
 * @returns {object} Attributes as key-value pairs
 */
const attributesToObject = (attributes) => {
  if (!attributes || !Array.isArray(attributes)) return {};

  return attributes.reduce((acc, attr) => {
    if (attr.name) {
      // Use URL key for consistency
      const key = attr.name.startsWith('cs_') ? attributeCodeToUrlKey(attr.name) : attr.name;
      acc[key] = attr.value;
    }
    return acc;
  }, {});
};

// Export for build script to process
module.exports = {
  findAttributeValue,
  extractAttributes,
  extractVariantOptions,
  getColorHex,
  ensureHttpsUrl,
  isInStock,
  extractManufacturer,
  extractSku,
  extractName,
  extractUrlKey,
  attributesToObject,
};
