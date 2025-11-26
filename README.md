# Commerce Mesh

Adobe API Mesh configuration for CitiSignal e-commerce integration. This project orchestrates multiple Adobe Commerce services (Catalog Service, Live Search, Commerce GraphQL) into a unified GraphQL API with enhanced product resolvers and dynamic facet support.

## Overview

This API Mesh provides:

- **Unified GraphQL endpoint** combining multiple Adobe Commerce services
- **Dynamic facet system** with SEO-friendly URL mapping
- **Enhanced product resolvers** with normalized data structures
- **Smart utility injection** - Eliminates code duplication across resolvers
- **Build-time injection pattern** to overcome API Mesh limitations
- **SSR-optimized queries** for complete page data in single requests
- **Clean resolver architecture** - Focus on orchestration, not implementation

## Prerequisites

- Adobe I/O CLI (`aio`) installed and configured
- Access to Adobe Commerce services (Catalog Service, Live Search, Commerce Core)
- Node.js 18+ and npm

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env with your credentials:
   # - API_KEY
   # - CATALOG_SERVICE_URL
   # - LIVE_SEARCH_URL
   # - COMMERCE_URL
   # - ENVIRONMENT_ID
   # - WEBSITE_CODE
   # - STORE_CODE
   # - STORE_VIEW_CODE
   # - CUSTOMER_GROUP
   ```

3. **Configure Adobe I/O CLI:**
   ```bash
   aio app use
   # Select your organization and project
   ```

## Development Workflow

### Build and Deploy

```bash
# Build mesh configuration (generates mesh.json)
npm run build

# Deploy to staging environment
npm run update

# Deploy to production environment
npm run update:prod

# Check mesh status
npm run status

# View mesh details
npm run describe
```

### Build Process

The build process (`npm run build`) performs several critical steps:

1. **Processes resolvers** with build-time injection pattern
2. **Injects facet mappings** from `config/facet-mappings.json`
3. **Adds utility functions** to each resolver
4. **Generates mesh.json** with processed resolver references
5. **Validates configuration** before deployment

## Architecture

### Directory Structure

```
commerce-mesh/
├── config/
│   └── facet-mappings.json    # SEO-friendly URL mappings
├── resolvers-src/              # Source resolver files
│   ├── category-page.js       # Unified category page data
│   ├── product-cards.js       # Product listing with filters
│   ├── product-facets.js      # Dynamic facets/filters
│   └── ...
├── resolvers/                  # Generated resolvers with injections
├── scripts/
│   ├── build-mesh.js          # Build script with injection logic
│   └── update-mesh.js         # Deployment script
├── schemas/
│   └── schema.graphql         # GraphQL schema extensions
└── mesh.json                  # Generated mesh configuration
```

### Services Integration

The mesh integrates three main Adobe Commerce services:

1. **Catalog Service** - Product data, attributes, pricing
2. **Live Search** - AI-powered search, dynamic facets, relevance
3. **Commerce Core GraphQL** - Categories, navigation, cart, checkout

### Resolvers

All custom resolvers follow the `Citisignal_*` naming convention.

#### Active Resolvers (start here)

Located in `resolvers-src/`:

- `Citisignal_productCards` - Product listings with pagination
- `Citisignal_productFacets` - Dynamic filter options
- `Citisignal_productSearchFilter` - Search with filters
- `Citisignal_categoryNavigation` - Navigation menus
- `Citisignal_categoryBreadcrumbs` - Breadcrumb trails
- Plus more...

#### Reference Implementations

Located in `resolvers-src/reference/`:

- `category-page.js` - Unified query pattern (read-only)

Reference implementations show advanced patterns but are not actively maintained.
See citisignal-nextjs/src/reference/unified-query/ for frontend example.

## Dynamic Facet System

The mesh implements a sophisticated facet system that:

1. **Accepts any Adobe Commerce attributes** dynamically via JSON scalar type
2. **Maps technical codes to SEO-friendly URLs** (e.g., `cs_manufacturer` → `manufacturer`)
3. **Provides bidirectional mapping** for clean URLs and API compatibility
4. **Supports custom and standard attributes** without schema changes

Configuration in `config/facet-mappings.json`:

```json
{
  "mappings": {
    "cs_manufacturer": "manufacturer",
    "cs_memory": "storage"
  },
  "defaults": {
    "removePrefix": ["cs_", "attr_"],
    "replaceUnderscore": true,
    "toLowerCase": true
  }
}
```

## Testing

### GraphQL Playground

After deployment, test queries using the GraphQL playground:

```bash
# Get the mesh URL
npm run describe

# Open the URL in browser and test queries
```

### Example Queries

```graphql
# Unified category page query
query GetCategoryPage {
  Citisignal_categoryPageData(
    categoryUrlKey: "phones"
    filter: { manufacturer: "Apple", memory: ["128GB", "256GB"] }
    sort: { attribute: PRICE, direction: ASC }
  ) {
    navigation { ... }
    products { ... }
    facets { ... }
    breadcrumbs { ... }
  }
}
```

## Troubleshooting

- **Build failures**: Check `console.log` output from build script
- **Deployment errors**: Run `npm run status` to check mesh health
- **Query errors**: Enable debug mode in resolvers (temporarily add logging)
- **Missing facets**: Verify facet mappings in config and rebuild

## Documentation

- [Build-Time Injection Pattern](docs/build-time-injection-pattern.md)
- [Implementing Facets](docs/implementing-facets.md)
- [Resolver Patterns](docs/resolver-patterns.md)
- [API Mesh Limitations](docs/explorations/API%20Mesh%20Limitations.md)
- [Debugging Guide](docs/debugging-api-mesh.md)

## Related Projects

- [CitiSignal Next.js Frontend](../citisignal-nextjs) - The frontend application consuming this mesh

## License

Private - All rights reserved
