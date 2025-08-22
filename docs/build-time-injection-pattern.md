# Build-Time Injection Pattern

## Problem

Adobe API Mesh has a critical limitation: resolvers cannot import external files or utilities. This forces code duplication and makes configuration management difficult.

## Solution

Use a build script to inject configuration and utilities into resolvers at build time, creating processed versions with all necessary code inline.

## Implementation

### 1. Configuration Structure

```
config/
  facet-mappings.json    # Configuration to inject
scripts/
  build-mesh.js          # Build script with injection logic
resolvers-src/
  product-facets.js      # Original resolver files
resolvers/
  product-facets.js      # Generated with injected code
```

### 2. Build Script Pattern

```javascript
// scripts/build-mesh.js
function processResolversWithMappings() {
  const resolversDir = path.join(__dirname, '..', 'resolvers-src');
  const processedDir = path.join(__dirname, '..', 'resolvers');

  // Load configuration
  const config = JSON.parse(fs.readFileSync('config/facet-mappings.json'));

  // Process each resolver
  resolverFiles.forEach((file) => {
    let content = fs.readFileSync(originalPath, 'utf8');

    // Inject configuration and helpers at the beginning
    const injection = `
// ============================================================================
// INJECTED CODE - Added during build
// ============================================================================
const CONFIG = ${JSON.stringify(config, null, 2)};

const helperFunction = () => {
  // Helper implementation
};

// ============================================================================
// ORIGINAL RESOLVER CODE BELOW
// ============================================================================
`;

    fs.writeFileSync(processedPath, injection + content);
  });
}
```

### 3. Mesh Configuration Update

```javascript
// mesh.json uses processed resolvers
{
  "additionalResolvers": [
    "./resolvers/product-facets.js",  // Use generated version
    "./resolvers/product-cards.js"
  ]
}
```

### 4. Git Configuration

```
# .gitignore
resolvers/  # Don't commit generated files
```

## Use Cases

### 1. Configuration Injection

- Environment-specific settings
- Feature flags
- Mapping tables (like facet mappings)
- API endpoints

### 2. Utility Function Injection

- Shared helper functions
- Data transformation utilities
- Validation functions
- Common patterns

### 3. Type Definitions

- TypeScript interfaces (as comments)
- JSDoc type definitions
- Schema documentation

## Example: Facet Mapping System

### Configuration File

```json
// config/facet-mappings.json
{
  "mappings": {
    "cs_manufacturer": "manufacturer",
    "cs_memory": "storage"
  },
  "defaults": {
    "removePrefix": ["cs_", "attr_"],
    "replaceUnderscore": true
  }
}
```

### Injected Result

```javascript
// resolvers/product-facets.js
const FACET_MAPPINGS = {
  mappings: {
    cs_manufacturer: 'manufacturer',
    cs_memory: 'storage',
  },
};

const attributeCodeToUrlKey = (attributeCode) => {
  if (FACET_MAPPINGS.mappings[attributeCode]) {
    return FACET_MAPPINGS.mappings[attributeCode];
  }
  // Apply default transformations...
};

// Original resolver code follows...
```

## Benefits

1. **No Code Duplication** - Shared code injected where needed
2. **Configuration Management** - Central config files, not hard-coded
3. **Type Safety** - Can inject TypeScript types as comments
4. **Build-Time Optimization** - No runtime overhead
5. **Clean Source Files** - Original resolvers stay focused
6. **Version Control** - Only source files committed, not generated

## Limitations

1. **Build Step Required** - Must run build before deploy
2. **Debugging Complexity** - Errors reference generated files
3. **No Runtime Updates** - Changes require rebuild
4. **File Size** - Injected code increases resolver size

## Best Practices

1. **Clear Separation** - Mark injected vs original code clearly
2. **Idempotent Builds** - Same input = same output
3. **Source Maps** - Consider generating for debugging
4. **Documentation** - Document what gets injected and why
5. **Validation** - Validate configuration before injection
6. **Error Handling** - Graceful fallbacks if config missing

## Alternatives Considered

### Why Not...

**Runtime Config Loading?**

- API Mesh doesn't support file reads at runtime
- Would require external API calls (latency)

**Environment Variables?**

- Limited to simple key-value pairs
- No complex data structures
- Still requires code to handle

**Webhook for Config?**

- Additional complexity and latency
- External dependency
- Authentication overhead

## Conclusion

Build-time injection is currently the best pattern for sharing code and configuration across API Mesh resolvers. While not ideal, it provides a workable solution to API Mesh's import limitations while maintaining code quality and avoiding duplication.
