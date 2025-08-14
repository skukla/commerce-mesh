/**
 * Custom resolvers for Adobe API Mesh
 * Adds fields to existing Catalog Service types and simplified product queries
 */

// Helper functions (must be inline)
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

// Minimal query for product cards (listing pages)
const PRODUCT_CARD_QUERY = `{
  items {
    productView {
      __typename
      id
      name
      sku
      inStock
      images(roles: ["small"]) {
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
        attributes {
          name
          label
          value
        }
        options {
          id
          title
          required
          values {
            id
            ... on Catalog_ProductViewOptionValueSwatch {
              title
              value
            }
          }
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

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productCards: {
        resolve: async (root, args, context, info) => {
          try {
            // Transform our simplified filter to Catalog format
            const catalogFilters = buildCatalogFilters(args.filter);
            
            // Call the Catalog service with minimal query
            const searchResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
              root: {},
              args: {
                phrase: args.phrase || '',
                filter: catalogFilters,
                page_size: args.limit || 20,
                current_page: args.page || 1
              },
              context,
              selectionSet: PRODUCT_CARD_QUERY
            });

            // Transform items to ProductCard type with flattened structure
            const items = searchResult.items.map(item => {
              const product = item.productView;
              const isComplex = product.__typename === 'Catalog_ComplexProductView';
              
              return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                manufacturer: extractAttributeValue(product.attributes, 'manufacturer', 'CitiSignal'),
                display_price: extractPrice(product),
                display_currency: extractCurrency(product),
                is_on_sale: isProductOnSale(product),
                discount_percentage: getProductDiscountPercentage(product),
                in_stock: product.inStock,
                image_url: extractImageUrl(product.images),
                specifications: extractSpecifications(product.attributes),
                // Complex product specific fields
                memory_options: isComplex ? extractMemoryOptions(product.options) : [],
                available_colors: isComplex ? extractColorOptions(product.options) : [],
              };
            });
            
            return {
              items,
              total_count: searchResult.total_count,
              page_info: searchResult.page_info
            };
          } catch (error) {
            console.error('ProductCards query error:', error);
            throw error;
          }
        }
      }
    },
    
    // Add fields to Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        }
      },
      memory_options: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          return extractMemoryOptions(root.options);
        }
      },
      available_colors: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          return extractColorOptions(root.options);
        }
      },
      is_on_sale: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root, args, context, info) => {
          if (!root.priceRange) return false;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return isOnSale(regular, final);
        }
      },
      display_price: {
        selectionSet: '{ priceRange { minimum { final { amount { value } } } } }',
        resolve: (root, args, context, info) => {
          return root.priceRange?.minimum?.final?.amount?.value || 0;
        }
      },
      display_currency: {
        selectionSet: '{ priceRange { minimum { final { amount { currency } } } } }',
        resolve: (root, args, context, info) => {
          return root.priceRange?.minimum?.final?.amount?.currency || 'USD';
        }
      },
      discount_percentage: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root, args, context, info) => {
          if (!root.priceRange) return 0;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        }
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root, args, context, info) => {
          return root.inStock || false;
        }
      },
      specifications: {
        selectionSet: '{ attributes { name label value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return [];
          
          return root.attributes.map(attr => ({
            name: attr.label || cleanAttributeName(attr.name) || '',
            value: attr.value || ''
          }));
        }
      },
      formatted_options: {
        selectionSet: '{ options { id title required values { id title ... on Catalog_ProductViewOptionValueSwatch { type value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.options) return [];
          
          return root.options.map(option => ({
            id: option.id,
            title: option.title,
            required: option.required || false,
            values: option.values?.map(v => ({
              id: v.id,
              title: v.title,
              value: v.value || null
            })) || []
          }));
        }
      }
    },
    
    // Add fields to Catalog_SimpleProductView  
    Catalog_SimpleProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        }
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.price) return false;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return isOnSale(regular, final);
        }
      },
      display_price: {
        selectionSet: '{ price { final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          return root.price?.final?.amount?.value || 0;
        }
      },
      display_currency: {
        selectionSet: '{ price { final { amount { currency } } } }',
        resolve: (root, args, context, info) => {
          return root.price?.final?.amount?.currency || 'USD';
        }
      },
      discount_percentage: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.price) return 0;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        }
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root, args, context, info) => {
          return root.inStock || false;
        }
      },
      specifications: {
        selectionSet: '{ attributes { name label value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return [];
          
          return root.attributes.map(attr => ({
            name: attr.label || cleanAttributeName(attr.name) || '',
            value: attr.value || ''
          }));
        }
      }
    }
  }
};