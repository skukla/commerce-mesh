/**
 * CITISIGNAL PRODUCT CARDS - CUSTOM GRAPHQL QUERY
 * 
 * This resolver demonstrates API Mesh's ability to create completely custom queries
 * with custom filters, custom business logic, and custom response shapes.
 * 
 * What Adobe gives us: Complex, nested, technical structures
 * What we deliver: Simple, flat, business-ready data
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The clean API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_productCards
 * 
 * INPUT:
 *   query {
 *     Citisignal_productCards(
 *       phrase: "iphone"           // Optional search term
 *       filter: {                   // Business-friendly filters
 *         category: "phones"
 *         manufacturer: "Apple"
 *         priceMin: 500
 *         priceMax: 1500
 *       }
 *       sort: { attribute: PRICE, direction: ASC }
 *       limit: 24
 *       page: 1
 *     )
 *   }
 * 
 * OUTPUT - Our custom response shape:
 *   {
 *     items: [{
 *       // Flat, simple structure
 *       id: "123"
 *       sku: "IP15-PRO"
 *       name: "iPhone 15 Pro"
 *       urlKey: "iphone-15-pro"
 *       
 *       // Business fields with logic applied
 *       manufacturer: "Apple"        // Cleaned from "cs_manufacturer"
 *       price: "$999.99"            // Formatted with currency
 *       originalPrice: "$1,199.99"  // Only present if on sale
 *       discountPercent: 17         // Calculated business metric
 *       inStock: true
 *       
 *       // Simplified media
 *       image: {
 *         url: "https://..."        // Ensured HTTPS
 *         altText: "iPhone 15 Pro"
 *       }
 *       
 *       // Extracted variant options
 *       memory: ["128GB", "256GB", "512GB"]
 *       colors: [
 *         { name: "Natural", hex: "#F5F5DC" },
 *         { name: "Blue", hex: "#4A90E2" }
 *       ]
 *     }],
 *     
 *     // Pagination with business logic
 *     totalCount: 42
 *     hasMoreItems: true  // Business logic: currentPage < totalPages
 *     currentPage: 1
 *     page_info: { ... }
 *   }
 */

// ============================================================================
// CUSTOM FILTER TRANSFORMATION - Business filters to Adobe format
// ============================================================================

/**
 * Transform business-friendly filters to service-specific formats
 * 
 * OUR CUSTOM FILTER (what frontend sends):
 *   filter: {
 *     category: "phones",
 *     manufacturer: "Apple",
 *     priceMin: 500,
 *     priceMax: 1500
 *   }
 * 
 * ADOBE'S REQUIRED FORMAT (what we transform it to):
 *   filter: [
 *     { attribute: "categoryPath", in: ["phones"] },
 *     { attribute: "cs_manufacturer", in: ["Apple"] },
 *     { attribute: "price", range: { from: 500, to: 1500 } }
 *   ]
 * 
 * Notice: Technical prefixes (cs_), nested structures, different attribute names
 */
const buildCatalogFilters = (filter) => {
  if (!filter) return [];
  
  const catalogFilters = [];
  
  // Category filter - maps to Adobe's categoryPath
  if (filter.category) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.category]
    });
  }
  
  // Manufacturer filter - Adobe requires cs_ prefix
  if (filter.manufacturer) {
    catalogFilters.push({
      attribute: 'cs_manufacturer',
      in: [filter.manufacturer]
    });
  }
  
  // Price range filter - converts min/max to range object
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

const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];
  
  const searchFilters = [];
  
  // Live Search uses 'categories' instead of 'categoryPath'
  if (filter.category) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.category]
    });
  }
  
  // Same manufacturer handling
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [filter.manufacturer]
    });
  }
  
  // Same price range handling
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

// ============================================================================
// SERVICE ORCHESTRATION - Intelligent service selection
// ============================================================================

/**
 * Business logic: Choose the right Adobe service based on user intent
 */
const shouldUseLiveSearch = (args) => {
  // Use AI-powered Live Search when user is actively searching
  // Use Catalog Service for browsing (faster, no AI needed)
  return args.phrase && args.phrase.trim() !== '';
};

// ============================================================================
// DATA TRANSFORMATION & BUSINESS LOGIC - The reshaping magic
// ============================================================================

/**
 * Transform complex Adobe product structure to our custom shape
 * 
 * INPUT (from Adobe):
 * {
 *   productView: {
 *     __typename: "Catalog_ComplexProductView",
 *     sku: "IP15-PRO",
 *     name: "iPhone 15 Pro",
 *     priceRange: {
 *       minimum: {
 *         regular: { amount: { value: 1199.99, currency: "USD" } },
 *         final: { amount: { value: 999.99, currency: "USD" } }
 *       }
 *     },
 *     attributes: [
 *       { name: "cs_manufacturer", value: "Apple" }
 *     ],
 *     options: {
 *       title: "Memory",
 *       values: [{ title: "128GB" }, { title: "256GB" }]
 *     }
 *   }
 * }
 * 
 * OUTPUT (our custom shape):
 * {
 *   id: "123",
 *   sku: "IP15-PRO",
 *   name: "iPhone 15 Pro",
 *   manufacturer: "Apple",        // Cleaned
 *   price: "$999.99",            // Formatted
 *   originalPrice: "$1,199.99",  // Formatted
 *   discountPercent: 17,         // Calculated
 *   memory: ["128GB", "256GB"]   // Extracted
 * }
 */
const transformProductToCard = (product) => {
  if (!product) return null;
  
  // --- EXTRACT FROM NESTED STRUCTURES ---
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  
  // Navigate price structure (different for simple vs complex products)
  const regularPrice = isComplex 
    ? product.priceRange?.minimum?.regular?.amount?.value
    : product.price?.regular?.amount?.value;
    
  const finalPrice = isComplex 
    ? product.priceRange?.minimum?.final?.amount?.value
    : product.price?.final?.amount?.value;
  
  // Extract manufacturer from attributes array
  const manufacturerAttr = product.attributes?.find(a => 
    a.name === 'manufacturer' || a.name === 'cs_manufacturer'
  );
  const manufacturer = manufacturerAttr?.value;
  
  // --- APPLY BUSINESS LOGIC ---
  
  // Calculate sale status and discount
  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = isOnSale 
    ? Math.round(((regularPrice - finalPrice) / regularPrice) * 100)
    : null;
  
  // Format prices for display
  const formatPrice = (amount) => {
    if (!amount) return null;
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };
  
  // Clean technical prefixes
  const cleanManufacturer = manufacturer?.startsWith('cs_') 
    ? manufacturer.substring(3) 
    : manufacturer;
  
  // Extract variant options for complex products
  const memoryOption = product.options?.find(opt => opt.title === 'Memory');
  const memoryValues = memoryOption?.values?.map(v => v.title) || [];
  
  const colorOption = product.options?.find(opt => opt.title === 'Color');
  const colorValues = colorOption?.values?.map(v => ({
    name: v.title,
    hex: v.value || '#000000'
  })) || [];
  
  // Ensure HTTPS for images
  const imageUrl = product.images?.[0]?.url;
  const secureImageUrl = imageUrl?.startsWith('http://') 
    ? imageUrl.replace('http://', 'https://')
    : imageUrl;
  
  // --- BUILD CUSTOM RESPONSE SHAPE ---
  return {
    // Basic fields - flat structure
    id: product.id,
    sku: product.sku,
    name: product.name,
    urlKey: product.urlKey || '',
    
    // Business fields with transformations
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
    
    // Variant options (only if they exist)
    memory: memoryValues.length > 0 ? memoryValues : null,
    colors: colorValues.length > 0 ? colorValues : null
  };
};

// ============================================================================
// SORT MAPPING - Business sort to service format
// ============================================================================

/**
 * Transform business-friendly sort to service-specific formats
 * 
 * OUR CUSTOM SORT (what frontend sends):
 *   sort: { attribute: "PRICE", direction: "ASC" }
 * 
 * ADOBE'S REQUIRED FORMAT:
 *   Catalog: { attribute: "price", direction: "ASC" }
 *   Live Search: [{ attribute: "price", direction: "ASC" }]  // Array format
 * 
 * Note: "RELEVANCE" only works with AI-powered Live Search, not Catalog
 */
const mapSortForCatalog = (sort) => {
  if (!sort) return null;
  
  // Catalog doesn't support AI relevance sorting
  if (sort.attribute === 'RELEVANCE') return null;
  
  const attributeMap = {
    'PRICE': 'price',
    'NAME': 'name'
  };
  
  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return null;
  
  return {
    attribute: fieldName,
    direction: sort.direction || 'DESC'
  };
};

const mapSortForLiveSearch = (sort) => {
  if (!sort) return [];
  
  const attributeMap = {
    'PRICE': 'price',
    'NAME': 'name',
    'RELEVANCE': 'relevance'  // AI-powered sorting
  };
  
  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return [];
  
  return [{
    attribute: fieldName,
    direction: sort.direction || 'DESC'
  }];
};

// ============================================================================
// PERFORMANCE OPTIMIZATION - Parallel execution for search
// ============================================================================

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
        sort: mapSortForLiveSearch(args.sort)
      },
      context,
      selectionSet: `{
        items {
          product { sku }
          productView { sku }
        }
        total_count
        page_info { current_page page_size total_pages }
      }`
    }),
    
    // Get full product details from Catalog
    context.CatalogServiceSandbox.Query.Catalog_productSearch({
      root: {},
      args: {
        phrase: args.phrase || '',
        filter: catalogFilters,
        page_size: args.limit || 24,
        current_page: args.page || 1,
        sort: mapSortForCatalog(args.sort)
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
  
  // Merge results: AI ranking with full details
  const orderedSkus = [];
  liveSearchResult?.items?.forEach(item => {
    const sku = item.productView?.sku || item.product?.sku;
    if (sku) orderedSkus.push(sku);
  });
  
  const productMap = new Map();
  catalogResult?.items?.forEach(item => {
    if (item.productView?.sku) {
      productMap.set(item.productView.sku, item.productView);
    }
  });
  
  const items = orderedSkus
    .map(sku => productMap.get(sku))
    .filter(Boolean)
    .map(transformProductToCard);
  
  return {
    items,
    pageInfo: liveSearchResult?.page_info,
    totalCount: liveSearchResult?.total_count || 0
  };
};

// ============================================================================
// CATALOG MODE - Direct catalog query for browsing
// ============================================================================

const executeCatalogMode = async (context, args) => {
  const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: buildCatalogFilters(args.filter),
      page_size: args.limit || 24,
      current_page: args.page || 1,
      sort: mapSortForCatalog(args.sort)
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
    }`
  });
  
  const items = result?.items
    ?.map(item => transformProductToCard(item.productView))
    .filter(Boolean) || [];
  
  return {
    items,
    pageInfo: result?.page_info,
    totalCount: result?.total_count || 0
  };
};

// ============================================================================
// MAIN RESOLVER - Brings it all together
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productCards: {
        resolve: async (root, args, context, info) => {
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
              hasMoreItems: currentPage < totalPages,  // Calculated: more pages available?
              currentPage: currentPage,
              page_info: {
                current_page: currentPage,
                page_size: result.pageInfo?.page_size || args.limit || 24,
                total_pages: totalPages
              },
            };
            
          } catch (error) {
            console.error('Product cards resolver error:', error);
            throw error;
          }
        }
      }
    }
  }
};