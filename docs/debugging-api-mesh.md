# Debugging Adobe API Mesh Resolvers

## Key Learnings from Resolver Debugging Session

### 1. Systematic Debugging Approach

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

### 2. Common Resolver Issues and Fixes

#### Schema Mismatches

**Problem**: Resolver returns fields that don't match the GraphQL schema
**Example**: Returning `{ navigation: [] }` when schema expects `{ items: [], headerNav: [], footerNav: [] }`
**Solution**: Always check the schema definition and ensure resolver returns exact structure

#### Field Name Mapping

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

#### Missing Required Fields

**Problem**: Schema defines non-nullable fields that resolver doesn't provide
**Example**: `Citisignal_ProductSuggestion.id` is required but not returned
**Solution**: Ensure all required fields are included, even if generating defaults:

```javascript
const id = productView.id || product.id || sku || name; // Fallback chain
```

#### Context Path Errors

**Problem**: Incorrect paths to query upstream services
**Correct Pattern**:

```javascript
context.LiveSearchSandbox.Query.Search_productSearch();
context.CatalogServiceSandbox.Query.Catalog_productSearch();
context.CommerceGraphQL.Query.Commerce_categoryList();
```

### 3. Resolver Best Practices

#### Return Complete Structure on Error

Always return a valid structure matching the schema, even on error:

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

#### Use Helper Functions for Consistency

Extract common transformations to ensure consistency across resolvers:

- `attributeCodeToUrlKey()` - Convert technical codes to SEO-friendly URLs
- `formatPrice()` - Consistent price formatting
- `ensureHttps()` - Security for URLs
- `extractVariantOptions()` - Dynamic option extraction

#### Dynamic Field Extraction

For flexible schemas, use dynamic extraction:

```javascript
options.forEach((option) => {
  if (option.id?.startsWith('cs_')) {
    const cleanName = attributeCodeToUrlKey(option.id);
    // Handle dynamically
  }
});
```

### 4. Testing Strategy

#### Test Individual Resolvers

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

#### Check Mesh Status

```bash
aio api-mesh:status
aio api-mesh:describe  # Gets endpoint URL
aio api-mesh:get       # Shows full configuration
```

### 5. Deployment Notes

#### Build and Deploy Commands

```bash
npm run build   # Generates mesh.json from mesh.config.js
npm run update  # Deploys mesh to Adobe
```

#### Force Rebuild When Needed

```bash
npm run build -- --force   # Force rebuild even if no changes detected
npm run update -- --force  # Force deployment
```

### 6. Common Error Patterns

| Error                                     | Likely Cause                         | Solution                                       |
| ----------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| 500 Internal Server Error                 | Resolver runtime error               | Check resolver return structure matches schema |
| Cannot return null for non-nullable field | Missing required field               | Ensure all required fields are returned        |
| Gateway timeout (504)                     | Complex query or Adobe service issue | Retry, simplify query, or check Adobe status   |
| 301 Redirect                              | Wrong mesh endpoint                  | Use edge-sandbox-graph.adobe.io for sandbox    |

### 7. Schema-Resolver Alignment Checklist

Before deploying a resolver:

- [ ] Check the GraphQL schema for the exact type definition
- [ ] Verify all required (!) fields are included
- [ ] Match field names exactly (key vs attribute, options vs buckets)
- [ ] Test with minimal query first
- [ ] Add error handling that returns valid structure
- [ ] Use consistent transformation functions across resolvers

### 8. Debugging Tools

1. **Check resolver syntax**: `node -c resolvers/resolver-name.js`
2. **View mesh logs**: Available in Adobe Developer Console
3. **Test queries**: Use GraphQL playground or curl commands
4. **Incremental testing**: Add resolvers one by one
5. **Schema validation**: Compare resolver output with schema types

This systematic approach helped identify and fix issues with all 7 custom resolvers in the API Mesh configuration.
