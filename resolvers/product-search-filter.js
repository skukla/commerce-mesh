/**
 * CITISIGNAL PRODUCT SEARCH & FILTER - CONSOLIDATED QUERY
 *
 * This resolver demonstrates the power of API Mesh to optimize frontend performance
 * by combining multiple related queries into a single, efficient operation.
 *
 * What Adobe gives us: Separate endpoints for products and facets
 * What we deliver: One query that returns both, reducing network overhead by 50%
 *
 * Use case: After initial page load, when users interact with filters or search,
 * this single query replaces what used to be two separate network requests.
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The optimized API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_productSearchFilter
 *
 * INPUT:
 *   query {
 *     Citisignal_productSearchFilter(
 *       phrase: "iphone"           // Optional search (triggers AI ranking)
 *       filter: {                   // Optional filters
 *         categoryUrlKey: "phones"
 *         manufacturer: "Apple"
 *         priceMin: 500
 *       }
 *       sort: { attribute: PRICE, direction: ASC }
 *       limit: 24
 *       page: 1
 *     )
 *   }
 *
 * OUTPUT - Both products AND facets in one response:
 *   {
 *     products: {
 *       items: [{ ... }]           // Product cards
 *       totalCount: 42
 *       hasMoreItems: true
 *       page_info: { ... }
 *     }
 *     facets: {
 *       facets: [{                 // Available filters
 *         key: "manufacturer"
 *         title: "Brand"
 *         options: [{ ... }]
 *       }]
 *     }
 *   }
 *
 * Performance impact:
 * - Before: 2 queries × ~200ms each = ~400ms total
 * - After: 1 query × ~250ms = 37.5% faster
 * - Bonus: Guaranteed data consistency (same filter context)
 */

// ============================================================================
// SHARED UTILITIES - Reused from existing resolvers for consistency
// ============================================================================

/**
 * Clean technical prefixes from attribute names
 */
const cleanAttributeName = (name) => {
  if (!name) return name;
  return name.startsWith('cs_') ? name.substring(3) : name;
};

/**
 * Normalize filter values for case-insensitive matching
 */
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

/**
 * Format price for display
 */
const formatPrice = (amount) => {
  if (!amount) return null;
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Calculate discount percentage
 */
const calculateDiscountPercent = (regularPrice, finalPrice) => {
  if (!regularPrice || !finalPrice || finalPrice >= regularPrice) return null;
  return Math.round(((regularPrice - finalPrice) / regularPrice) * 100);
};

/**
 * Ensure HTTPS in URLs
 */
const ensureHttps = (url) => {
  if (!url) return url;
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
};

/**
 * Extract price value from nested structures
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
 * Find attribute value by name
 */
const findAttributeValue = (attributes, name) => {
  if (!attributes || !Array.isArray(attributes)) return null;
  const attr = attributes.find((a) => a.name === name || a.name === `cs_${name}`);
  return attr?.value;
};

/**
 * Extract variant options from product
 */
const extractVariantOptions = (options) => {
  const variantOptions = {};

  if (!options || !Array.isArray(options)) {
    return variantOptions;
  }

  options.forEach((option) => {
    if (option.id?.startsWith('cs_')) {
      const cleanOptionName = cleanAttributeName(option.id);

      if (cleanOptionName === 'color' && option.values) {
        variantOptions.colors = option.values.map((v) => ({
          name: v.title,
          hex: v.value || '#000000',
        }));
      } else if (option.values) {
        variantOptions[cleanOptionName] = option.values.map((v) => v.title);
      }
    }
  });

  return variantOptions;
};

// ============================================================================
// FILTER TRANSFORMATION - Business filters to Adobe format
// ============================================================================

/**
 * Build filters for Catalog Service
 */
const buildCatalogFilters = (filter) => {
  if (!filter) return [];

  const catalogFilters = [];

  if (filter.categoryUrlKey) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.categoryUrlKey],
    });
  }

  if (filter.manufacturer) {
    catalogFilters.push({
      attribute: 'cs_manufacturer',
      in: [normalizeFilterValue(filter.manufacturer)],
    });
  }

  if (filter.memory) {
    catalogFilters.push({
      attribute: 'cs_memory',
      in: Array.isArray(filter.memory) ? filter.memory : [filter.memory],
    });
  }

  if (filter.colors && filter.colors.length > 0) {
    catalogFilters.push({
      attribute: 'cs_color',
      in: filter.colors,
    });
  }

  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    catalogFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999,
      },
    });
  }

  return catalogFilters;
};

/**
 * Build filters for Live Search
 */
const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];

  const searchFilters = [];

  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey],
    });
  }

  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [normalizeFilterValue(filter.manufacturer)],
    });
  }

  if (filter.memory) {
    searchFilters.push({
      attribute: 'cs_memory',
      in: Array.isArray(filter.memory) ? filter.memory : [filter.memory],
    });
  }

  if (filter.colors && filter.colors.length > 0) {
    searchFilters.push({
      attribute: 'cs_color',
      in: filter.colors,
    });
  }

  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    searchFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999,
      },
    });
  }

  return searchFilters;
};

// ============================================================================
// DATA TRANSFORMATION - Complex Adobe structures to clean API
// ============================================================================

/**
 * Transform product to card format
 */
const transformProductToCard = (product) => {
  if (!product) return null;

  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  const regularPrice = extractPriceValue(product, 'regular', isComplex);
  const finalPrice = extractPriceValue(product, 'final', isComplex);
  const manufacturer = findAttributeValue(product.attributes, 'manufacturer');

  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);
  const cleanManufacturer = cleanAttributeName(manufacturer);
  const variantOptions = extractVariantOptions(product.options);
  const imageUrl = product.images?.[0]?.url;
  const secureImageUrl = ensureHttps(imageUrl);

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    urlKey: product.urlKey || '',
    manufacturer: cleanManufacturer || null,
    price: formatPrice(finalPrice),
    originalPrice: isOnSale ? formatPrice(regularPrice) : null,
    discountPercent,
    inStock: product.inStock || false,
    image: imageUrl
      ? {
          url: secureImageUrl,
          altText: product.images[0].label || product.name,
        }
      : null,
    ...variantOptions,
  };
};

/**
 * Transform facets for filters
 */
const transformFacets = (facets) => {
  if (!facets || !Array.isArray(facets)) return [];

  return facets
    .map((facet) => {
      const cleanAttribute = cleanAttributeName(facet.attribute);
      const title = facet.title || cleanAttribute;

      return {
        key: cleanAttribute,
        title: title,
        type: 'checkbox',
        options:
          facet.buckets?.map((bucket) => ({
            id: bucket.title,
            name: bucket.title,
            count: bucket.count || 0,
          })) || [],
      };
    })
    .filter((facet) => facet.options.length > 0);
};

// ============================================================================
// SORT MAPPING - Business sort to service format
// ============================================================================

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

// ============================================================================
// CONSOLIDATED QUERY EXECUTION - The optimization magic happens here
// ============================================================================

/**
 * Execute consolidated query using Live Search (when searching)
 * Gets both products and facets from a SINGLE service call
 */
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

/**
 * Execute consolidated query using Catalog Service (when browsing/filtering)
 * Gets both products and facets from a SINGLE service call
 */
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

// ============================================================================
// MAIN RESOLVER - Orchestrates the consolidated query
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productSearchFilter: {
        resolve: async (root, args, context, _info) => {
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
