# Resolver Patterns

## Overview

Adobe API Mesh resolvers must be self-contained due to platform limitations. This document describes the patterns, conventions, and smart build system we use to maintain consistency and eliminate code duplication.

## Table of Contents

- [Limitations and Solutions](#limitations-and-solutions)
- [Standard Resolver Structure](#standard-resolver-structure)
- [Utility Injection System](#utility-injection-system)
- [Common Patterns](#common-patterns)
- [Service Query Patterns](#service-query-patterns)
- [Response Structures](#response-structures)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)

## Limitations and Solutions

### Platform Constraints

Adobe API Mesh has strict limitations:

- No `import` or `require` statements allowed
- No shared utility libraries
- Each resolver must be completely self-contained
- No access to file system or external modules

### Smart Utility Injection Solution

We've developed a build-time injection system that:

1. **Maintains utilities in separate modules** (`resolvers-src/utils/`)
2. **Automatically detects** which utilities each resolver needs
3. **Injects only required functions** at build time
4. **Handles transitive dependencies** automatically
5. **Eliminates manual copying** and duplication

This system reduced ~2000 lines of duplicated code across resolvers.

## Standard Resolver Structure

Every resolver follows this 9-section pattern for consistency:

```javascript
/**
 * RESOLVER NAME - PURPOSE
 *
 * What Adobe gives us: [Complex structure description]
 * What we deliver: [Simple structure description]
 */

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================
const DEFAULT_PAGE_SIZE = 24; // Consistent across all resolvers
const DEFAULT_MAX_PRICE = 999999;
const DEFAULT_MIN_PRICE = 0;

// ============================================================================
// SECTION 2: FILTER CONVERSION
// ============================================================================
// Convert frontend filters to service formats
// Note: These functions are injected at build time from utils/filter-utils.js

// ============================================================================
// SECTION 3: ATTRIBUTE EXTRACTION
// ============================================================================
// Extract and clean attributes from products
// Note: These functions are injected at build time from utils/attribute-utils.js

// ============================================================================
// SECTION 4: PRICE UTILITIES
// ============================================================================
// Price extraction and formatting
// Note: These functions are injected at build time from utils/price-utils.js

// ============================================================================
// SECTION 5: URL UTILITIES
// ============================================================================
// URL normalization and security
const ensureHttpsUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return url.replace(/^http:\/\//, 'https://');
};

// ============================================================================
// SECTION 6: PRODUCT TRANSFORMATION
// ============================================================================
// Transform products to consistent format
// Note: transformProduct is injected at build time from utils/product-transform.js

// ============================================================================
// SECTION 7: DOMAIN-SPECIFIC FUNCTIONS
// ============================================================================
// Resolver-specific transformations (e.g., navigation, facets)

// ============================================================================
// SECTION 8: SERVICE QUERIES
// ============================================================================
// Abstract service calls into functions
const fetchProducts = async (context, args) => { ... }
const fetchFacets = async (context, args) => { ... }

// ============================================================================
// SECTION 9: MAIN RESOLVER
// ============================================================================
module.exports = {
  resolvers: {
    Query: {
      Citisignal_resolverName: async (root, args, context, info) => {
        try {
          // Orchestrate service calls
          // Transform data
          // Return consistent shape
        } catch (error) {
          console.error(`Error in Citisignal_resolverName:`, error.message);
          // Return safe defaults for SSR resilience
          return {
            items: [],
            totalCount: 0,
          };
        }
      },
    },
  },
};
```

## Utility Injection System

### How It Works

1. **Source files** in `resolvers-src/` reference utilities normally
2. **Build script** detects used functions via AST analysis
3. **Transitive dependencies** are automatically included
4. **Injected code** is placed at the top of built resolvers

### Available Utility Modules

#### `utils/filter-utils.js`

```javascript
// Filter conversion and building
convertFiltersToProductFilter(filters);
buildCatalogFilters(productFilter);
buildLiveSearchFilters(productFilter);
normalizeFilterValue(value);
```

#### `utils/price-utils.js`

```javascript
// Price extraction and formatting
extractRegularPrice(product);
extractFinalPrice(product);
extractPriceValue(product, priceType, isComplex);
calculateDiscountPercentage(regularPrice, finalPrice);
formatPrice(amount);
```

#### `utils/attribute-utils.js`

```javascript
// Attribute extraction and mapping
attributeCodeToUrlKey(attributeCode);
extractAttributeValue(attributes, attributeName, defaultValue);
findAttributeValue(attributes, name);
extractVariantOptions(options);
```

#### `utils/product-transform.js`

```javascript
// Product transformation
transformProduct(product);
transformProductCard(product);
transformCatalogProduct(product, isComplex);
```

#### `utils/navigation-utils.js`

```javascript
// Navigation and category utilities
transformCategory(category);
buildCategoryUrl(category);
buildBreadcrumbs(categoryPath);
```

#### `utils/facet-transform.js`

```javascript
// Facet transformation
transformFacet(facet);
transformBucket(bucket);
```

## Common Patterns

### Helper Functions

These patterns are used across multiple resolvers:

```javascript
// Ensure HTTPS for security
const ensureHttps = (url) => {
  if (!url) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return url.replace(/^http:\/\//, 'https://');
};

// Extract variant options dynamically
const extractVariantOptions = (options) => {
  const variantOptions = {};
  if (!options || !Array.isArray(options)) return variantOptions;

  options.forEach((option) => {
    if (option.id?.startsWith('cs_')) {
      const cleanName = attributeCodeToUrlKey(option.id);
      if (cleanName === 'color' && option.values) {
        variantOptions.colors = option.values.map((v) => ({
          name: v.title,
          hex: v.value || '#000000',
        }));
      } else if (option.values) {
        variantOptions[cleanName] = option.values.map((v) => v.title);
      }
    }
  });

  return variantOptions;
};
```

## Service Query Patterns

### Live Search (AI-powered search)

```javascript
const searchResult = await context.LiveSearchSandbox.Query.Search_productSearch({
  root: {},
  args: {
    phrase: searchTerm,
    filter: filters,
    page_size: limit,
    current_page: page,
    sort: sortOptions,
  },
  context,
  selectionSet: `{
    items {
      product {
        sku
        name
        url_key
        # ... other fields
      }
    }
    page_info {
      current_page
      page_size
      total_pages
    }
    facets {
      attribute
      title
      buckets {
        ... on Search_ScalarBucket { title count }
        ... on Search_RangeBucket { title count }
      }
    }
  }`,
});
```

### Catalog Service (fast category browsing)

```javascript
const catalogResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
  root: {},
  args: {
    filter: filters,
    page_size: limit,
    current_page: page,
    sort: sortOptions,
  },
  context,
  selectionSet: `{
    items {
      productView {
        sku
        name
        urlKey
        # ... other fields
      }
    }
    page_info {
      current_page
      page_size
      total_pages
    }
    facets {
      attribute
      title
      buckets {
        ... on Catalog_ScalarBucket { title count }
        ... on Catalog_RangeBucket { title count }
      }
    }
  }`,
});
```

### Commerce GraphQL (category tree, etc.)

```javascript
const categoryResult = await context.CommerceGraphQL.Query.Commerce_categoryList({
  root: {},
  args: {
    filters: { url_key: { eq: categoryUrlKey } },
  },
  context,
  selectionSet: `{
    id
    name
    url_key
    url_path
    breadcrumbs {
      category_name
      category_url_key
    }
  }`,
});
```

## Response Structures

### Product List Response

```javascript
return {
  items: products || [],
  totalCount: total || 0,
  hasMoreItems: currentPage < totalPages,
  currentPage: currentPage || 1,
  page_info: {
    current_page: currentPage,
    page_size: pageSize,
    total_pages: totalPages,
  },
};
```

### Facets Response

```javascript
return {
  facets: facets.map((facet) => ({
    key: attributeCodeToUrlKey(facet.attribute),
    title: facet.title || cleanAttribute,
    type: facet.type || 'STANDARD',
    options: facet.buckets.map((bucket) => ({
      id: bucket.title,
      name: bucket.title,
      count: bucket.count || 0,
    })),
  })),
  totalCount: total || 0,
};
```

### Navigation Response

```javascript
return {
  items: navigationItems || [],
  headerNav: items.slice(0, 5).map((cat) => ({
    href: cat.href,
    label: cat.label,
    category: cat.urlKey,
  })),
  footerNav: items.slice(0, 8).map((cat) => ({
    href: cat.href,
    label: cat.label,
  })),
};
```

### Field Consistency Rules

#### Product Shape

All resolvers returning products must use this exact shape:

```javascript
{
  id: string,
  sku: string,
  urlKey: string,
  name: string,
  manufacturer: string | null,
  price: string,  // Formatted with $
  originalPrice: string | null,  // Only if on sale
  discountPercent: number | null,
  inStock: boolean,
  image: {
    url: string,
    altText: string
  } | null,
  memory: string[] | null,  // For complex products
  colors: Array<{ name: string, hex: string }> | null
}
```

## Error Handling

### Pattern

Always return a valid structure that matches the schema:

```javascript
catch (error) {
  console.error(`Error in ${resolverName}:`, error.message);

  // Return complete structure with defaults
  // Never return null or undefined
  // SSR must always complete successfully
  return {
    items: [],
    totalCount: 0,
    hasMoreItems: false,
    currentPage: 1,
    page_info: {
      current_page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total_pages: 0,
    },
    // Include ALL required fields
  };
}
```

### Best Practices

1. **Log with context**: Include resolver name in error logs
2. **Return safe defaults**: Never throw errors that break SSR
3. **Include all required fields**: Check schema for non-nullable fields
4. **Maintain structure**: Return the same shape on success and error

## Testing Strategy

### For Each Resolver

1. **Test with minimal query first**

```graphql
query {
  Citisignal_resolver {
    totalCount
  }
}
```

2. **Test with filters/parameters**

```graphql
query {
  Citisignal_resolver(filter: { categoryUrlKey: "phones" }, limit: 10) {
    items {
      id
      name
    }
    totalCount
  }
}
```

3. **Test error cases**

- Invalid parameters
- Missing required fields
- Service timeouts

4. **Verify all required fields**

- Check against schema definition
- Ensure non-nullable fields have values

### Testing Commands

```bash
# Test individual resolver
curl -X POST $MESH_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"query":"{ Citisignal_productCards(limit: 1) { totalCount } }"}'

# Test with debug field
curl -X POST $MESH_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"query":"{ Citisignal_productCards { _debug } }"}'
```

## Resolver Types

### Page-Level Resolvers

- `category-page.js` - All data for category pages
- `product-page.js` - All data for product listing pages

These resolvers fetch complete page data in a single query for SSR optimization.

### Focused Resolvers

- `product-cards.js` - Product listings only
- `product-facets.js` - Filter facets only
- `search-suggestions.js` - Search autocomplete
- `category-navigation.js` - Navigation menus

These resolvers have single responsibilities for client-side updates.

## Maintaining Consistency

### When Updating Utilities

1. Update the function in the appropriate `utils/*.js` file
2. Run `npm run build` to regenerate resolvers
3. Test each affected resolver
4. Deploy with `npm run update`

### When Creating New Resolvers

1. Create in `resolvers-src/` directory
2. Follow the 9-section pattern
3. Use utility functions (they'll be injected)
4. Ensure consistent field shapes
5. Add comprehensive error handling
6. Test thoroughly before deployment

### Checklist

- [ ] Constants match standard values (DEFAULT_PAGE_SIZE = 24)
- [ ] Section comments are numbered correctly
- [ ] Field shapes match documentation
- [ ] Error handling returns safe defaults
- [ ] No debug code remains
- [ ] GraphQL queries use consistent field selections
- [ ] Utilities are from the shared modules

## Related Documentation

- [Utility Injection Pattern](../build-system/utility-injection.md)
- [Debugging Guide](../development/debugging-guide.md)
- [API Differences](../architecture/api-differences.md)
- [Schema Conventions](../architecture/schema-conventions.md)
