/**
 * Field Extensions for Adobe Catalog Service Types
 * 
 * This file extends native Adobe Catalog Service GraphQL types with computed fields
 * that provide cleaner, more business-friendly data transformations.
 * 
 * Extended types:
 * - Catalog_ComplexProductView: Adds fields for configurable/bundled products
 * - Catalog_SimpleProductView: Adds fields for simple products
 * 
 * Common fields added:
 * - manufacturer: Clean manufacturer name without cs_ prefix
 * - is_on_sale: Boolean indicating if product has a discount
 * - display_price/display_currency: Formatted pricing fields
 * - discount_percentage: Calculated discount percentage
 * - specifications: Cleaned product attributes
 * - secure_image/secure_images: Ensure HTTPS URLs for images
 */

// Helper functions (must be duplicated due to API Mesh limitations)
const cleanAttributeName = (name) => {
  if (!name) return '';
  // Remove cs_ prefix if present
  return name.startsWith('cs_') ? name.substring(3) : name;
};

const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
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
  return Math.round(discount * 10) / 10; // Round to 1 decimal place
};

module.exports = {
  resolvers: {
    // Field extensions for Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        }
      },
      memory_options: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root) => {
          return extractMemoryOptions(root.options);
        }
      },
      available_colors: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root) => {
          return extractColorOptions(root.options);
        }
      },
      is_on_sale: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root) => {
          if (!root.priceRange) return false;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return isOnSale(regular, final);
        }
      },
      display_price: {
        selectionSet: '{ priceRange { minimum { final { amount { value } } } } }',
        resolve: (root) => {
          return root.priceRange?.minimum?.final?.amount?.value || 0;
        }
      },
      display_currency: {
        selectionSet: '{ priceRange { minimum { final { amount { currency } } } } }',
        resolve: (root) => {
          return root.priceRange?.minimum?.final?.amount?.currency || 'USD';
        }
      },
      discount_percentage: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root) => {
          if (!root.priceRange) return 0;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        }
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root) => {
          return root.inStock || false;
        }
      },
      secure_image: {
        selectionSet: '{ images(roles: ["small_image"]) { url label roles } }',
        resolve: (root) => {
          if (!root.images || root.images.length === 0) return null;
          const firstImage = root.images[0];
          return {
            ...firstImage,
            url: ensureHttpsUrl(firstImage.url)
          };
        }
      },
      secure_images: {
        selectionSet: '{ images { url label roles } }',
        resolve: (root) => {
          if (!root.images) return [];
          return root.images.map(image => ({
            ...image,
            url: ensureHttpsUrl(image.url)
          }));
        }
      }
    },
    
    // Field extensions for Catalog_SimpleProductView
    Catalog_SimpleProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        }
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root) => {
          if (!root.price) return false;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return isOnSale(regular, final);
        }
      },
      display_price: {
        selectionSet: '{ price { final { amount { value } } } }',
        resolve: (root) => {
          return root.price?.final?.amount?.value || 0;
        }
      },
      display_currency: {
        selectionSet: '{ price { final { amount { currency } } } }',
        resolve: (root) => {
          return root.price?.final?.amount?.currency || 'USD';
        }
      },
      discount_percentage: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root) => {
          if (!root.price) return 0;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        }
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root) => {
          return root.inStock || false;
        }
      },
      secure_image: {
        selectionSet: '{ images(roles: ["small_image"]) { url label roles } }',
        resolve: (root) => {
          if (!root.images || root.images.length === 0) return null;
          const firstImage = root.images[0];
          return {
            ...firstImage,
            url: ensureHttpsUrl(firstImage.url)
          };
        }
      },
      secure_images: {
        selectionSet: '{ images { url label roles } }',
        resolve: (root) => {
          if (!root.images) return [];
          return root.images.map(image => ({
            ...image,
            url: ensureHttpsUrl(image.url)
          }));
        }
      }
    }
  }
};