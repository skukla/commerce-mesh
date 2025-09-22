
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
 * CITISIGNAL SIMPLE PRODUCT - Individual Product Details by SKU
 *
 * This resolver fetches details for a specific simple product SKU.
 * Used for variant selection where the frontend needs to get exact
 * product details (images, price, stock) for a selected variant.
 */

// ============================================================================
// UTILITY FUNCTIONS - Reused from product-detail.js
// ============================================================================

/**
 * Format price for display with currency symbol and thousands separator
 */
const formatPrice = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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
 * Advanced flexible variant matching
 * Supports any product type and any attribute structure
 */
const createFlexibleVariantMatcher = (configurableOptions, valueToLabelMap) => {
  return (variant, requestedAttributes) => {
    const product = variant.product;
    let matches = true;

    Object.entries(requestedAttributes).forEach(([attrCode, attrValue]) => {
      if (!attrValue) return; // Skip empty values

      let attributeMatched = false;

      // Strategy 1: Direct label mapping from configurable options
      const label = valueToLabelMap[`${attrCode}:${attrValue}`];
      if (label && product.sku.toLowerCase().includes(label.toLowerCase())) {
        attributeMatched = true;
        return;
      }

      // Strategy 2: Direct value matching (for simple values)
      if (product.sku.toLowerCase().includes(String(attrValue).toLowerCase())) {
        attributeMatched = true;
        return;
      }

      // Strategy 3: Search through all configurable options
      configurableOptions.forEach(option => {
        if (option.values) {
          option.values.forEach(optionValue => {
            if ((optionValue.value === attrValue || optionValue.title === attrValue) &&
                product.sku.toLowerCase().includes(optionValue.title.toLowerCase())) {
              attributeMatched = true;
            }
          });
        }
      });

      // Strategy 4: Pattern-based matching for different value types
      if (!attributeMatched) {
        const normalizedValue = String(attrValue).toLowerCase();
        const normalizedSku = product.sku.toLowerCase();
        
        // Hex colors
        if (normalizedValue.startsWith('#')) {
          configurableOptions.forEach(option => {
            if (option.id.toLowerCase().includes('color') && option.values) {
              option.values.forEach(colorValue => {
                if (colorValue.value === attrValue && normalizedSku.includes(colorValue.title.toLowerCase())) {
                  attributeMatched = true;
                }
              });
            }
          });
        }
        // Size/memory patterns (128GB, XL, Large, etc.)
        else if (normalizedValue.match(/^(xs|s|m|l|xl|xxl|\d+(gb|mb|kb|tb))$/i)) {
          if (normalizedSku.includes(normalizedValue)) {
            attributeMatched = true;
          }
        }
        // Numeric values
        else if (!isNaN(Number(attrValue))) {
          if (normalizedSku.includes(normalizedValue)) {
            attributeMatched = true;
          }
        }
        // Generic string matching with fuzzy logic
        else {
          // Try partial matching for compound words
          const words = normalizedValue.split(/[\s-_]+/);
          if (words.every(word => normalizedSku.includes(word))) {
            attributeMatched = true;
          }
        }
      }

      if (!attributeMatched) {
        matches = false;
      }
    });

    return matches;
  };
};

/**
 * Extract price value from nested price structure
 */
const extractPriceValue = (product, priceType) => {
  return priceType === 'regular'
    ? product.price?.regular?.amount?.value
    : product.price?.final?.amount?.value;
};

// ============================================================================
// MAIN RESOLVER - Simple Product Details
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_variantByAttributes: {
        resolve: async (_root, args, context, _info) => {
          try {
            // Query Commerce GraphQL for the configurable product with its variants
            const commerceResult = await context.CommerceGraphQL.Query.Commerce_products({
              root: {},
              args: {
                filter: {
                  sku: { eq: args.parentSku }
                }
              },
              context,
              selectionSet: `{
                items {
                  sku
                  name
                  images {
                    url
                    label
                  }
                  ... on Commerce_ConfigurableProduct {
                    variants {
                      product {
                        sku
                        name
                        inStock
                        price {
                          regularPrice {
                            amount {
                              value
                              currency
                            }
                          }
                          finalPrice {
                            amount {
                              value
                              currency
                            }
                          }
                        }
                        images {
                          url
                          label
                        }
                      }
                      attributes {
                        code
                        value_index
                      }
                    }
                  }
                }
              }`
            });

            const configurableProduct = commerceResult?.items?.[0];
            if (!configurableProduct?.variants) {
              throw new Error(`Configurable product with SKU "${args.parentSku}" not found or has no variants`);
            }

            // Get configurable options to understand the attribute-to-label mapping
            const configurableOptionsResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
              root: {},
              args: {
                phrase: '',
                filter: [{ attribute: 'sku', eq: args.parentSku }],
                current_page: 1,
                page_size: 1
              },
              context,
              selectionSet: `{
                items {
                  productView {
                    ... on Catalog_ComplexProductView {
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
              }`
            });

            const configurableOptions = configurableOptionsResult?.items?.[0]?.productView?.options || [];

            // Create reverse mapping: attribute value -> option label
            const valueToLabelMap = {};
            configurableOptions.forEach(option => {
              if (option.values) {
                option.values.forEach(value => {
                  valueToLabelMap[`${option.id}:${value.value}`] = value.title;
                });
              }
            });

            // Maximum flexibility: handle any attribute structure
            const requestedAttributes = args.attributes.attributes || args.attributes;
            
            // Create the flexible matcher function
            const flexibleMatcher = createFlexibleVariantMatcher(configurableOptions, valueToLabelMap);
            
            // Find the variant using the advanced flexible matching
            const matchingVariant = configurableProduct.variants.find(variant => {
              return flexibleMatcher(variant, requestedAttributes);
            });

            if (!matchingVariant) {
              throw new Error(`No variant found matching the specified attributes`);
            }

            const product = matchingVariant.product;
            
            // Extract pricing
            const regularPrice = product.price?.regularPrice?.amount?.value;
            const finalPrice = product.price?.finalPrice?.amount?.value || regularPrice;
            const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;

            // Use the variant's actual images from Adobe Commerce
            // If variant has its own images, use those; otherwise fall back to main product images
            const variantImages = product.images?.length > 0 ? product.images : configurableProduct.images;
            
            // Transform images
            const images = variantImages?.map(img => ({
              url: ensureHttpsUrl(img.url),
              altText: img.label || `${product.sku} variant`
            })) || [];

            const primaryImage = images[0] || null;

            // Return the matching variant details
            return {
              id: `variant-${product.sku}`,
              sku: product.sku,
              name: product.name,
              price: formatPrice(finalPrice),
              originalPrice: isOnSale ? formatPrice(regularPrice) : null,
              inStock: product.inStock || true,
              stockLevel: null,
              image: primaryImage,
              images: images,
              attributes: requestedAttributes
            };

          } catch (error) {
            console.error('Variant by attributes resolver error:', error);
            throw error;
          }
        },
      },
    },
  },
};
