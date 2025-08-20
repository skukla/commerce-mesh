# Facet Implementation Guide

## Overview
This document covers the implementation details for product facets (filters) in the Adobe API Mesh resolvers, including critical requirements for proper facet count display and multiple filter support.

## Key Concepts

### GraphQL Inline Fragments for Bucket Types
Adobe Commerce APIs return facet buckets as union types that require inline fragments to access the count field:

```graphql
# ❌ INCORRECT - Will return count: 0
facets {
  buckets {
    title
    count  # This won't work!
  }
}

# ✅ CORRECT - Use inline fragments
facets {
  buckets {
    ... on Search_ScalarBucket {
      title
      count
    }
    ... on Search_RangeBucket {
      title
      count
    }
  }
}
```

For Catalog Service, use the `Catalog_` prefix:
- `Catalog_ScalarBucket`
- `Catalog_RangeBucket`

For Live Search, use the `Search_` prefix:
- `Search_ScalarBucket`
- `Search_RangeBucket`

## Filter Implementation

### Supported Filters
All resolvers support the following filters:

1. **Category** (`categoryUrlKey`)
   - Live Search: `categories` attribute
   - Catalog Service: `categoryPath` attribute

2. **Manufacturer** (`manufacturer`)
   - Attribute: `cs_manufacturer`
   - Case-insensitive via `normalizeFilterValue()`

3. **Memory** (`memory`)
   - Attribute: `cs_memory`
   - Accepts single value or array

4. **Colors** (`colors`)
   - Attribute: `cs_color`
   - Always expects array

5. **Price Range** (`priceMin`, `priceMax`)
   - Attribute: `price`
   - Uses range object

### Filter Normalization

```javascript
// Case-insensitive manufacturer matching
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

// Examples:
// "apple" → "Apple"
// "APPLE" → "Apple" 
// "Apple" → "Apple"
```

### Building Filters

```javascript
const buildLiveSearchFilters = (filter) => {
  const searchFilters = [];
  
  // Category filter
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey]
    });
  }
  
  // Manufacturer with normalization
  if (filter.manufacturer) {
    searchFilters.push({
      attribute: 'cs_manufacturer',
      in: [normalizeFilterValue(filter.manufacturer)]
    });
  }
  
  // Memory filter
  if (filter.memory) {
    searchFilters.push({
      attribute: 'cs_memory',
      in: Array.isArray(filter.memory) ? filter.memory : [filter.memory]
    });
  }
  
  // Color filter
  if (filter.colors && filter.colors.length > 0) {
    searchFilters.push({
      attribute: 'cs_color',
      in: filter.colors
    });
  }
  
  // Price range
  if (filter.priceMin !== undefined || filter.priceMax !== undefined) {
    searchFilters.push({
      attribute: 'price',
      range: {
        from: filter.priceMin || 0,
        to: filter.priceMax || 999999
      }
    });
  }
  
  return searchFilters;
};
```

## Multiple Facet Filtering

Filters are cumulative using AND logic:
- Apple → Shows all Apple products
- Apple + 256GB → Shows only Apple products with 256GB option
- Apple + 256GB + Black → Shows only black Apple products with 256GB

## Common Issues and Solutions

### Issue: Facet counts showing 0

**Cause**: Missing inline fragments in GraphQL query
**Solution**: Always use inline fragments for bucket types (see above)

### Issue: Filters not applying

**Cause**: Filter attribute not implemented in resolver
**Solution**: Add filter handling in both `buildLiveSearchFilters` and `buildCatalogFilters`

### Issue: Case sensitivity in filters

**Cause**: Direct string comparison without normalization
**Solution**: Use `normalizeFilterValue()` for string filters like manufacturer

## Resolver Files

The following resolvers implement facet filtering:

1. **product-facets.js**: Returns filter options with counts
2. **product-cards.js**: Returns filtered products
3. **category-page.js**: Unified query combining products and facets

All three must handle filters consistently for proper operation.

## Testing Facets

Test facet implementation with curl:

```bash
# Test facet counts
curl -X POST $MESH_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "Magento-Environment-Id: $ENV_ID" \
  -d '{"query": "query { Citisignal_productFacets(filter: { categoryUrlKey: \"phones\" }) { facets { key title options { name count } } } }"}'

# Test multiple filters
curl -X POST $MESH_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "Magento-Environment-Id: $ENV_ID" \
  -d '{"query": "query { Citisignal_productCards(filter: { categoryUrlKey: \"phones\", manufacturer: \"Apple\", memory: \"256GB\" }) { totalCount } }"}'
```

## Best Practices

1. **Always use inline fragments** for facet buckets
2. **Normalize string filters** for case-insensitive matching
3. **Handle arrays properly** for multi-value filters
4. **Test with curl** before deploying to verify counts
5. **Keep filter logic consistent** across all resolvers