/**
 * Category Page Resolver
 * Orchestrates multiple services to provide complete category page data in a single query.
 * Fetches navigation, products, facets, and breadcrumbs in parallel for optimal performance.
 */

// Execute all queries in parallel for maximum performance
const executeUnifiedQuery = async (context, args) => {
  const catalogFilters = buildPageFilters(args.categoryUrlKey, args.filter, 'catalog');
  const searchFilters = buildPageFilters(args.categoryUrlKey, args.filter, 'search');
  const useSearch = args.phrase && args.phrase.trim() !== '';

  // Start ALL queries simultaneously
  const promises = [
    // 1. Navigation (Commerce Core)
    context.CommerceGraphQL.Query.Commerce_categoryList({
      root: {},
      args: { filters: {} },
      context,
      selectionSet: `{
        id
        uid
        name
        url_path
        url_key
        include_in_menu
        is_active
        level
        position
        product_count
        parent_id
        children {
          id
          uid
          name
          url_path
          url_key
          include_in_menu
          is_active
          level
          position
          product_count
          children {
            id
            uid
            name
            url_path
            url_key
            include_in_menu
            is_active
            level
            position
            product_count
          }
        }
      }`,
    }),

    // 2. Products (Catalog or Live Search based on context)
    useSearch
      ? context.LiveSearchSandbox.Query.Search_productSearch({
          root: {},
          args: {
            phrase: args.phrase,
            filter: searchFilters,
            page_size: args.limit || 24,
            current_page: args.page || 1,
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
              attribute title
              buckets { 
                ... on Search_ScalarBucket { title count }
                ... on Search_RangeBucket { title count }
              }
            }
          }`,
        })
      : context.CatalogServiceSandbox.Query.Catalog_productSearch({
          root: {},
          args: {
            phrase: '',
            filter: catalogFilters,
            page_size: args.limit || 24,
            current_page: args.page || 1,
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
            total_count
            page_info { current_page page_size total_pages }
            facets {
              attribute title
              buckets { 
                ... on Catalog_ScalarBucket { title count }
                ... on Catalog_RangeBucket { title count }
              }
            }
          }`,
        }),
  ];

  // Add category-specific query if needed
  if (args.categoryUrlKey) {
    promises.push(
      context.CommerceGraphQL.Query.Commerce_categoryList({
        root: {},
        args: {
          filters: { url_key: { eq: args.categoryUrlKey } },
        },
        context,
        selectionSet: `{
          id name url_path description
          breadcrumbs {
            category_name
            category_url_path
          }
        }`,
      })
    );
  }

  // Execute all queries in parallel
  const results = await Promise.all(promises);

  return {
    navigation: results[0],
    products: results[1],
    category: results[2]?.[0] || null,
  };
};

// ============================================================================
// RESPONSE ASSEMBLY - Build the complete page response
// ============================================================================

/**
 * Assemble the complete page response from parallel query results
 */
const assemblePageResponse = (navigation, products, category) => {
  // Transform and filter navigation
  const transformedNav = navigation?.map(transformCategory).filter(Boolean) || [];
  const navItems = filterForNavigation(transformedNav, 10);

  // Build header and footer navigation
  const headerNav = buildHeaderNav(navItems, 5);
  const footerNav = buildFooterNav(navItems, 8);

  // Transform products
  const productItems =
    products?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [];

  // Transform facets
  const facets = transformFacets(products?.facets || []);

  // Build breadcrumbs
  const breadcrumbs = buildBreadcrumbs(category);

  // Build category info
  const categoryInfo = category
    ? {
        id: category.id,
        name: category.name || 'All Products',
        urlKey: category.url_path || '',
        description: category.description,
        metaTitle: category.meta_title || category.name,
        metaDescription: category.meta_description,
      }
    : {
        id: null,
        name: 'All Products',
        urlKey: '',
        description: null,
        metaTitle: null,
        metaDescription: null,
      };

  return {
    // Navigation: Citisignal_CategoryNavigationResponse
    navigation: {
      items: navItems,
      headerNav: headerNav,
      footerNav: footerNav,
    },

    // Products: Citisignal_ProductCardResult
    products: {
      items: productItems,
      totalCount: products?.total_count || 0,
      hasMoreItems:
        (products?.page_info?.current_page || 1) < (products?.page_info?.total_pages || 1),
      currentPage: products?.page_info?.current_page || 1,
      page_info: products?.page_info
        ? {
            current_page: products.page_info.current_page,
            page_size: products.page_info.page_size,
            total_pages: products.page_info.total_pages,
          }
        : null,
    },

    // Facets: Citisignal_ProductFacetsResult
    facets: {
      facets: facets,
      totalCount: products?.total_count || 0,
    },

    // Breadcrumbs: Citisignal_BreadcrumbResponse
    breadcrumbs: {
      items: breadcrumbs,
    },

    // CategoryInfo: Citisignal_CategoryInfo
    categoryInfo: categoryInfo,
  };
};

// Create empty response structure for error cases
const createEmptyResponse = () => ({
  navigation: {
    items: [],
    headerNav: [],
    footerNav: [],
  },
  products: {
    items: [],
    totalCount: 0,
    hasMoreItems: false,
    currentPage: 1,
    page_info: {
      current_page: 1,
      page_size: 20,
      total_pages: 0,
    },
  },
  facets: {
    facets: [],
    totalCount: 0,
  },
  breadcrumbs: {
    items: [],
  },
  categoryInfo: {
    id: null,
    name: 'All Products',
    urlKey: '',
    description: null,
    metaTitle: null,
    metaDescription: null,
  },
});

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryPageData: {
        resolve: async (_root, args, context, _info) => {
          try {
            // Execute all queries in parallel
            const { navigation, products, category } = await executeUnifiedQuery(context, args);

            // Assemble and return the complete page response
            return assemblePageResponse(navigation, products, category);
          } catch (error) {
            console.error('Category page resolver error:', error);
            // Return minimal structure on error for SSR resilience
            return createEmptyResponse();
          }
        },
      },
    },
  },
};
