/**
 * NAVIGATION UTILITIES
 *
 * Centralized navigation and category transformation functions for
 * consistent category hierarchy handling across resolvers.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 */

/**
 * Transform a category object for navigation use
 * @param {object} category - Raw category from Commerce Core
 * @returns {object|null} Transformed category
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
    description: category.description || null,
    metaTitle: category.meta_title || category.name,
    metaDescription: category.meta_description || null,
  };
};

/**
 * Filter categories for navigation display
 * Applies business rules for what should appear in navigation
 * @param {array} categories - Array of transformed categories
 * @param {number} maxItems - Maximum items to show (default: 10)
 * @returns {array} Filtered categories
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
 * Build header navigation items
 * Simplified structure for header menus
 * @param {array} categories - Filtered categories
 * @param {number} maxItems - Maximum items for header (default: 5)
 * @returns {array} Header navigation items
 */
const buildHeaderNav = (categories, maxItems = 5) => {
  if (!categories || !Array.isArray(categories)) return [];

  return categories.slice(0, maxItems).map((cat) => ({
    href: cat.href,
    label: cat.label,
    category: cat.urlKey,
    children:
      cat.children?.slice(0, 5).map((child) => ({
        href: child.href,
        label: child.label,
        category: child.urlKey,
      })) || [],
  }));
};

/**
 * Build footer navigation items
 * Simplified flat structure for footer links
 * @param {array} categories - Filtered categories
 * @param {number} maxItems - Maximum items for footer (default: 8)
 * @returns {array} Footer navigation items
 */
const buildFooterNav = (categories, maxItems = 8) => {
  if (!categories || !Array.isArray(categories)) return [];

  return categories.slice(0, maxItems).map((cat) => ({
    href: cat.href,
    label: cat.label,
  }));
};

/**
 * Build breadcrumb trail for a category
 * @param {object} category - Current category with breadcrumbs
 * @param {boolean} includeHome - Whether to include Home link (default: false)
 * @returns {array} Breadcrumb items
 */
const buildBreadcrumbs = (category, includeHome = false) => {
  const breadcrumbs = [];

  // Optionally add Home (frontend may handle this with an icon)
  if (includeHome) {
    breadcrumbs.push({
      categoryId: null,
      name: 'Home',
      urlPath: '/',
      level: 0,
    });
  }

  // Add parent categories from breadcrumbs array
  if (category?.breadcrumbs && Array.isArray(category.breadcrumbs)) {
    category.breadcrumbs.forEach((crumb, index) => {
      breadcrumbs.push({
        categoryId: crumb.category_id || null,
        name: crumb.category_name || '',
        urlPath: crumb.category_url_path || '',
        level: includeHome ? index + 1 : index,
      });
    });
  }

  // Add current category as the last breadcrumb
  if (category) {
    breadcrumbs.push({
      categoryId: category.id || null,
      name: category.name || '',
      urlPath: category.url_path || '',
      level: breadcrumbs.length,
      isActive: true, // Mark current page
    });
  }

  return breadcrumbs;
};

/**
 * Find a category by URL key in a category tree
 * @param {array} categories - Category tree
 * @param {string} urlKey - URL key to search for
 * @returns {object|null} Found category or null
 */
const findCategoryByUrlKey = (categories, urlKey) => {
  if (!categories || !urlKey) return null;

  for (const category of categories) {
    if (category.urlKey === urlKey || category.url_key === urlKey) {
      return category;
    }

    // Search children recursively
    if (category.children && category.children.length > 0) {
      const found = findCategoryByUrlKey(category.children, urlKey);
      if (found) return found;
    }
  }

  return null;
};

/**
 * Get category path from root to a specific category
 * @param {array} categories - Category tree
 * @param {string} categoryId - Target category ID
 * @param {array} path - Current path (used in recursion)
 * @returns {array} Path of categories from root to target
 */
const getCategoryPath = (categories, categoryId, path = []) => {
  if (!categories || !categoryId) return [];

  for (const category of categories) {
    const currentPath = [...path, category];

    if (String(category.id) === String(categoryId)) {
      return currentPath;
    }

    if (category.children && category.children.length > 0) {
      const foundPath = getCategoryPath(category.children, categoryId, currentPath);
      if (foundPath.length > 0) return foundPath;
    }
  }

  return [];
};

/**
 * Flatten category tree into a single-level array
 * Useful for search or dropdown selects
 * @param {array} categories - Category tree
 * @param {number} maxDepth - Maximum depth to flatten (default: Infinity)
 * @returns {array} Flattened array of categories
 */
const flattenCategories = (categories, maxDepth = Infinity, currentDepth = 0) => {
  if (!categories || currentDepth >= maxDepth) return [];

  const flattened = [];

  categories.forEach((category) => {
    // Add the category with depth indicator
    flattened.push({
      ...category,
      depth: currentDepth,
      children: undefined, // Remove children from flattened version
    });

    // Recursively flatten children
    if (category.children && category.children.length > 0) {
      flattened.push(...flattenCategories(category.children, maxDepth, currentDepth + 1));
    }
  });

  return flattened;
};

/**
 * Build mega menu structure from categories
 * Groups categories for mega menu display
 * @param {array} categories - Top-level categories
 * @returns {object} Mega menu structure
 */
const buildMegaMenu = (categories) => {
  if (!categories || !Array.isArray(categories)) return { columns: [] };

  // Group categories into columns for mega menu
  const columns = [];
  const itemsPerColumn = 5;

  categories.forEach((category, index) => {
    const columnIndex = Math.floor(index / itemsPerColumn);

    if (!columns[columnIndex]) {
      columns[columnIndex] = [];
    }

    columns[columnIndex].push({
      title: category.name,
      href: category.href,
      items: (category.children || []).slice(0, 8).map((child) => ({
        label: child.name,
        href: child.href,
      })),
    });
  });

  return { columns };
};

// Export for build script to process
module.exports = {
  transformCategory,
  filterForNavigation,
  buildHeaderNav,
  buildFooterNav,
  buildBreadcrumbs,
  findCategoryByUrlKey,
  getCategoryPath,
  flattenCategories,
  buildMegaMenu,
};
