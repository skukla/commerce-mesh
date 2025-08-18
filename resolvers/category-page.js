/**
 * CATEGORY PAGE DATA RESOLVER
 * 
 * Universal resolver for all category pages (phones, watches, accessories, etc.)
 * Optimized for server-side rendering to deliver complete page data in one query.
 * 
 * This resolver demonstrates the SSR-first pattern where:
 * - Initial page load gets everything from one query (fast SSR)
 * - Client-side updates use individual queries (flexible updates)
 * 
 * Orchestrates:
 * - Commerce Core: Navigation and breadcrumbs
 * - Catalog Service: Product listings
 * - Live Search: Facets and AI ranking
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
      productFilter.manufacturer = f.in[0];
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
      Citisignal_categoryPageData: async (root, args, context, info) => {
        try {
          const {
            category,
            phrase,
            filter,
            sort,
            pageSize = 24,  // Higher default for category pages
            currentPage = 1
          } = args;
          
          // Convert filter array to ProductFilter object
          const productFilter = convertFiltersToProductFilter(filter);
          
          // Extract category from either direct param or filter
          const categoryId = category || productFilter?.category || 
            filter?.find(f => f.attribute === 'category_uid')?.eq;
          
          if (!categoryId) {
            throw new Error('Category is required for categoryPageData query');
          }
          
          // Build filters for services
          const catalogFilters = productFilter ? [
            productFilter.category && { attribute: 'categoryPath', in: [productFilter.category] },
            productFilter.manufacturer && { attribute: 'cs_manufacturer', in: [productFilter.manufacturer] },
            (productFilter.priceMin !== undefined || productFilter.priceMax !== undefined) && {
              attribute: 'price',
              range: {
                from: productFilter.priceMin || 0,
                to: productFilter.priceMax || 999999
              }
            },
            productFilter.memory && { attribute: 'memory', in: productFilter.memory },
            productFilter.colors && { attribute: 'color', in: productFilter.colors }
          ].filter(Boolean) : [];

          // Execute all queries in parallel for optimal SSR performance
          const [navResult, productsResult, facetsResult, breadcrumbsResult, categoryInfoResult] = await Promise.all([
            // 1. Navigation (from Commerce Core)
            context.CommerceGraphQL.Query.Commerce_categoryList({
              root: {},
              args: {},
              context,
              selectionSet: `{
                id name url_path url_key level position include_in_menu
                children {
                  id name url_path url_key level position include_in_menu product_count
                  children {
                    id name url_path url_key level position include_in_menu product_count
                  }
                }
              }`
            }).then(categories => {
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
                        category: child.url_key,
                        isActive: child.url_key === categoryId
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
            }),
            
            // 2. Products (from Catalog Service or Live Search based on search phrase)
            phrase ? 
              // With search: Use Live Search for AI ranking + Catalog for details
              Promise.all([
                context.LiveSearchSandbox.Query.Search_productSearch({
                  root: {},
                  args: {
                    phrase: phrase,
                    filter: catalogFilters,
                    page_size: pageSize,
                    current_page: currentPage,
                    sort: sort ? [{ attribute: sort.attribute?.toLowerCase(), direction: sort.direction }] : []
                  },
                  context,
                  selectionSet: `{ items { product { sku } } total_count page_info { current_page page_size total_pages } }`
                }),
                context.CatalogServiceSandbox.Query.Catalog_productSearch({
                  root: {},
                  args: {
                    phrase: phrase,
                    filter: catalogFilters,
                    page_size: pageSize,
                    current_page: currentPage
                  },
                  context,
                  selectionSet: `{
                    items {
                      productView {
                        __typename id name sku urlKey inStock
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
                })
              ]).then(([searchResult, catalogResult]) => {
                // Merge Live Search ranking with Catalog details
                const orderedSkus = searchResult?.items?.map(item => item.product?.sku).filter(Boolean) || [];
                const productMap = new Map();
                
                catalogResult?.items?.forEach(item => {
                  if (item.productView?.sku) {
                    productMap.set(item.productView.sku, item.productView);
                  }
                });
                
                const items = orderedSkus.map(sku => {
                  const product = productMap.get(sku);
                  if (!product) return null;
                  
                  return transformProduct(product);
                }).filter(Boolean);
                
                return {
                  items,
                  totalCount: searchResult?.total_count || 0,
                  hasMoreItems: searchResult?.page_info?.current_page < searchResult?.page_info?.total_pages,
                  currentPage: searchResult?.page_info?.current_page || 1,
                  page_info: searchResult?.page_info || { current_page: 1, page_size: pageSize, total_pages: 1 }
                };
              }) :
              // Without search: Direct Catalog query
              context.CatalogServiceSandbox.Query.Catalog_productSearch({
                root: {},
                args: {
                  phrase: '',
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
                      __typename id name sku urlKey inStock
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
              }).then(result => ({
                items: result?.items?.map(item => transformProduct(item.productView)).filter(Boolean) || [],
                totalCount: result?.total_count || 0,
                hasMoreItems: result?.page_info?.current_page < result?.page_info?.total_pages,
                currentPage: result?.page_info?.current_page || 1,
                page_info: result?.page_info || { current_page: 1, page_size: pageSize, total_pages: 1 }
              })),
            
            // 3. Facets (from Live Search)
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
                    ... on Search_ScalarBucket { id }
                  }
                }
              }`
            }).then(result => ({
              facets: result?.facets?.map(facet => ({
                title: facet.title,
                key: facet.attribute,
                type: 'list',
                options: facet.buckets?.map(bucket => ({
                  id: bucket.id || bucket.title,
                  name: bucket.title,
                  count: 0
                })) || []
              })) || []
            })),
            
            // 4. Breadcrumbs (from Commerce Core)
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
              
              const breadcrumbs = categories ? findCategory(categories, categoryId) : null;
              return { items: breadcrumbs || [] };
            }),
            
            // 5. Category Info (from Commerce Core)
            context.CommerceGraphQL.Query.Commerce_categoryList({
              root: {},
              args: {},
              context,
              selectionSet: `{
                id name url_key description meta_title meta_description
                children {
                  id name url_key description meta_title meta_description
                  children {
                    id name url_key description meta_title meta_description
                  }
                }
              }`
            }).then(categories => {
              const findCategoryInfo = (cats, urlKey) => {
                for (const cat of cats) {
                  if (cat.url_key === urlKey) {
                    return {
                      id: cat.id,
                      name: cat.name,
                      urlKey: cat.url_key,
                      description: cat.description,
                      metaTitle: cat.meta_title || cat.name,
                      metaDescription: cat.meta_description
                    };
                  }
                  if (cat.children) {
                    const result = findCategoryInfo(cat.children, urlKey);
                    if (result) return result;
                  }
                }
                return null;
              };
              
              return findCategoryInfo(categories, categoryId) || {
                name: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
                urlKey: categoryId
              };
            })
          ]);
          
          // Return complete page data for SSR
          return {
            navigation: navResult,
            products: productsResult,
            facets: facetsResult,
            breadcrumbs: breadcrumbsResult,
            categoryInfo: categoryInfoResult
          };
          
        } catch (error) {
          // Return safe defaults for SSR resilience
          return {
            navigation: { headerNav: [], footerNav: [] },
            products: { 
              items: [], 
              totalCount: 0, 
              hasMoreItems: false,
              currentPage: 1,
              page_info: { current_page: 1, page_size: 24, total_pages: 1 }
            },
            facets: { facets: [] },
            breadcrumbs: { items: [] },
            categoryInfo: { name: 'Category', urlKey: '' }
          };
        }
      }
    }
  }
};

// Product transformation helper (shared logic)
function transformProduct(product) {
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
  
  const manufacturer = product.attributes?.find(a => 
    a.name === 'manufacturer' || a.name === 'cs_manufacturer'
  )?.value || null;
  
  const memoryOptions = isComplex && product.options?.find(o => o.title === 'Memory')?.values?.map(v => v.title) || [];
  const colorOptions = isComplex && product.options?.find(o => o.title === 'Color')?.values?.map(v => ({
    name: v.title,
    hex: v.value || '#000000'
  })) || [];
  
  const formatPrice = (amount) => {
    if (!amount) return null;
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };
  
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
}