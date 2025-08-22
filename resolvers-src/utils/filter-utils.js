/**
 * FILTER UTILITIES
 *
 * Centralized filter transformation functions for converting between
 * frontend filter formats and Adobe service formats (Catalog Service, Live Search).
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 * The urlKeyToAttributeCode function is injected separately from facet mappings.
 */

/**
 * Normalize filter values for case-insensitive matching
 * Capitalizes first letter to match how brand names are typically stored
 * @param {string} value - Value to normalize
 * @returns {string} Normalized value
 */
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

/**
 * Build filters for Adobe Catalog Service
 * Converts frontend filter format to Catalog Service format
 * @param {object} filter - Frontend filter object with categoryUrlKey and facets
 * @returns {array} Array of Catalog Service filter objects
 */
const buildCatalogFilters = (filter) => {
  if (!filter) return [];

  const catalogFilters = [];

  // Category filter - Catalog uses 'categoryPath'
  if (filter.categoryUrlKey) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Skip empty values
      if (!value || (Array.isArray(value) && value.length === 0)) return;

      // Convert URL key back to Adobe attribute code (injected function)
      const attributeCode = urlKeyToAttributeCode(urlKey);

      // Special handling for price ranges
      if (attributeCode === 'price') {
        if (typeof value === 'string' && value.includes('-')) {
          const [min, max] = value.split('-').map((v) => parseFloat(v));
          catalogFilters.push({
            attribute: attributeCode,
            range: { from: min || 0, to: max || 999999 },
          });
        } else if (Array.isArray(value) && value.length > 0) {
          // Handle array of price ranges
          const [min, max] = value[0].split('-').map((v) => parseFloat(v));
          catalogFilters.push({
            attribute: attributeCode,
            range: { from: min || 0, to: max || 999999 },
          });
        }
      }
      // Special handling for manufacturer - normalize values
      else if (attributeCode === 'cs_manufacturer' || attributeCode === 'manufacturer') {
        const normalizedValue = Array.isArray(value)
          ? value.map((v) => normalizeFilterValue(v))
          : normalizeFilterValue(value);

        catalogFilters.push({
          attribute: attributeCode,
          in: Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue],
        });
      }
      // All other attributes
      else {
        catalogFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
      }
    });
  }

  return catalogFilters;
};

/**
 * Build filters for Adobe Live Search
 * Converts frontend filter format to Live Search format
 * @param {object} filter - Frontend filter object with categoryUrlKey and facets
 * @returns {array} Array of Live Search filter objects
 */
const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];

  const searchFilters = [];

  // Category filter - Live Search uses 'categories'
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Skip empty values
      if (!value || (Array.isArray(value) && value.length === 0)) return;

      // Convert URL key back to Adobe attribute code (injected function)
      const attributeCode = urlKeyToAttributeCode(urlKey);

      // Special handling for price ranges
      if (attributeCode === 'price') {
        if (typeof value === 'string' && value.includes('-')) {
          const [min, max] = value.split('-').map((v) => parseFloat(v));
          searchFilters.push({
            attribute: attributeCode,
            range: { from: min || 0, to: max || 999999 },
          });
        } else if (Array.isArray(value) && value.length > 0) {
          // Handle array of price ranges
          const [min, max] = value[0].split('-').map((v) => parseFloat(v));
          searchFilters.push({
            attribute: attributeCode,
            range: { from: min || 0, to: max || 999999 },
          });
        }
      }
      // Special handling for manufacturer - normalize values
      else if (attributeCode === 'cs_manufacturer' || attributeCode === 'manufacturer') {
        const normalizedValue = Array.isArray(value)
          ? value.map((v) => normalizeFilterValue(v))
          : normalizeFilterValue(value);

        searchFilters.push({
          attribute: attributeCode,
          in: Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue],
        });
      }
      // All other attributes
      else {
        searchFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
      }
    });
  }

  return searchFilters;
};

/**
 * Build filters for page-level queries (category pages)
 * Similar to regular filters but category comes from resolver parameter
 * @param {string} categoryUrlKey - Category URL key from resolver parameter
 * @param {object} pageFilter - Page filter object with facets only
 * @param {string} service - 'catalog' or 'search' to determine format
 * @returns {array} Array of filter objects
 */
const buildPageFilters = (categoryUrlKey, pageFilter, service = 'catalog') => {
  const filters = [];

  // Add category filter if provided
  if (categoryUrlKey) {
    filters.push({
      attribute: service === 'search' ? 'categories' : 'categoryPath',
      in: [categoryUrlKey],
    });
  }

  // Add remaining filters
  const additionalFilters =
    service === 'search'
      ? buildLiveSearchFilters(pageFilter || {})
      : buildCatalogFilters(pageFilter || {});

  // Filter out any duplicate category filters
  const nonCategoryFilters = additionalFilters.filter(
    (f) => f.attribute !== 'categories' && f.attribute !== 'categoryPath'
  );

  return [...filters, ...nonCategoryFilters];
};

/**
 * Map sort attribute to service-specific format
 * @param {string} attribute - Frontend sort attribute
 * @param {string} service - 'catalog' or 'search'
 * @returns {string} Mapped sort attribute
 */
const mapSortAttribute = (attribute, service) => {
  // Common mappings
  const sortMap = {
    PRICE: 'price',
    NAME: 'name',
    POSITION: 'position',
    RELEVANCE: 'relevance',
  };

  const mapped = sortMap[attribute] || attribute.toLowerCase();

  // Service-specific adjustments
  if (service === 'catalog' && mapped === 'relevance') {
    return 'position'; // Catalog doesn't have relevance, use position
  }

  return mapped;
};

/**
 * Build sort configuration for services
 * @param {object} sort - Frontend sort object with attribute and direction
 * @param {string} service - 'catalog' or 'search'
 * @returns {object} Service-specific sort configuration
 */
const buildSort = (sort, service = 'catalog') => {
  if (!sort) return null;

  return {
    attribute: mapSortAttribute(sort.attribute, service),
    direction: sort.direction || 'ASC',
  };
};

// Export for build script to process
module.exports = {
  normalizeFilterValue,
  buildCatalogFilters,
  buildLiveSearchFilters,
  buildPageFilters,
  mapSortAttribute,
  buildSort,
};
