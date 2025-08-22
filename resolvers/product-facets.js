/**
 * CITISIGNAL PRODUCT FACETS - CUSTOM FILTER OPTIONS QUERY
 *
 * This resolver demonstrates transforming Adobe's complex facet structures
 * into simple, business-friendly filter options for product listings.
 *
 * What Adobe gives us: Technical attribute names, nested bucket structures
 * What we deliver: Clean filter options ready for UI components
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The filter API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_productFacets
 *
 * INPUT:
 *   query {
 *     Citisignal_productFacets(
 *       phrase: "phone"          // Optional search term
 *       filter: {                // Current applied filters
 *         categoryUrlKey: "phones"
 *         manufacturer: "Apple"
 *       }
 *     )
 *   }
 *
 * OUTPUT - Our custom facet structure:
 *   {
 *     facets: [{
 *       // Clean, UI-ready filter group
 *       attribute: "manufacturer"    // Cleaned from "cs_manufacturer"
 *       title: "Brand"              // Preserved from admin configuration
 *       type: "PINNED"              // Indicates importance
 *       buckets: [{
 *         title: "Apple"            // Display name
 *         value: "Apple"            // Filter value
 *         count: 42                 // Products matching
 *       }]
 *     }]
 *   }
 *
 * Note: Facets are contextual - they update based on applied filters
 * Example: Filter by "Apple" → Memory facet shows only Apple phone memory options
 */

// ============================================================================
// HELPER FUNCTIONS - Shared utilities (copied due to mesh limitations)
// ============================================================================

// ============================================================================
// FILTER TRANSFORMATION - Business filters to Adobe format
// ============================================================================

/**
 * Transform our custom filters to service-specific formats
 *
 * OUR FILTER FORMAT:
 *   filter: { categoryUrlKey: "phones", manufacturer: "Apple" }
 *
 * ADOBE'S REQUIRED FORMAT:
 *   filter: [
 *     { attribute: "categories", in: ["phones"] },      // Live Search
 *     { attribute: "cs_manufacturer", in: ["Apple"] }   // With prefix
 *   ]
 */

const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];

  const searchFilters = [];

  // Category filter - uses URL key like "phones"
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Convert URL key back to Adobe attribute code
      const attributeCode = urlKeyToAttributeCode(urlKey);

      if (attributeCode === 'price' && Array.isArray(value) && value.length > 0) {
        // Special handling for price ranges
        const [min, max] = value[0].split('-').map(parseFloat);
        searchFilters.push({
          attribute: attributeCode,
          range: { from: min || 0, to: max || 999999 },
        });
      } else if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        // All other attributes use 'in' filter
        searchFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
      }
    });
  }

  // Legacy filters removed - all filtering now goes through dynamic facets

  return searchFilters;
};

const buildCatalogFilters = (filter) => {
  if (!filter) return [];

  const catalogFilters = [];

  // Catalog uses 'categoryPath' instead of 'categories'
  if (filter.categoryUrlKey) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Convert URL key back to Adobe attribute code
      const attributeCode = urlKeyToAttributeCode(urlKey);

      if (attributeCode === 'price' && Array.isArray(value) && value.length > 0) {
        const [min, max] = value[0].split('-').map(parseFloat);
        catalogFilters.push({
          attribute: attributeCode,
          range: { from: min || 0, to: max || 999999 },
        });
      } else if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        catalogFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
      }
    });
  }

  // Legacy filters removed - all filtering now goes through dynamic facets

  return catalogFilters;
};

// ============================================================================
// SERVICE ORCHESTRATION - Choose the right facet source
// ============================================================================

/**
 * Business logic: Which service provides better facets?
 * - Live Search: Dynamic, contextual facets that update with search
 * - Catalog Service: Static category facets
 */
const shouldUseLiveSearch = (args) => {
  // Use Live Search when searching (better contextual facets)
  return args.phrase && args.phrase.trim() !== '';
};

// ============================================================================
// FACET TRANSFORMATION - Complex structure to simple filters
// ============================================================================

/**
 * Transform Adobe's complex facet structure to our clean format
 *
 * ADOBE'S FORMAT (Live Search):
 * {
 *   aggregations: [{
 *     attribute: "cs_manufacturer",
 *     title: "Brand",              // Admin-configured label
 *     buckets: [{
 *       title: "Apple",
 *       __typename: "ScalarBucket",
 *       count: 42
 *     }]
 *   }]
 * }
 *
 * OUR CLEAN FORMAT:
 * {
 *   facets: [{
 *     attribute: "manufacturer",    // Technical prefix removed
 *     title: "Brand",               // Preserved from admin config
 *     buckets: [{
 *       title: "Apple",
 *       value: "Apple",
 *       count: 42
 *     }]
 *   }]
 * }
 */
const transformFacets = (facets) => {
  if (!facets || !Array.isArray(facets)) return [];

  return facets
    .map((facet) => {
      // Preserve the original attribute code for filtering
      const originalAttribute = facet.attribute; // e.g., "cs_manufacturer", "manufacturer", "custom_field"

      // Get SEO-friendly URL key using injected mapping function
      const urlKey = attributeCodeToUrlKey(facet.attribute);

      // RESPECT ADMIN-CONFIGURED LABELS
      // Adobe Commerce admins can set custom labels for facets
      // We preserve their business decisions while cleaning technical details
      const title = facet.title || urlKey;

      // Transform buckets to consistent format - map to 'options' for our schema
      const options =
        facet.buckets?.map((bucket) => {
          // For price facets, format the display name
          if (facet.attribute === 'price' && bucket.title) {
            // Parse price range (e.g., "300.0-400.0")
            const match = bucket.title.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
            if (match) {
              const min = parseFloat(match[1]);
              const max = parseFloat(match[2]);

              // Format with currency and thousands separator
              const formattedMin = '$' + min.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              const formattedMax = '$' + max.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

              return {
                id: bucket.title, // Keep original as ID for filtering
                name: formattedMin + ' - ' + formattedMax, // Formatted for display
                count: bucket.count || 0,
              };
            }
          }

          // Default handling for non-price facets
          return {
            id: bucket.title, // Keep original for value
            name: bucket.title, // Display name
            count: bucket.count || 0,
          };
        }) || [];

      return {
        key: urlKey, // SEO-friendly URL key for frontend
        attributeCode: originalAttribute, // Actual code for filtering (preserves exact Adobe attribute)
        title: title,
        type: facet.attribute === 'price' ? 'radio' : 'checkbox', // Price uses radio, others use checkbox
        options: options,
      };
    })
    .filter((facet) => facet.options.length > 0); // Remove empty facets
};

// ============================================================================
// QUERY EXECUTION - Get facets from appropriate service
// ============================================================================

const executeLiveSearchFacets = async (context, args) => {
  const filters = buildLiveSearchFilters(args.filter);

  const result = await context.LiveSearchSandbox.Query.Search_productSearch({
    root: {},
    args: {
      phrase: args.phrase || '',
      filter: filters,
      page_size: 1, // Facet counts represent all matching products, not just current page
      current_page: 1,
    },
    context,
    selectionSet: `{
      facets {
        attribute
        title
        type
        buckets {
          ... on Search_ScalarBucket {
            title
            count
          }
          ... on Search_RangeBucket {
            title
            count
          }
        }
      }
    }`,
  });

  return transformFacets(result?.facets);
};

const executeCatalogFacets = async (context, args) => {
  const filters = buildCatalogFilters(args.filter);

  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: filters,
      page_size: 1, // Facet counts represent all matching products, not just current page
      current_page: 1,
    },
    context,
    selectionSet: `{
      facets {
        attribute
        title
        type
        buckets {
          ... on Catalog_ScalarBucket {
            title
            count
          }
          ... on Catalog_RangeBucket {
            title
            count
          }
        }
      }
    }`,
  });

  return transformFacets(result?.facets);
};

// ============================================================================
// MAIN RESOLVER - Orchestrates facet retrieval
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productFacets: {
        resolve: async (_root, args, context, _info) => {
          try {
            // 1. Decide which service to use based on context
            const useSearch = shouldUseLiveSearch(args);

            // 2. Get facets from appropriate service
            const facets = useSearch
              ? await executeLiveSearchFacets(context, args)
              : await executeCatalogFacets(context, args);

            // 3. Return our clean facet structure
            // Notice: No complex nesting, just simple filter options
            return {
              facets: facets || [],
            };
          } catch (error) {
            console.error('Product facets resolver error:', error);
            // Return empty facets on error (graceful degradation)
            return { facets: [] };
          }
        },
      },
    },
  },
};
