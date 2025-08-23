# Development Workflow

## Building the Mesh

The mesh build process uses a build-time injection pattern to overcome API Mesh limitations:

1. **Source Files**:
   - `/resolvers-src/*.js` - Original resolver files
   - `/config/facet-mappings.json` - Configuration for facet mapping
   - `/schemas/schema.graphql` - GraphQL type definitions
   - `mesh.config.js` - Mesh configuration

2. **Build Process**:
   - Processes resolvers with injected configuration and utilities
   - Creates `/resolvers/` directory with enhanced resolvers
   - Generates `mesh.json` with references to generated resolvers

### Build Commands

```bash
npm run build        # Build mesh.json with processed resolvers
```

The build script (`scripts/build-mesh.js`) automatically:

- Loads facet mappings from `/config/`
- Injects configuration and helper functions into each resolver
- Creates generated versions in `/resolvers/`
- Generates `mesh.json` with correct resolver paths
- Validates the configuration

## Deploying the Mesh

### Deploy to Staging

```bash
npm run update       # Builds and deploys to staging
```

### Deploy to Production

```bash
npm run update:prod  # Builds and deploys to production
```

The deployment process:

1. Runs the build step automatically
2. Updates the mesh configuration via Adobe I/O CLI
3. Waits for provisioning to complete
4. Reports deployment status

Note: The `update` command includes the build step, so you don't need to run `npm run build` separately.

## Testing Changes

After deployment, test your changes using:

### GraphQL Playground

```bash
# Get the mesh endpoint
npm run describe

# The output will include the GraphQL endpoint URL
# Open this URL in a browser to access the GraphQL playground
```

### Command Line Testing

```bash
# Check mesh status
npm run status

# Test a query directly
curl -X POST [endpoint] \
  -H "Content-Type: application/json" \
  -H "x-api-key: [your-api-key]" \
  -d '{"query": "{ Citisignal_productCards(filter: { categoryUrlKey: \"phones\" }) { items { name } } }"}'
```

## Local Development

Since API Mesh runs in Adobe's cloud, there's no true local development. However, you can:

1. **Test resolver logic locally** (limited):
   - Extract resolver logic into testable functions
   - Use unit tests to validate transformations

2. **Use a staging mesh** for development:
   - Deploy frequently to staging
   - Test changes in the cloud environment

3. **Enable logging temporarily**:
   - Add `console.log` statements to resolvers
   - Deploy to staging
   - View logs via Adobe I/O CLI
   - **Remember to remove logs before production**

## Common Workflows

### Adding a New Resolver

1. Create the resolver in `/resolvers-src/`:

```javascript
// resolvers-src/my-new-resolver.js
module.exports = {
  resolvers: {
    Query: {
      Citisignal_myQuery: {
        resolve: async (root, args, context) => {
          // Resolver logic
        },
      },
    },
  },
};
```

2. Add the GraphQL schema in `/schemas/schema.graphql`:

```graphql
type Query {
  Citisignal_myQuery(param: String): MyResultType
}
```

3. Update `mesh.config.js` to include the resolver

4. Build and deploy:

```bash
npm run update
```

### Modifying Facet Mappings

1. Edit `/config/facet-mappings.json`:

```json
{
  "mappings": {
    "cs_new_attribute": "new-attribute"
  }
}
```

2. Rebuild and deploy:

```bash
npm run update
```

The build process will automatically inject the new mappings into all resolvers.

### Debugging Issues

1. **Check deployment status**:

```bash
npm run status
```

2. **View mesh configuration**:

```bash
npm run describe
```

3. **Test queries in playground**:
   - Use the GraphQL playground URL from `npm run describe`
   - Test queries incrementally
   - Check network tab for errors

4. **Review logs** (if logging is enabled):
   - Temporarily add console.log to resolvers
   - Deploy to staging
   - Check Adobe I/O logs

## Best Practices

1. **Always test in staging first**
2. **Remove debug code before production**
3. **Use the build-time injection pattern for shared code**
4. **Follow the standard resolver structure**
5. **Document new queries in schema comments**
6. **Keep resolver logic simple and focused**
7. **Handle errors gracefully with fallback values**

## Troubleshooting

See [Debugging Guide](./debugging-api-mesh.md) for detailed troubleshooting steps.
