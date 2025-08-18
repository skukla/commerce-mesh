/**
 * PRODUCT PAGE DATA RESOLVER
 * 
 * Demonstrates the power of Adobe API Mesh by orchestrating multiple
 * backend services in a single GraphQL query. This is the key value prop:
 * frontend developers make ONE query to get ALL the data they need.
 * 
 * This resolver coordinates:
 * - Commerce Core: Category navigation and breadcrumbs
 * - Live Search: Dynamic facets and AI-powered search
 * - Catalog Service: Product data with full attributes
 * 
 * Note: Adobe API Mesh resolvers cannot directly call other custom resolvers.
 * Instead, we directly call the underlying data sources and transform the data.
 */

/**
 * Convert array of FilterInput to ProductFilter object
 */
const convertFiltersToProductFilter = (filters) => {
  if (!filters || !Array.isArray(filters)) return undefined;
  
  const productFilter = {};
  
  filters.forEach(f => {
    if (f.attribute === 'category_uid' && f.eq) {
      productFilter.category = f.eq;
    } else if (f.attribute === 'cs_manufacturer' && f.in) {
      productFilter.manufacturer = f.in[0]; // Take first manufacturer
    } else if (f.attribute === 'memory' && f.in) {
      productFilter.memory = f.in;
    } else if (f.attribute === 'color' && f.in) {
      productFilter.colors = f.in;
    } else if (f.attribute === 'price' && f.range) {
      if (f.range.from !== undefined) productFilter.priceMin = f.range.from;
      if (f.range.to !== undefined) productFilter.priceMax = f.range.to;
    }
  });
  
  return Object.keys(productFilter).length > 0 ? productFilter : undefined;
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productPageData: async (root, args, context, info) => {
        try {
          const debugInfo = {};
          debugInfo.receivedArgs = args;
          
          const {
            category,
            phrase,
            filter,
            sort,
            pageSize = 12,
            currentPage = 1
          } = args;
          
          debugInfo.extractedValues = {
            category,
            phrase,
            filter,
            sort,
            pageSize,
            currentPage
          };
          
          // Convert filter array to ProductFilter object
          const productFilter = convertFiltersToProductFilter(filter);
          debugInfo.convertedFilter = productFilter;
          
          // Extract category from either direct param or filter
          // The filter array might have category_uid which we need for breadcrumbs
          const categoryForBreadcrumbs = category || productFilter?.category || 
            filter?.find(f => f.attribute === 'category_uid')?.eq;
          debugInfo.categoryForBreadcrumbs = categoryForBreadcrumbs;

          // Execute all data fetching in parallel
          // Since we can't call custom resolvers directly, we call the underlying services
          // and replicate the transformation logic inline
          
          debugInfo.contextKeys = Object.keys(context || {});
          debugInfo.availableSources = {
            hasCommerce: !!context.CommerceGraphQL,
            hasCatalog: !!context.CatalogServiceSandbox,
            hasLiveSearch: !!context.LiveSearchSandbox
          };
          
          try {
            // Build filter for Catalog/Live Search
            const catalogFilters = productFilter ? [
              productFilter.category && { attribute: 'categoryPath', in: [productFilter.category] },
              productFilter.manufacturer && { attribute: 'cs_manufacturer', in: [productFilter.manufacturer] },
              (productFilter.priceMin !== undefined || productFilter.priceMax !== undefined) && {
                attribute: 'price',
                range: {
                  from: productFilter.priceMin || 0,
                  to: productFilter.priceMax || 999999
                }
              }
            ].filter(Boolean) : [];

            // Execute queries in parallel by calling underlying services directly
            const [navResult, productsResult, facetsResult, breadcrumbsResult] = await Promise.all([
              // 1. Navigation from Commerce Core
              context.CommerceGraphQL ?
                context.CommerceGraphQL.Query.Commerce_categoryList({
                  root: {},
                  args: {},
                  context,
                  selectionSet: `{
                    id name url_path url_key level position
                    include_in_menu
                    children {
                      id name url_path url_key level position
                      include_in_menu product_count
                      children {
                        id name url_path url_key level position
                        include_in_menu product_count
                      }
                    }
                  }`
                }).then(categories => {
                  // Transform categories to navigation format
                  if (!categories || !Array.isArray(categories)) {
                    return { headerNav: [], footerNav: [] };
                  }
                  
                  const headerNav = [];
                  const footerNav = [];
                  
                  categories.forEach(cat => {
                    if (cat.children) {
                      cat.children.forEach(child => {
                        if (child.include_in_menu === 1 && child.level === 2) {
                          const navItem = {
                            href: `/category/${child.url_key}`,
                            label: child.name,
                            category: child.url_key
                          };
                          
                          if (child.position <= 6) {
                            headerNav.push(navItem);
                          } else {
                            footerNav.push({ href: navItem.href, label: navItem.label });
                          }
                        }
                      });
                    }
                  });
                  
                  return {
                    headerNav: headerNav.sort((a, b) => a.position - b.position),
                    footerNav: footerNav.sort((a, b) => a.position - b.position)
                  };
                }) :
                Promise.resolve({ headerNav: [], footerNav: [] }),
              
              // 2. Products from Catalog Service
              context.CatalogServiceSandbox ?
                context.CatalogServiceSandbox.Query.Catalog_productSearch({
                  root: {},
                  args: {
                    phrase: phrase || '',
                    filter: catalogFilters,
                    page_size: pageSize,
                    current_page: currentPage,
                    sort: sort ? { attribute: sort.attribute?.toLowerCase(), direction: sort.direction } : null
                  },
                  context,
                  selectionSet: `{
                    total_count
                    page_info { current_page page_size total_pages }
                    items {
                      productView {
                        __typename
                        id
                        name
                        sku
                        urlKey
                        inStock
                        images(roles: ["small_image"]) {
                          url
                          label
                          roles
                        }
                        attributes {
                          name
                          label
                          value
                        }
                        ... on Catalog_SimpleProductView {
                          price {
                            regular { amount { value currency } }
                            final { amount { value currency } }
                          }
                        }
                        ... on Catalog_ComplexProductView {
                          priceRange {
                            minimum {
                              regular { amount { value currency } }
                              final { amount { value currency } }
                            }
                          }
                          options {
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
                  }`
                }).then(result => {
                  // Transform products using the same logic as product-cards resolver
                  const items = result?.items?.map(item => {
                    const product = item.productView;
                    if (!product) return null;
                    
                    const isComplex = product.__typename === 'Catalog_ComplexProductView';
                    const regularPrice = isComplex 
                      ? product.priceRange?.minimum?.regular?.amount?.value
                      : product.price?.regular?.amount?.value;
                    const finalPrice = isComplex
                      ? product.priceRange?.minimum?.final?.amount?.value
                      : product.price?.final?.amount?.value;
                    
                    const onSale = regularPrice && finalPrice && finalPrice < regularPrice;
                    const discountPercent = onSale ? Math.round(((regularPrice - finalPrice) / regularPrice) * 100) : null;
                    
                    // Extract manufacturer from attributes
                    const manufacturer = product.attributes?.find(a => 
                      a.name === 'manufacturer' || a.name === 'cs_manufacturer'
                    )?.value || null;
                    
                    // Extract memory options from complex products
                    const memoryOptions = isComplex && product.options?.find(o => o.title === 'Memory')?.values?.map(v => v.title) || [];
                    
                    // Extract color options from complex products
                    const colorOptions = isComplex && product.options?.find(o => o.title === 'Color')?.values?.map(v => ({
                      name: v.title,
                      hex: v.value || '#000000'
                    })) || [];
                    
                    // Format price with currency
                    const formatPrice = (amount) => {
                      if (!amount) return null;
                      return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
                    };
                    
                    // Handle image URL
                    const image = product.images?.[0] ? {
                      url: product.images[0].url?.startsWith('//') ? 'https:' + product.images[0].url : product.images[0].url,
                      altText: product.images[0].label || product.name
                    } : null;
                    
                    return {
                      id: product.id,
                      sku: product.sku,
                      urlKey: product.urlKey || '',
                      name: product.name,
                      manufacturer,
                      price: formatPrice(finalPrice),
                      originalPrice: onSale ? formatPrice(regularPrice) : null,
                      discountPercent,
                      inStock: product.inStock || false,
                      image,
                      memory: memoryOptions.length > 0 ? memoryOptions : null,
                      colors: colorOptions.length > 0 ? colorOptions : null
                    };
                  }).filter(Boolean) || [];
                  
                  return {
                    items,
                    totalCount: result?.total_count || 0,
                    hasMoreItems: result?.page_info?.current_page < result?.page_info?.total_pages,
                    currentPage: result?.page_info?.current_page || 1,
                    page_info: result?.page_info || { current_page: 1, page_size: pageSize, total_pages: 1 },
                    facets: [],
                    aggregations: []
                  };
                }) :
                Promise.resolve({
                  items: [],
                  totalCount: 0,
                  hasMoreItems: false,
                  currentPage: 1,
                  page_info: { current_page: 1, page_size: pageSize, total_pages: 1 },
                  facets: [],
                  aggregations: []
                }),
              
              // 3. Facets from Live Search
              context.LiveSearchSandbox ?
                context.LiveSearchSandbox.Query.Search_productSearch({
                  root: {},
                  args: {
                    phrase: phrase || '',
                    filter: catalogFilters,
                    page_size: 1,
                    current_page: 1
                  },
                  context,
                  selectionSet: `{
                    facets {
                      title
                      attribute
                      buckets {
                        title
                        __typename
                        ... on Search_RangeBucket {
                          from
                          to
                        }
                        ... on Search_ScalarBucket {
                          id
                        }
                        ... on Search_StatsBucket {
                          min
                          max
                        }
                      }
                    }
                  }`
                }).then(result => {
                  // Transform facets
                  const facets = result?.facets?.map(facet => ({
                    title: facet.title,
                    key: facet.attribute,
                    type: 'list',
                    options: facet.buckets?.map(bucket => ({
                      id: bucket.id || bucket.title,
                      name: bucket.title,
                      count: 0
                    })) || []
                  })) || [];
                  
                  return { facets, totalCount: result?.total_count || 0 };
                }) :
                Promise.resolve({ facets: [], totalCount: 0 }),
              
              // 4. Breadcrumbs from Commerce Core
              categoryForBreadcrumbs && context.CommerceGraphQL ?
                context.CommerceGraphQL.Query.Commerce_categoryList({
                  root: {},
                  args: {},
                  context,
                  selectionSet: `{
                    id name url_path url_key level
                    children {
                      id name url_path url_key level
                      children {
                        id name url_path url_key level
                      }
                    }
                  }`
                }).then(categories => {
                  // Find the category and build breadcrumb trail
                  const findCategory = (cats, urlKey, trail = []) => {
                    for (const cat of cats) {
                      if (cat.url_key === urlKey) {
                        return [...trail, { name: cat.name, urlPath: `/category/${cat.url_key}` }];
                      }
                      if (cat.children) {
                        const result = findCategory(
                          cat.children,
                          urlKey,
                          [...trail, { name: cat.name, urlPath: `/category/${cat.url_key}` }]
                        );
                        if (result) return result;
                      }
                    }
                    return null;
                  };
                  
                  const breadcrumbs = categories ? findCategory(categories, categoryForBreadcrumbs) : null;
                  return { items: breadcrumbs || [] };
                }) :
                Promise.resolve({ items: [] })
            ]);
            
            // Results are already transformed
            const navigation = navResult || { headerNav: [], footerNav: [] };
            const products = productsResult || {
              items: [],
              totalCount: 0,
              page_info: { current_page: 1, page_size: pageSize, total_pages: 1 }
            };
            const facets = facetsResult || { facets: [] };
            const breadcrumbs = breadcrumbsResult || { items: [] };
            
            debugInfo.dataFetchResults = {
              hasNavigation: !!navigation?.headerNav?.length || !!navigation?.footerNav?.length,
              hasProducts: !!products?.items?.length,
              hasFacets: !!facets?.facets?.length,
              hasBreadcrumbs: !!breadcrumbs?.items?.length
            };

            debugInfo.finalResults = {
              navigationItemCount: navigation?.headerNav?.length || 0,
              productsCount: products?.items?.length || 0,
              facetsCount: facets?.facets?.length || 0,
              breadcrumbsCount: breadcrumbs?.items?.length || 0
            };

            // Return unified response - frontend gets everything in one query
            const response = {
              navigation,
              products,
              facets,
              breadcrumbs
            };
            
            // Only include debug field if requested in selection set
            const includeDebug = info?.fieldNodes?.[0]?.selectionSet?.selections?.some(
              s => s.name?.value === '_debug'
            );
            
            if (includeDebug) {
              debugInfo.finalProductsPageInfo = response.products?.page_info;
              response._debug = JSON.stringify(debugInfo, null, 2);
            }
            
            return response;
            
          } catch (resolverError) {
            debugInfo.resolverError = resolverError.message || 'Resolver execution failed';
            
            // Return fallback response with debug info about the error
            return {
              navigation: { headerNav: [], footerNav: [] },
              products: {
                items: [],
                totalCount: 0,
                hasMoreItems: false,
                currentPage: 1,
                page_info: { current_page: 1, page_size: pageSize, total_pages: 1 },
                facets: [],
                aggregations: []
              },
              facets: { facets: [] },
              breadcrumbs: { items: [] },
              _debug: JSON.stringify(debugInfo, null, 2)
            };
          }

        } catch (error) {
          
          // Graceful degradation - return partial data if possible
          return {
            navigation: { headerNav: [], footerNav: [] },
            products: { items: [], page_info: {}, aggregations: [] },
            facets: { aggregations: [] },
            breadcrumbs: { items: [] }
          };
        }
      }
    }
  }
};