/**
 * CITISIGNAL BREADCRUMBS - CUSTOM BREADCRUMB API
 * 
 * This resolver demonstrates transforming Adobe Commerce's category hierarchy
 * into clean breadcrumb trails for SEO and navigation.
 * 
 * What Adobe gives us: Category hierarchy with parent relationships
 * What we deliver: Clean breadcrumb trail ready for UI components
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The breadcrumb API we're creating
// ============================================================================

/**
 * Our Custom Query: Citisignal_categoryBreadcrumbs
 * 
 * INPUT:
 *   query {
 *     Citisignal_categoryBreadcrumbs(
 *       categoryUrlKey: "phones"    // Category URL key to get breadcrumbs for
 *     )
 *   }
 * 
 * OUTPUT - Our breadcrumb trail:
 *   {
 *     breadcrumbs: [{
 *       // Clean breadcrumb items
 *       name: "Home"
 *       href: "/"
 *       isActive: false
 *     }, {
 *       name: "Electronics"
 *       href: "/electronics"
 *       isActive: false
 *     }, {
 *       name: "Phones"
 *       href: "/phones"
 *       isActive: true        // Current page
 *     }]
 *   }
 * 
 */

// ============================================================================
// DATA TRANSFORMATION - Build breadcrumb trail
// ============================================================================

/**
 * Transform Adobe's category breadcrumb to clean format
 * 
 * ADOBE'S BREADCRUMB STRUCTURE:
 * {
 *   category_id: 4,
 *   category_name: "Electronics",
 *   category_url_path: "electronics",
 *   category_level: 2
 * }
 * 
 * OUR CLEAN BREADCRUMB:
 * {
 *   name: "Electronics",
 *   href: "/electronics",
 *   isActive: false
 * }
 */
const transformBreadcrumb = (breadcrumb, isLast = false) => {
  if (!breadcrumb) return null;
  
  const urlPath = breadcrumb.category_url_path || breadcrumb.url_path || '';
  
  return {
    // Match the schema: Citisignal_BreadcrumbItem
    categoryId: breadcrumb.category_id || null,
    name: breadcrumb.category_name || breadcrumb.name || '',
    urlPath: urlPath ? `/${urlPath}` : '/',
    level: breadcrumb.category_level || breadcrumb.level || 0
  };
};

/**
 * Build complete breadcrumb trail from category data
 * 
 * ADOBE'S CATEGORY WITH BREADCRUMBS:
 * {
 *   id: 6,
 *   name: "Phones",
 *   url_path: "phones",
 *   breadcrumbs: [{
 *     category_name: "Electronics",
 *     category_url_path: "electronics"
 *   }]
 * }
 * 
 * OUR COMPLETE TRAIL:
 * [
 *   { name: "Home", href: "/", isActive: false },
 *   { name: "Electronics", href: "/electronics", isActive: false },
 *   { name: "Phones", href: "/phones", isActive: true }
 * ]
 */
const buildBreadcrumbTrail = (category) => {
  const breadcrumbs = [];
  
  // Don't add Home - the frontend already displays a home icon
  
  if (category) {
    // Add parent categories from breadcrumbs array
    if (category.breadcrumbs && Array.isArray(category.breadcrumbs)) {
      const parentCrumbs = category.breadcrumbs
        .map(crumb => transformBreadcrumb(crumb, false))
        .filter(Boolean);
      
      breadcrumbs.push(...parentCrumbs);
    }
    
    // Add current category as the last breadcrumb
    if (category.name) {
      breadcrumbs.push({
        categoryId: category.id || category.uid || null,
        name: category.name,
        urlPath: category.url_path ? `/${category.url_path}` : '/',
        level: category.level || breadcrumbs.length
      });
    }
  }
  
  return breadcrumbs;
};

// ============================================================================
// QUERY EXECUTION - Get category with breadcrumbs from Commerce
// ============================================================================

const executeCategoryBreadcrumbs = async (context, args) => {
  if (!args.categoryUrlKey) {
    return [];  // No category specified
  }
  
  try {
    // Query Adobe Commerce for specific category with breadcrumbs
    const result = await context.CommerceGraphQL.Query.Commerce_categoryList({
      root: {},
      args: {
        filters: {
          url_key: { eq: args.categoryUrlKey }
        }
      },
      context,
      selectionSet: `{
        id
        uid
        name
        url_path
        level
        breadcrumbs {
          category_id
          category_name
          category_url_path
          category_level
        }
      }`
    });
    
    // Get the first (and should be only) category
    const category = result?.[0];
    
    // Build and return breadcrumb trail
    return buildBreadcrumbTrail(category);
    
  } catch (error) {
    console.error('Error fetching category breadcrumbs:', error);
    return [];
  }
};

// ============================================================================
// MAIN RESOLVER - Clean breadcrumb API
// ============================================================================

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryBreadcrumbs: {
        resolve: async (root, args, context, info) => {
          try {
            // Get breadcrumb trail from Commerce
            const breadcrumbs = await executeCategoryBreadcrumbs(context, args);
            
            // Return clean breadcrumb structure matching schema
            // Ready for direct use in breadcrumb components
            return {
              items: breadcrumbs || []
            };
            
          } catch (error) {
            console.error('Category breadcrumbs resolver error:', error);
            // Return empty breadcrumbs on error (graceful degradation)
            return { items: [] };
          }
        }
      }
    }
  }
};