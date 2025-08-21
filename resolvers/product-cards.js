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
 *         categoryUrlKey: "phones"
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
 *     categoryUrlKey: "phones",
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

  // Category filter - uses URL key like "phones"
  if (filter.categoryUrlKey) {
    catalogFilters.push({
      attribute: 'categoryPath',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Convert URL key back to Adobe attribute code
      const attributeCode = getAttributeCode(urlKey);

      if (attributeCode === 'price' && Array.isArray(value) && value.length > 0) {
        const [min, max] = value[0].split('-').map(parseFloat);
        catalogFilters.push({
          attribute: attributeCode,
          range: { from: min || 0, to: max || 999999 },
        });
      } else if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        catalogFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
      }
    });
  }

  // Legacy filters removed - all filtering now goes through dynamic facets

  return catalogFilters;
};

const buildLiveSearchFilters = (filter) => {
  if (!filter) return [];

  const searchFilters = [];

  // Live Search uses 'categories' instead of 'categoryPath'
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey],
    });
  }

  // Handle dynamic facets from JSON object
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Convert URL key back to Adobe attribute code
      const attributeCode = getAttributeCode(urlKey);

      if (attributeCode === 'price' && Array.isArray(value) && value.length > 0) {
        // Special handling for price ranges
        const [min, max] = value[0].split('-').map(parseFloat);
        searchFilters.push({
          attribute: attributeCode,
          range: { from: min || 0, to: max || 999999 },
        });
      } else if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        // Normalize values for manufacturer attribute
        let normalizedValue = value;
        if (attributeCode === 'cs_manufacturer' || attributeCode === 'manufacturer') {
          normalizedValue = Array.isArray(value)
            ? value.map((v) => normalizeFilterValue(v))
            : normalizeFilterValue(value);
        }

        // All other attributes use 'in' filter
        searchFilters.push({
          attribute: attributeCode,
          in: Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue],
        });
      }
    });
  }

  // Legacy filters removed - all filtering now goes through dynamic facets

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
 * Normalize filter values for case-insensitive matching
 * Capitalizes first letter to match how brand names are typically stored
 * Examples: "apple" -> "Apple", "APPLE" -> "Apple", "Apple" -> "Apple"
 */
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

/**
 * Format price for display with currency symbol and thousands separator
 */
const formatPrice = (amount) => {
  // Always return a string for non-nullable price field
  if (!amount && amount !== 0) return '$0.00';
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
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  // Handle protocol-relative URLs (//domain.com)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Replace HTTP with HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
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
  const attr = attributes.find((a) => a.name === name || a.name === `cs_${name}`);
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

  options.forEach((option) => {
    if (option.id?.startsWith('cs_')) {
      // Clean the option name using helper
      const cleanOptionName = cleanAttributeName(option.id);

      // Special handling for color options (include hex values)
      if (cleanOptionName === 'color' && option.values) {
        variantOptions.colors = option.values.map((v) => ({
          name: v.title,
          hex: v.value || '#000000',
        }));
      }
      // Standard handling for other options (memory, storage, etc.)
      else if (option.values) {
        variantOptions[cleanOptionName] = option.values.map((v) => v.title);
      }
    }
  });

  return variantOptions;
};

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
  const regularPrice = extractPriceValue(product, 'regular', isComplex);
  const finalPrice = extractPriceValue(product, 'final', isComplex);
  const manufacturer = findAttributeValue(product.attributes, 'manufacturer');

  // --- APPLY BUSINESS LOGIC ---
  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = calculateDiscountPercent(regularPrice, finalPrice);
  const cleanManufacturer = cleanAttributeName(manufacturer);
  const variantOptions = extractVariantOptions(product.options);
  const imageUrl = product.images?.[0]?.url;
  const secureImageUrl = ensureHttpsUrl(imageUrl);

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
    image: imageUrl
      ? {
          url: secureImageUrl,
          altText: product.images[0].label || product.name,
        }
      : null,

    // Variant options - dynamically included based on what's available
    ...variantOptions,
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

  const items = orderedSkus
    .map((sku) => productMap.get(sku))
    .filter(Boolean)
    .map(transformProductToCard);

  return {
    items,
    pageInfo: liveSearchResult?.page_info,
    totalCount: liveSearchResult?.total_count || 0,
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

  const items =
    result?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [];

  return {
    items,
    pageInfo: result?.page_info,
    totalCount: result?.total_count || 0,
  };
};

// ============================================================================
// MAIN RESOLVER - Brings it all together
// ============================================================================

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
            console.error('Product cards resolver error:', error);
            throw error;
          }
        },
      },
    },
  },
};
