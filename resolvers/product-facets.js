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
/**
 * Normalize filter values for case-insensitive matching
 * Capitalizes first letter to match how brand names are typically stored
 * Examples: "apple" -> "Apple", "APPLE" -> "Apple", "Apple" -> "Apple"
 */
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];
  
  const searchFilters = [];
  
  // Category filter - uses URL key like "phones"
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey]
    });
  }
  
  // Manufacturer filter - needs cs_ prefix
  // Normalize for case-insensitive matching ("apple" -> "Apple")
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [normalizeFilterValue(filter.manufacturer)]
    });
  }
  
  // Memory filter
  if (filter.memory) {
    searchFilters.push({
      attribute: 'cs_memory',
      in: Array.isArray(filter.memory) ? filter.memory : [filter.memory]
    });
  }
  
  // Color filter
  if (filter.colors && filter.colors.length > 0) {
    searchFilters.push({
      attribute: 'cs_color',
      in: filter.colors
    });
  }
  
  // Price range filter
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    searchFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999
      }
    });
  }
  
  return searchFilters;
};

const buildCatalogFilters = (filter) => {
  if (!filter) return [];
  
  const catalogFilters = [];
  
  // Catalog uses 'categoryPath' instead of 'categories'
  if (filter.categoryUrlKey) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.categoryUrlKey]
    });
  }
  
  // Same manufacturer handling with normalization
  if (filter.manufacturer) {
    catalogFilters.push({
      attribute: 'cs_manufacturer',
      in: [normalizeFilterValue(filter.manufacturer)]
    });
  }
  
  // Memory filter
  if (filter.memory) {
    catalogFilters.push({
      attribute: 'cs_memory',
      in: Array.isArray(filter.memory) ? filter.memory : [filter.memory]
    });
  }
  
  // Color filter
  if (filter.colors && filter.colors.length > 0) {
    catalogFilters.push({
      attribute: 'cs_color',
      in: filter.colors
    });
  }
  
  // Same price range
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    catalogFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999
      }
    });
  }
  
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
  
  return facets.map(facet => {
    // Clean technical attribute names (remove cs_ prefix)
    const cleanAttribute = facet.attribute?.startsWith('cs_') 
      ? facet.attribute.substring(3)
      : facet.attribute;
    
    // RESPECT ADMIN-CONFIGURED LABELS
    // Adobe Commerce admins can set custom labels for facets
    // We preserve their business decisions while cleaning technical details
    const title = facet.title || cleanAttribute;
    
    // Transform buckets to consistent format - map to 'options' for our schema
    const options = facet.buckets?.map(bucket => ({
      id: bucket.title,      // Use title as ID for now
      name: bucket.title,    // Display name
      count: bucket.count || 0
    })) || [];
    
    return {
      key: cleanAttribute,
      title: title,
      type: 'checkbox',  // All facets use checkbox for multi-select filtering
      options: options
    };
  }).filter(facet => facet.options.length > 0); // Remove empty facets
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
      current_page: 1
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
    }`
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
      current_page: 1
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
    }`
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
        resolve: async (root, args, context, info) => {
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
              facets: facets || []
            };
            
          } catch (error) {
            console.error('Product facets resolver error:', error);
            // Return empty facets on error (graceful degradation)
            return { facets: [] };
          }
        }
      }
    }
  }
};