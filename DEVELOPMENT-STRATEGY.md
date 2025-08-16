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
- `product-cards.js` - Hybrid Catalog/Live Search for product listings
- `product-facets.js` - Separate facets/filters query (optimized with page_size: 1)
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
6. **Facets Performance Tip** - Use `page_size: 1` when fetching only facets. Aggregations are calculated across the entire result set regardless of page size, so minimal products = faster response
7. **Service Capabilities** - Catalog Service does NOT support facets/aggregations, only Live Search does
8. **Category Filtering** - Live Search uses `categories` attribute, Catalog uses `categoryPath`
9. **Sort Fields** - Catalog Service expects `sort: {name: "price"}` not `sort: {attribute: "price"}`
10. **Build Script** - Auto-glob schema files instead of hardcoding for maintainability

## Hybrid Search Implementation

### The Problem
- **Live Search** provides AI-powered relevance but lacks product attributes (memory, colors, manufacturer)
- **Catalog Service** has complete product data but basic text matching for search
- Sequential API calls cause sluggish search experience

### The Solution: Parallel Hybrid Approach

```javascript
// When user searches, run BOTH queries in parallel
const [liveSearchResult, catalogSearchResult] = await Promise.all([
  // Query 1: Get AI-powered ranking from Live Search
  context.LiveSearchSandbox.Query.Search_productSearch(...),
  // Query 2: Get full product details from Catalog
  context.CatalogServiceSandbox.Query.Catalog_productSearch(...)
]);

// Merge: Use Live Search order with Catalog data
const orderedSkus = extractSkusFromLiveSearch(liveSearchResult);
const productMap = buildProductMapFromCatalog(catalogSearchResult);
const results = mergeInLiveSearchOrder(orderedSkus, productMap);
```

### Service Selection Logic

**Product Cards** (`product-cards.js`):
```javascript
if (userIsSearching) {
  // Use hybrid approach: Live Search ranking + Catalog details
  return parallelHybridSearch();
} else {
  // Direct Catalog query for filters and initial loads
  return catalogQuery();
}
```

**Facets** (`product-facets.js` - separate resolver):
```javascript
if (userIsSearching) {
  // Live Search for AI-aware facets
  return liveSearchFacets();
} else {
  // Catalog Service for category facets
  return catalogFacets();
}
// Note: Always use page_size: 1 for facets - aggregations cover all results
```

### Performance Metrics
- **Parallel queries**: ~50% faster than sequential (200ms vs 400ms)
- **With debouncing**: 80% fewer API calls during typing
- **Result**: Responsive search with complete product data

### Important Notes
- Both services hit the same endpoint but with different GraphQL operations
- `Search_productSearch` uses Live Search schema (limited attributes)
- `Catalog_productSearch` uses Catalog schema (full product data)
- Frontend remains simple - just calls `Citisignal_productCards`

## Facets Implementation

### Architecture Decision
Facets are handled by a **separate resolver** (`product-facets.js`) following single responsibility principle:
- Product cards resolver focuses on products
- Facets resolver focuses on filter options
- Both can be optimized independently

### Key Discoveries
1. **Catalog Service has NO facets support** - Confirmed via API testing and documentation
2. **Live Search facets structure** - Uses `facets.buckets` not `aggregations.options`
3. **Always use Live Search for facets** - Since Catalog doesn't support them at all

### Frontend Integration
```javascript
// Separate hooks for separation of concerns
const { items, loading } = useProductCards({ ... });
const { facets, loading: facetsLoading } = useProductFacets({ ... });
```

### Performance Optimization
- Facets query uses `page_size: 1` since aggregations cover all results
- Products and facets load in parallel
- SWR caching with `keepPreviousData` prevents flicker

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