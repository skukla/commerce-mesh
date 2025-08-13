/**
 * Custom resolvers for Adobe API Mesh
 * Adds fields to existing Catalog Service types and simplified product queries
 */

module.exports = {
  resolvers: {
    Query: {
      simpleProducts: {
        selectionSet: `{
          Catalog_productSearch(
            phrase: $category
            page_size: 20
          ) {
            items {
              productView {
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
                ... on Catalog_SimpleProductView {
                  price {
                    final {
                      amount {
                        value
                        currency
                      }
                    }
                    regular {
                      amount {
                        value
                        currency
                      }
                    }
                  }
                  attributes {
                    name
                    value
                  }
                }
                ... on Catalog_ComplexProductView {
                  priceRange {
                    minimum {
                      final {
                        amount {
                          value
                          currency
                        }
                      }
                      regular {
                        amount {
                          value
                          currency
                        }
                      }
                    }
                  }
                  attributes {
                    name
                    value
                  }
                  options {
                    id
                    title
                    required
                    values {
                      id
                      title
                      ... on Catalog_ProductViewOptionValueSwatch {
                        type
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
          }
        }`,
        resolve: (root, args, context, info) => {
          const searchResult = root.Catalog_productSearch;
          if (!searchResult || !searchResult.items) {
            return [];
          }

          return searchResult.items.map(item => {
            const product = item.productView;
            
            // Get price based on product type
            let price = 0;
            let originalPrice = 0;
            let currency = 'USD';
            
            if (product.__typename === 'Catalog_SimpleProductView' && product.price) {
              price = product.price.final?.amount?.value || 0;
              originalPrice = product.price.regular?.amount?.value || 0;
              currency = product.price.final?.amount?.currency || 'USD';
            } else if (product.__typename === 'Catalog_ComplexProductView' && product.priceRange) {
              price = product.priceRange.minimum?.final?.amount?.value || 0;
              originalPrice = product.priceRange.minimum?.regular?.amount?.value || 0;
              currency = product.priceRange.minimum?.final?.amount?.currency || 'USD';
            }
            
            // Flatten attributes into specs object
            const specs = {};
            if (product.attributes) {
              product.attributes.forEach(attr => {
                if (attr.name && attr.value) {
                  // Clean up attribute names for better readability
                  const cleanName = attr.name
                    .replace(/^cs_/, '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                  specs[cleanName] = attr.value;
                }
              });
            }
            
            // Add options for complex products
            if (product.options) {
              product.options.forEach(option => {
                if (option.title && option.values) {
                  const values = option.values.map(v => v.title || v.value).filter(Boolean);
                  if (values.length > 0) {
                    specs[option.title] = values.join(', ');
                  }
                }
              });
            }
            
            return {
              id: product.id,
              name: product.name,
              sku: product.sku,
              url: product.urlKey,
              description: product.shortDescription || '',
              image: product.images?.[0]?.url || null,
              price: price,
              originalPrice: originalPrice,
              currency: currency,
              onSale: price < originalPrice,
              specs: JSON.stringify(specs) // Converting to string since GraphQL doesn't support arbitrary object types
            };
          });
        }
      }
    },
    
    // Add fields to Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return 'CitiSignal';
          
          const manufacturerAttr = root.attributes.find(attr => 
            attr.name === 'cs_manufacturer' || attr.name === 'manufacturer'
          );
          
          return manufacturerAttr?.value || 'CitiSignal';
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
          return final < regular;
        }
      }
    },
    
    // Add fields to Catalog_SimpleProductView  
    Catalog_SimpleProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return 'CitiSignal';
          
          const manufacturerAttr = root.attributes.find(attr => 
            attr.name === 'cs_manufacturer' || attr.name === 'manufacturer'
          );
          
          return manufacturerAttr?.value || 'CitiSignal';
        }
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.price) return false;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return final < regular;
        }
      }
    }
  }
};