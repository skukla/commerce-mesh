# API Mesh Resolver Patterns

## Overview

Adobe API Mesh resolvers must be self-contained due to platform limitations. This document describes the patterns and conventions used to maintain consistency despite necessary code duplication.

## Limitations and Constraints

### Cannot Use External Files

- No `import` or `require` statements
- No shared utility libraries
- Each resolver must be completely self-contained
- Code duplication is unavoidable but manageable

### Solution: Utility Injection Pattern

We use a smart build-time injection system that:

1. Maintains utilities in separate modules (`resolvers-src/utils/`)
2. Automatically detects which utilities each resolver needs
3. Injects only required functions at build time
4. Eliminates manual copying and duplication

See [Utility Injection Pattern](./utility-injection-pattern.md) for details.

## Standard Resolver Structure

Every resolver follows this 9-section pattern:

### Section 1: Constants

```javascript
const DEFAULT_PAGE_SIZE = 24; // Consistent across all resolvers
const DEFAULT_MAX_PRICE = 999999;
const DEFAULT_MIN_PRICE = 0;
```

### Section 2: Filter Conversion

```javascript
// Convert frontend filter array to intermediate object
const convertFiltersToProductFilter = (filters) => { ... }

// Convert to Catalog Service format
const buildCatalogFilters = (productFilter) => { ... }

// Convert to Live Search format
const buildLiveSearchFilters = (productFilter) => { ... }
```

### Section 3: Attribute Extraction

```javascript
const attributeCodeToUrlKey = (attributeCode) => { ... } // Injected at build time
const extractAttributeValue = (attributes, attributeName, defaultValue) => { ... }
```

### Section 4: Price Utilities

```javascript
const extractRegularPrice = (product) => { ... }
const extractFinalPrice = (product) => { ... }
const calculateDiscountPercentage = (regularPrice, finalPrice) => { ... }
const formatPrice = (amount) => { ... }
```

### Section 5: URL Utilities

```javascript
const ensureHttpsUrl = (url) => { ... }
```

### Section 6: Product Transformation

```javascript
const transformProduct = (product) => {
  // Consistent product shape across all resolvers
  return {
    id,
    sku,
    urlKey,
    name,
    manufacturer,
    price,
    originalPrice,
    discountPercent,
    inStock,
    image,
    memory,
    colors,
  };
};
```

### Section 7: Domain-Specific Functions

Each resolver may have unique functions for its domain:

- Navigation transformation (page resolvers)
- Facet transformation (facet resolver)
- Sort mapping (product resolvers)

### Section 8: Service Queries

```javascript
// Abstract service calls into functions
const fetchProducts = async (context, args) => { ... }
const fetchFacets = async (context, args) => { ... }
const fetchNavigation = async (context, args) => { ... }
```

### Section 9: Main Resolver

```javascript
module.exports = {
  resolvers: {
    Query: {
      Citisignal_resolverName: async (root, args, context, info) => {
        try {
          // Orchestrate service calls
          // Return consistent shape
        } catch (error) {
          // Return safe defaults for SSR resilience
        }
      },
    },
  },
};
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

These resolvers have single responsibilities for client-side updates.

## Maintaining Consistency

### When Updating Utilities

1. Update the function in `shared-utilities-template.js`
2. Copy the updated function to ALL resolvers that use it
3. Test each resolver to ensure consistency

### When Creating New Resolvers

1. Start with the template structure
2. Copy needed utilities from `shared-utilities-template.js`
3. Follow the 9-section pattern
4. Ensure consistent field shapes with existing resolvers

## Field Consistency Rules

### Product Shape

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

### Facet Shape

```javascript
{
  title: string,
  key: string,
  type: 'list' | 'range',
  options: Array<{
    id: string,
    name: string,
    count: number
  }>
}
```

### Navigation Shape

```javascript
{
  headerNav: Array<{
    href: string,
    label: string,
    category: string,
    isActive?: boolean
  }>,
  footerNav: Array<{
    href: string,
    label: string
  }>
}
```

## Error Handling Pattern

All resolvers must return safe defaults on error:

```javascript
catch (error) {
  console.error(`Error in ${resolverName}:`, error.message);
  return {
    // Return empty but valid structure
    // Never return null or undefined
    // SSR must always complete successfully
  };
}
```

## Testing Checklist

When updating resolvers:

- [ ] Constants match template (DEFAULT_PAGE_SIZE = 24)
- [ ] All utility functions match template exactly
- [ ] Field shapes match documentation
- [ ] Error handling returns safe defaults
- [ ] Section comments are numbered correctly
- [ ] No debug code remains
- [ ] GraphQL queries use consistent field selections
