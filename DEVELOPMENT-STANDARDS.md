# Commerce Mesh Project

Adobe API Mesh configuration for CitiSignal e-commerce integration.

## Quick Reference

- **Deploy**: `npm run update` - Builds and deploys to staging (includes build step)
- **Build Only**: `npm run build` - Generates mesh.json without deploying
- **Test**: Use GraphQL playground or curl

## Architecture

### Services
1. **Catalog Service** - Product data, SEO-optimized
2. **Live Search** - AI search, dynamic facets
3. **Commerce GraphQL** - Cart, checkout, customer

### Custom Resolvers

**Key Patterns**:
- `Citisignal_*` prefix for all custom queries
- Intelligent service selection based on context
- Data normalization for consistent API

**Main Resolvers**:
- `product-cards.js` - Hybrid Catalog/Live Search
- `search-suggestions.js` - Autocomplete
- `field-extensions.js` - Computed fields

## Development Standards

### Resolver Guidelines
- **Normalize Data** - Consistent structure regardless of service
- **Handle Both Services** - Live Search uses `productView`, Catalog uses direct fields
- **Image URLs** - Always ensure HTTPS, handle relative paths
- **No External Utilities** - Helpers must be inline (Mesh limitation)
- **Large Files Acceptable** - Can't split resolvers due to mesh architecture requiring inline helpers

### Service Selection Logic
```javascript
// Simple, clear logic
if (args.phrase) return 'live_search';     // User searching
if (args.facets) return 'live_search';     // Need facets
return 'catalog';                          // Initial load
```

### Data Consistency
- Live Search: Access via `item.productView.*`
- Catalog: Access via `item.productView.*` or `item.product.*`
- Always provide fallbacks for missing data

### Testing
```bash
# Test resolver directly
curl -X POST [endpoint] \
  -H "Content-Type: application/json" \
  -H "x-api-key: [key]" \
  -d '{"query": "{ Citisignal_productCards(...) { ... } }"}'
```

### Simplicity Guidelines
- **Clear Service Selection** - Simple if/else logic, no complex conditions
- **Extract Helper Functions** - Keep resolver logic clean, helpers do transformations
- **Consistent Naming** - Helper functions should clearly state their purpose
- **No Debug Code** - Remove all console.log statements before commit
- **Fail Gracefully** - Return empty results on error, don't crash
- **Avoid Deep Nesting** - Use early returns and extracted functions
- **Document Why, Not What** - Comments should explain business logic, not code

## Key Learnings

1. **productView is Critical** - Live Search's complete data lives here
2. **Images Vary** - Live Search may return relative paths, use `productView.images`
3. **Stock Status** - Show all products with badges, don't filter
4. **Facets on Demand** - Only request when user interacts
5. **Keep It Simple** - Clear service selection, no complex logic

## Deployment

Changes require deployment:
1. Make resolver or schema changes
2. `npm run update` - Builds and deploys to staging
3. Confirm with "y" when prompted
4. Wait for provisioning (~1-2 minutes)

Note: `npm run update` automatically runs the build step first, so there's no need to run `npm run build` separately.

## Environment Variables

Required in `.env`:
- `ADOBE_COMMERCE_GRAPHQL_ENDPOINT`
- `ADOBE_SANDBOX_CATALOG_SERVICE_ENDPOINT`
- `ADOBE_CATALOG_API_KEY`
- `ADOBE_COMMERCE_ENVIRONMENT_ID`
- Various store codes