# Schema Organization Plan

## Problem
Currently, all GraphQL type definitions are stored as a single string in `mesh.json`'s `additionalTypeDefs` field, making them hard to read, maintain, and version control.

## Solution: Build Process with Separate Schema Files

Since API Mesh requires a JSON file with additionalTypeDefs as a string, we'll create a build process to compile separate GraphQL files into the required format.

### Directory Structure
```
commerce-mesh/
├── schemas/
│   ├── types.graphql         # Custom type definitions
│   └── extensions.graphql    # Extensions to existing types
├── build-mesh.js             # Build script
├── mesh.json                 # Generated (add to .gitignore)
└── mesh.config.json          # Source configuration
```

### Implementation Steps

#### 1. Create Schema Files

**schemas/types.graphql** - Custom type definitions:
- `ColorOption`
- `ProductOption`
- `OptionValue`
- `Category`
- `Specification`
- `ProductSearchResult`
- `ProductItem`
- `PageInfo`
- `ProductFilter` (input type)

**schemas/extensions.graphql** - Type extensions:
- Extensions to `Catalog_ComplexProductView`
- Extensions to `Catalog_SimpleProductView`
- Extensions to `Query`

#### 2. Build Script (`build-mesh.js`)

```javascript
const fs = require('fs');
const path = require('path');

// Read schema files
const typesSchema = fs.readFileSync('./schemas/types.graphql', 'utf8');
const extensionsSchema = fs.readFileSync('./schemas/extensions.graphql', 'utf8');

// Read base mesh configuration
const meshConfig = JSON.parse(fs.readFileSync('./mesh.config.json', 'utf8'));

// Combine schemas into a single string
const combinedSchema = `${typesSchema}\n${extensionsSchema}`
  .replace(/\n/g, ' ')  // Convert to single line
  .replace(/\s+/g, ' ') // Normalize whitespace
  .trim();

// Add to mesh configuration
meshConfig.meshConfig.additionalTypeDefs = combinedSchema;

// Write the final mesh.json
fs.writeFileSync('./mesh.json', JSON.stringify(meshConfig, null, 2));

console.log('✅ mesh.json generated successfully');
```

#### 3. Update package.json

Add build script:
```json
{
  "scripts": {
    "build:mesh": "node build-mesh.js",
    "deploy": "npm run build:mesh && aio api-mesh:create"
  }
}
```

#### 4. Update .gitignore

Add generated file:
```
mesh.json
```

### Benefits

1. **Readability**: Type definitions in proper `.graphql` files with syntax highlighting
2. **Maintainability**: Easier to find and modify specific types
3. **Version Control**: Better diffs for schema changes
4. **Separation of Concerns**: Types organized by purpose
5. **API Mesh Compliance**: Generated `mesh.json` remains fully compliant

### Migration Process

1. Extract current `additionalTypeDefs` from `mesh.json`
2. Split into logical schema files
3. Create `mesh.config.json` with all non-schema configuration
4. Test build process
5. Update deployment scripts

### Notes

- The build script runs before deployment
- Generated `mesh.json` should not be committed
- Schema files can be further split if needed (e.g., `schemas/products.graphql`, `schemas/search.graphql`)
- Consider adding schema validation in the build process