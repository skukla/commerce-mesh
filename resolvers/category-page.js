/**
 * CITISIGNAL CATEGORY PAGE - UNIFIED PAGE DATA QUERY
 * 
 * This resolver demonstrates orchestrating multiple Adobe services into one query
 * that provides ALL data needed for a category page's initial load.
 * 
 * What Adobe gives us: Separate services for navigation, products, facets, breadcrumbs
 * What we deliver: Complete page data in ONE query for fast initial page loads
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The unified page API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_categoryPage
 * 
 * INPUT:
 *   query {
 *     Citisignal_categoryPage(
 *       categoryId: "phones"      // Optional - omit for "all products"
 *       phrase: "iphone"          // Optional search within category
 *       filter: {                 // Optional filters
 *         manufacturer: "Apple"
 *         priceMin: 500
 *       }
 *       sort: { attribute: PRICE, direction: ASC }
 *       page: 1
 *       limit: 24
 *     )
 *   }
 * 
 * OUTPUT - Complete page data in one response:
 *   {
 *     // Navigation for header/footer
 *     navigation: {
 *       header: [{ name: "Phones", href: "/phones" }]
 *       footer: [{ name: "Support", href: "/support" }]
 *     }
 *     
 *     // Breadcrumb trail
 *     breadcrumbs: [
 *       { name: "Home", href: "/" },
 *       { name: "Phones", href: "/phones", isActive: true }
 *     ]
 *     
 *     // Product listings
 *     products: {
 *       items: [{ ... }]         // Transformed product cards
 *       totalCount: 42
 *       hasMoreItems: true
 *     }
 *     
 *     // Filter options
 *     facets: [{ ... }]          // Available filters
 *     
 *     // Page metadata
 *     category: {
 *       name: "Phones"
 *       description: "..."
 *     }
 *   }
 * 
 *
 */

// ============================================================================
// SERVICE ORCHESTRATION - Coordinate multiple Adobe services
// ============================================================================

/**
 * Services we orchestrate:
 * 1. Commerce Core - Navigation and breadcrumbs
 * 2. Catalog Service - Product listings
 * 3. Live Search - Facets and AI ranking when searching
 * 
 * This demonstrates API Mesh's power to combine multiple backend services
 * into a single, efficient GraphQL query for the frontend.
 */

// ============================================================================
// FILTER TRANSFORMATION - Business filters to service formats
// ============================================================================

/**
 * Build filters for Catalog Service
 * Separates category filter from user-applied filters
 */
const buildCatalogFilters = (categoryId, pageFilter) => {
  const filters = [];
  
  // Category filter (for category pages)
  if (categoryId) {
    filters.push({ 
      attribute: 'categoryPath', 
      in: [categoryId] 
    });
  }
  
  // User-applied filters
  if (pageFilter) {
    if (pageFilter.manufacturer) {
      filters.push({ 
        attribute: 'cs_manufacturer', 
        in: [pageFilter.manufacturer] 
      });
    }
    
    if (pageFilter.priceMin !== undefined || pageFilter.priceMax !== undefined) {
      filters.push({
        attribute: 'price',
        range: {
          from: pageFilter.priceMin || 0,
          to: pageFilter.priceMax || 999999
        }
      });
    }
  }
  
  return filters;
};

/**
 * Build filters for Live Search (slightly different format)
 */
const buildLiveSearchFilters = (categoryId, pageFilter) => {
  const filters = [];
  
  // Live Search uses 'categories' instead of 'categoryPath'
  if (categoryId) {
    filters.push({ 
      attribute: 'categories', 
      in: [categoryId] 
    });
  }
  
  // Rest is similar to Catalog
  if (pageFilter) {
    if (pageFilter.manufacturer) {
      filters.push({ 
        attribute: 'cs_manufacturer', 
        in: [pageFilter.manufacturer] 
      });
    }
    
    if (pageFilter.priceMin !== undefined || pageFilter.priceMax !== undefined) {
      filters.push({
        attribute: 'price',
        range: {
          from: pageFilter.priceMin || 0,
          to: pageFilter.priceMax || 999999
        }
      });
    }
  }
  
  return filters;
};

// ============================================================================
// DATA TRANSFORMATION - Complex to simple
// ============================================================================

// ============================================================================
// BUSINESS LOGIC HELPERS - Reusable transformation functions
// ============================================================================

/**
 * Clean technical prefixes from attribute names
 */
const cleanAttributeName = (name) => {
  if (!name) return name;
  return name.startsWith('cs_') ? name.substring(3) : name;
};

/**
 * Format price for display with currency symbol and thousands separator
 */
const formatPrice = (amount) => {
  if (!amount) return null;
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Calculate discount percentage from regular and final prices
 */
const calculateDiscountPercent = (regularPrice, finalPrice) => {
  if (!regularPrice || !finalPrice || finalPrice >= regularPrice) return null;
  return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
};

/**
 * Ensure URL uses HTTPS protocol
 */
const ensureHttps = (url) => {
  if (!url) return url;
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
};

/**
 * Extract price value from nested price structure
 */
const extractPriceValue = (product, priceType, isComplex) => {
  if (isComplex) {
    return priceType === 'regular'
      ? product.priceRange?.minimum?.regular?.amount?.value
      : product.priceRange?.minimum?.final?.amount?.value;
  }
  return priceType === 'regular'
    ? product.price?.regular?.amount?.value
    : product.price?.final?.amount?.value;
};

/**
 * Find attribute value by name (checks both with and without cs_ prefix)
 */
const findAttributeValue = (attributes, name) => {
  if (!attributes || !Array.isArray(attributes)) return null;
  const attr = attributes.find(a => 
    a.name === name || a.name === `cs_${name}`
  );
  return attr?.value;
};

/**
 * Extract and transform variant options from product
 * Dynamically handles all cs_ prefixed options
 */
const extractVariantOptions = (options) => {
  const variantOptions = {};
  
  if (!options || !Array.isArray(options)) {
    return variantOptions;
  }
  
  options.forEach(option => {
    if (option.id?.startsWith('cs_')) {
      // Clean the option name using helper
      const cleanOptionName = cleanAttributeName(option.id);
      
      // Special handling for color options (include hex values)
      if (cleanOptionName === 'color' && option.values) {
        variantOptions.colors = option.values.map(v => ({
          name: v.title,
          hex: v.value || '#000000'
        }));
      } 
      // Standard handling for other options (memory, storage, etc.)
      else if (option.values) {
        variantOptions[cleanOptionName] = option.values.map(v => v.title);
      }
    }
  });
  
  return variantOptions;
};

/**
 * Transform product for page display  
 * This is the EXACT transformation from product-cards.js resolver
 * Copied here to ensure consistency between unified and focused resolvers
 */
const transformProductToCard = (product) => {
  if (!product) return null;
  
  // --- EXTRACT FROM NESTED STRUCTURES ---
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  const regularPrice = extractPriceValue(product, 'regular', isComplex);
  const finalPrice = extractPriceValue(product, 'final', isComplex);
  const manufacturer = findAttributeValue(product.attributes, 'manufacturer');
  
  // --- APPLY BUSINESS LOGIC ---
  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);
  const cleanManufacturer = cleanAttributeName(manufacturer);
  const variantOptions = extractVariantOptions(product.options);
  const imageUrl = product.images?.[0]?.url;
  const secureImageUrl = ensureHttps(imageUrl);
  
  // --- BUILD CUSTOM RESPONSE SHAPE ---
  return {
    // Basic fields
    id: product.id,
    sku: product.sku,
    name: product.name,
    urlKey: product.urlKey || '',
    
    // Business fields with transformation via business logic
    manufacturer: cleanManufacturer || null,
    price: formatPrice(finalPrice),
    originalPrice: isOnSale ? formatPrice(regularPrice) : null,
    discountPercent,
    inStock: product.inStock || false,
    
    // Simplified media structure
    image: imageUrl ? {
      url: secureImageUrl,
      altText: product.images[0].label || product.name
    } : null,
    
    // Variant options - dynamically included based on what's available
    ...variantOptions
  };
};

/**
 * Transform facets for filters
 * Using logic aligned with product-facets resolver
 */
const transformFacets = (facets) => {
  if (!facets || !Array.isArray(facets)) return [];
  
  return facets.map(facet => {
    // Clean the attribute name using helper
    const cleanAttribute = cleanAttributeName(facet.attribute);
    
    // RESPECT ADMIN-CONFIGURED LABELS
    // Use the title from Adobe if provided, otherwise use cleaned attribute
    const title = facet.title || cleanAttribute;
    
    return {
      key: cleanAttribute,
      title: title,
      type: facet.type || 'STANDARD',
      options: facet.buckets?.map(bucket => ({
        id: bucket.title,      // Use title as ID
        name: bucket.title,    // Display name
        count: bucket.count || 0
      })) || []
    };
  }).filter(facet => facet.options.length > 0);
};

/**
 * Transform category for navigation 
 * Using logic aligned with category-navigation resolver
 */
const transformCategory = (category) => {
  if (!category) return null;
  
  // Build navigation-ready fields
  const href = category.url_path ? `/${category.url_path}` : '/';
  
  return {
    // Essential navigation fields
    id: String(category.id || category.uid),
    name: category.name || '',
    href: href,                          // Ready-to-use link
    label: category.name || '',          // Display text
    
    // Hierarchy and ordering
    level: category.level || 0,
    position: category.position || 0,
    
    // Metadata for filtering
    includeInMenu: category.include_in_menu === 1 || category.include_in_menu === true,
    isActive: category.is_active === true || category.is_active === 1,
    productCount: category.product_count || 0,
    
    // Nested navigation (recursive transformation)
    children: category.children?.map(transformCategory).filter(Boolean) || [],
    
    // Additional fields for advanced use
    urlPath: category.url_path || '',
    urlKey: category.url_key || '',
    parentId: category.parent_id || null
  };
};

/**
 * Filter categories for navigation display
 * Business rules from category-navigation resolver
 */
const filterForNavigation = (categories, maxItems = 10) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .filter(cat => 
      cat.includeInMenu &&     // Admin marked for menu
      cat.isActive &&          // Currently active
      cat.name &&              // Has a name to display
      cat.href                 // Has a valid URL
    )
    .sort((a, b) => a.position - b.position)  // Respect admin ordering
    .slice(0, maxItems)        // Limit for clean UI
    .map(cat => ({
      ...cat,
      // Recursively filter children
      children: filterForNavigation(cat.children, maxItems)
    }));
};

/**
 * Build breadcrumb trail
 * Using logic aligned with category-breadcrumbs resolver
 */
const buildBreadcrumbs = (category) => {
  const breadcrumbs = [];
  
  // Always start with Home
  breadcrumbs.push({
    categoryId: null,
    name: 'Home',
    urlPath: '/',
    level: 0
  });
  
  // Add parent categories
  if (category?.breadcrumbs) {
    category.breadcrumbs.forEach((crumb, index) => {
      breadcrumbs.push({
        categoryId: null,
        name: crumb.category_name || '',
        urlPath: crumb.category_url_path || '',
        level: index + 1
      });
    });
  }
  
  // Add current category
  if (category) {
    breadcrumbs.push({
      categoryId: category.id || null,
      name: category.name || '',
      urlPath: category.url_path || '',
      level: breadcrumbs.length
    });
  }
  
  return breadcrumbs;
};

// ============================================================================
// PARALLEL QUERY EXECUTION - The orchestration magic
// ============================================================================

/**
 * Execute all queries in parallel for maximum performance
 * This is the core value of the unified query - getting everything at once
 */
const executeUnifiedQuery = async (context, args) => {
  const catalogFilters = buildCatalogFilters(args.categoryId, args.filter);
  const searchFilters = buildLiveSearchFilters(args.categoryId, args.filter);
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
      }`
    }),
    
    // 2. Products (Catalog or Live Search based on context)
    useSearch
      ? context.LiveSearchSandbox.Query.Search_productSearch({
          root: {},
          args: {
            phrase: args.phrase,
            filter: searchFilters,
            page_size: args.limit || 24,
            current_page: args.page || 1
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
            aggregations {
              attribute title
              buckets { title count }
            }
          }`
        })
      : context.CatalogServiceSandbox.Query.Catalog_productSearch({
          root: {},
          args: {
            phrase: '',
            filter: catalogFilters,
            page_size: args.limit || 24,
            current_page: args.page || 1
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
              buckets { title count }
            }
          }`
        })
  ];
  
  // Add category-specific query if needed
  if (args.categoryId) {
    promises.push(
      context.CommerceGraphQL.Query.Commerce_categoryList({
        root: {},
        args: {
          filters: { ids: { eq: args.categoryId } }
        },
        context,
        selectionSet: `{
          id name url_path description
          breadcrumbs {
            category_name
            category_url_path
          }
        }`
      })
    );
  }
  
  // Execute all queries in parallel
  const results = await Promise.all(promises);
  
  return {
    navigation: results[0],
    products: results[1],
    category: results[2]?.[0] || null
  };
};

// ============================================================================
// MAIN RESOLVER - Unified page data API
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryPageData: {
        resolve: async (root, args, context, info) => {
          try {
            // Execute all queries in parallel
            const { navigation, products, category } = await executeUnifiedQuery(context, args);
            
            // Transform navigation
            const transformedNav = navigation?.map(transformCategory).filter(Boolean) || [];
            
            // Filter navigation for display
            const navItems = filterForNavigation(transformedNav, 10);
            const headerNav = navItems.slice(0, 5).map(cat => ({
              href: cat.href,
              label: cat.label,
              category: cat.urlKey
            }));
            const footerNav = navItems.slice(0, 8).map(cat => ({
              href: cat.href,
              label: cat.label
            }));
            
            // Build complete page response
            return {
              // Navigation: Citisignal_CategoryNavigationResponse
              navigation: {
                items: navItems,
                headerNav: headerNav,
                footerNav: footerNav
              },
              
              // Products: Citisignal_ProductCardResult
              products: {
                items: products?.items?.map(item => 
                  transformProductToCard(item.productView)
                ).filter(Boolean) || [],
                totalCount: products?.total_count || 0,
                hasMoreItems: (products?.page_info?.current_page || 1) < 
                             (products?.page_info?.total_pages || 1),
                currentPage: products?.page_info?.current_page || 1,
                page_info: products?.page_info ? {
                  current_page: products.page_info.current_page,
                  page_size: products.page_info.page_size,
                  total_pages: products.page_info.total_pages
                } : null
              },
              
              // Facets: Citisignal_ProductFacetsResult
              facets: {
                facets: transformFacets(
                  products?.aggregations || products?.facets || []
                ),
                totalCount: products?.total_count || 0
              },
              
              // Breadcrumbs: Citisignal_BreadcrumbResponse
              breadcrumbs: {
                items: buildBreadcrumbs(category)
              },
              
              // CategoryInfo: Citisignal_CategoryInfo
              categoryInfo: category ? {
                id: category.id,
                name: category.name || 'All Products',
                urlKey: category.url_path || '',
                description: category.description,
                metaTitle: category.meta_title || category.name,
                metaDescription: category.meta_description
              } : {
                id: null,
                name: 'All Products',
                urlKey: '',
                description: null,
                metaTitle: null,
                metaDescription: null
              }
            };
            
          } catch (error) {
            console.error('Category page resolver error:', error);
            // Return minimal structure on error
            return {
              navigation: { 
                items: [], 
                headerNav: [], 
                footerNav: [] 
              },
              products: { 
                items: [], 
                totalCount: 0, 
                hasMoreItems: false,
                currentPage: 1,
                page_info: {
                  current_page: 1,
                  page_size: 20,
                  total_pages: 0
                }
              },
              facets: {
                facets: [],
                totalCount: 0
              },
              breadcrumbs: {
                items: []
              },
              categoryInfo: {
                id: null,
                name: 'All Products',
                urlKey: '',
                description: null,
                metaTitle: null,
                metaDescription: null
              }
            };
          }
        }
      }
    }
  }
};