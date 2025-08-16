/**
 * Citisignal_productCards Resolver
 * 
 * TWO MODES OF OPERATION:
 * 1. SEARCH MODE (user has search text): 
 *    - Runs Live Search + Catalog in parallel
 *    - Uses AI ranking from Live Search with full details from Catalog
 * 
 * 2. CATALOG MODE (no search text):
 *    - Direct Catalog query for filters and initial loads
 * 
 * NOTE: All helpers must be inline due to mesh architecture limitations.
 * Cannot split into separate files or use external utilities.
 * Facets are handled by separate Citisignal_productFacets resolver.
 */

// ============================================================================
// SECTION 1: DATA TRANSFORMATION HELPERS
// ============================================================================
const cleanAttributeName = (name) => {
  if (!name) return '';
  // Remove cs_ prefix if present
  return name.startsWith('cs_') ? name.substring(3) : name;
};

const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Handle protocol-relative URLs (//domain.com)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  // Convert HTTP to HTTPS for secure delivery
  return url.replace(/^http:\/\//, 'https://');
};

const extractAttributeValue = (attributes, attributeName, defaultValue = '') => {
  if (!attributes || !Array.isArray(attributes)) return defaultValue;
  
  // Look for both cs_ prefixed and clean versions
  const csName = `cs_${attributeName}`;
  const attr = attributes.find(a => 
    a.name === attributeName || 
    a.name === csName ||
    cleanAttributeName(a.name) === attributeName
  );
  
  return attr?.value || defaultValue;
};

const extractRegularPrice = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  return isComplex 
    ? product.priceRange?.minimum?.regular?.amount?.value
    : product.price?.regular?.amount?.value;
};

const extractFinalPrice = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  return isComplex 
    ? product.priceRange?.minimum?.final?.amount?.value
    : product.price?.final?.amount?.value;
};

const extractOptionByTitle = (options, title) => {
  if (!options) return null;
  return options.find(opt => opt.title === title);
};

const extractMemoryOptions = (options) => {
  const memoryOption = extractOptionByTitle(options, 'Memory');
  return memoryOption?.values?.map(v => v.title) || [];
};

const extractColorOptions = (options) => {
  const colorOption = extractOptionByTitle(options, 'Color');
  return colorOption?.values?.map(v => ({
    name: v.title,
    hex: v.value || '#000000'
  })) || [];
};

const isOnSale = (regularPrice, finalPrice) => {
  return finalPrice < regularPrice;
};

const calculateDiscountPercentage = (regularPrice, finalPrice) => {
  if (!regularPrice || regularPrice <= 0) return 0;
  if (!finalPrice || finalPrice >= regularPrice) return 0;
  
  const discount = ((regularPrice - finalPrice) / regularPrice) * 100;
  return Math.round(discount); // Return as whole number for display
};

const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return null;
  // Add comma formatting for thousands
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// ============================================================================
// SECTION 2: FILTER BUILDERS (Convert frontend filters to service-specific format)
// ============================================================================

const DEFAULT_MAX_PRICE = 999999;
const DEFAULT_MIN_PRICE = 0;

const buildCatalogFilters = (filter) => {
  if (!filter) return [];
  
  const catalogFilters = [];
  
  if (filter.category) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.category]
    });
  }
  
  if (filter.manufacturer) {
    catalogFilters.push({
      attribute: 'cs_manufacturer',  // Adobe expects cs_ prefix
      in: [filter.manufacturer]
    });
  }
  
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    catalogFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || DEFAULT_MIN_PRICE,
        to: filter.priceMax || DEFAULT_MAX_PRICE
      }
    });
  }
  
  return catalogFilters;
};

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
// SECTION 3: SORT MAPPERS (Convert frontend sort to service-specific format)
// ============================================================================

const mapSortForCatalog = (sort) => {
  if (!sort) return null;
  
  // Catalog Service doesn't support relevance sorting
  // That's an AI feature only available in Live Search
  if (sort.attribute === 'RELEVANCE') {
    return null; // Don't send any sort for relevance in catalog mode
  }
  
  // Map attribute names to Catalog Service field names
  const attributeMap = {
    'PRICE': 'price',
    'NAME': 'name'
  };
  
  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return null;
  
  // Catalog Service expects a sort object with attribute and direction
  // Direction must be the actual enum value, not a string
  return {
    attribute: fieldName,
    direction: sort.direction || 'DESC'
  };
};

const mapSortForLiveSearch = (sort) => {
  if (!sort) return [];
  
  // Map attribute names to Live Search field names
  const attributeMap = {
    'PRICE': 'price',
    'NAME': 'name',
    'RELEVANCE': 'relevance'
  };
  
  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return [];
  
  // Live Search expects an array of sort objects
  return [{
    attribute: fieldName,
    direction: sort.direction || 'DESC'
  }];
};

// ============================================================================
// SECTION 4: SERVICE SELECTION & PRODUCT TRANSFORMATION
// ============================================================================

const shouldUseLiveSearch = (args) => {
  // Use Live Search when user is actively searching
  // This gives us AI-powered relevance ranking
  if (args.phrase && args.phrase.trim() !== '') return true;
  
  // For filters without search, use Catalog directly
  return false;
};

// Extract SKUs from Live Search results while preserving order
const extractOrderedSkus = (liveSearchResult) => {
  const skus = [];
  if (liveSearchResult?.items) {
    liveSearchResult.items.forEach(item => {
      const sku = item.productView?.sku || item.product?.sku;
      if (sku) skus.push(sku);
    });
  }
  return skus;
};

// Build a map of SKU to product for fast lookups
const buildProductMap = (catalogResult) => {
  const productMap = new Map();
  if (catalogResult?.items) {
    catalogResult.items.forEach(item => {
      const product = item.productView;
      if (product?.sku) {
        productMap.set(product.sku, product);
      }
    });
  }
  return productMap;
};

// Merge products in Live Search order with Catalog data
const mergeSearchResults = (orderedSkus, productMap) => {
  if (!orderedSkus.length) return [];
  
  return orderedSkus
    .map(sku => {
      const product = productMap.get(sku);
      return product ? transformProductToCard(product) : null;
    })
    .filter(Boolean); // Remove any nulls
};

// Build query arguments for service calls
const buildQueryArgs = (args, filters, sort) => {
  const queryArgs = {
    phrase: args.phrase || '', // Catalog Service requires phrase, even if empty
    filter: filters,
    page_size: args.limit || 20,
    current_page: args.page || 1
  };
  
  if (sort) {
    queryArgs.sort = sort;
  }
  
  return queryArgs;
};

// Transform a Catalog product to our standard format
// Used by both modes to ensure consistent output
const transformProductToCard = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  const regularPrice = extractRegularPrice(product);
  const finalPrice = extractFinalPrice(product);
  const onSale = isOnSale(regularPrice, finalPrice);
  
  const image = product.images?.[0] ? {
    url: ensureHttpsUrl(product.images[0].url),
    altText: product.images[0].label || product.name
  } : null;
  
  return {
    id: product.id,
    sku: product.sku,
    urlKey: product.urlKey || '',
    name: product.name,
    manufacturer: extractAttributeValue(product.attributes, 'manufacturer', null),
    price: formatPrice(finalPrice),
    originalPrice: onSale ? formatPrice(regularPrice) : null,
    discountPercent: onSale ? calculateDiscountPercentage(regularPrice, finalPrice) : null,
    inStock: product.inStock || false,
    image: image,
    memory: isComplex ? extractMemoryOptions(product.options) : [],
    colors: isComplex ? extractColorOptions(product.options) : []
  };
};

// ============================================================================
// SECTION 5: GRAPHQL QUERIES
// ============================================================================

// Query 1: Basic Catalog query (no facets) - used for initial page loads
const PRODUCT_CARD_QUERY = `{
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
      ... on Catalog_SimpleProductView {
        price {
          regular {
            amount {
              value
              currency
            }
          }
          final {
            amount {
              value
              currency
            }
          }
        }
        attributes {
          name
          label
          value
        }
      }
      ... on Catalog_ComplexProductView {
        priceRange {
          minimum {
            regular {
              amount {
                value
                currency
              }
            }
            final {
              amount {
                value
                currency
              }
            }
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
        attributes {
          name
          label
          value
        }
      }
    }
  }
  page_info {
    current_page
    page_size
    total_pages
  }
  total_count
}`;

// Query 2: Live Search query (minimal) - only gets SKUs and ranking
const LIVE_SEARCH_QUERY = `{
  items {
    product {
      sku
      name
    }
    productView {
      sku
    }
  }
  page_info {
    current_page
    page_size
    total_pages
  }
  total_count
}`;


// ============================================================================
// SECTION 6: MAIN RESOLVER
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productCards: {
        resolve: async (root, args, context, info) => {
          try {
            const useLiveSearch = shouldUseLiveSearch(args);
            let searchResult;
            let items = [];
            
            // ==================================================================
            // MODE 1: SEARCH WITH AI RANKING (Parallel Live Search + Catalog)
            // ==================================================================
            if (useLiveSearch) {
              // Run BOTH queries in parallel for better performance
              const liveSearchFilters = buildLiveSearchFilters(args.filter);
              const catalogFilters = buildCatalogFilters(args.filter);
              const searchSort = mapSortForLiveSearch(args.sort);
              
              // Build query arguments
              const liveSearchArgs = buildQueryArgs(args, liveSearchFilters, searchSort);
              const catalogArgs = buildQueryArgs(args, catalogFilters, 
                searchSort ? mapSortForCatalog(args.sort) : undefined);
              
              // Start both queries at the same time
              const [liveSearchResult, catalogSearchResult] = await Promise.all([
                // Query 1: Live Search for ranking
                context.LiveSearchSandbox.Query.Search_productSearch({
                  root: {},
                  args: liveSearchArgs,
                  context,
                  selectionSet: LIVE_SEARCH_QUERY
                }),
                // Query 2: Catalog search for full product details
                context.CatalogServiceSandbox.Query.Catalog_productSearch({
                  root: {},
                  args: catalogArgs,
                  context,
                  selectionSet: PRODUCT_CARD_QUERY
                })
              ]);
              
              // Extract SKUs from Live Search results (preserving order)
              const orderedSkus = extractOrderedSkus(liveSearchResult);
              
              // Create a map of SKU to full product data from Catalog results
              const productMap = buildProductMap(catalogSearchResult);
              
              // Merge results maintaining Live Search order
              items = mergeSearchResults(orderedSkus, productMap);
              
              // Set pagination info from Live Search
              searchResult = liveSearchResult;
              
            // ==================================================================
            // MODE 2: CATALOG ONLY (with or without facets based on request)
            // ==================================================================
            } else {
              // Use Catalog Service for all non-search queries
              const catalogFilters = buildCatalogFilters(args.filter);
              const catalogSort = mapSortForCatalog(args.sort);
              const catalogArgs = buildQueryArgs(args, catalogFilters, catalogSort);
              
              searchResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
                root: {},
                args: catalogArgs,
                context,
                selectionSet: PRODUCT_CARD_QUERY
              });
              
              // Transform products using standard transformer
              if (searchResult?.items) {
                items = searchResult.items.map(item => 
                  transformProductToCard(item.productView)
                );
              }
              
            }
            
            // ==================================================================
            // FINAL RESPONSE FORMATTING
            // ==================================================================
            const currentPage = searchResult?.page_info?.current_page || args.page || 1;
            const totalPages = searchResult?.page_info?.total_pages || 0;
            
            return {
              items,
              totalCount: searchResult?.total_count || 0,
              hasMoreItems: currentPage < totalPages,
              currentPage
            };
          } catch (error) {
            throw error;
          }
        }
      }
    }
  }
};