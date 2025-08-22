/**
 * Search Suggestions Resolver
 * Provides lightweight autocomplete suggestions using Live Search AI
 * for typo tolerance and semantic understanding.
 */

// Transform product to minimal suggestion format
// Uses injected utilities: formatPrice, ensureHttpsUrl
const transformToSuggestion = (item) => {
  if (!item) return null;

  // Extract data from either product or productView
  const product = item.product || {};
  const productView = item.productView || {};

  // Get the best available data
  const sku = productView.sku || product.sku;
  const name = product.name || productView.name;
  // const inStock = productView.inStock !== undefined ? productView.inStock : true;

  // Extract and format price
  const priceValue =
    productView.price?.final?.amount?.value ||
    productView.price?.regular?.amount?.value ||
    product.price?.regularPrice?.amount?.value;
  const price = formatPrice(priceValue);

  // Get image URL and ensure HTTPS
  const imageUrl = productView.images?.[0]?.url || product.small_image?.url || product.image?.url;
  const image = ensureHttpsUrl(imageUrl);

  // Generate id if not present (using sku or name)
  const id = productView.id || product.id || sku || name;

  // Get urlKey for product links
  const urlKey = productView.urlKey || product.url_key || product.urlKey || sku;

  // Return minimal suggestion object
  return {
    id,
    name,
    sku,
    urlKey,
    price,
    image,
  };
};

const SUGGESTIONS_LIMIT = 5; // Keep autocomplete fast and focused

const executeSearchSuggestions = async (context, args) => {
  // Validate input
  if (!args.phrase || args.phrase.trim().length < 2) {
    return []; // Don't search for very short queries
  }

  // Query Live Search for AI-powered suggestions
  const result = await context.LiveSearchSandbox.Query.Search_productSearch({
    root: {},
    args: {
      phrase: args.phrase,
      page_size: SUGGESTIONS_LIMIT,
      current_page: 1,
    },
    context,
    selectionSet: `{
      items {
        product {
          sku
          name
          small_image {
            url
          }
        }
        productView {
          sku
          name
          inStock
          price {
            final {
              amount {
                value
              }
            }
            regular {
              amount {
                value
              }
            }
          }
          images {
            url
          }
        }
      }
    }`,
  });

  // Transform to lightweight suggestions
  const suggestions = result?.items?.map(transformToSuggestion).filter(Boolean) || [];

  return suggestions;
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_searchSuggestions: {
        resolve: async (_root, args, context, _info) => {
          try {
            // Get AI-powered suggestions from Live Search
            const suggestions = await executeSearchSuggestions(context, args);

            // Return our lightweight suggestion format
            // Perfect for fast, responsive autocomplete UI
            return {
              suggestions: suggestions || [],
            };
          } catch (error) {
            console.error('Search suggestions resolver error:', error);
            // Return empty suggestions on error (graceful degradation)
            return { suggestions: [] };
          }
        },
      },
    },
  },
};
