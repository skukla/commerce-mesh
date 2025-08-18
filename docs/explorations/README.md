# Adobe API Mesh Documentation

## Quick Links
- [Development Workflow](./development-workflow.md) - Building and deploying the mesh
- [Debugging Guide](./debugging.md) - How to debug resolvers without console.log
- [Schema Conventions](./schema-conventions.md) - Naming and structure guidelines
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Overview
This Adobe API Mesh integrates:
- Adobe Commerce Core GraphQL
- Adobe Live Search Service  
- Adobe Catalog Service

All custom types use the `Citisignal_` prefix to avoid conflicts.

## Project Structure
```
commerce-mesh/
├── schema/          # GraphQL type definitions
├── resolvers/       # Custom resolver implementations
├── scripts/         # Build and deployment scripts
├── docs/           # Documentation
└── mesh.config.js  # Main mesh configuration
```