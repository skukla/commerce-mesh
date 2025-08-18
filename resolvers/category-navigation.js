/**
 * CATEGORY NAVIGATION RESOLVER
 * 
 * Fetches hierarchical category tree from Commerce Core GraphQL
 * for building dynamic navigation menus.
 * 
 * SERVICE SELECTION:
 * - Commerce Core: Has complete category hierarchy with parent/child relationships
 * - Live Search/Catalog: Only have flat category lists for filtering
 * 
 * NOTE: All helpers must be inline due to mesh architecture limitations.
 */

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const DEFAULT_HEADER_NAV_ITEMS = 6;
const DEFAULT_FOOTER_NAV_ITEMS = 4;

// ============================================================================
// SECTION 2: CATEGORY TRANSFORMATION
// ============================================================================

/**
 * Transform Commerce category to our Citisignal_CategoryItem type
 */
const transformCategory = (category) => {
  if (!category) return null;
  
  return {
    id: category.id || category.uid,
    name: category.name || '',
    urlPath: category.url_path || '',
    urlKey: category.url_key || '',
    level: category.level || 0,
    position: category.position || 0,
    includeInMenu: category.include_in_menu === 1 || category.include_in_menu === true,
    isActive: category.is_active === true || category.is_active === 1,
    children: category.children?.map(transformCategory).filter(Boolean) || [],
    productCount: category.product_count || 0,
    parentId: category.parent_id || null,
    // Navigation-ready fields
    href: `/${category.url_path || ''}`,
    label: category.name || ''
  };
};

// ============================================================================
// SECTION 3: NAVIGATION FILTERING
// ============================================================================

/**
 * Filter categories based on visibility settings
 */
const filterCategories = (categories, includeInactive) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .filter(cat => {
      // Always filter out categories not in menu (check for 1 or true)
      if (!cat.include_in_menu || cat.include_in_menu === 0) return false;
      // Optionally filter out inactive categories
      if (!includeInactive && !cat.is_active) return false;
      return true;
    })
    .map(cat => ({
      ...transformCategory(cat),
      // Recursively filter children
      children: filterCategories(cat.children, includeInactive)
    }));
};

/**
 * Transform categories for header navigation - returns flat array for menus
 */
const transformForHeaderNav = (categories, maxItems = DEFAULT_HEADER_NAV_ITEMS) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .filter(cat => cat.includeInMenu && cat.isActive)
    .sort((a, b) => a.position - b.position)
    .slice(0, maxItems)
    .map(cat => ({
      href: cat.href,
      label: cat.label,
      category: 'shop'
    }));
};

/**
 * Transform categories for footer navigation - returns limited list
 */
const transformForFooterNav = (categories, maxItems = DEFAULT_FOOTER_NAV_ITEMS) => {
  if (!categories || !Array.isArray(categories)) return [];
  
  return categories
    .filter(cat => cat.includeInMenu && cat.isActive)
    .sort((a, b) => a.position - b.position)
    .slice(0, maxItems)
    .map(cat => ({
      href: cat.href,
      label: cat.label
    }));
};

// ============================================================================
// SECTION 4: MAIN RESOLVER
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryNavigation: async (root, args, context, info) => {
        try {
          const { 
            rootCategoryId,
            includeInactive = false 
          } = args;

          // Query Commerce Core for category tree
          // Commerce_categoryList returns an array of CategoryTree objects
          const result = await context.CommerceGraphQL.Query.Commerce_categoryList({
            root,
            args: {},
            context,
            info,
            selectionSet: `{
              id
              uid
              name
              url_path
              url_key
              level
              position
              include_in_menu
              is_active
              product_count
              parent_id
              children {
                id
                uid
                name
                url_path
                url_key
                level
                position
                include_in_menu
                is_active
                product_count
                parent_id
                children {
                  id
                  uid
                  name
                  url_path
                  url_key
                  level
                  position
                  include_in_menu
                  is_active
                  product_count
                  parent_id
                }
              }
            }`
          });

          // Result is an array of CategoryTree objects
          // Get the root category or all top-level categories
          let categories = [];
          
          if (Array.isArray(result)) {
            // If we have a rootCategoryId, find that category
            if (rootCategoryId) {
              const rootCategory = result.find(cat => 
                cat.id === rootCategoryId || cat.uid === rootCategoryId
              );
              categories = rootCategory?.children || [];
            } else {
              // Use first category's children (usually the store root)
              categories = result[0]?.children || [];
            }
          }

          // Transform and filter categories
          const transformedCategories = filterCategories(
            categories,
            includeInactive
          );

          return {
            items: transformedCategories,
            // Pre-formatted navigation items for immediate use
            headerNav: transformForHeaderNav(transformedCategories),
            footerNav: transformForFooterNav(transformedCategories)
          };

        } catch (error) {
          console.error('[CategoryNavigation] Error fetching categories:', error);
          
          // Return empty result on error (graceful degradation)
          return {
            items: [],
            headerNav: [],
            footerNav: []
          };
        }
      }
    }
  }
};