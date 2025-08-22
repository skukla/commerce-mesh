/**
 * FACET TRANSFORMATION UTILITIES
 *
 * Centralized facet transformation functions for converting Adobe's
 * facet structures into frontend-ready filter options.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 * The attributeCodeToUrlKey function is injected separately from facet mappings.
 */

/**
 * Transform a single facet from Adobe format to frontend format
 * @param {object} facet - Adobe facet object
 * @returns {object} Transformed facet
 */
const transformFacet = (facet) => {
  if (!facet) return null;

  const originalAttribute = facet.attribute;
  // Get SEO-friendly URL key using injected mapping function
  const urlKey = attributeCodeToUrlKey(facet.attribute);

  // Use the title from Adobe if provided, otherwise use URL key
  const title = facet.title || urlKey;

  // Determine facet type for UI rendering
  const facetType = determineFacetType(urlKey, facet);

  return {
    key: urlKey,
    attributeCode: originalAttribute, // Preserve original Adobe attribute code
    title: title,
    type: facetType,
    options: transformFacetOptions(facet.buckets || [], urlKey),
  };
};

/**
 * Transform multiple facets and filter out empty ones
 * @param {array} facets - Array of Adobe facet objects
 * @returns {array} Array of transformed facets
 */
const transformFacets = (facets) => {
  if (!facets || !Array.isArray(facets)) return [];

  return facets.map(transformFacet).filter((facet) => facet && facet.options.length > 0);
};

/**
 * Transform facet options (buckets) into frontend format
 * @param {array} buckets - Array of facet buckets
 * @param {string} urlKey - The facet's URL key for special formatting
 * @returns {array} Array of transformed options
 */
const transformFacetOptions = (buckets, urlKey) => {
  if (!buckets || !Array.isArray(buckets)) return [];

  return buckets.map((bucket) => {
    // Special formatting for price facets
    if (urlKey === 'price' && bucket.title) {
      return transformPriceOption(bucket);
    }

    // Default handling for non-price facets
    return {
      id: bucket.title || bucket.value || '',
      name: bucket.title || bucket.value || '',
      count: bucket.count || 0,
      value: bucket.value || bucket.title, // Value to use in filters
    };
  });
};

/**
 * Transform price facet option with currency formatting
 * @param {object} bucket - Price bucket
 * @returns {object} Transformed price option
 */
const transformPriceOption = (bucket) => {
  // Parse price range (e.g., "300.0-400.0" or "300-400")
  const match = bucket.title.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);

  if (match) {
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);

    // Format with currency and thousands separator
    const formattedMin = formatPrice(min);
    const formattedMax = formatPrice(max);

    return {
      id: bucket.title, // Keep original as ID for filtering
      name: `${formattedMin} - ${formattedMax}`, // Formatted for display
      count: bucket.count || 0,
      value: bucket.title, // Original value for filters
      min: min, // Numeric values for range sliders
      max: max,
    };
  }

  // Fallback for non-standard price formats
  return {
    id: bucket.title,
    name: bucket.title,
    count: bucket.count || 0,
    value: bucket.title,
  };
};

/**
 * Determine the UI type for a facet
 * @param {string} urlKey - The facet's URL key
 * @param {object} facet - The facet object
 * @returns {string} UI type ('radio', 'checkbox', 'range', etc.)
 */
const determineFacetType = (urlKey, facet) => {
  // Price should be single-select (radio) or range
  if (urlKey === 'price') {
    return facet.type === 'RANGE' ? 'range' : 'radio';
  }

  // Rating is typically single-select
  if (urlKey === 'rating' || urlKey === 'customer-rating') {
    return 'radio';
  }

  // Most facets are multi-select
  return 'checkbox';
};

/**
 * Sort facets by importance/relevance
 * @param {array} facets - Array of transformed facets
 * @returns {array} Sorted array of facets
 */
const sortFacets = (facets) => {
  if (!facets || !Array.isArray(facets)) return [];

  // Define priority order for common facets
  const priority = {
    price: 1,
    manufacturer: 2,
    brand: 2,
    category: 3,
    color: 4,
    size: 5,
    memory: 6,
    storage: 6,
    rating: 7,
    'customer-rating': 7,
  };

  return facets.sort((a, b) => {
    const aPriority = priority[a.key] || 999;
    const bPriority = priority[b.key] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Secondary sort by title
    return a.title.localeCompare(b.title);
  });
};

/**
 * Get active filter values from facets
 * Useful for showing currently applied filters
 * @param {object} filter - Current filter object
 * @param {array} facets - Available facets
 * @returns {array} Array of active filter objects
 */
const getActiveFilters = (filter, facets) => {
  const active = [];

  if (!filter || !filter.facets) return active;

  Object.entries(filter.facets).forEach(([urlKey, value]) => {
    // Find the corresponding facet
    const facet = facets.find((f) => f.key === urlKey);
    if (!facet) return;

    // Handle different value types
    if (Array.isArray(value)) {
      value.forEach((v) => {
        const option = facet.options.find((o) => o.value === v);
        if (option) {
          active.push({
            facetKey: urlKey,
            facetTitle: facet.title,
            value: v,
            label: option.name,
          });
        }
      });
    } else if (value) {
      const option = facet.options.find((o) => o.value === value);
      active.push({
        facetKey: urlKey,
        facetTitle: facet.title,
        value: value,
        label: option ? option.name : value,
      });
    }
  });

  return active;
};

/**
 * Create facet aggregation query parameters
 * Used when we need to fetch facets without products
 * @param {object} filter - Current filter to get contextual facets
 * @returns {object} Query parameters for facet aggregation
 */
const createFacetQueryParams = (filter) => {
  return {
    // Use page_size: 1 since aggregations cover all results
    page_size: 1,
    current_page: 1,
    // Include filters for contextual facets
    filter: filter || {},
  };
};

// Export for build script to process
module.exports = {
  transformFacet,
  transformFacets,
  transformFacetOptions,
  transformPriceOption,
  determineFacetType,
  sortFacets,
  getActiveFilters,
  createFacetQueryParams,
};
