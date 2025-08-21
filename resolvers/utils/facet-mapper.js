/**
 * FACET MAPPING UTILITIES
 *
 * Centralizes the logic for mapping between:
 * - Adobe attribute codes (what Adobe uses)
 * - URL keys (what appears in URLs for SEO)
 *
 * This keeps all resolvers consistent and maintainable.
 */

const mappingConfig = require('../../config/facet-mappings.json');

/**
 * Convert an Adobe attribute code to a SEO-friendly URL key
 * Examples:
 * - cs_manufacturer -> manufacturer (explicit mapping)
 * - cs_new_feature -> new-feature (auto-cleaned)
 */
function getUrlKey(attributeCode) {
  // Check for explicit mapping first
  if (mappingConfig.mappings[attributeCode]) {
    return mappingConfig.mappings[attributeCode];
  }

  // Apply default transformation rules
  let urlKey = attributeCode;

  // Remove common prefixes
  mappingConfig.defaults.removePrefix.forEach((prefix) => {
    if (urlKey.startsWith(prefix)) {
      urlKey = urlKey.substring(prefix.length);
    }
  });

  // Replace underscores with hyphens for URL friendliness
  if (mappingConfig.defaults.replaceUnderscore) {
    urlKey = urlKey.replace(/_/g, '-');
  }

  // Convert to lowercase for consistency
  if (mappingConfig.defaults.toLowerCase) {
    urlKey = urlKey.toLowerCase();
  }

  return urlKey;
}

/**
 * Convert a URL key back to an Adobe attribute code
 * This is used when receiving filters from the frontend
 * Examples:
 * - manufacturer -> cs_manufacturer
 * - storage -> cs_memory
 */
function getAttributeCode(urlKey) {
  // Look through mappings to find the attribute code
  for (const [attributeCode, mappedKey] of Object.entries(mappingConfig.mappings)) {
    if (mappedKey === urlKey) {
      return attributeCode;
    }
  }

  // If no explicit mapping, try to reverse engineer
  // This is a best guess for dynamic attributes
  // Note: This won't be perfect for auto-generated keys

  // Convert hyphens back to underscores
  const withUnderscores = urlKey.replace(/-/g, '_');

  // Check if any common pattern exists in Adobe
  // This would typically check against actual facets from Adobe
  // For now, return as-is (the mesh will handle unmapped gracefully)
  return withUnderscores;
}

/**
 * Transform a filters object from URL keys to attribute codes
 * Used when receiving filter parameters from the frontend
 *
 * Input:  { manufacturer: "Apple", storage: "256GB" }
 * Output: { cs_manufacturer: "Apple", cs_memory: "256GB" }
 */
function mapUrlFiltersToAttributeCodes(urlFilters) {
  if (!urlFilters || typeof urlFilters !== 'object') {
    return {};
  }

  const mappedFilters = {};

  Object.entries(urlFilters).forEach(([urlKey, value]) => {
    const attributeCode = getAttributeCode(urlKey);
    mappedFilters[attributeCode] = value;
  });

  return mappedFilters;
}

/**
 * Transform facets from Adobe format to frontend format
 * Adds the URL key while preserving Adobe's data
 */
function transformFacet(facet) {
  const urlKey = getUrlKey(facet.attribute);

  return {
    title: facet.title || urlKey, // Use Adobe's title, fallback to key
    key: urlKey, // SEO-friendly URL key
    attributeCode: facet.attribute, // Original Adobe attribute code
    type: facet.type === 'SCALAR' ? 'checkbox' : 'radio', // Map Adobe types
    options:
      facet.buckets?.map((bucket) => ({
        id: bucket.title,
        name: bucket.title,
        count: bucket.count || 0,
      })) || [],
  };
}

module.exports = {
  getUrlKey,
  getAttributeCode,
  mapUrlFiltersToAttributeCodes,
  transformFacet,
};
