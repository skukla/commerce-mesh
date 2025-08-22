# Facet Implementation Guide

## Overview

This document covers the implementation details for product facets (filters) in the Adobe API Mesh resolvers, including dynamic facet support and SEO-friendly URL mapping.

## Dynamic Facet Architecture

### Core Components

1. **JSON Scalar Type** - Enables dynamic filter support:

   ```graphql
   scalar JSON # Allows filter.facets to accept any key-value pairs
   input Citisignal_ProductFilter {
     facets: JSON # Dynamic filters from Adobe Commerce
     # Legacy fields kept for compatibility
   }
   ```

2. **Facet Mapping Configuration** (`config/facet-mappings.json`):

   ```json
   {
     "mappings": {
       "cs_manufacturer": "manufacturer",  # SEO-friendly URLs
       "cs_memory": "storage"
     },
     "defaults": {
       "removePrefix": ["cs_", "attr_"],
       "replaceUnderscore": true,
       "toLowerCase": true
     }
   }
   ```

3. **Build-Time Injection** - Mappings are injected into resolvers at build time:
   - Avoids API Mesh import limitations
   - Creates `resolvers-processed/` directory with injected code
   - Adds `attributeCodeToUrlKey()` and `urlKeyToAttributeCode()` helper functions

### Data Flow

1. **Adobe → Mesh**: Facets come with technical attribute codes (e.g., `cs_manufacturer`)
2. **Mesh Processing**: Converts to SEO-friendly keys using mappings
3. **Mesh → Frontend**: Returns both `key` (for URLs) and `attributeCode` (for reference)
4. **Frontend → Mesh**: Sends filters using clean URL keys
5. **Mesh → Adobe**: Converts keys back to attribute codes for queries

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

### Dynamic Filter Support

The system now supports ANY filters configured in Adobe Commerce:

````javascript
// Frontend sends clean URL keys
filter: {
  facets: {
    "manufacturer": "Apple",
    "storage": "256GB",
    "color": "black",
    "price": "300-500"
  }
}

// Mesh converts to Adobe attribute codes
filters: [
  { attribute: "cs_manufacturer", in: ["Apple"] },
  { attribute: "cs_memory", in: ["256GB"] },
  { attribute: "cs_color", in: ["black"] },
  { attribute: "price", range: { from: 300, to: 500 } }
]

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
````

### Building Filters with Dynamic Support

```javascript
const buildLiveSearchFilters = (filter) => {
  const searchFilters = [];

  // Category filter (still separate for clarity)
  if (filter.categoryUrlKey) {
    searchFilters.push({
      attribute: 'categories',
      in: [filter.categoryUrlKey],
    });
  }

  // Dynamic facets - supports ANY Adobe attributes
  if (filter.facets && typeof filter.facets === 'object') {
    Object.entries(filter.facets).forEach(([urlKey, value]) => {
      // Convert URL key back to Adobe attribute code
      const attributeCode = urlKeyToAttributeCode(urlKey);

      if (attributeCode === 'price' && Array.isArray(value)) {
        // Special handling for price ranges
        const [min, max] = value[0].split('-').map(parseFloat);
        searchFilters.push({
          attribute: attributeCode,
          range: { from: min || 0, to: max || 999999 },
        });
      } else if (value) {
        // All other attributes
        searchFilters.push({
          attribute: attributeCode,
          in: Array.isArray(value) ? value : [value],
        });
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
2. **Use build-time injection** for shared configuration/utilities
3. **Map URLs for SEO** - Clean keys in URLs, technical codes in queries
4. **Support dynamic attributes** - Use JSON scalar for extensibility
5. **Test with curl** before deploying to verify counts
6. **Keep filter logic consistent** across all resolvers
7. **Document mappings** - Keep `facet-mappings.json` documented
8. **Preserve display names** - Always use Adobe's title field, not hard-coded names
