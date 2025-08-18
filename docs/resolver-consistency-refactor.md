# Resolver Consistency Refactoring

## Overview
All resolvers need to follow the same consistent pattern due to API Mesh limitations that prevent code sharing between files.

## Standard Resolver Structure

Each resolver should have these sections in order:

1. **File Header Comment** - Describe resolver purpose and services used
2. **SECTION 1: CONSTANTS** - Default values used throughout
3. **SECTION 2: FILTER CONVERSION** - Convert frontend filters to service formats
4. **SECTION 3: ATTRIBUTE EXTRACTION** - Extract and clean attributes
5. **SECTION 4: PRICE UTILITIES** - Price extraction and formatting
6. **SECTION 5: URL UTILITIES** - URL normalization (HTTPS)
7. **SECTION 6: PRODUCT TRANSFORMATION** - Transform products to consistent format
8. **SECTION 7: [DOMAIN-SPECIFIC]** - Resolver-specific transformations
9. **SECTION 8: SERVICE QUERIES** - Abstracted service calls
10. **SECTION 9: MAIN RESOLVER** - Main resolver logic with error handling

## Key Changes Made

### 1. Consistent Constants
- `DEFAULT_PAGE_SIZE = 24` (was inconsistent: 12 vs 24)
- `DEFAULT_MAX_PRICE = 999999`
- `DEFAULT_MIN_PRICE = 0`

### 2. Removed Debug Code
- Removed all `debugInfo` logging from product-page resolver
- Added consistent error logging with resolver name

### 3. Extracted Service Queries
- Created separate functions for each service call
- Makes the main resolver logic cleaner
- Easier to test and maintain

### 4. Consistent Error Handling
- All resolvers return safe defaults on error
- Log errors with resolver name for debugging
- Never throw errors that would break SSR

### 5. Standardized Utilities
All resolvers now have the same utility functions:
- `convertFiltersToProductFilter`
- `buildCatalogFilters`
- `buildLiveSearchFilters` (where needed)
- `transformProduct`
- `formatPrice`
- `calculateDiscountPercentage`
- `ensureHttpsUrl`
- `extractAttributeValue`
- etc.

## Files Refactored

1. ✅ `category-page.js` - Complete refactor with all sections
2. ⏳ `product-page.js` - Needs refactoring (remove debug, add sections)
3. ⏳ `product-cards.js` - Already well-structured, needs DEFAULT_PAGE_SIZE update
4. ⏳ `product-facets.js` - Already well-structured, minor updates needed

## Benefits

1. **Maintainability** - Easy to update utilities across all resolvers
2. **Consistency** - Same patterns make debugging easier
3. **Documentation** - Clear sections make code self-documenting
4. **Error Resilience** - Consistent error handling for SSR
5. **Performance** - Parallel queries and optimized transformations