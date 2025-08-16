/**
 * Citisignal_productCards Resolver
 * 
 * Intelligently uses Catalog Service for initial loads and Live Search for filtering.
 * Returns products formatted for category/listing pages with optional facets.
 */

// Helper functions for the Citisignal_productCards resolver
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

// Constants
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
      attribute: 'cs_manufacturer',
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

// Build filters for Live Search API
const buildSearchFilters = (filter) => {
  if (!filter) return [];
  
  const searchFilters = [];
  
  if (filter.category) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.category]
    });
  }
  
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'manufacturer',
      in: [filter.manufacturer]
    });
  }
  
  if (filter.memory && filter.memory.length > 0) {
    searchFilters.push({
      attribute: 'memory',
      in: filter.memory
    });
  }
  
  if (filter.colors && filter.colors.length > 0) {
    searchFilters.push({
      attribute: 'color',
      in: filter.colors
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

// Map frontend sort options to service-specific formats
const mapSortForCatalog = (sort) => {
  if (!sort) return null;
  
  // Map attribute names to Catalog Service field names
  const attributeMap = {
    'PRICE': 'price',
    'NAME': 'name',
    'RELEVANCE': 'relevance'
  };
  
  const fieldName = attributeMap[sort.attribute];
  if (!fieldName) return null;
  
  // Catalog Service expects a sort object with attribute and direction
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

// Determine if we should use Live Search based on request parameters
const shouldUseLiveSearch = (args) => {
  // Simple logic:
  // 1. If user is searching (has text in search bar) -> Live Search
  // 2. If user requested facets (for dynamic filters) -> Live Search  
  // 3. Everything else -> Catalog Service
  
  if (args.phrase && args.phrase.trim() !== '') return true;
  if (args.facets === true) return true;
  
  // Default to Catalog Service for initial loads and basic browsing
  return false;
};

// Transform Live Search facets to our clean format
const transformFacets = (aggregations) => {
  if (!aggregations || !Array.isArray(aggregations)) return [];
  
  return aggregations.map(facet => {
    const options = facet.options?.map(opt => ({
      label: opt.label,
      value: opt.value,
      count: opt.count || 0
    })) || [];
    
    return {
      attribute: facet.attribute,
      label: facet.label, // Use the label configured in Commerce admin
      options: options.filter(opt => opt.count > 0) // Only show options with products
    };
  }).filter(facet => facet.options.length > 0); // Only include facets with options
};

// Minimal query for product cards (listing pages) - Catalog Service
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

// Query for Live Search with facets
const SEARCH_QUERY = `{
  items {
    product {
      __typename
      uid
      name
      price_range {
        minimum_price {
          regular_price {
            value
            currency
          }
          final_price {
            value
            currency
          }
        }
      }
    }
    productView {
      inStock
      sku
      urlKey
      images {
        url
        label
      }
    }
  }
  aggregations {
    attribute
    label
    count
    options {
      label
      value
      count
    }
  }
  page_info {
    current_page
    page_size
    total_pages
  }
  total_count
}`;

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productCards: {
        resolve: async (root, args, context, info) => {
          try {
            const useLiveSearch = shouldUseLiveSearch(args);
            let searchResult;
            let items = [];
            let facets = null;
            
            if (useLiveSearch) {
              // Use Live Search for filtering and search
              const searchFilters = buildSearchFilters(args.filter);
              const searchSort = mapSortForLiveSearch(args.sort);
              
              searchResult = await context.LiveSearchSandbox.Query.Search_productSearch({
                root: {},
                args: {
                  phrase: args.phrase || '',
                  filter: searchFilters,
                  page_size: args.limit || 20,
                  current_page: args.page || 1,
                  sort: searchSort
                },
                context,
                selectionSet: SEARCH_QUERY
              });
              
              // Transform Live Search results to our format
              if (searchResult?.items) {
                items = searchResult.items.map(item => {
                  const product = item.product;
                  const productView = item.productView; // Live Search has more complete data in productView
                  const regularPrice = product.price_range?.minimum_price?.regular_price?.value;
                  const finalPrice = product.price_range?.minimum_price?.final_price?.value;
                  const onSale = isOnSale(regularPrice, finalPrice);
                  
                  // Use productView.images which has full URLs
                  const firstImage = productView?.images?.[0];
                  const image = firstImage ? {
                    url: ensureHttpsUrl(firstImage.url),
                    altText: firstImage.label || product.name
                  } : null;
                  
                  // For Live Search, we'll need to fetch attributes separately or use defaults
                  // This is a limitation we'll need to address with custom fields
                  return {
                    id: product.uid,
                    sku: productView?.sku || product.sku,
                    urlKey: productView?.urlKey || '',
                    name: product.name,
                    manufacturer: null, // Will need custom field
                    price: formatPrice(finalPrice),
                    originalPrice: onSale ? formatPrice(regularPrice) : null,
                    discountPercent: onSale ? calculateDiscountPercentage(regularPrice, finalPrice) : null,
                    inStock: productView?.inStock !== false, // default to true if missing
                    image: image,
                    memory: [], // Will need custom field
                    colors: []  // Will need custom field
                  };
                });
              }
              
              // Include facets if requested
              if (args.facets && searchResult?.aggregations) {
                facets = transformFacets(searchResult.aggregations);
              }
            } else {
              // Use Catalog Service for initial loads
              const catalogFilters = buildCatalogFilters(args.filter);
              const catalogSort = mapSortForCatalog(args.sort);
              const catalogArgs = {
                phrase: args.phrase || '',
                filter: catalogFilters,
                page_size: args.limit || 20,
                current_page: args.page || 1
              };
              
              // Only add sort if provided
              if (catalogSort) {
                catalogArgs.sort = catalogSort;
              }
              searchResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
                root: {},
                args: catalogArgs,
                context,
                selectionSet: PRODUCT_CARD_QUERY
              });
              
              // Transform Catalog results to our format
              if (searchResult?.items) {
                items = searchResult.items.map(item => {
                  const product = item.productView;
                  const isComplex = product.__typename === 'Catalog_ComplexProductView';
                  const regularPrice = extractRegularPrice(product);
                  const finalPrice = extractFinalPrice(product);
                  const onSale = isOnSale(regularPrice, finalPrice);
                  
                  const image = product.images?.[0] ? {
                    url: ensureHttpsUrl(product.images[0].url),
                    altText: product.images[0].label || product.name
                  } : null;
                  
                  const stockStatus = product.inStock || false;
                  
                  return {
                    id: product.id,
                    sku: product.sku,
                    urlKey: product.urlKey || '',
                    name: product.name,
                    manufacturer: extractAttributeValue(product.attributes, 'manufacturer', null),
                    price: formatPrice(finalPrice),
                    originalPrice: onSale ? formatPrice(regularPrice) : null,
                    discountPercent: onSale ? calculateDiscountPercentage(regularPrice, finalPrice) : null,
                    inStock: stockStatus,
                    image: image,
                    memory: isComplex ? extractMemoryOptions(product.options) : [],
                    colors: isComplex ? extractColorOptions(product.options) : []
                  };
                });
              }
            }
            
            const currentPage = searchResult?.page_info?.current_page || args.page || 1;
            const totalPages = searchResult?.page_info?.total_pages || 0;
            
            return {
              items,
              totalCount: searchResult?.total_count || 0,
              hasMoreItems: currentPage < totalPages,
              currentPage,
              facets // Will be null for Catalog, populated for Live Search
            };
          } catch (error) {
            throw error;
          }
        }
      }
    }
  }
};