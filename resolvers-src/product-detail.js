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
 * Query breadcrumbs from Commerce GraphQL
 * Generates proper category-based breadcrumbs using product categories
 */
const queryBreadcrumbs = async (context, product) => {
  try {
    // First, get the product's categories from Commerce GraphQL
    const categories = await queryProductCategories(context, product);

    if (!categories || categories.length === 0) {
      // Fallback to simple breadcrumb if no categories
      return {
        items: [
          { name: 'Products', urlPath: '/products' },
          { name: product.name, urlPath: `/products/${product.urlKey}` },
        ],
      };
    }

    // Use the first category for breadcrumbs (could be enhanced to find "primary" category)
    const category = categories[0];

    return {
      items: [
        { name: category.name, urlPath: category.url_path },
        { name: product.name, urlPath: `/products/${product.urlKey}` },
      ],
    };
  } catch (error) {
    console.warn('Failed to fetch breadcrumbs from Commerce GraphQL:', error.message);
    // Fallback to attribute-based breadcrumbs - functions will be injected by build system
    const attributes = transformProductAttributes(product.attributes); // eslint-disable-line no-undef
    return generateProductBreadcrumbs(attributes, product); // eslint-disable-line no-undef
  }
};

/**
 * Query product categories from Commerce GraphQL
 * Gets the actual category assignments for the product
 */
const queryProductCategories = async (context, product) => {
  try {
    // Query Commerce GraphQL for products by SKU to get category assignments
    const result = await context.CommerceGraphQL.Query.Commerce_products({
      root: {},
      args: {
        filter: { sku: { eq: product.sku } },
      },
      context,
      selectionSet: `{
        items {
          categories {
            id
            name
            url_key
            url_path
            level
          }
        }
      }`,
    });

    const productCategories = result?.items?.[0]?.categories || [];

    // Filter and sort categories (prefer lower level numbers = higher in hierarchy)
    return productCategories
      .filter((cat) => cat.level > 1) // Skip root category
      .sort((a, b) => a.level - b.level); // Sort by hierarchy level
  } catch (error) {
    console.warn('Failed to fetch categories from Commerce GraphQL:', error.message);
    return [];
  }
};

/**
 * Transform product data to our custom shape using extracted utilities
 * Clean orchestrator function that delegates business logic to utilities
 */
const transformProduct = async (product, commerceVariants = [], context) => {
  if (!product) return null;

  const productData = product.productView || product;
  const isComplex = productData.__typename === 'Catalog_ComplexProductView';

  // Use extracted utilities for business logic (functions injected by build system)
  const pricing = extractProductPricing(productData, isComplex); // eslint-disable-line no-undef
  const images = transformProductImages(productData.images, productData.name); // eslint-disable-line no-undef
  const attributes = transformProductAttributes(productData.attributes); // eslint-disable-line no-undef
  const configurable_options = transformConfigurableOptions(productData.options); // eslint-disable-line no-undef
  const variants = transformProductVariants(commerceVariants, configurable_options); // eslint-disable-line no-undef

  // Query actual breadcrumbs from Commerce GraphQL if context is available
  const breadcrumbs = context
    ? await queryBreadcrumbs(context, productData)
    : generateProductBreadcrumbs(attributes, productData); // eslint-disable-line no-undef

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

            return await transformProduct(product, commerceVariants, context);
          } catch (error) {
            console.error('Product detail resolver error:', error);
            throw error;
          }
        },
      },
    },
  },
};
