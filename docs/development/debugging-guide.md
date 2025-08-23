# Debugging Guide

## Overview

This comprehensive guide covers debugging strategies, tools, and solutions for Adobe API Mesh development. Since traditional debugging tools like `console.log` don't work in API Mesh resolvers, we've developed specialized approaches.

## Table of Contents

- [Debugging Strategy](#debugging-strategy)
- [Debug Field Pattern](#debug-field-pattern)
- [Common Issues](#common-issues)
- [Testing Workflow](#testing-workflow)
- [Performance Debugging](#performance-debugging)
- [Deployment Issues](#deployment-issues)

## Debugging Strategy

### Systematic Approach for 500 Errors

When encountering 500 errors in API Mesh:

1. **Remove all resolvers** from mesh.json and deploy
   - Confirms the base mesh configuration is working
   - Isolates the issue to custom resolvers

2. **Add resolvers back one by one**
   - Deploy after each addition
   - Test immediately to identify which resolver causes issues
   - Fix issues before adding the next resolver

3. **Test with the correct endpoint**
   - Use `https://edge-sandbox-graph.adobe.io/api/{mesh-id}/graphql` for sandbox
   - NOT `https://graph.adobe.io/api/{mesh-id}/graphql` (this redirects)

## Debug Field Pattern

Since `console.log` doesn't work in Adobe API Mesh resolvers, we use a `_debug` field approach.

### 1. Add Debug Field to Schema

```graphql
type Citisignal_ProductCardResult {
  items: [Citisignal_ProductCard]
  page_info: Citisignal_PageInfo
  _debug: String # Debug information when requested
}
```

### 2. Build Debug Info in Resolver

```javascript
const debugInfo = {};

// Capture input
debugInfo.receivedArgs = args;
debugInfo.searchResultExists = !!searchResult;

// Capture intermediate values
debugInfo.calculated = {
  currentPage,
  pageSize,
  totalPages,
  itemsLength: items.length,
};

// Capture upstream responses
debugInfo.searchResultPageInfo = searchResult?.page_info;
```

### 3. Conditionally Include Debug Field

```javascript
// Only include debug field if requested in selection set
const includeDebug = info?.fieldNodes?.[0]?.selectionSet?.selections?.some(
  (s) => s.name?.value === '_debug'
);

if (includeDebug) {
  response._debug = JSON.stringify(debugInfo, null, 2);
}
```

### 4. Using Debug in Queries

```graphql
query {
  Citisignal_productCards(limit: 10) {
    items {
      name
    }
    page_info {
      current_page
    }
    _debug # Request debug info
  }
}
```

### Debug Output Format

The `_debug` field returns a JSON string containing:

```json
{
  "receivedArgs": {
    "limit": 10,
    "page": 1
  },
  "searchResultExists": true,
  "searchResultPageInfo": {
    "current_page": 1,
    "page_size": 10,
    "total_pages": 5
  },
  "calculated": {
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 5,
    "itemsLength": 10
  }
}
```

## Common Issues

### Schema Mismatches

**Problem**: Resolver returns fields that don't match the GraphQL schema

**Example**: Returning `{ navigation: [] }` when schema expects `{ items: [], headerNav: [], footerNav: [] }`

**Solution**: Always check the schema definition and ensure resolver returns exact structure

### Field Name Mapping

**Problem**: Adobe APIs use different field names than your schema

**Example**:

- Adobe returns `attribute` and `buckets`
- Schema expects `key` and `options`

**Solution**: Transform field names in your resolver:

```javascript
return {
  key: cleanAttribute, // Map 'attribute' to 'key'
  title: title,
  options: buckets, // Map 'buckets' to 'options'
};
```

### Missing Required Fields

**Problem**: Schema defines non-nullable fields that resolver doesn't provide

**Example**: `Citisignal_ProductSuggestion.id` is required but not returned

**Solution**: Ensure all required fields are included, even if generating defaults:

```javascript
const id = productView.id || product.id || sku || name; // Fallback chain
```

### Context Path Errors

**Problem**: Incorrect paths to query upstream services

**Correct Pattern**:

```javascript
context.LiveSearchSandbox.Query.Search_productSearch();
context.CatalogServiceSandbox.Query.Catalog_productSearch();
context.CommerceGraphQL.Query.Commerce_categoryList();
```

### Facet Counts Showing 0

**Error**: Facet options display correctly but all show `count: 0`

**Cause**: Missing GraphQL inline fragments for bucket union types

**Solution**:

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
    ... on Search_ScalarBucket { title count }
    ... on Search_RangeBucket { title count }
  }
}
```

### Multiple Filters Not Working

**Error**: Adding second filter doesn't narrow results

**Cause**: Filter attributes not implemented in resolver filter builders

**Solution**: Add missing filter handling in `buildLiveSearchFilters` and `buildCatalogFilters`:

```javascript
// Add memory filter
if (filter.memory) {
  filters.push({
    attribute: 'cs_memory',
    in: Array.isArray(filter.memory) ? filter.memory : [filter.memory],
  });
}

// Add color filter
if (filter.colors && filter.colors.length > 0) {
  filters.push({
    attribute: 'cs_color',
    in: filter.colors,
  });
}
```

### Case Sensitivity in Filters

**Error**: Filtering by "apple" returns no results, only "Apple" works

**Solution**: Implement case normalization:

```javascript
const normalizeFilterValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

// Use in filter:
if (filter.manufacturer) {
  filters.push({
    attribute: 'cs_manufacturer',
    in: [normalizeFilterValue(filter.manufacturer)],
  });
}
```

### Cannot Return Null for Non-Nullable Field

**Error**: `Cannot return null for non-nullable field Citisignal_PageInfo.current_page`

**Solution**: Add fallback values in resolver:

```javascript
const currentPage = searchResult?.page_info?.current_page || 1;
const pageSize = searchResult?.page_info?.page_size || 20;
```

## Testing Workflow

### 1. Test Individual Resolvers

```bash
curl -s -X POST https://edge-sandbox-graph.adobe.io/api/{mesh-id}/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: {api-key}" \
  -H "Magento-Environment-Id: {env-id}" \
  -H "Magento-Website-Code: {website}" \
  -H "Magento-Store-View-Code: {store-view}" \
  -H "Magento-Store-Code: {store}" \
  -H "Magento-Customer-Group: 0" \
  -d '{"query":"{ Citisignal_productCards(limit: 1) { totalCount } }"}' | python3 -m json.tool
```

### 2. Test with Environment Variables

```bash
# Set environment variables
export MESH_ENDPOINT="https://edge-sandbox-graph.adobe.io/api/YOUR-MESH-ID/graphql"
export API_KEY="your-api-key"
export ENV_ID="your-environment-id"

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

### 3. Check Mesh Status

```bash
aio api-mesh:status
aio api-mesh:describe  # Gets endpoint URL
aio api-mesh:get       # Shows full configuration
```

### 4. Force Rebuild When Needed

```bash
npm run build -- --force   # Force rebuild even if no changes detected
npm run update -- --force  # Force deployment
```

## Performance Debugging

### Slow Queries

**Symptoms**: Queries take >2 seconds

**Debug Approach**:

```javascript
// Add timing to debug info
const startTime = Date.now();
const searchResult = await context.LiveSearchSandbox.Query.Search_productSearch();
const searchTime = Date.now() - startTime;

debugInfo.timing = {
  searchDuration: searchTime,
  totalDuration: Date.now() - startTime,
};
```

**Solutions**:

1. Avoid nested queries where possible
2. Use parallel Promise.all() for multiple calls
3. Implement caching in resolvers
4. Reduce selection set size

### Debugging Parallel Calls

```javascript
debugInfo.parallelCalls = {
  call1Duration: call1Time,
  call2Duration: call2Time,
  call1Success: !!result1,
  call2Success: !!result2,
};
```

## Deployment Issues

### Provisioning Timeout

**Error**: "Mesh deployment timed out"

**Solutions**:

1. Check mesh status manually: `npm run status`
2. Wait and retry deployment
3. Check Adobe status page for outages

### Invalid Configuration

**Error**: "Invalid mesh configuration"

**Solutions**:

1. Validate `mesh.json` is valid JSON
2. Check all resolver paths exist
3. Ensure environment variables are set
4. Validate GraphQL schema syntax

### Resolver Changes Not Working

**Error**: Code changes don't appear after deployment

**Solution**:

1. Force rebuild: `npm run build --force`
2. Force update: `npm run update --force`
3. Wait for provisioning to complete
4. Clear any CDN/browser caches

## Common Error Patterns

| Error                                     | Likely Cause                         | Solution                                       |
| ----------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| 500 Internal Server Error                 | Resolver runtime error               | Check resolver return structure matches schema |
| Cannot return null for non-nullable field | Missing required field               | Ensure all required fields are returned        |
| Gateway timeout (504)                     | Complex query or Adobe service issue | Retry, simplify query, or check Adobe status   |
| 301 Redirect                              | Wrong mesh endpoint                  | Use edge-sandbox-graph.adobe.io for sandbox    |
| Unknown type                              | Type is referenced but not defined   | Ensure type is defined in schema files         |
| Query not accessible                      | Filter schema not updated            | Update filterSchema in mesh.config.js          |
| Type already exists                       | Name conflict with Adobe types       | Use Citisignal\_ prefix for custom types       |

## Schema-Resolver Alignment Checklist

Before deploying a resolver:

- [ ] Check the GraphQL schema for the exact type definition
- [ ] Verify all required (!) fields are included
- [ ] Match field names exactly (key vs attribute, options vs buckets)
- [ ] Test with minimal query first
- [ ] Add error handling that returns valid structure
- [ ] Use consistent transformation functions across resolvers

## Debugging Tools

1. **Check resolver syntax**: `node -c resolvers/resolver-name.js`
2. **View mesh logs**: Available in Adobe Developer Console
3. **Test queries**: Use GraphQL playground or curl commands
4. **Incremental testing**: Add resolvers one by one
5. **Schema validation**: Compare resolver output with schema types
6. **Debug field**: Use `_debug` field for runtime inspection

## Best Practices

1. **Remove in Production**: Consider removing debug fields from production schema
2. **Limit Data**: Don't include sensitive data in debug output
3. **Structure Output**: Use consistent structure for debug info
4. **Performance**: Only build debug info when requested (check `includeDebug`)
5. **Return Complete Structure on Error**: Always return a valid structure matching the schema, even on error:

```javascript
catch (error) {
  console.error('Resolver error:', error);
  return {
    items: [],
    totalCount: 0,
    // Include ALL required fields with defaults
  };
}
```

## Getting Help

### Logs

Adobe API Mesh logs are available in:

- Adobe I/O Console
- Runtime logs (for custom resolvers)

### Support

- Adobe API Mesh documentation
- Adobe Support Portal
- GitHub Issues (for this project)

## Related Documentation

- [Resolver Patterns](../implementation/resolver-patterns.md)
- [Build System](../build-system/utility-injection.md)
- [API Differences](../architecture/api-differences.md)
