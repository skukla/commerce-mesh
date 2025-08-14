const cleanAttributeName = (name) => {
    if (!name) return '';
    // Remove cs_ prefix if present
    return name.startsWith('cs_') ? name.substring(3) : name;
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
  
  const extractPrice = (product) => {
    const isComplex = product.__typename === 'Catalog_ComplexProductView';
    return isComplex 
      ? product.priceRange?.minimum?.final?.amount?.value
      : product.price?.final?.amount?.value;
  };
  
  const extractCurrency = (product) => {
    const isComplex = product.__typename === 'Catalog_ComplexProductView';
    return isComplex 
      ? product.priceRange?.minimum?.final?.amount?.currency || 'USD'
      : product.price?.final?.amount?.currency || 'USD';
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
  
  const isProductOnSale = (product) => {
    const regular = extractRegularPrice(product);
    const final = extractFinalPrice(product);
    return isOnSale(regular, final);
  };
  
  const getProductDiscountPercentage = (product) => {
    const regular = extractRegularPrice(product);
    const final = extractFinalPrice(product);
    return calculateDiscountPercentage(regular, final);
  };
  
  const extractSpecifications = (attributes) => {
    if (!attributes) return [];
    return attributes.map(attr => ({
      name: attr.label || cleanAttributeName(attr.name),
      value: attr.value
    }));
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
  
  const extractImageUrl = (images) => {
    if (!images || !Array.isArray(images) || images.length === 0) return '';
    
    // First try to find an image with 'small' role
    const smallImage = images.find(img => img.roles?.includes('small'));
    if (smallImage?.url) return smallImage.url;
    
    // Fallback to first image if no small image found
    return images[0]?.url || '';
  };
  
  const isOnSale = (regularPrice, finalPrice) => {
    return finalPrice < regularPrice;
  };
  
  const calculateDiscountPercentage = (regularPrice, finalPrice) => {
    if (!regularPrice || regularPrice <= 0) return 0;
    if (!finalPrice || finalPrice >= regularPrice) return 0;
    
    const discount = ((regularPrice - finalPrice) / regularPrice) * 100;
    return Math.round(discount * 10) / 10; // Round to 1 decimal place
  };
  
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
    
    if (filter.price_min !== undefined || filter.price_max !== undefined) {
      catalogFilters.push({
        attribute: 'price',
        range: {
          from: filter.price_min || 0,
          to: filter.price_max || 999999
        }
      });
    }
    
    if (filter.in_stock_only) {
      catalogFilters.push({
        attribute: 'inStock',
        eq: 'true'
      });
    }
    
    return catalogFilters;
  };

module.exports = {
  cleanAttributeName,
  extractAttributeValue,
  extractPrice,
  extractCurrency,
  extractRegularPrice,
  extractFinalPrice,
  isProductOnSale,
  getProductDiscountPercentage,
  extractSpecifications,
  extractOptionByTitle,
  extractMemoryOptions,
  extractColorOptions,
  extractImageUrl,
  isOnSale,
  calculateDiscountPercentage,
  buildCatalogFilters
};