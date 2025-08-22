# Commerce Mesh Project

Adobe API Mesh configuration for CitiSignal e-commerce integration.

## 🔴 Required After Every Change

1. **[Code Review](../citisignal-nextjs/docs/code-review-checklist.md)** - Check simplicity, patterns, types
2. **[Update Docs](../citisignal-nextjs/docs/documentation-checklist.md)** - Keep documentation current

## Quick Reference

- **Deploy**: `npm run update` - Builds and deploys to staging (includes build step)
- **Build Only**: `npm run build` - Generates mesh.json without deploying
- **Test**: Use GraphQL playground or curl

## Architecture

### Services

1. **Catalog Service** - Product data, SEO-optimized
2. **Live Search** - AI search, dynamic facets
3. **Commerce GraphQL** - Cart, checkout, customer

### Dynamic Facet System

**Build-Time Injection Pattern**:

- `config/facet-mappings.json` - Defines URL mappings for SEO (e.g., `cs_manufacturer` → `manufacturer`)
- Build script injects mappings into resolvers at build time (avoids import limitations)
- Bidirectional mapping: URL keys ↔ Adobe attribute codes
- Frontend uses clean `key` field, mesh handles all mapping logic

### Custom Resolvers

**Key Patterns**:

- `Citisignal_*` prefix for all custom queries
- Intelligent service selection based on context
- Data normalization for consistent API
- Separate filter types for different contexts

**Resolver Types**:

_Page-Level Resolvers (SSR-optimized)_:

- `category-page.js` - Complete category page data in one query (uses `Citisignal_PageFilter`)
- `product-page.js` - Complete product listing page data in one query (uses `Citisignal_PageFilter`)
- Used by frontend "Single Query" mode for demonstration and SSR preparation

_Focused Resolvers (Single responsibility)_:

- `product-cards.js` - Hybrid Catalog/Live Search for product listings (uses `Citisignal_ProductFilter`)
- `product-facets.js` - Separate facets/filters query (uses `Citisignal_ProductFilter`)
- `search-suggestions.js` - Autocomplete
- `field-extensions.js` - Computed fields
- `category-navigation.js` - Category hierarchy from Commerce Core (filters active/menu items, sorts by position)
- `category-breadcrumbs.js` - Breadcrumb trails for categories (Home > Category path, no artificial "Shop" level)

**Filter Architecture**:

- `Citisignal_ProductFilter` - Used by standalone queries, includes category field
- `Citisignal_PageFilter` - Used by page-level resolvers, category comes from resolver parameter
- Clean separation prevents conflicting category values

**🔴 CRITICAL: Filter Schema Configuration**
When adding new custom queries, the filterSchema MUST be updated to expose them:

```json
"filterSchema": {
  "mode": "bare",
  "filters": [
    "Query.{Citisignal_*, Catalog_productSearch, Search_productSearch, Commerce_categoryList}",
    "!Mutation"  // Exclude all mutations for security
  ]
}
```

The `Citisignal_*` wildcard ensures all custom queries are exposed. Without this, queries will return null even if the resolver works correctly.

## Development Standards

### Resolver Architecture

**9-Section Pattern** (All resolvers follow this structure):

1. **File Header** - Purpose and service orchestration description
2. **Constants** - `DEFAULT_PAGE_SIZE = 24`, price limits
3. **Filter Conversion** - Convert frontend filters to service formats
4. **Attribute Extraction** - Clean and extract product attributes
5. **Price Utilities** - Price extraction and formatting
6. **Product Transformation** - Consistent product format
7. **Domain-Specific Functions** - Unique to each resolver (navigation, facets, etc.)
8. **Service Queries** - Abstracted service calls
9. **Main Resolver** - Orchestration with error handling

**Shared Utilities Template**:

- `shared-utilities-template.js` - Reference implementation of common functions
- Copy needed functions from template when creating/updating resolvers
- Maintains consistency despite necessary code duplication

### Resolver Guidelines

- **Normalize Data** - Consistent structure regardless of service
- **Handle Both Services** - Live Search uses `productView`, Catalog uses direct fields
- **Image URLs** - Always ensure HTTPS, handle relative paths
- **No External Utilities** - Helpers must be inline (Mesh limitation)
- **Build-Time Injection** - Use build script to inject shared code/config into resolvers
- **Large Files Acceptable** - Can't split resolvers due to mesh architecture requiring inline helpers
- **Return Safe Defaults** - Never return null/undefined on error for SSR resilience
- **Dynamic Facets** - Use JSON scalar type for `filter.facets` to support any Adobe attributes

### Service Selection Logic

```javascript
// Product cards resolver
if (args.phrase && args.phrase.trim() !== '') {
  return 'hybrid'; // Live Search + Catalog in parallel
}
return 'catalog'; // Direct Catalog query

// Facets resolver
return 'live_search'; // Always - Catalog has no facets support
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

1. **Catalog Service has NO facets support** - Always use Live Search for filters
2. **Sort field is `attribute` not `name`** - Returns empty results if wrong
3. **Catalog requires `phrase` parameter** - Even if empty string
4. **Use `page_size: 1` for facets** - Aggregations cover all results anyway
5. **Parallel queries for hybrid search** - 50% faster than sequential
6. **API Mesh limitations** - No external imports, all code must be inline
7. **Consistent field shapes** - All resolvers must return same shapes for same types
8. **Build-time injection works** - Inject config/utilities at build to avoid import limitations
9. **JSON scalar enables dynamic facets** - Business users can add filters without code changes
10. **SEO requires URL mapping** - Clean URLs (manufacturer) vs technical codes (cs_manufacturer)

## 🚨 Critical API Differences

**[→ See detailed API differences documentation](./docs/api-differences.md)**

Key gotchas:

- Sort field: `attribute` not `name`
- Category filter: `categoryPath` vs `categories`
- Catalog requires `phrase` even if empty
- Catalog has NO facets support

## Hybrid Search Implementation

**[→ See detailed hybrid search documentation](./docs/hybrid-search.md)**

When users search, we run Live Search + Catalog in parallel:

- Live Search for AI ranking (SKUs only)
- Catalog for complete product data
- Merge preserving Live Search order
- 50% faster than sequential

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

## Testing

```bash
# Test resolver directly
curl -X POST [endpoint] \
  -H "Content-Type: application/json" \
  -H "x-api-key: [key]" \
  -d '{"query": "{ Citisignal_productCards(...) { ... } }"}'
```
