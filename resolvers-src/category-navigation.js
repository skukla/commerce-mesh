/**
 * Category Navigation Resolver
 * Transforms Commerce category tree into navigation structures for headers and footers.
 */

// Configuration

const DEFAULT_HEADER_NAV_ITEMS = 6; // Keep header clean
const DEFAULT_FOOTER_NAV_ITEMS = 4; // Smaller footer menu

// transformCategory function is injected at build time
// filterForNavigation function is injected at build time

/**
 * Get navigation items by type (header vs footer)
 */
const getNavigationByType = (categories, type, maxItems) => {
  // Determine item limit based on navigation type
  const limit =
    maxItems || (type === 'FOOTER' ? DEFAULT_FOOTER_NAV_ITEMS : DEFAULT_HEADER_NAV_ITEMS);

  // Filter and limit navigation items
  return filterForNavigation(categories, limit);
};

// Get categories from Commerce
const executeCategoryNavigation = async (context, args) => {
  // Query Adobe Commerce for category tree
  const result = await context.CommerceGraphQL.Query.Commerce_categoryList({
    root: {},
    args: {
      filters: {}, // Get all categories, we'll filter later
    },
    context,
    selectionSet: `{
      id
      uid
      name
      url_path
      url_key
      include_in_menu
      is_active
      level
      position
      product_count
      parent_id
      children {
        id
        uid
        name
        url_path
        url_key
        include_in_menu
        is_active
        level
        position
        product_count
        children {
          id
          uid
          name
          url_path
          url_key
          include_in_menu
          is_active
          level
          position
          product_count
        }
      }
    }`,
  });

  // Transform to navigation structure
  const transformed = result?.map(transformCategory).filter(Boolean) || [];

  // Apply navigation type filtering
  return getNavigationByType(transformed, args.type, args.maxItems);
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryNavigation: {
        resolve: async (_root, args, context, _info) => {
          try {
            // Get and transform navigation from Commerce
            const navigation = await executeCategoryNavigation(context, args);

            // Create header nav items
            const headerNav = navigation.slice(0, 5).map((cat) => ({
              href: cat.href,
              label: cat.label,
              category: cat.urlKey,
            }));

            // Create footer nav items
            const footerNav = navigation.slice(0, 8).map((cat) => ({
              href: cat.href,
              label: cat.label,
            }));

            // Return structure
            return {
              items: navigation || [],
              headerNav: headerNav || [],
              footerNav: footerNav || [],
            };
          } catch (error) {
            context.logger.error(`Category nav error: ${error.message?.substring(0, 63)}`);
            // Return empty navigation on error (graceful degradation)
            return {
              items: [],
              headerNav: [],
              footerNav: [],
            };
          }
        },
      },
    },
  },
};
