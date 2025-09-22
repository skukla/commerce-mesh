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
 * Transform product data to our custom shape
 */
const transformProduct = (product, commerceVariants = []) => {
  if (!product) return null;

  const productData = product.productView || product;
  const isComplex = productData.__typename === 'Catalog_ComplexProductView';

  // Extract price information
  const regularPrice = isComplex
    ? productData.priceRange?.minimum?.regular?.amount?.value
    : productData.price?.regular?.amount?.value;
  const finalPrice = isComplex
    ? productData.priceRange?.minimum?.final?.amount?.value
    : productData.price?.final?.amount?.value;

  const isOnSale = regularPrice && finalPrice && finalPrice < regularPrice;
  const discountPercent = isOnSale
    ? Math.round(((regularPrice - finalPrice) / regularPrice) * 100)
    : null;

  // Find manufacturer
  const manufacturer = productData.attributes?.find(
    (attr) => attr.name === 'manufacturer' || attr.name === 'cs_manufacturer'
  )?.value;

  // Transform images
  const images = (productData.images || []).map((image, index) => ({
    url: ensureHttpsUrl(image.url),
    altText: image.label || productData.name || '',
    type: index === 0 ? 'image' : 'thumbnail',
  }));

  // Transform attributes - use the label provided by Catalog Service
  const attributes = (productData.attributes || []).map((attr) => ({
    key: attr.name || '',
    label: attr.label || attr.name || '',
    value: attr.value || '',
    type: 'text',
  }));

  // Transform configurable options
  const configurable_options = (productData.options || []).map((option) => ({
    label: option.title || option.label || '',
    attribute_code: option.id || '',
    values: (option.values || []).map((value) => ({
      label: value.title || value.label || '',
      value: value.value || '',
      swatch_data: value.swatch_data
        ? {
            type: value.swatch_data.type || 'color',
            value: value.swatch_data.value || value.value || '',
          }
        : null,
    })),
  }));

  // Transform variants from Commerce GraphQL
  const variants = commerceVariants.map((variant) => {
    const variantProduct = variant.product;
    const variantRegularPrice = variantProduct?.price_range?.minimum_price?.regular_price?.value;
    const variantFinalPrice =
      variantProduct?.price_range?.minimum_price?.final_price?.value || variantRegularPrice;

    // Build attributes object from variant attributes
    // Need to map Commerce GraphQL labels back to configurable option values (especially for colors)
    const attributes = {};
    if (variant.attributes && Array.isArray(variant.attributes)) {
      variant.attributes.forEach((attr) => {
        if (attr.code && attr.label) {
          // For color attributes, map the label back to the hex value
          if (attr.code === 'cs_color') {
            // Find the matching configurable option value
            const colorOption = configurable_options.find(
              (opt) => opt.attribute_code === 'cs_color'
            );
            const colorValue = colorOption?.values.find((val) => val.label === attr.label);
            attributes[attr.code] = colorValue?.value || attr.label;
          } else {
            // For other attributes (like memory), use the label as-is
            attributes[attr.code] = attr.label;
          }
        }
      });
    }

    return {
      id: variantProduct?.sku || '',
      sku: variantProduct?.sku || '',
      attributes,
      price: formatPrice(variantFinalPrice),
      originalPrice:
        variantRegularPrice && variantFinalPrice && variantRegularPrice > variantFinalPrice
          ? formatPrice(variantRegularPrice)
          : null,
      inStock: variantProduct?.stock_status === 'IN_STOCK',
      stockLevel: null, // Not available in Commerce GraphQL
      image: variantProduct?.image
        ? {
            url: ensureHttpsUrl(variantProduct.image.url),
            altText: variantProduct.image.label || `${variantProduct.sku} variant`,
          }
        : null,
    };
  });

  // Generate breadcrumbs dynamically based on product family attribute
  let categoryName = 'Products';
  let categoryPath = '/products';

  if (attributes && attributes.length > 0) {
    const productFamily = attributes.find((attr) => attr.key === 'cs_product_family');
    if (productFamily && productFamily.value) {
      categoryName = productFamily.value;
      categoryPath = `/${categoryName.toLowerCase()}`;
    }
  }

  const breadcrumbs = {
    items: [
      { name: categoryName, urlPath: categoryPath },
      { name: productData.name || '', urlPath: `/products/${productData.urlKey}` },
    ],
  };

  return {
    id: productData.id || '',
    sku: productData.sku || '',
    name: productData.name || '',
    urlKey: productData.urlKey || '',
    price: formatPrice(finalPrice),
    originalPrice: isOnSale ? formatPrice(regularPrice) : null,
    discountPercent,
    inStock: productData.inStock || false,
    stockLevel: productData.stockLevel || null,
    manufacturer: manufacturer || null,
    description: productData.description || '',
    shortDescription: productData.shortDescription || '',
    images,
    attributes,
    breadcrumbs,
    configurable_options,
    variants,
  };
};

// Note: ensureHttpsUrl and formatPrice are injected by the build system

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
