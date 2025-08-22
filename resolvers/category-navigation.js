/**
 * CITISIGNAL CATEGORY NAVIGATION - CUSTOM NAVIGATION API
 *
 * This resolver demonstrates transforming Adobe Commerce's complex category tree
 * into clean, navigation-ready data structures for headers and footers.
 *
 * What Adobe gives us: Deeply nested category hierarchy with technical fields
 * What we deliver: Clean navigation items ready for UI menus
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The navigation API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_categoryNavigation
 *
 * INPUT:
 *   query {
 *     Citisignal_categoryNavigation(
 *       type: HEADER       // or FOOTER
 *       maxItems: 6        // Limit items for clean UI
 *     )
 *   }
 *
 * OUTPUT - Our navigation-ready structure:
 *   {
 *     navigation: [{
 *       // Clean navigation item
 *       id: "4"
 *       name: "Phones"
 *       href: "/phones"           // Ready-to-use link
 *       label: "Phones"           // Display text
 *       level: 2                  // For styling nested menus
 *       position: 1               // Display order
 *       children: [{              // Nested navigation
 *         name: "iPhones"
 *         href: "/phones/iphones"
 *       }]
 *     }]
 *   }
 *
 */

// ============================================================================
// CONFIGURATION - Business rules for navigation
// ============================================================================

const DEFAULT_HEADER_NAV_ITEMS = 6; // Keep header clean
const DEFAULT_FOOTER_NAV_ITEMS = 4; // Smaller footer menu

// ============================================================================
// DATA TRANSFORMATION - Complex hierarchy to clean navigation
// ============================================================================

/**
 * Transform Adobe's category structure to navigation items
 *
 * ADOBE'S COMMERCE STRUCTURE:
 * {
 *   uid: "Mg==",
 *   id: 2,
 *   name: "Default Category",
 *   url_path: "default-category",
 *   url_key: "default-category",
 *   include_in_menu: 1,
 *   is_active: true,
 *   level: 1,
 *   position: 0,
 *   product_count: 42,
 *   children: [{
 *     uid: "NA==",
 *     name: "Phones",
 *     url_path: "phones",
 *     include_in_menu: 1,
 *     children: [...]
 *   }]
 * }
 *
 * OUR CLEAN NAVIGATION ITEM:
 * {
 *   id: "4",
 *   name: "Phones",
 *   href: "/phones",        // Built from url_path
 *   label: "Phones",        // Ready for display
 *   level: 2,
 *   position: 1,
 *   children: [...]         // Recursively transformed
 * }
 */
const transformCategory = (category) => {
  if (!category) return null;

  // Build navigation-ready fields
  const href = category.url_path ? `/${category.url_path}` : '/';

  return {
    // Essential navigation fields
    id: String(category.id || category.uid),
    name: category.name || '',
    href: href, // Ready-to-use link
    label: category.name || '', // Display text

    // Hierarchy and ordering
    level: category.level || 0,
    position: category.position || 0,

    // Metadata for filtering
    includeInMenu: category.include_in_menu === 1 || category.include_in_menu === true,
    isActive: category.is_active === true || category.is_active === 1,
    productCount: category.product_count || 0,

    // Nested navigation (recursive transformation)
    children: category.children?.map(transformCategory).filter(Boolean) || [],

    // Additional fields for advanced use
    urlPath: category.url_path || '',
    urlKey: category.url_key || '',
    parentId: category.parent_id || null,
  };
};

// ============================================================================
// NAVIGATION FILTERING - Apply business rules
// ============================================================================

/**
 * Filter categories for navigation display
 * Business rules: Only active, menu-enabled categories
 */
const filterForNavigation = (categories, maxItems = 10) => {
  if (!categories || !Array.isArray(categories)) return [];

  return categories
    .filter(
      (cat) =>
        cat.includeInMenu && // Admin marked for menu
        cat.isActive && // Currently active
        cat.name && // Has a name to display
        cat.href // Has a valid URL
    )
    .sort((a, b) => a.position - b.position) // Respect admin ordering
    .slice(0, maxItems) // Limit for clean UI
    .map((cat) => ({
      ...cat,
      // Recursively filter children
      children: filterForNavigation(cat.children, maxItems),
    }));
};

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

// ============================================================================
// QUERY EXECUTION - Get categories from Commerce
// ============================================================================

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

// ============================================================================
// MAIN RESOLVER - Clean navigation API
// ============================================================================

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
            console.error('Category navigation resolver error:', error);
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
