# Development Workflow

## Building the Mesh

The mesh build process combines:
1. `mesh.config.js` - Configuration and sources
2. `/schema/*.graphql` - Type definitions
3. `/resolvers/*.js` - Custom resolvers

### Build Commands
```bash
npm run build        # Build mesh.json from config and schema
npm run build --force # Force rebuild even if no changes detected
```

The build script automatically:
- Combines all `.graphql` files from `/schema/`
- Generates `mesh.json` with embedded schema
- Validates the configuration

## Deploying the Mesh

### Deploy to Staging
```bash
npm run update
```

### Deploy to Production
```bash
npm run update --prod
```

The deployment script:
1. Builds the mesh if needed
2. Purges the mesh cache
3. Updates the mesh configuration
4. Polls for provisioning status
5. Reports success/failure

### Deploy Options
```bash
npm run update --force        # Force update even if no changes
npm run update --skip-cache   # Skip cache purge step
```

## Testing Changes

After deployment, test using:

### GraphQL Playground
Visit the mesh endpoint in a browser to use the GraphQL playground.

### Command Line
```bash
curl -X POST https://graph.adobe.io/api/[MESH_ID]/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: search_gql" \
  -H "Magento-Environment-Id: [ENV_ID]" \
  -H "Magento-Store-View-Code: default" \
  -d '{"query":"{ __schema { queryType { name } } }"}'
```

## Important Notes

- The mesh includes both schema and resolver code - both need deployment
- Changes to resolvers require redeployment (not just schema changes)
- Always test in staging before production deployment
- Cache purging is automatic but can take a few minutes to propagate