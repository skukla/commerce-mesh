/**
 * SEARCH SUGGESTIONS RESOLVER
 * 
 * Provides quick product suggestions for search autocomplete using Live Search.
 * Returns top 5 products matching the search phrase.
 * 
 * SERVICE SELECTION:
 * - Live Search: AI-powered search with better relevance
 * - Catalog Service: No autocomplete-specific API
 * 
 * NOTE: All helpers must be inline due to mesh architecture limitations.
 */

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const SUGGESTIONS_LIMIT = 5;

// ============================================================================
// SECTION 2: URL UTILITIES
// ============================================================================

const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Handle protocol-relative URLs (//domain.com)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  return url.replace(/^http:\/\//, 'https://');
};

// ============================================================================
// SECTION 3: PRICE UTILITIES
// ============================================================================

const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return null;
  // Add comma formatting for thousands
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// ============================================================================
// SECTION 4: MAIN RESOLVER
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_searchSuggestions: {
        resolve: async (root, args, context, info) => {
          try {
            if (!args.phrase || args.phrase.trim() === '') {
              return { suggestions: [] };
            }
            
            // Use Live Search for suggestions
            const searchResult = await context.LiveSearchSandbox.Query.Search_productSearch({
              root: {},
              args: {
                phrase: args.phrase,
                page_size: SUGGESTIONS_LIMIT,
                current_page: 1
              },
              context,
              selectionSet: `{
                items {
                  product {
                    uid
                    name
                    price_range {
                      minimum_price {
                        final_price {
                          value
                        }
                      }
                    }
                  }
                  productView {
                    sku
                    urlKey
                    images {
                      url
                      label
                    }
                  }
                }
                total_count
              }`
            });
            
            if (!searchResult?.items) {
              return { suggestions: [] };
            }
            
            const suggestions = searchResult.items.map(item => {
              const product = item.product;
              const productView = item.productView;
              const firstImage = productView?.images?.[0];
              
              return {
                id: product.uid,
                name: product.name,
                sku: productView?.sku || '',
                urlKey: productView?.urlKey || '',
                price: formatPrice(product.price_range?.minimum_price?.final_price?.value),
                image: firstImage ? ensureHttpsUrl(firstImage.url) : null
              };
            });
            
            return {
              suggestions,
              totalCount: searchResult.total_count
            };
          } catch (error) {
            // Return empty suggestions on error to allow graceful degradation
            return { suggestions: [] };
          }
        }
      }
    }
  }
};