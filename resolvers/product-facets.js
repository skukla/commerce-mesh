/**
 * Citisignal_productFacets Resolver
 * 
 * Returns available filter options (facets) for product listings.
 * Separate from product cards to follow single responsibility principle.
 * 
 * SERVICE SELECTION:
 * - With search text: Use Live Search for AI-aware facets
 * - Without search: Use Catalog Service for category facets
 */

// ============================================================================
// SECTION 1: FILTER BUILDERS
// ============================================================================

const DEFAULT_MAX_PRICE = 999999;
const DEFAULT_MIN_PRICE = 0;


const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];
  
  const searchFilters = [];
  
  if (filter.category) {
    searchFilters.push({
      attribute: 'categories',  // Live Search uses 'categories'
      in: [filter.category]
    });
  }
  
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [filter.manufacturer]
    });
  }
  
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    searchFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || DEFAULT_MIN_PRICE,
        to: filter.priceMax || DEFAULT_MAX_PRICE
      }
    });
  }
  
  return searchFilters;
};

// ============================================================================
// SECTION 2: FACET TRANSFORMATION
// ============================================================================

const cleanAttributeName = (name) => {
  if (!name) return '';
  // Remove cs_ prefix if present
  return name.startsWith('cs_') ? name.substring(3) : name;
};

const getFacetTitle = (attribute, label) => {
  const cleanAttr = cleanAttributeName(attribute);
  if (label) return label;
  
  const titleMap = {
    'manufacturer': 'Manufacturer',
    'memory': 'Memory',
    'color': 'Color',
    'price': 'Price',
    'categoryPath': 'Category'
  };
  
  return titleMap[cleanAttr] || cleanAttr;
};


// ============================================================================
// SECTION 3: SERVICE SELECTION
// ============================================================================

// Always use Live Search for facets since Catalog doesn't support them
const shouldUseLiveSearch = () => true;

// ============================================================================
// SECTION 4: GRAPHQL QUERY
// ============================================================================

// Live Search uses 'facets' with different structure
const LIVE_SEARCH_FACETS_QUERY = `{
  facets {
    attribute
    title
    buckets {
      ... on Search_ScalarBucket {
        title
        count
      }
    }
  }
  total_count
}`;


// ============================================================================
// SECTION 5: MAIN RESOLVER
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productFacets: {
        resolve: async (root, args, context, info) => {
          try {
            // Always use Live Search since Catalog doesn't support facets
            const filters = buildLiveSearchFilters(args.filter);
            const result = await context.LiveSearchSandbox.Query.Search_productSearch({
              root: {},
              args: {
                phrase: args.phrase || '',
                filter: filters,
                page_size: 1,
                current_page: 1
              },
              context,
              selectionSet: LIVE_SEARCH_FACETS_QUERY
            });
            
            // Transform Live Search facets to our format
            const facets = result?.facets?.map(facet => {
              const cleanAttr = cleanAttributeName(facet.attribute);
              
              const options = facet.buckets?.map(bucket => ({
                id: bucket.title,
                name: bucket.title,
                count: bucket.count || 0
              })) || [];
              
              return {
                title: facet.title || getFacetTitle(facet.attribute, null),
                key: cleanAttr,
                type: 'checkbox',
                options: options.filter(opt => opt.count > 0)
              };
            }).filter(facet => facet.options.length > 0) || [];
            
            return {
              facets,
              totalCount: result?.total_count || 0
            };
          } catch (error) {
            throw error;
          }
        }
      }
    }
  }
};