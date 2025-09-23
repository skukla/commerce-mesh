/**
 * Product Search & Filter Resolver
 * Consolidates product search and facet queries into a single operation,
 * reducing network overhead and ensuring consistent filter context.
 */

// Note: cleanAttributeName functionality now replaced by attributeCodeToUrlKey() injected at build time

// normalizeFilterValue function is injected at build time

// formatPrice function is injected at build time

// calculateDiscountPercent function is injected at build time

// ensureHttpsUrl function is injected at build time

// extractPriceValue function is injected at build time

// findAttributeValue function is injected at build time

// extractVariantOptions function is injected at build time

// buildCatalogFilters function is injected at build time

// buildLiveSearchFilters function is injected at build time

// transformProductToCard function is injected at build time

// transformFacets function is injected at build time

// Sort mapping

const mapSortForCatalog = (sort) => {
  if (!sort) return null;
  if (sort.attribute === 'RELEVANCE') return null;

  const attributeMap = {
    PRICE: 'price',
    NAME: 'name',
  };

  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return null;

  return {
    attribute: fieldName,
    direction: sort.direction || 'DESC',
  };
};

const mapSortForLiveSearch = (sort) => {
  if (!sort) return [];

  const attributeMap = {
    PRICE: 'price',
    NAME: 'name',
    RELEVANCE: 'relevance',
  };

  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return [];

  return [
    {
      attribute: fieldName,
      direction: sort.direction || 'DESC',
    },
  ];
};

// Execute consolidated query using Live Search (when searching)
const executeLiveSearchQuery = async (context, args) => {
  const filters = buildLiveSearchFilters(args.filter);

  // Single query that returns both products and facets
  const result = await context.LiveSearchSandbox.Query.Search_productSearch({
    root: {},
    args: {
      phrase: args.phrase || '',
      filter: filters,
      page_size: args.limit || 24,
      current_page: args.page || 1,
      sort: mapSortForLiveSearch(args.sort),
    },
    context,
    selectionSet: `{
      items {
        productView {
          __typename
          id name sku urlKey inStock
          images(roles: ["small_image"]) { url label }
          attributes { name value }
          ... on Search_SimpleProductView {
            price {
              regular { amount { value } }
              final { amount { value } }
            }
          }
          ... on Search_ComplexProductView {
            priceRange {
              minimum {
                regular { amount { value } }
                final { amount { value } }
              }
            }
            options {
              id
              title
              values {
                ... on Search_ProductViewOptionValueSwatch {
                  title
                  value
                }
              }
            }
          }
        }
      }
      total_count
      page_info { current_page page_size total_pages }
      facets {
        attribute
        title
        type
        buckets {
          ... on Search_ScalarBucket { title count }
          ... on Search_RangeBucket { title count }
        }
      }
    }`,
  });

  return {
    products:
      result?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [],
    facets: transformFacets(result?.facets || []),
    pageInfo: result?.page_info,
    totalCount: result?.total_count || 0,
  };
};

// Execute consolidated query using Catalog Service (when browsing/filtering)
const executeCatalogQuery = async (context, args) => {
  const filters = buildCatalogFilters(args.filter);

  // Single query that returns both products and facets
  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: filters,
      page_size: args.limit || 24,
      current_page: args.page || 1,
      sort: mapSortForCatalog(args.sort),
    },
    context,
    selectionSet: `{
      items {
        productView {
          __typename
          id name sku urlKey inStock
          images(roles: ["small_image"]) { url label }
          attributes { name value }
          ... on Catalog_SimpleProductView {
            price {
              regular { amount { value } }
              final { amount { value } }
            }
          }
          ... on Catalog_ComplexProductView {
            priceRange {
              minimum {
                regular { amount { value } }
                final { amount { value } }
              }
            }
            options {
              id
              title
              values {
                ... on Catalog_ProductViewOptionValueSwatch {
                  title value
                }
              }
            }
          }
        }
      }
      total_count
      page_info { current_page page_size total_pages }
      facets {
        attribute
        title
        type
        buckets {
          ... on Catalog_ScalarBucket { title count }
          ... on Catalog_RangeBucket { title count }
        }
      }
    }`,
  });

  return {
    products:
      result?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [],
    facets: transformFacets(result?.facets || []),
    pageInfo: result?.page_info,
    totalCount: result?.total_count || 0,
  };
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productSearchFilter: {
        resolve: async (_root, args, context, _info) => {
          try {
            // 1. Decide which service based on search intent
            const useSearch = args.phrase && args.phrase.trim() !== '';

            // 2. Execute single query that returns both products and facets
            const result = useSearch
              ? await executeLiveSearchQuery(context, args)
              : await executeCatalogQuery(context, args);

            // 3. Build consolidated response
            const currentPage = result.pageInfo?.current_page || args.page || 1;
            const totalPages = result.pageInfo?.total_pages || 1;

            return {
              // Products with pagination
              products: {
                items: result.products || [],
                totalCount: result.totalCount,
                hasMoreItems: currentPage < totalPages,
                currentPage: currentPage,
                page_info: {
                  current_page: currentPage,
                  page_size: result.pageInfo?.page_size || args.limit || 24,
                  total_pages: totalPages,
                },
              },

              // Facets for filtering
              facets: {
                facets: result.facets || [],
                totalCount: result.totalCount,
              },

              // Overall total for consistency
              totalCount: result.totalCount,
            };
          } catch (error) {
            console.error('Product search filter resolver error:', error);
            // Return empty structure on error
            return {
              products: {
                items: [],
                totalCount: 0,
                hasMoreItems: false,
                currentPage: 1,
                page_info: {
                  current_page: 1,
                  page_size: args.limit || 24,
                  total_pages: 0,
                },
              },
              facets: {
                facets: [],
                totalCount: 0,
              },
              totalCount: 0,
            };
          }
        },
      },
    },
  },
};
