/**
 * CATEGORY BREADCRUMBS RESOLVER
 * 
 * Fetches breadcrumb trail for a specific category from Commerce Core GraphQL.
 * Used for SEO-friendly navigation paths.
 * 
 * SERVICE SELECTION:
 * - Commerce Core: Has full category hierarchy with breadcrumb support
 * - Live Search/Catalog: No breadcrumb functionality
 */

/**
 * Transform Commerce breadcrumb to our Citisignal_BreadcrumbItem type
 */
const transformBreadcrumb = (breadcrumb) => {
  if (!breadcrumb) return null;
  
  return {
    categoryId: breadcrumb.category_id || null,
    name: breadcrumb.category_name || breadcrumb.name || '',
    urlPath: breadcrumb.category_url_path || breadcrumb.url_path || '',
    level: breadcrumb.category_level || breadcrumb.level || 0
  };
};

/**
 * Build complete breadcrumb trail (excluding Home since UI has icon)
 */
const buildBreadcrumbTrail = (category) => {
  const breadcrumbs = [];
  
  if (category) {
    // Add category breadcrumbs if available (parent categories)
    if (category.breadcrumbs && Array.isArray(category.breadcrumbs)) {
      const categoryBreadcrumbs = category.breadcrumbs
        .map(transformBreadcrumb)
        .filter(Boolean)
        .map((crumb, index) => ({
          ...crumb,
          level: index // Start at level 0
        }));
      
      breadcrumbs.push(...categoryBreadcrumbs);
    }
    
    // Add current category as final breadcrumb
    breadcrumbs.push({
      categoryId: category.id || category.uid,
      name: category.name || '',
      urlPath: category.url_path || '',
      level: breadcrumbs.length
    });
  }
  
  return breadcrumbs;
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_categoryBreadcrumbs: async (root, args, context, info) => {
        try {
          const { categoryUrlKey } = args;
          
          if (!categoryUrlKey) {
            return {
              items: []
            };
          }

          // Query Commerce Core for all categories
          // Commerce_categoryList returns array of CategoryTree
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
              breadcrumbs {
                category_id
                category_name
                category_url_path
                category_level
              }
              children {
                id
                uid
                name
                url_path
                url_key
                level
                breadcrumbs {
                  category_id
                  category_name
                  category_url_path
                  category_level
                }
                children {
                  id
                  uid
                  name
                  url_path
                  url_key
                  level
                  breadcrumbs {
                    category_id
                    category_name
                    category_url_path
                    category_level
                  }
                }
              }
            }`
          });

          // Find the category by URL key in the tree
          let category = null;
          
          function findCategoryByUrlKey(categories, urlKey) {
            for (const cat of categories) {
              if (cat.url_key === urlKey) {
                return cat;
              }
              if (cat.children) {
                const found = findCategoryByUrlKey(cat.children, urlKey);
                if (found) return found;
              }
            }
            return null;
          }
          
          if (Array.isArray(result)) {
            category = findCategoryByUrlKey(result, categoryUrlKey);
          }
          
          if (!category) {
            // Return empty breadcrumbs if category not found
            return {
              items: []
            };
          }

          // Build complete breadcrumb trail
          const breadcrumbs = buildBreadcrumbTrail(category);
          
          return {
            items: breadcrumbs
          };

        } catch (error) {
          console.error('[CategoryBreadcrumbs] Error fetching breadcrumbs:', error);
          
          // Return empty breadcrumbs on error
          return {
            items: []
          };
        }
      }
    }
  }
};