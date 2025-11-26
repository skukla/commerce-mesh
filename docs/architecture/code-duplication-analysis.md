# Code Duplication Analysis

## Summary

**Good news**: Code duplication is already well-managed through our build-time utility injection system. The unified resolvers (like `category-page.js`) **do not duplicate** logic from individual resolvers - they share the same utility functions via build-time injection.

## How It Works

### Build-Time Injection Pattern

Our `scripts/build-mesh.js` performs AST analysis to:

1. Detect which utility functions each resolver needs
2. Resolve transitive dependencies automatically
3. Inject only required functions at build time
4. Eliminate code duplication across resolvers

### Shared Functions

#### Category Operations

- `transformCategory` - Used by both category-page.js and category-navigation.js
- `filterForNavigation` - Shared across navigation resolvers
- `buildBreadcrumbs` - Used by category-page.js (injected from utils)

#### Product Transformations

- `transformProductToCard` - Shared by product-cards.js and category-page.js
- `transformProductToCard` is in utils/product-transform.js
- Build system injects it wherever needed

#### Navigation Utilities

- `buildHeaderNav` - Extracted to navigation-utils.js
- `buildFooterNav` - Extracted to navigation-utils.js
- Injected into resolvers that need them

#### Facet Processing

- `transformFacets` - In utils/facet-transform.js
- Shared across product-facets.js and category-page.js
- No duplication due to injection

## Verification

### category-page.js (Unified Resolver)

```javascript
// These functions are injected by build system:
const transformedNav = navigation?.map(transformCategory).filter(Boolean) || [];
const navItems = filterForNavigation(transformedNav, 10);
const breadcrumbs = buildBreadcrumbs(category);
const productItems =
  products?.items?.map((item) => transformProductToCard(item.productView)).filter(Boolean) || [];
```

### category-navigation.js (Individual Resolver)

```javascript
// Same transformCategory function injected here too:
const transformed = result?.map(transformCategory).filter(Boolean) || [];
```

### No Duplication

- Both resolvers reference the same function names
- Build system injects the actual function code
- Single source of truth in `resolvers-src/utils/`
- Changes to utility propagate to all resolvers

## Utility Modules

### Current Structure

```
resolvers-src/
├── utils/
│   ├── navigation-utils.js     # transformCategory, buildHeaderNav, buildFooterNav
│   ├── product-transform.js    # transformProductToCard, transformProduct
│   ├── facet-transform.js      # transformFacets
│   ├── filter-utils.js         # buildPageFilters, convertFilters
│   ├── price-utils.js          # extractProductPricing, formatPrice
│   └── attribute-utils.js      # extractAttributeValue, findAttributeValue
```

### Build Process

1. **Source**: Write resolver with utility function calls
2. **Build**: `npm run build` analyzes AST and injects utilities
3. **Output**: `build/resolvers/*.js` has complete, self-contained code
4. **Deploy**: Self-contained resolvers uploaded to API Mesh

## Why This Works

### Advantages

✅ **No Manual Duplication** - Write utility once, use everywhere  
✅ **Single Source of Truth** - Changes propagate automatically  
✅ **API Mesh Compatible** - Output is self-contained as required  
✅ **Transitive Dependencies** - Build system resolves automatically  
✅ **Clean Source Code** - Resolvers focus on orchestration

### Example: Adding New Utility

```javascript
// 1. Add to utils/my-utils.js
export const myNewUtility = (data) => {
  // implementation
};

// 2. Use in resolver
const result = myNewUtility(data); // eslint-disable-line no-undef

// 3. Build automatically injects it
npm run build

// 4. No manual copying needed!
```

## Areas Without Duplication

### Navigation

- ✅ transformCategory - in navigation-utils.js
- ✅ filterForNavigation - in navigation-utils.js
- ✅ buildHeaderNav - in navigation-utils.js
- ✅ buildFooterNav - in navigation-utils.js

### Products

- ✅ transformProductToCard - in product-transform.js
- ✅ transformProduct - in product-transform.js
- ✅ extractProductPricing - in price-utils.js

### Facets

- ✅ transformFacets - in facet-transform.js
- ✅ Facet mappings - loaded once, could be cached in context.state

### Filters

- ✅ buildPageFilters - in filter-utils.js
- ✅ convertFilters - in filter-utils.js
- ✅ buildCatalogFilters - in filter-utils.js

## Potential Optimizations

### 1. Cache Facet Mappings (Low Priority)

Currently, facet mappings might be loaded in multiple resolvers. Could cache in context.state:

```javascript
const getFacetMappings = (context) => {
  if (!context.state) context.state = {};
  if (!context.state.facetMappings) {
    context.state.facetMappings = loadFacetMappings();
  }
  return context.state.facetMappings;
};
```

**Impact**: Minimal - facet mappings are small and load fast  
**Priority**: Low

### 2. Monitor Build Output Size

As we add utilities, monitor the size of built resolvers:

- Each resolver gets only what it needs
- Transitive dependencies add size
- Keep utilities focused and minimal

**Action**: Periodic review of build/ directory file sizes  
**Threshold**: Individual resolver > 100KB warrants review

## Conclusion

**Our build system already prevents code duplication effectively.** The unified resolvers share utilities with individual resolvers through build-time injection. No manual extraction or refactoring needed at this time.

## Maintenance Guidelines

### When Adding New Resolvers

1. Use utility functions from `resolvers-src/utils/`
2. Add `// eslint-disable-line no-undef` for injected functions
3. Run `npm run build` - injection happens automatically
4. Test the built resolver in dev mesh

### When Adding New Utilities

1. Create/update file in `resolvers-src/utils/`
2. Export the function
3. Use in any resolver
4. Build system detects and injects automatically

### When Modifying Utilities

1. Update the function in `utils/`
2. Run `npm run build`
3. Test **all** affected resolvers (build system shows which)
4. Deploy with confidence - changes propagate

## Related Documentation

- [Build System Utility Injection](../build-system/utility-injection.md)
- [Resolver Patterns](./resolver-patterns.md)
- [Optimization Analysis](./resolver-optimization-analysis.md)
