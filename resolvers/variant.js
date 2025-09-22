
// ============================================================================
// INJECTED FACET MAPPINGS - Added during build from config/facet-mappings.json
// ============================================================================
const FACET_MAPPINGS = {
  "version": "1.0",
  "description": "URL key mappings for SEO-friendly URLs. Display names come from Adobe Commerce.",
  "mappings": {
    "cs_manufacturer": "manufacturer",
    "cs_memory": "storage",
    "cs_color": "color",
    "price": "price",
    "categories": "category",
    "cs_connectivity": "connectivity",
    "cs_screen_size": "screen-size"
  },
  "defaults": {
    "removePrefix": [
      "cs_",
      "attr_",
      "custom_"
    ],
    "replaceUnderscore": true,
    "toLowerCase": true
  }
};

// Helper functions for facet mapping
const attributeCodeToUrlKey = (attributeCode) => {
  // Check for explicit mapping
  if (FACET_MAPPINGS.mappings && FACET_MAPPINGS.mappings[attributeCode]) {
    return FACET_MAPPINGS.mappings[attributeCode];
  }
  
  // Apply default transformations
  let urlKey = attributeCode;
  if (FACET_MAPPINGS.defaults) {
    // Remove prefixes
    (FACET_MAPPINGS.defaults.removePrefix || []).forEach(prefix => {
      if (urlKey.startsWith(prefix)) {
        urlKey = urlKey.substring(prefix.length);
      }
    });
    
    // Replace underscores
    if (FACET_MAPPINGS.defaults.replaceUnderscore) {
      urlKey = urlKey.replace(/_/g, '-');
    }
    
    // Convert to lowercase
    if (FACET_MAPPINGS.defaults.toLowerCase) {
      urlKey = urlKey.toLowerCase();
    }
  }
  
  return urlKey;
};

const urlKeyToAttributeCode = (urlKey) => {
  // Find the attribute code for a URL key
  if (FACET_MAPPINGS.mappings) {
    for (const [attributeCode, mappedKey] of Object.entries(FACET_MAPPINGS.mappings)) {
      if (mappedKey === urlKey) {
        return attributeCode;
      }
    }
  }
  
  // If no mapping found, try to reverse the default transformations
  // This is a best-effort approach
  return urlKey.replace(/-/g, '_');
};

// ============================================================================
// SHARED UTILITY FUNCTIONS - Injected at build time
// ============================================================================

/**
 * Extract configurable options from product options
 * Shared utility function injected into all resolvers that need it
 */
const extractConfigurableOptions = (options) => {
  if (!options || !Array.isArray(options)) return [];

  return options.map(option => ({
    label: option.title || option.label || '',
    attribute_code: option.id || option.attribute_code || '',
    values: (option.values || []).map(value => ({
      label: value.title || value.label || '',
      value: value.value || value.id || '',
      swatch_data: value.swatch_data ? {
        type: value.swatch_data.type || 'text',
        value: value.swatch_data.value || ''
      } : null
    }))
  }));
};

// ============================================================================
// ORIGINAL RESOLVER CODE BELOW
// ============================================================================
/**
 * SIMPLE VARIANT RESOLVER
 * Frontend sends user selections, backend finds the right variant
 * No complex logic in frontend, no overengineering
 */

const formatPrice = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_getVariant: {
        resolve: async (_root, args, context, _info) => {
          try {
            // 1. Get the configurable product with all variants
            const result = await context.CommerceGraphQL.Query.Commerce_products({
              root: {},
              args: { filter: { sku: { eq: args.productSku } } },
              context,
              selectionSet: `{
                items {
                  ... on Commerce_ConfigurableProduct {
                    variants {
                      product {
                        sku
                        name
                        inStock
                        price {
                          regularPrice { amount { value } }
                          finalPrice { amount { value } }
                        }
                        images { url label }
                      }
                    }
                  }
                }
              }`
            });

            const configProduct = result?.items?.[0];
            if (!configProduct?.variants) {
              throw new Error(`No variants found for product ${args.productSku}`);
            }

            // 2. Simple matching: find variant by checking if SKU contains the values
            const selections = args.selections;
            
            const matchingVariant = configProduct.variants.find(variant => {
              const sku = variant.product.sku.toLowerCase();
              
              // For each selection, check if the SKU contains it
              return Object.values(selections).every(value => {
                if (!value) return true;
                
                // Handle different value types
                const searchValue = String(value).toLowerCase();
                
                // Direct string matching (works for most cases)
                if (sku.includes(searchValue)) return true;
                
                // For hex colors, we'd need to map to color names
                // This is the ONLY complex logic needed
                if (searchValue.startsWith('#')) {
                  const colorMap = {
                    '#64464e': 'burgundy',
                    '#425456': 'green', 
                    '#08080a': 'phantom-black',
                    '#fcfcfc': 'phantom-white'
                  };
                  const colorName = colorMap[searchValue];
                  return colorName && sku.includes(colorName);
                }
                
                return false;
              });
            });

            if (!matchingVariant) {
              throw new Error(`No variant found for selections: ${JSON.stringify(selections)}`);
            }

            // 3. Return the simple result
            const product = matchingVariant.product;
            const regularPrice = product.price?.regularPrice?.amount?.value;
            const finalPrice = product.price?.finalPrice?.amount?.value || regularPrice;
            const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
            const primaryImage = product.images?.[0];

            return {
              sku: product.sku,
              name: product.name,
              price: formatPrice(finalPrice),
              originalPrice: isOnSale ? formatPrice(regularPrice) : null,
              inStock: product.inStock || false,
              image: primaryImage ? {
                url: ensureHttpsUrl(primaryImage.url),
                altText: primaryImage.label || product.name
              } : null
            };

          } catch (error) {
            console.error('Variant resolver error:', error);
            throw error;
          }
        },
      },
    },
  },
};
