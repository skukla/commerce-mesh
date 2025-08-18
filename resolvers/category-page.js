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

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_MAX_PRICE = 999999;
const DEFAULT_MIN_PRICE = 0;

// ============================================================================
// SECTION 2: FILTER CONVERSION
// ============================================================================

/**
 * Build filters for Catalog Service
 * Now accepts category separately from page filter
 */
const buildCatalogFilters = (categoryId, pageFilter) => {
  const filters = [];
  
  // Always add category filter if provided
  if (categoryId) {
    filters.push({ attribute: 'categoryPath', in: [categoryId] });
  }
  
  // Add page filters if provided
  if (pageFilter) {
    if (pageFilter.manufacturer) {
      filters.push({ attribute: 'cs_manufacturer', in: [pageFilter.manufacturer] });
    }
    if (pageFilter.priceMin !== undefined || pageFilter.priceMax !== undefined) {
      filters.push({
        attribute: 'price',
        range: {
          from: pageFilter.priceMin || DEFAULT_MIN_PRICE,
          to: pageFilter.priceMax || DEFAULT_MAX_PRICE
        }
      });
    }
    if (pageFilter.memory) {
      filters.push({ attribute: 'memory', in: pageFilter.memory });
    }
    if (pageFilter.colors) {
      filters.push({ attribute: 'color', in: pageFilter.colors });
    }
  }
  
  return filters;
};

// ============================================================================
// SECTION 3: ATTRIBUTE EXTRACTION
// ============================================================================

/**
 * Clean attribute name by removing cs_ prefix
 */
const cleanAttributeName = (name) => {
  if (!name) return '';
  return name.startsWith('cs_') ? name.substring(3) : name;
};

/**
 * Extract attribute value from attributes array
 */
const extractAttributeValue = (attributes, attributeName, defaultValue = '') => {
  if (!attributes || !Array.isArray(attributes)) return defaultValue;
  
  const csName = `cs_${attributeName}`;
  const attr = attributes.find(a => 
    a.name === attributeName || 
    a.name === csName ||
    cleanAttributeName(a.name) === attributeName
  );
  
  return attr?.value || defaultValue;
};

// ============================================================================
// SECTION 4: PRICE UTILITIES
// ============================================================================

/**
 * Extract regular price from product
 */
const extractRegularPrice = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  return isComplex 
    ? product.priceRange?.minimum?.regular?.amount?.value
    : product.price?.regular?.amount?.value;
};

/**
 * Extract final price from product
 */
const extractFinalPrice = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  return isComplex 
    ? product.priceRange?.minimum?.final?.amount?.value
    : product.price?.final?.amount?.value;
};

/**
 * Calculate discount percentage
 */
const calculateDiscountPercentage = (regularPrice, finalPrice) => {
  if (!regularPrice || regularPrice <= 0) return 0;
  if (!finalPrice || finalPrice >= regularPrice) return 0;
  
  const discount = ((regularPrice - finalPrice) / regularPrice) * 100;
  return Math.round(discount);
};

/**
 * Format price with currency symbol and thousand separators
 */
const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return null;
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// ============================================================================
// SECTION 5: URL UTILITIES
// ============================================================================

/**
 * Ensure URL uses HTTPS protocol
 */
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  return url.replace(/^http:\/\//, 'https://');
};

// ============================================================================
// SECTION 6: PRODUCT TRANSFORMATION
// ============================================================================

/**
 * Extract memory options from product
 */
const extractMemoryOptions = (product) => {
  if (!product.options) return [];
  const memoryOption = product.options.find(opt => opt.title === 'Memory');
  return memoryOption?.values?.map(v => v.title) || [];
};

/**
 * Extract color options from product
 */
const extractColorOptions = (product) => {
  if (!product.options) return [];
  const colorOption = product.options.find(opt => opt.title === 'Color');
  return colorOption?.values?.map(v => ({
    name: v.title,
    hex: v.value || '#000000'
  })) || [];
};

/**
 * Transform product data to consistent format
 */
const transformProduct = (product) => {
  if (!product) return null;
  
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  const regularPrice = extractRegularPrice(product);
  const finalPrice = extractFinalPrice(product);
  
  const onSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = onSale ? calculateDiscountPercentage(regularPrice, finalPrice) : null;
  
  const manufacturer = extractAttributeValue(
    product.attributes,
    'manufacturer',
    null
  );
  
  const memoryOptions = isComplex ? extractMemoryOptions(product) : [];
  const colorOptions = isComplex ? extractColorOptions(product) : [];
  
  const image = product.images?.[0] ? {
    url: ensureHttpsUrl(product.images[0].url),
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
};

// ============================================================================
// SECTION 7: NAVIGATION TRANSFORMATION
// ============================================================================

/**
 * Transform category list to navigation structure
 */
const transformNavigation = (categories, activeCategory) => {
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
            href: `/${child.url_key}`,
            label: child.name,
            category: child.url_key,
            isActive: child.url_key === activeCategory
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
};

/**
 * Find category breadcrumbs
 */
const findCategoryBreadcrumbs = (categories, urlKey, trail = []) => {
  for (const cat of categories) {
    if (cat.url_key === urlKey) {
      return [...trail, { name: cat.name, urlPath: `/${cat.url_key}` }];
    }
    if (cat.children) {
      const result = findCategoryBreadcrumbs(
        cat.children,
        urlKey,
        [...trail, { name: cat.name, urlPath: `/${cat.url_key}` }]
      );
      if (result) return result;
    }
  }
  return null;
};

/**
 * Find category info
 */
const findCategoryInfo = (categories, urlKey) => {
  for (const cat of categories) {
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

// ============================================================================
// SECTION 8: SERVICE QUERIES
// ============================================================================

/**
 * Fetch navigation from Commerce Core
 */
const fetchNavigation = async (context, categoryId) => {
  const categories = await context.CommerceGraphQL.Query.Commerce_categoryList({
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
  });
  
  return transformNavigation(categories, categoryId);
};

/**
 * Fetch products with hybrid approach
 */
const fetchProducts = async (context, args) => {
  const { phrase, catalogFilters, pageSize, currentPage, sort } = args;
  
  if (phrase) {
    // With search: Use Live Search for AI ranking + Catalog for details
    const [searchResult, catalogResult] = await Promise.all([
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
    ]);
    
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
  } else {
    // Without search: Direct Catalog query
    const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
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
    });
    
    return {
      items: result?.items?.map(item => transformProduct(item.productView)).filter(Boolean) || [],
      totalCount: result?.total_count || 0,
      hasMoreItems: result?.page_info?.current_page < result?.page_info?.total_pages,
      currentPage: result?.page_info?.current_page || 1,
      page_info: result?.page_info || { current_page: 1, page_size: pageSize, total_pages: 1 }
    };
  }
};

/**
 * Fetch facets from Live Search
 */
const fetchFacets = async (context, args) => {
  const { phrase, catalogFilters } = args;
  
  const result = await context.LiveSearchSandbox.Query.Search_productSearch({
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
  });
  
  return {
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
  };
};

/**
 * Fetch breadcrumbs from Commerce Core
 */
const fetchBreadcrumbs = async (context, categoryId) => {
  const categories = await context.CommerceGraphQL.Query.Commerce_categoryList({
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
  });
  
  const breadcrumbs = categories ? findCategoryBreadcrumbs(categories, categoryId) : null;
  return { items: breadcrumbs || [] };
};

/**
 * Fetch category info from Commerce Core
 */
const fetchCategoryInfo = async (context, categoryId) => {
  const categories = await context.CommerceGraphQL.Query.Commerce_categoryList({
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
  });
  
  return findCategoryInfo(categories, categoryId) || {
    name: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
    urlKey: categoryId
  };
};

// ============================================================================
// SECTION 9: MAIN RESOLVER
// ============================================================================

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
            pageSize = DEFAULT_PAGE_SIZE,
            currentPage = 1
          } = args;
          
          // Category is now required
          if (!category) {
            throw new Error('Category is required for categoryPageData query');
          }
          
          // Build filters for services - category is separate from page filters
          const catalogFilters = buildCatalogFilters(category, filter);
          
          // Execute all queries in parallel for optimal SSR performance
          const [navResult, productsResult, facetsResult, breadcrumbsResult, categoryInfoResult] = await Promise.all([
            fetchNavigation(context, category),
            fetchProducts(context, { phrase, catalogFilters, pageSize, currentPage, sort }),
            fetchFacets(context, { phrase, catalogFilters }),
            fetchBreadcrumbs(context, category),
            fetchCategoryInfo(context, category)
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
          console.error('Error in Citisignal_categoryPageData:', error.message);
          
          // Return safe defaults for SSR resilience
          return {
            navigation: { headerNav: [], footerNav: [] },
            products: { 
              items: [], 
              totalCount: 0, 
              hasMoreItems: false,
              currentPage: 1,
              page_info: { current_page: 1, page_size: DEFAULT_PAGE_SIZE, total_pages: 1 }
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