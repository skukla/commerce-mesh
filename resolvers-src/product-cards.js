/**
 * Product Cards Resolver
 * Returns simplified product data for listing pages, intelligently routing
 * to Live Search (for searches) or Catalog Service (for browsing).
 */

// Choose the right Adobe service based on user intent
const shouldUseLiveSearch = (args) => {
  // Use AI-powered Live Search when user is actively searching
  // Use Catalog Service for browsing (faster, no AI needed)
  return args.phrase && args.phrase.trim() !== '';
};

// Transform business-friendly sort to service-specific formats
const mapSortForCatalog = (sort) => {
  if (!sort) return null;

  // Catalog doesn't support AI relevance sorting
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
    RELEVANCE: 'relevance', // AI-powered sorting
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

// Parallel execution for search mode - combines AI ranking with full product data
const executeSearchMode = async (context, args) => {
  const liveSearchFilters = buildLiveSearchFilters(args.filter);
  const catalogFilters = buildCatalogFilters(args.filter);

  // Run both queries in parallel - 50% faster than sequential
  const [liveSearchResult, catalogResult] = await Promise.all([
    // Get AI ranking from Live Search (minimal fields)
    context.LiveSearchSandbox.Query.Search_productSearch({
      root: {},
      args: {
        phrase: args.phrase || '',
        filter: liveSearchFilters,
        page_size: args.limit || 24,
        current_page: args.page || 1,
        sort: mapSortForLiveSearch(args.sort),
      },
      context,
      selectionSet: `{
        items {
          product { sku }
          productView { sku }
        }
        total_count
        page_info { current_page page_size total_pages }
      }`,
    }),

    // Get full product details from Catalog
    context.CatalogServiceSandbox.Query.Catalog_productSearch({
      root: {},
      args: {
        phrase: args.phrase || '',
        filter: catalogFilters,
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
                    title
                    value
                  }
                }
              }
            }
          }
        }
      }`,
    }),
  ]);

  // Merge results: AI ranking with full details
  const orderedSkus = [];
  liveSearchResult?.items?.forEach((item) => {
    const sku = item.productView?.sku || item.product?.sku;
    if (sku) orderedSkus.push(sku);
  });

  const productMap = new Map();
  catalogResult?.items?.forEach((item) => {
    if (item.productView?.sku) {
      productMap.set(item.productView.sku, item.productView);
    }
  });

  let items = orderedSkus
    .map((sku) => productMap.get(sku))
    .filter(Boolean)
    .map(transformProductToCard);

  // Apply onSaleOnly filter if specified
  if (args.filter?.onSaleOnly) {
    items = items.filter((item) => item.discountPercent > 0);
  }

  return {
    items,
    pageInfo: liveSearchResult?.page_info,
    totalCount: args.filter?.onSaleOnly ? items.length : liveSearchResult?.total_count || 0,
  };
};

// Direct catalog query for browsing (no AI needed)
const executeCatalogMode = async (context, args) => {
  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: buildCatalogFilters(args.filter),
      page_size: args.limit || 24,
      current_page: args.page || 1,
      sort: mapSortForCatalog(args.sort),
    },
    context,
    selectionSet: `{
      total_count
      page_info { current_page page_size total_pages }
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
    }`,
  });

  let items =
    result?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [];

  // Apply onSaleOnly filter if specified
  if (args.filter?.onSaleOnly) {
    items = items.filter((item) => item.discountPercent > 0);
  }

  return {
    items,
    pageInfo: result?.page_info,
    totalCount: args.filter?.onSaleOnly ? items.length : result?.total_count || 0,
  };
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productCards: {
        resolve: async (_root, args, context, _info) => {
          try {
            // 1. Decide strategy based on user intent
            const useSearch = shouldUseLiveSearch(args);

            // 2. Execute with appropriate service(s)
            const result = useSearch
              ? await executeSearchMode(context, args)
              : await executeCatalogMode(context, args);

            // 3. Extract pagination data (with fallbacks for missing values)
            const currentPage = result.pageInfo?.current_page || args.page || 1;
            const totalPages = result.pageInfo?.total_pages || 1;

            // 4. Return our custom response shape
            // Notice: We add "hasMoreItems" - a calculated business field
            // Adobe doesn't provide this, but frontends need it for pagination UI
            return {
              items: result.items || [],
              totalCount: result.totalCount,
              hasMoreItems: currentPage < totalPages, // Calculated: more pages available?
              currentPage: currentPage,
              page_info: {
                current_page: currentPage,
                page_size: result.pageInfo?.page_size || args.limit || 24,
                total_pages: totalPages,
              },
            };
          } catch (error) {
            context.logger.error(`Product cards error: ${error.message?.substring(0, 60)}`);
            throw error;
          }
        },
      },
    },
  },
};
