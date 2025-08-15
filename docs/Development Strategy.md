# Adobe API Mesh for Commerce

## Project Overview
Adobe API Mesh implementation for Commerce with enhanced product resolvers and custom GraphQL schema. This project provides a unified GraphQL API that combines data from Adobe Commerce, Catalog Service, and Live Search services.

### Project Relationship
This project serves as the **backend API layer** for the CitiSignal Next.js frontend application:
- **commerce-mesh** (this project): Provides the GraphQL API endpoint with enhanced Adobe Commerce data
- **citisignal-nextjs**: Consumes this API to render the e-commerce UI and handle user interactions
- **Deployed Endpoint**: `https://edge-sandbox-graph.adobe.io/api/d5818ebf-e560-45b3-9830-79183dbfaf27/graphql`

The mesh transforms raw Adobe service data into clean, business-friendly fields that the frontend can directly consume without additional processing.

## Architecture
- **API Mesh**: GraphQL gateway that federates multiple Adobe services
- **Custom Resolvers**: Enhanced field resolvers for product data transformation
- **Schema Extensions**: Custom fields added to native Catalog Service types

## Key Commands

### Development & Deployment
```bash
# Install dependencies
npm install

# Build mesh configuration (generates mesh.json from config)
npm run build

# Create new mesh deployment
npm run create

# Update existing mesh deployment
npm run update

# Update production mesh
npm run update:prod

# Check mesh status
npm run status

# Describe mesh configuration
npm run describe
```

### Adobe I/O App Commands
```bash
# Run local development server
aio app run

# Run with local serverless stack
aio app run --local

# Run tests
aio app test

# Run e2e tests
aio app test --e2e

# Deploy to Adobe I/O Runtime
aio app deploy

# Undeploy application
aio app undeploy

# Generate .env file
aio app use
```

## Project Structure
```
commerce-mesh/
├── docs/                 # Documentation files
│   ├── API Mesh Limitations.md
│   ├── How Custom Queries and Resolvers Work.md
│   ├── Enhanced Query Examples.md
│   └── Schema Organization Plan.md
├── schema/              # GraphQL schema definitions
│   └── schema.graphql   # Custom type definitions
├── queries/             # Sample GraphQL queries
│   ├── phone_products.graphql
│   └── phone_products_configurables.graphql
├── scripts/             # Build and deployment scripts
│   ├── build-mesh.js    # Builds mesh.json configuration
│   └── update-mesh.js   # Updates existing mesh deployment
├── mesh.config.js       # Main mesh configuration
├── mesh.json            # Generated mesh config (do not edit directly)
├── resolvers.js         # Custom GraphQL resolvers
├── env.example          # Environment variables template
└── package.json         # Project dependencies
```

## Environment Setup
1. Copy `env.example` to `.env`
2. Fill in required Adobe Commerce credentials:
   - `ADOBE_COMMERCE_GRAPHQL_ENDPOINT`
   - `ADOBE_SANDBOX_CATALOG_SERVICE_ENDPOINT`
   - `ADOBE_SANDBOX_CATALOG_API_KEY`
   - `ADOBE_PRODUCTION_CATALOG_API_KEY`
   - `ADOBE_COMMERCE_ENVIRONMENT_ID`
   - `ADOBE_COMMERCE_WEBSITE_CODE`
   - `ADOBE_COMMERCE_STORE_CODE`
   - `ADOBE_COMMERCE_STORE_VIEW_CODE`

## Data Sources
The mesh federates three main sources:
1. **CommerceGraphQL**: Core Adobe Commerce GraphQL API (prefixed with `Commerce_`)
2. **CatalogServiceSandbox**: Adobe Catalog Service API (prefixed with `Catalog_`)
3. **LiveSearchSandbox**: Adobe Live Search API (prefixed with `Search_`)

## Custom Enhancements

### Custom Query
- `products`: Simplified product search with enhanced filtering and field resolution

### Enhanced Fields (added to Catalog types)
- `manufacturer`: Clean manufacturer name without cs_ prefix
- `is_on_sale`: Boolean indicating if product is on sale
- `display_price`: Formatted price for display
- `discount_percentage`: Calculated discount percentage
- `specifications`: Product specifications array
- `memory_options`: Available memory configurations
- `color_options`: Available color options with hex values
- `image_url`: Primary product image URL
- `gallery_images`: Product gallery images
- `category`: Product category information

## Important Technical Notes

### API Mesh Limitations
- All resolver code must be self-contained in `resolvers.js`
- Cannot import external npm modules or helper files
- Must use inline helper functions
- Console.log not supported - use `context.logger` instead
- Built-in `fetch()` available for HTTP requests

### Resolver Architecture
1. **Query Resolvers**: Fetch data from source APIs using `context` object
2. **Field Resolvers**: Transform data for specific fields using `selectionSet`
3. **Type System**: GraphQL automatically applies field resolvers to native types

### Best Practices
- Always build mesh configuration before deployment (`npm run build`)
- Test queries locally before production deployment
- Use provided sample queries as templates
- Keep resolver logic simple and focused
- Document any new custom fields in schema

## Debugging
- Use VS Code debugger with `WebAndActions` configuration
- Check mesh status with `npm run status`
- View detailed configuration with `npm run describe`
- Access logs through Adobe I/O Runtime console

## References
- [Adobe API Mesh Documentation](https://developer.adobe.com/graphql-mesh-gateway/)
- [Adobe Commerce GraphQL](https://developer.adobe.com/commerce/webapi/graphql/)
- [Adobe App Builder Docs](https://developer.adobe.com/app-builder/docs/)