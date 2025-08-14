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

const extractPrice = (product) => {
  const isComplex = product.__typename === 'Catalog_ComplexProductView';
  return isComplex 
    ? product.priceRange?.minimum?.final?.amount?.value
    : product.price?.final?.amount?.value;
};

const extractMemoryOptions = (options) => {
  if (!options) return [];
  const memoryOption = options.find(opt => opt.title === 'Memory');
  return memoryOption?.values?.map(v => v.title) || [];
};

const extractColorOptions = (options) => {
  if (!options) return [];
  const colorOption = options.find(opt => opt.title === 'Color');
  return colorOption?.values?.map(v => ({
    name: v.title,
    hex: v.value || '#000000'
  })) || [];
};

const extractPrimaryImage = (images) => {
  return images?.[0]?.url || null;
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

// Minimal query for product cards (listing pages)
const PRODUCT_CARD_QUERY = `{
  items {
    productView {
      __typename
      id
      name
      sku
      inStock
      images(roles: ["image"]) {
        url
        label
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
            const catalogFilters = [];
            if (args.filter) {
              if (args.filter.category) {
                catalogFilters.push({
                  attribute: 'categoryPath',
                  in: [args.filter.category]
                });
              }
              if (args.filter.manufacturer) {
                catalogFilters.push({
                  attribute: 'manufacturer',
                  eq: args.filter.manufacturer
                });
              }
              if (args.filter.price_min !== undefined || args.filter.price_max !== undefined) {
                catalogFilters.push({
                  attribute: 'price',
                  range: {
                    from: args.filter.price_min || 0,
                    to: args.filter.price_max || 999999
                  }
                });
              }
              if (args.filter.in_stock_only) {
                catalogFilters.push({
                  attribute: 'inStock',
                  eq: 'true'
                });
              }
              // Note: on_sale_only would need custom logic since it's computed
            }
            
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

            // If no result, return empty response
            if (!searchResult) {
              return {
                items: [],
                total_count: 0,
                page_info: {
                  current_page: args.page || 1,
                  page_size: args.limit || 20,
                  total_pages: 0
                }
              };
            }

            // Transform items to ProductCard type with flattened structure
            const items = searchResult.items?.map(item => {
              const product = item.productView;
              const isComplex = product.__typename === 'Catalog_ComplexProductView';
              
              return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                manufacturer: extractManufacturer(product.attributes),
                display_price: extractPrice(product),
                display_currency: isComplex 
                  ? product.priceRange?.minimum?.final?.amount?.currency || 'USD'
                  : product.price?.final?.amount?.currency || 'USD',
                is_on_sale: isComplex
                  ? calculateIsOnSale(
                      product.priceRange?.minimum?.regular?.amount?.value,
                      product.priceRange?.minimum?.final?.amount?.value
                    )
                  : calculateIsOnSale(
                      product.price?.regular?.amount?.value,
                      product.price?.final?.amount?.value
                    ),
                discount_percentage: isComplex
                  ? calculateDiscountPercentage(
                      product.priceRange?.minimum?.regular?.amount?.value,
                      product.priceRange?.minimum?.final?.amount?.value
                    )
                  : calculateDiscountPercentage(
                      product.price?.regular?.amount?.value,
                      product.price?.final?.amount?.value
                    ),
                in_stock: product.inStock || false,
                images: product.images || [],
                specifications: product.attributes?.map(attr => ({
                  name: attr.label || attr.name || '',
                  value: attr.value || ''
                })) || [],
                // Complex product specific fields
                memory_options: isComplex ? extractMemoryOptions(product.options) : [],
                available_colors: isComplex ? extractColorOptions(product.options) : [],
                formatted_options: isComplex && product.options ? 
                  product.options.map(option => ({
                    id: option.id,
                    title: option.title,
                    required: option.required || false,
                    values: option.values?.map(v => ({
                      id: v.id,
                      title: v.title,
                      value: v.value || null
                    })) || []
                  })) : []
              };
            }) || [];

            return {
              items,
              total_count: searchResult.total_count || 0,
              page_info: searchResult.page_info || {
                current_page: args.page || 1,
                page_size: args.limit || 20,
                total_pages: 0
              }
            };
          } catch (error) {
            console.error('ProductCards query error:', error);
            // Return empty result on error
            return {
              items: [],
              total_count: 0,
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
            name: attr.label || attr.name || '',
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
            name: attr.label || attr.name || '',
            value: attr.value || ''
          }));
        }
      }
    }
  }
};