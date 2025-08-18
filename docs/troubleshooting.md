# Troubleshooting

## Common Issues

### "Unknown type" Errors
**Error**: `Unknown type "Citisignal_FilterInput"`

**Cause**: Type is referenced but not defined

**Solution**:
1. Ensure the type is defined in a `.graphql` file in `/schema/`
2. Run `npm run build --force` to rebuild
3. Deploy the updated mesh

---

### "Cannot return null for non-nullable field"
**Error**: `Cannot return null for non-nullable field Citisignal_PageInfo.current_page`

**Cause**: Resolver returning null/undefined for required field

**Solution**:
1. Add fallback values in resolver:
```javascript
const currentPage = searchResult?.page_info?.current_page || 1;
const pageSize = searchResult?.page_info?.page_size || 20;
```
2. Ensure all code paths return valid values
3. Use the `_debug` field to identify where nulls come from

---

### Query Not Accessible
**Error**: Query works in playground but not from frontend

**Cause**: Filter schema not updated

**Solution**:
1. Update `filterSchema` in `mesh.config.js`:
```javascript
filterSchema: {
  mode: "bare",
  filters: [
    "Query.{Citisignal_*, ...}"
  ]
}
```
2. Rebuild and deploy

---

### Resolver Changes Not Working
**Error**: Code changes don't appear after deployment

**Cause**: Resolver code not redeployed or cached

**Solution**:
1. Force rebuild: `npm run build --force`
2. Force update: `npm run update --force`
3. Wait for provisioning to complete
4. Clear any CDN/browser caches

---

### Type Already Exists
**Error**: `Type "ProductCard" already exists`

**Cause**: Name conflict with Adobe types

**Solution**:
1. Always use `Citisignal_` prefix for custom types
2. Check for duplicate definitions across schema files

---

### Empty Results
**Error**: Query returns empty results when data exists

**Possible Causes**:
1. Wrong filter attributes
2. Incorrect resolver logic
3. Upstream service issues

**Debugging Steps**:
1. Add `_debug` field to query
2. Check filter values in debug output
3. Verify upstream service responses
4. Test upstream queries directly

---

## Debugging Workflow

### 1. Enable Debug Output
```graphql
query {
  Citisignal_productCards {
    _debug
  }
}
```

### 2. Check Debug Info
Look for:
- `receivedArgs` - What arguments the resolver got
- `searchResultExists` - Whether upstream data exists
- `calculated` - What values were computed

### 3. Test Upstream Services
Test Adobe services directly:
```bash
# Test Catalog Service
curl -X POST [CATALOG_ENDPOINT] ...

# Test Live Search
curl -X POST [SEARCH_ENDPOINT] ...
```

### 4. Check Mesh Status
```bash
npm run status
```

## Performance Issues

### Slow Queries
**Symptoms**: Queries take >2 seconds

**Solutions**:
1. Avoid nested queries where possible
2. Use parallel Promise.all() for multiple calls
3. Implement caching in resolvers
4. Reduce selection set size

### Timeout Errors
**Error**: Query timeout

**Solutions**:
1. Increase timeout in mesh config
2. Optimize resolver logic
3. Reduce data fetching in single query
4. Implement pagination

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

## Getting Help

### Logs
Adobe API Mesh logs are available in:
- Adobe I/O Console
- Runtime logs (for custom resolvers)

### Support
- Adobe API Mesh documentation
- Adobe Support Portal
- GitHub Issues (for this project)