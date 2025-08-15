/**
 * Product Query Resolvers for Adobe API Mesh
 * 
 * This file contains custom GraphQL query resolvers that provide simplified
 * product search and listing functionality with clean, camelCase field names
 * to match the Catalog Service API.
 * 
 * Main queries:
 * - Citisignal_productCards: Returns products formatted for category/listing pages
 */

// Helper functions for the Citisignal_productCards resolver
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
  return `$${amount.toFixed(2)}`;
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
  
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    catalogFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999
      }
    });
  }
  
  if (filter.inStockOnly) {
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

            // Check if we got a valid result
            if (!searchResult || !searchResult.items) {
              return {
                items: [],
                totalCount: 0,
                hasMoreItems: false,
                currentPage: args.page || 1
              };
            }

            // Transform items to clean ProductCard format
            const items = searchResult.items.map(item => {
              const product = item.productView;
              const isComplex = product.__typename === 'Catalog_ComplexProductView';
              const regularPrice = extractRegularPrice(product);
              const finalPrice = extractFinalPrice(product);
              const onSale = isOnSale(regularPrice, finalPrice);
              
              // Transform image URL to HTTPS
              const image = product.images?.[0] ? {
                ...product.images[0],
                url: ensureHttpsUrl(product.images[0].url)
              } : null;
              
              return {
                id: product.id,
                sku: product.sku,
                urlKey: product.urlKey || '',
                name: product.name,
                manufacturer: extractAttributeValue(product.attributes, 'manufacturer', null),
                price: formatPrice(finalPrice),
                originalPrice: onSale ? formatPrice(regularPrice) : null,
                discountPercent: onSale ? calculateDiscountPercentage(regularPrice, finalPrice) : null,
                inStock: product.inStock || false,
                image: image,
                memory: isComplex ? extractMemoryOptions(product.options) : [],
                colors: isComplex ? extractColorOptions(product.options) : []
              };
            });
            
            const currentPage = searchResult.page_info?.current_page || args.page || 1;
            const totalPages = searchResult.page_info?.total_pages || 0;
            
            return {
              items,
              totalCount: searchResult.total_count,
              hasMoreItems: currentPage < totalPages,
              currentPage
            };
          } catch (error) {
            console.error('ProductCards query error:', error);
            throw error;
          }
        }
      }
    }
  }
};