# Utility Injection Pattern

## Overview

This document describes the enhanced utility injection pattern that allows us to maintain DRY (Don't Repeat Yourself) principles despite Adobe API Mesh's limitation of not supporting external imports in resolvers.

## The Problem

Adobe API Mesh resolvers must be completely self-contained:

- No `import` or `require` statements allowed
- Each resolver must include all code it needs inline
- This traditionally led to massive code duplication across resolvers

## The Solution: Smart Utility Injection

We've implemented a build-time injection system that:

1. Maintains utility functions in separate modules for easy maintenance
2. Automatically detects which utilities each resolver needs
3. Injects only the required utilities at build time
4. Groups utilities by module for better organization

## Architecture

### Directory Structure

```
resolvers-src/
├── utils/                    # Utility modules (source of truth)
│   ├── price-utils.js       # Price formatting, calculations
│   ├── filter-utils.js      # Filter transformations
│   ├── product-transform.js # Product data transformations
│   ├── facet-transform.js   # Facet transformations
│   ├── navigation-utils.js  # Navigation helpers
│   └── attribute-utils.js   # Attribute extraction
├── product-cards.js         # Clean resolver focusing on orchestration
├── category-page.js         # Clean resolver focusing on orchestration
└── ...

resolvers/                    # Generated (git-ignored)
├── product-cards.js         # With injected utilities
├── category-page.js         # With injected utilities
└── ...
```

### How It Works

1. **Write Clean Resolvers**: Focus on business logic and orchestration

```javascript
// resolvers-src/product-cards.js
const executeSearchMode = async (context, args) => {
  // Just use the function - it will be injected
  const filters = buildLiveSearchFilters(args.filter);
  // ... orchestration logic
};
```

2. **Define Utilities**: Maintain reusable functions in utility modules

```javascript
// resolvers-src/utils/filter-utils.js
const buildLiveSearchFilters = (filter) => {
  // Implementation
};

module.exports = {
  buildLiveSearchFilters,
  // ... other filter utilities
};
```

3. **Build Process**: Smart injection happens automatically

```bash
npm run build
```

The build script:

- Scans each resolver for function calls
- Identifies which utilities are needed
- Injects only those utilities
- Groups them by module for clarity

4. **Generated Output**: Clean, self-contained resolvers

```javascript
// resolvers/product-cards.js (generated)

// ============================================================================
// INJECTED FACET MAPPINGS
// ============================================================================
const FACET_MAPPINGS = {
  /* ... */
};

// ============================================================================
// INJECTED UTILITY FUNCTIONS
// ============================================================================

// From filter-utils.js
const buildLiveSearchFilters = (filter) => {
  /* ... */
};

// From product-transform.js
const transformProductToCard = (product) => {
  /* ... */
};

// ============================================================================
// ORIGINAL RESOLVER CODE BELOW
// ============================================================================
// ... your clean resolver code
```

## Utility Modules

### price-utils.js

- `formatPrice()` - Format prices with currency
- `calculateDiscountPercent()` - Calculate discount percentages
- `extractPriceValue()` - Extract prices from nested structures
- `isOnSale()` - Determine if product is on sale
- `parsePriceRange()` - Parse price range strings

### filter-utils.js

- `buildCatalogFilters()` - Build filters for Catalog Service
- `buildLiveSearchFilters()` - Build filters for Live Search
- `buildPageFilters()` - Build filters for page-level queries
- `normalizeFilterValue()` - Normalize filter values
- `mapSortAttribute()` - Map sort attributes

### product-transform.js

- `transformProductToCard()` - Transform products to card format
- `transformLiveSearchProducts()` - Transform Live Search results
- `transformCatalogProducts()` - Transform Catalog results
- `mergeProducts()` - Merge products from multiple sources

### facet-transform.js

- `transformFacet()` - Transform single facet
- `transformFacets()` - Transform multiple facets
- `transformPriceOption()` - Format price facet options
- `sortFacets()` - Sort facets by importance

### navigation-utils.js

- `transformCategory()` - Transform category for navigation
- `filterForNavigation()` - Filter categories for display
- `buildHeaderNav()` - Build header navigation
- `buildFooterNav()` - Build footer navigation
- `buildBreadcrumbs()` - Build breadcrumb trail

### attribute-utils.js

- `findAttributeValue()` - Find attribute by name
- `extractVariantOptions()` - Extract product variants
- `ensureHttpsUrl()` - Ensure URLs use HTTPS
- `isInStock()` - Check stock status
- `extractManufacturer()` - Extract manufacturer

## Benefits

1. **Single Source of Truth**: Each utility is defined once
2. **Easy Maintenance**: Update logic in one place
3. **Smaller Resolver Files**: Focus on orchestration, not implementation
4. **Consistent Behavior**: All resolvers use same utilities
5. **Smart Injection**: Only includes what's needed
6. **Better Organization**: Clear separation of concerns
7. **Type Safety**: TypeScript can still check function signatures

## Writing New Resolvers

1. **Focus on Orchestration**: Write clean business logic

```javascript
// Just use utilities as if they were imported
const products = transformCatalogProducts(result.items);
const filters = buildCatalogFilters(args.filter);
```

2. **Let Build Handle Injection**: Don't worry about copying functions

3. **Add New Utilities**: Create new utility modules as needed

```javascript
// resolvers-src/utils/my-utils.js
const myHelper = () => {
  /* ... */
};
module.exports = { myHelper };
```

## Updating Utilities

1. **Edit the Utility Module**: Make changes in `resolvers-src/utils/`
2. **Rebuild**: Run `npm run build`
3. **Deploy**: Changes propagate to all resolvers that use them

## Best Practices

1. **Keep Utilities Pure**: No side effects, just transformations
2. **Document Parameters**: Clear JSDoc comments
3. **Consistent Naming**: Use descriptive function names
4. **Group Related Functions**: Organize by domain
5. **Test Utilities**: Can be unit tested separately
6. **Avoid Circular Dependencies**: Utilities shouldn't depend on each other

## Comparison: Before vs After

### Before (Traditional Approach)

- product-cards.js: 972 lines (with all utilities inline)
- category-page.js: 835 lines (with duplicate utilities)
- Total duplication: ~500 lines of repeated code

### After (Utility Injection)

- product-cards.js: 300 lines (clean orchestration)
- category-page.js: 361 lines (clean orchestration)
- Utilities: 6 modules, ~900 lines total (shared)
- Zero duplication, 40% less code overall

## Limitations

1. **Build Step Required**: Must rebuild after changes
2. **No Runtime Imports**: Still bound by API Mesh limitations
3. **Function Detection**: Regex-based, may miss edge cases
4. **Debugging**: Errors reference generated files

## Future Improvements

1. **AST-based Detection**: More accurate function detection
2. **Source Maps**: Better debugging experience
3. **Utility Testing**: Automated tests for utilities
4. **Dependency Graph**: Visualize utility usage
5. **Tree Shaking**: More aggressive dead code elimination

## Conclusion

The utility injection pattern successfully overcomes API Mesh's import limitations while maintaining clean, DRY code. Resolvers can now focus on business logic while the build system handles the complexity of creating self-contained files.
