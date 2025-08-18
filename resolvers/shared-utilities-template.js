/**
 * SHARED UTILITIES TEMPLATE
 * 
 * Copy this section to the top of each resolver due to API Mesh limitations.
 * Adobe API Mesh does not support importing from external files, so we must
 * duplicate these utilities in each resolver file.
 * 
 * IMPORTANT: Keep these utilities consistent across all resolvers.
 * If you update one, update them all.
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
 * Convert array of FilterInput to ProductFilter object
 * Used for transforming frontend filters to service-specific formats
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

/**
 * Build filters for Catalog Service
 */
const buildCatalogFilters = (productFilter) => {
  if (!productFilter) return [];
  
  return [
    productFilter.category && { attribute: 'categoryPath', in: [productFilter.category] },
    productFilter.manufacturer && { attribute: 'cs_manufacturer', in: [productFilter.manufacturer] },
    (productFilter.priceMin !== undefined || productFilter.priceMax !== undefined) && {
      attribute: 'price',
      range: {
        from: productFilter.priceMin || DEFAULT_MIN_PRICE,
        to: productFilter.priceMax || DEFAULT_MAX_PRICE
      }
    },
    productFilter.memory && { attribute: 'memory', in: productFilter.memory },
    productFilter.colors && { attribute: 'color', in: productFilter.colors }
  ].filter(Boolean);
};

/**
 * Build filters for Live Search
 */
const buildLiveSearchFilters = (productFilter) => {
  if (!productFilter) return [];
  
  return [
    productFilter.category && { attribute: 'categories', in: [productFilter.category] },
    productFilter.manufacturer && { attribute: 'cs_manufacturer', in: [productFilter.manufacturer] },
    (productFilter.priceMin !== undefined || productFilter.priceMax !== undefined) && {
      attribute: 'price',
      range: {
        from: productFilter.priceMin || DEFAULT_MIN_PRICE,
        to: productFilter.priceMax || DEFAULT_MAX_PRICE
      }
    },
    productFilter.memory && { attribute: 'memory', in: productFilter.memory },
    productFilter.colors && { attribute: 'color', in: productFilter.colors }
  ].filter(Boolean);
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
// SECTION 5: PRODUCT OPTIONS
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

// ============================================================================
// SECTION 6: URL UTILITIES
// ============================================================================

/**
 * Ensure URL uses HTTPS protocol
 */
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  // Convert HTTP to HTTPS
  return url.replace(/^http:\/\//, 'https://');
};

// ============================================================================
// SECTION 7: PRODUCT TRANSFORMATION
// ============================================================================

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
// SECTION 8: ERROR HANDLING
// ============================================================================

/**
 * Get safe default response for errors
 */
const getSafeDefaults = (type) => {
  const defaults = {
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
  
  return type ? defaults[type] : defaults;
};