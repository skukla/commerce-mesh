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

## Key Learnings & Best Practices

### Resolver Architecture Deep Dive

#### Two-Part Resolver Strategy
After extensive testing, we've established a clear separation of concerns:

1. **Field Extensions** (`resolvers/field-extensions.js`)
   - Purpose: Add computed fields to native Adobe Catalog Service types
   - Examples: `manufacturer`, `is_on_sale`, `discount_percentage`, `secure_image`
   - Key Learning: **Cannot override existing native fields** - attempting this causes 500 errors
   - Solution: Create new fields with different names (e.g., `secure_image` instead of modifying `image`)

2. **Custom Queries** (`resolvers/product-queries.js`)
   - Purpose: Create entirely new query endpoints with full control over response shape
   - Examples: `Citisignal_productCards` for optimized listing pages
   - Advantage: Can transform any data including native fields (like converting HTTP to HTTPS)
   - Use Case: When you need a different data structure than native queries provide

#### Critical Limitations Discovered

**Field Override Restriction**
```javascript
// ❌ THIS WILL CAUSE 500 ERROR
Catalog_SimpleProductView: {
  image: { // Trying to override native field
    resolve: (root) => transformImage(root.image)
  }
}

// ✅ THIS WORKS
Catalog_SimpleProductView: {
  secure_image: { // New field name
    resolve: (root) => transformImage(root.image)
  }
}
```

**Self-Contained Code Requirement**
- All helper functions must be duplicated in each resolver file
- Cannot use `require()` or `import` statements
- No access to npm packages
- Solution: Keep a library of helper functions to copy-paste

### Image URL Transformation Strategy

#### The Problem
Adobe Commerce returns HTTP URLs but production requires HTTPS

#### Solutions Implemented
1. **Custom Query Approach** (Recommended for new queries)
   ```javascript
   // In product-queries.js
   const image = product.images?.[0] ? {
     ...product.images[0],
     url: ensureHttpsUrl(product.images[0].url)
   } : null;
   ```

2. **Secure Field Approach** (For native queries)
   ```javascript
   // In field-extensions.js
   secure_image: {
     selectionSet: '{ images(roles: ["small_image"]) { url label } }',
     resolve: (root) => ({
       ...root.images[0],
       url: ensureHttpsUrl(root.images[0].url)
     })
   }
   ```

### Schema Organization

#### Current Structure (Improved)
```
schema/
├── queries.graphql      # Custom query definitions
└── extensions.graphql   # Type extensions for native types
```

#### Build Process
The `build-mesh.js` script:
1. Combines all `.graphql` files in schema directory
2. Removes comments for cleaner output
3. Generates `mesh.json` with combined schema
4. Tracks changes via MD5 hash

### Deployment Strategy

#### Build & Deploy Workflow
```bash
npm run build   # Generate mesh.json
npm run update  # Deploy to staging
npm run update:prod  # Deploy to production
```

#### Change Detection Issues & Solutions
- **Problem**: Hash-based detection sometimes misses changes
- **Solution 1**: Delete `.mesh-build-hash` and `.mesh-deploy-hash`
- **Solution 2**: Use `--force` flag: `npm run update -- --force`
- **Best Practice**: Always verify with `npm run status` after deployment

#### Deployment Time Considerations
- Mesh provisioning takes 2-3 minutes
- Changes may not be immediately visible
- Use `npm run status` to confirm provisioning complete
- Cache purging happens automatically during update

### Testing Strategy

#### Query Testing Workflow
1. Write query in `queries/` directory for testing
2. Test with GraphQL playground or Postman
3. Verify resolver changes with direct API calls
4. Check both custom queries and field extensions

#### Common Testing Pitfalls
- Cached responses hiding changes (wait 2-3 minutes or purge cache)
- Type mismatches between schema and resolvers
- Missing `selectionSet` in field resolvers

### Performance Optimizations

#### Resolver Best Practices
1. **Minimize Selection Sets**
   ```javascript
   // Only request fields you'll use
   selectionSet: '{ price { final { amount { value } } } }'
   ```

2. **Batch Operations**
   - Use array methods efficiently
   - Avoid multiple passes over data

3. **Early Returns**
   ```javascript
   if (!root.images || root.images.length === 0) return null;
   ```

### Error Handling

#### Debugging Techniques
1. **Use context.logger**
   ```javascript
   context.logger.info('Debug message', { data: root });
   ```

2. **Graceful Fallbacks**
   ```javascript
   return extractAttributeValue(root.attributes, 'manufacturer', 'Unknown');
   ```

3. **Type Checking**
   ```javascript
   if (!url || typeof url !== 'string') return url;
   ```

### Maintenance Guidelines

#### Adding New Fields
1. Add field definition to `schema/extensions.graphql`
2. Implement resolver in appropriate file
3. Test with sample query
4. Update documentation
5. Deploy with `npm run update`

#### Modifying Existing Resolvers
1. Make changes in resolver file
2. Delete hash files if changes aren't detected
3. Force rebuild: `npm run build -- --force`
4. Deploy and verify

### Common Gotchas & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Changes not deploying | Old data after update | Delete `.mesh-*-hash` files, use `--force` |
| 500 errors | "Internal Server Error" | Check for native field override attempts |
| Missing custom fields | Fields return null | Verify `selectionSet` includes required data |
| Deployment timeout | Provisioning hangs | Check Adobe I/O console for errors |
| Type mismatch | GraphQL validation errors | Ensure schema matches resolver return types |

### Future Improvements

#### Recommended Enhancements
1. **Automated Testing**: Add test suite for resolvers
2. **Type Generation**: Generate TypeScript types from schema
3. **Monitoring**: Add performance metrics to resolvers
4. **Documentation**: Auto-generate API documentation from schema
5. **Version Control**: Implement mesh versioning strategy

#### Architecture Considerations
- Consider splitting resolvers into more files as they grow
- Evaluate caching strategy for computed fields
- Plan for multi-environment deployment (dev/stage/prod)
- Implement blue-green deployment for zero-downtime updates