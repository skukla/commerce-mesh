/**
 * CITISIGNAL SEARCH SUGGESTIONS - CUSTOM AUTOCOMPLETE API
 * 
 * This resolver demonstrates creating a simple, fast autocomplete API
 * that transforms complex product data into lightweight suggestions.
 * 
 * What Adobe gives us: Full product objects with nested data
 * What we deliver: Minimal, fast suggestions perfect for autocomplete
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The autocomplete API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_searchSuggestions
 * 
 * INPUT:
 *   query {
 *     Citisignal_searchSuggestions(
 *       phrase: "ipho"    // Partial search term
 *     )
 *   }
 * 
 * OUTPUT - Our lightweight suggestion format:
 *   {
 *     suggestions: [{
 *       // Minimal data for fast autocomplete
 *       sku: "IP15-PRO"
 *       name: "iPhone 15 Pro"
 *       price: "$999.99"           // Formatted for display
 *       image: "https://..."        // Thumbnail URL, HTTPS ensured
 *       inStock: true              // Show availability
 *     }]
 *   }
 * 
 * Performance: Returns top 5 most relevant products
 * Powered by: Adobe Live Search AI for better relevance
 */

// ============================================================================
// SERVICE SELECTION - Why Live Search for suggestions
// ============================================================================

/**
 * Why we use Live Search for autocomplete:
 * - AI-powered relevance ranking
 * - Typo tolerance ("iphon" finds "iPhone")
 * - Semantic understanding ("smartphone" finds phones)
 * - Fast response times
 * 
 * Catalog Service doesn't have autocomplete-specific features
 */

// ============================================================================
// DATA TRANSFORMATION - Complex to minimal
// ============================================================================

/**
 * Transform complex product data to lightweight suggestions
 * 
 * ADOBE'S LIVE SEARCH RESPONSE:
 * {
 *   items: [{
 *     product: {
 *       sku: "IP15-PRO",
 *       name: "iPhone 15 Pro",
 *       small_image: { url: "http://..." }
 *     },
 *     productView: {
 *       sku: "IP15-PRO",
 *       inStock: true,
 *       price: {
 *         final: { amount: { value: 999.99 } }
 *       },
 *       images: [{ url: "//domain.com/image.jpg" }]
 *     }
 *   }]
 * }
 * 
 * OUR LIGHTWEIGHT SUGGESTION:
 * {
 *   sku: "IP15-PRO",
 *   name: "iPhone 15 Pro",
 *   price: "$999.99",      // Formatted
 *   image: "https://...",  // HTTPS ensured
 *   inStock: true
 * }
 */

/**
 * Ensure URLs use HTTPS for security
 */
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Handle protocol-relative URLs (//domain.com)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  // Convert HTTP to HTTPS
  return url.replace(/^http:\/\//, 'https://');
};

/**
 * Format price for display in suggestions
 */
const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return null;
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Transform product to minimal suggestion format
 */
const transformToSuggestion = (item) => {
  if (!item) return null;
  
  // Extract data from either product or productView
  const product = item.product || {};
  const productView = item.productView || {};
  
  // Get the best available data
  const sku = productView.sku || product.sku;
  const name = product.name || productView.name;
  const inStock = productView.inStock !== undefined ? productView.inStock : true;
  
  // Extract and format price
  const priceValue = productView.price?.final?.amount?.value || 
                     productView.price?.regular?.amount?.value ||
                     product.price?.regularPrice?.amount?.value;
  const price = formatPrice(priceValue);
  
  // Get image URL and ensure HTTPS
  const imageUrl = productView.images?.[0]?.url || 
                   product.small_image?.url || 
                   product.image?.url;
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
    image
  };
};

// ============================================================================
// QUERY EXECUTION - Get suggestions from Live Search
// ============================================================================

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
      current_page: 1
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
    }`
  });
  
  // Transform to lightweight suggestions
  const suggestions = result?.items
    ?.map(transformToSuggestion)
    .filter(Boolean) || [];
  
  return suggestions;
};

// ============================================================================
// MAIN RESOLVER - Simple and focused
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_searchSuggestions: {
        resolve: async (root, args, context, info) => {
          try {
            // Get AI-powered suggestions from Live Search
            const suggestions = await executeSearchSuggestions(context, args);
            
            // Return our lightweight suggestion format
            // Perfect for fast, responsive autocomplete UI
            return {
              suggestions: suggestions || []
            };
            
          } catch (error) {
            console.error('Search suggestions resolver error:', error);
            // Return empty suggestions on error (graceful degradation)
            return { suggestions: [] };
          }
        }
      }
    }
  }
};