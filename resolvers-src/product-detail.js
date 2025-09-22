/**
 * Product Detail Resolver
 * Minimal implementation for Product Detail Pages
 * Fetches product data from Catalog Service
 */

/**
 * Query product detail from Catalog Service by URL key
 */
/**
 * Query variants from Commerce GraphQL for a configurable product
 */
const queryProductVariants = async (context, sku) => {
  try {
    const result = await context.CommerceGraphQL.Query.Commerce_products({
      root: {},
      args: {
        filter: { sku: { eq: sku } },
      },
      context,
      selectionSet: `{
        items {
          sku
          ... on ConfigurableProduct {
            variants {
              product {
                sku
                name
                price_range {
                  minimum_price {
                    regular_price { value }
                    final_price { value }
                  }
                }
                image { url label }
                stock_status
              }
              attributes {
                code
                label
                value_index
              }
            }
          }
        }
      }`,
    });

    return result?.items?.[0]?.variants || [];
  } catch (error) {
    console.warn('Failed to fetch variants from Commerce GraphQL:', error.message);
    return [];
  }
};

const queryProductDetailByUrlKey = async (context, urlKey) => {
  return await context.CatalogServiceSandbox.Query.Catalog_productSearch({
    root: {},
    args: {
      phrase: '',
      filter: [
        {
          attribute: 'url_key',
          in: [urlKey],
        },
      ],
      page_size: 1,
      current_page: 1,
    },
    context,
    selectionSet: `{
      items {
        productView {
          __typename
          id name sku urlKey inStock stockLevel
          description shortDescription
          images(roles: ["small_image"]) { url label }
          attributes { name label value }
          ... on Catalog_SimpleProductView {
            price {
              regular { amount { value } }
              final { amount { value } }
            }
          }
          ... on Catalog_ComplexProductView {
            priceRange {
              minimum {
                regular { amount { value } }
                final { amount { value } }
              }
            }
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
            variants {
              product {
                sku
                name
                inStock
                stockLevel
                images(roles: ["small_image"]) { url label }
                price {
                  regular { amount { value } }
                  final { amount { value } }
                }
              }
              attributes { code label }
            }
          }
        }
      }
    }`,
  });
};

/**
 * Transform product data to our custom shape using extracted utilities
 * Clean orchestrator function that delegates business logic to utilities
 */
const transformProduct = (product, commerceVariants = []) => {
  if (!product) return null;

  const productData = product.productView || product;
  const isComplex = productData.__typename === 'Catalog_ComplexProductView';

  // Use extracted utilities for business logic
  const pricing = extractProductPricing(productData, isComplex);
  const images = transformProductImages(productData.images, productData.name);
  const attributes = transformProductAttributes(productData.attributes);
  const configurable_options = transformConfigurableOptions(productData.options);
  const variants = transformProductVariants(commerceVariants, configurable_options);
  const breadcrumbs = generateProductBreadcrumbs(attributes, productData);

  return {
    // Basic product fields
    id: productData.id || '',
    sku: productData.sku || '',
    name: productData.name || '',
    urlKey: productData.urlKey || '',
    description: productData.description || '',
    shortDescription: productData.shortDescription || '',
    inStock: productData.inStock || false,
    stockLevel: productData.stockLevel || null,

    // Transformed business data
    ...pricing,
    images,
    attributes,
    breadcrumbs,
    configurable_options,
    variants,
  };
};

// Note: All utility functions (ensureHttpsUrl, formatPrice, extractProductPricing, etc.) 
// are injected by the build system from resolvers-src/utils/

module.exports = {
  resolvers: {
    Query: {
      Citisignal_productDetail: {
        resolve: async (_root, args, context, _info) => {
          try {
            const { urlKey } = args;

            // Query product data from Catalog Service
            const productResult = await queryProductDetailByUrlKey(context, urlKey);

            if (!productResult?.items?.length || !productResult.items[0]?.productView) {
              return null;
            }

            const product = productResult.items[0].productView;

            // For configurable products, fetch variants from Commerce GraphQL
            let commerceVariants = [];
            if (product.__typename === 'Catalog_ComplexProductView' && product.sku) {
              commerceVariants = await queryProductVariants(context, product.sku);
            }

            return transformProduct(product, commerceVariants);
          } catch (error) {
            console.error('Product detail resolver error:', error);
            throw error;
          }
        },
      },
    },
  },
};
