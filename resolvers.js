/**
 * Custom resolvers for Adobe API Mesh
 * Adds fields to existing Catalog Service types and simplified product queries
 */

// Helper functions (must be inline)
const extractManufacturer = (attributes) => {
  if (!attributes) return 'CitiSignal';
  
  const manufacturerAttr = attributes.find(attr => 
    attr.name === 'cs_manufacturer' || attr.name === 'manufacturer'
  );
  
  return manufacturerAttr?.value || 'CitiSignal';
};

const calculateIsOnSale = (regularPrice, finalPrice) => {
  return finalPrice < regularPrice;
};

const calculateDiscountPercentage = (regularPrice, finalPrice) => {
  if (!regularPrice || regularPrice <= 0) return 0;
  if (!finalPrice || finalPrice >= regularPrice) return 0;
  
  const discount = ((regularPrice - finalPrice) / regularPrice) * 100;
  return Math.round(discount * 10) / 10; // Round to 1 decimal place
};

const cleanAttributeName = (name) => {
  return name
    .replace(/^cs_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Query string for fetching product data from Catalog service
const PRODUCT_SEARCH_QUERY = `{
  items {
    productView {
      __typename
      id
      name
      sku
      urlKey
      shortDescription
      images(roles: []) {
        url
        label
        roles
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
      products: {
        resolve: async (root, args, context, info) => {
          try {
            // Call the Catalog service programmatically
            const searchResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
              root: {},
              args: {
                phrase: args.phrase || '',
                filter: args.filter || [],
                page_size: args.limit || 20,
                current_page: args.page || 1
              },
              context,
              selectionSet: PRODUCT_SEARCH_QUERY
            });

            // If no result, return empty response
            if (!searchResult) {
              return {
                items: [],
                total: 0,
                page_info: {
                  current_page: args.page || 1,
                  page_size: args.limit || 20,
                  total_pages: 0
                }
              };
            }

            // Transform the results to our custom structure
            return {
              items: searchResult.items?.map(item => ({
                product: item.productView
              })) || [],
              total: searchResult.total_count || 0,
              page_info: searchResult.page_info || {
                current_page: args.page || 1,
                page_size: args.limit || 20,
                total_pages: 0
              }
            };
          } catch (error) {
            console.error('Products query error:', error);
            // Return empty result on error
            return {
              items: [],
              total: 0,
              page_info: {
                current_page: args.page || 1,
                page_size: args.limit || 20,
                total_pages: 0
              }
            };
          }
        }
      }
    },
    
    // Add fields to Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          return extractManufacturer(root.attributes);
        }
      },
      memory_options: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.options) return [];
          
          const memoryOption = root.options.find(opt => opt.title === 'Memory');
          return memoryOption?.values?.map(v => v.title) || [];
        }
      },
      available_colors: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.options) return [];
          
          const colorOption = root.options.find(opt => opt.title === 'Color');
          return colorOption?.values?.map(v => ({
            name: v.title,
            hex: v.value || '#000000'
          })) || [];
        }
      },
      is_on_sale: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root, args, context, info) => {
          if (!root.priceRange) return false;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return calculateIsOnSale(regular, final);
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
        selectionSet: '{ stock_status }',
        resolve: (root, args, context, info) => {
          return root.stock_status === 'IN_STOCK';
        }
      },
      primary_category: {
        selectionSet: '{ categories { name url_path } }',
        resolve: (root, args, context, info) => {
          return root.categories?.[0] || null;
        }
      },
      specifications: {
        selectionSet: '{ custom_attributes { code label value { label value } } }',
        resolve: (root, args, context, info) => {
          if (!root.custom_attributes) return [];
          
          return root.custom_attributes.map(attr => ({
            name: attr.label || cleanAttributeName(attr.code),
            value: attr.value?.label || attr.value?.value || ''
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
          return extractManufacturer(root.attributes);
        }
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.price) return false;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return calculateIsOnSale(regular, final);
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
        selectionSet: '{ stock_status }',
        resolve: (root, args, context, info) => {
          return root.stock_status === 'IN_STOCK';
        }
      },
      primary_category: {
        selectionSet: '{ categories { name url_path } }',
        resolve: (root, args, context, info) => {
          return root.categories?.[0] || null;
        }
      },
      specifications: {
        selectionSet: '{ custom_attributes { code label value { label value } } }',
        resolve: (root, args, context, info) => {
          if (!root.custom_attributes) return [];
          
          return root.custom_attributes.map(attr => ({
            name: attr.label || cleanAttributeName(attr.code),
            value: attr.value?.label || attr.value?.value || ''
          }));
        }
      }
    }
  }
};