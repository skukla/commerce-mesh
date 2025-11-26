/**
 * Product Facets Resolver
 * Returns filter options for product listings, transforming technical attributes
 * into UI-friendly facets. Uses Live Search for contextual facets when searching.
 */

// Filter building functions are injected at build time

// Choose the right facet source based on search context
const shouldUseLiveSearch = (args) => {
  // Use Live Search when searching (better contextual facets)
  return args.phrase && args.phrase.trim() !== '';
};

// transformFacets function is injected at build time

// Get facets from appropriate service

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
            context.logger.error(`Product facets error: ${error.message?.substring(0, 60)}`);
            // Return empty facets on error (graceful degradation)
            return { facets: [] };
          }
        },
      },
    },
  },
};
