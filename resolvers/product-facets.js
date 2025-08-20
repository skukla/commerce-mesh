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
 *         category: "phones"
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
 *   filter: { category: "phones", manufacturer: "Apple" }
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
  
  // Category filter - Live Search uses 'categories'
  if (filter.category) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.category]
    });
  }
  
  // Manufacturer filter - needs cs_ prefix
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [filter.manufacturer]
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
  if (filter.category) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.category]
    });
  }
  
  // Same manufacturer handling
  if (filter.manufacturer) {
    catalogFilters.push({
      attribute: 'cs_manufacturer',
      in: [filter.manufacturer]
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
      type: facet.type || 'STANDARD',
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
      page_size: 1, // Even though we get facets and not products, we still need one page
      current_page: 1
    },
    context,
    selectionSet: `{
      aggregations {
        attribute
        title
        type
        buckets {
          title
          count
        }
      }
    }`
  });
  
  return transformFacets(result?.aggregations);
};

const executeCatalogFacets = async (context, args) => {
  const filters = buildCatalogFilters(args.filter);
  
  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: filters,
      page_size: 1, // Even though we get facets and not products, we still need one page
      current_page: 1,
      includeAggregations: true
    },
    context,
    selectionSet: `{
      facets {
        attribute
        title
        type
        buckets {
          title
          count
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