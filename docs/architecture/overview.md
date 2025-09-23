# Architecture Overview

## Introduction

Commerce Mesh is an Adobe API Mesh implementation that provides a unified GraphQL API for e-commerce applications. It acts as an intelligent orchestration layer that combines multiple Adobe Commerce services (Live Search, Catalog Service, Commerce GraphQL) into a single, optimized API surface.

## Table of Contents

- [System Architecture](#system-architecture)
- [Core Services](#core-services)
- [Build System](#build-system)
- [Data Flow](#data-flow)
- [Key Design Decisions](#key-design-decisions)
- [Performance Optimizations](#performance-optimizations)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend Application                   │
│                  (Next.js / React / etc)                │
└────────────────────────┬────────────────────────────────┘
                         │ GraphQL Queries
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Commerce Mesh                         │
│                  (Adobe API Mesh)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Custom GraphQL Resolvers              │   │
│  │  • Product Cards  • Facets  • Navigation        │   │
│  │  • Category Pages • Search  • Suggestions       │   │
│  └─────────────────────────────────────────────────┘   │
└────────┬──────────────┬──────────────┬─────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Live Search  │ │   Catalog    │ │  Commerce    │
│   Service    │ │   Service    │ │   GraphQL    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Components

1. **Custom Resolvers**: Self-contained JavaScript functions that orchestrate service calls
2. **GraphQL Schema**: Type definitions for the unified API
3. **Build System**: Smart utility injection and configuration management
4. **Adobe Services**: Upstream data sources

## Core Services

### Live Search Service

**Purpose**: AI-powered search with relevance ranking

**Strengths**:

- Natural language understanding
- AI relevance ranking
- Facet aggregations with counts
- Search suggestions

**Limitations**:

- Incomplete product attributes
- Limited to search context

**Used For**:

- Search queries with user input
- Facet/filter options
- Search suggestions

### Catalog Service

**Purpose**: Fast, complete product catalog access

**Strengths**:

- Complete product attributes
- Complex product support (configurable)
- Fast category browsing
- Full attribute data

**Limitations**:

- Basic text matching only (no AI)
- No relevance scoring
- Limited personalization

**Used For**:

- Category browsing
- Product details
- Filter/facet queries for category browsing

### Commerce GraphQL

**Purpose**: Core commerce data and operations

**Strengths**:

- Category hierarchy
- CMS content
- Cart operations
- Customer data

**Used For**:

- Category navigation
- Breadcrumbs
- Store configuration

## Build System

### Utility Injection Architecture

The build system solves Adobe API Mesh's limitation of no external imports:

```
resolvers-src/           # Source files (clean, no duplication)
├── utils/              # Shared utilities (source of truth)
│   ├── price-utils.js
│   ├── filter-utils.js
│   └── product-transform.js
└── product-cards.js    # Resolver using utilities

     ↓ Build Process ↓

resolvers/              # Generated files (with injected code)
└── product-cards.js    # Self-contained with all dependencies
```

### Key Features

1. **Automatic Dependency Detection**: Scans code to find used functions
2. **Transitive Dependencies**: Includes functions used by injected functions
3. **Configuration Injection**: Injects JSON config at build time
4. **Zero Duplication**: ~2000 lines of code eliminated

### Build Process

```bash
npm run build   # Generates self-contained resolvers
npm run update  # Deploys to Adobe API Mesh
```

## Data Flow

### Hybrid Search Pattern

For search queries, we use a parallel hybrid approach:

```javascript
// Execute both queries in parallel
const [searchRanking, productDetails] = await Promise.all([
  liveSearchQuery(), // Get AI ranking (SKUs only)
  catalogQuery(), // Get full product details
]);

// Merge: Use Live Search order with Catalog data
return mergeInSearchOrder(searchRanking, productDetails);
```

### Service Selection Logic

```javascript
if (hasSearchPhrase) {
  // User is searching: Use hybrid approach
  return hybridSearch();
} else if (needsFacets) {
  // Need filter options: Must use Live Search
  return liveSearchWithFacets();
} else {
  // Simple browsing: Use Catalog Service
  return catalogBrowse();
}
```

## Key Design Decisions

### 1. Hybrid Search Strategy

**Decision**: Combine Live Search AI with Catalog Service data

**Rationale**:

- Live Search has superior relevance but incomplete data
- Catalog Service has complete data but poor search
- Parallel execution maintains performance

**Result**: Best of both worlds - AI search with complete product details

### 2. Utility Injection Pattern

**Decision**: Build-time code injection instead of runtime imports

**Rationale**:

- Adobe API Mesh doesn't support imports
- Manual copying leads to errors and inconsistency
- Need single source of truth for utilities

**Result**: Clean code with zero duplication

### 3. Unified Query Architecture

**Decision**: Single queries for entire pages (SSR optimization)

**Rationale**:

- Reduce client-server round trips
- Enable server-side rendering
- Improve initial page load performance

**Result**: Fast, SEO-friendly pages

### 4. Schema Namespacing

**Decision**: Prefix all custom types with `Citisignal_`

**Rationale**:

- Avoid conflicts with Adobe types
- Clear distinction between custom and native
- Easier debugging and maintenance

**Result**: Clean, conflict-free schema

## Performance Optimizations

### Parallel Query Execution

```javascript
// ✅ Optimal: Parallel execution (~200ms)
const [products, facets, navigation] = await Promise.all([
  fetchProducts(),
  fetchFacets(),
  fetchNavigation(),
]);

// ❌ Slow: Sequential execution (~600ms)
const products = await fetchProducts();
const facets = await fetchFacets();
const navigation = await fetchNavigation();
```

### Selective Field Fetching

```javascript
// Live Search: Only fetch SKUs for ranking
selectionSet: `{
  items {
    product { sku }
  }
}`;

// Catalog: Fetch full details
selectionSet: `{
  items {
    productView {
      sku name price images attributes
    }
  }
}`;
```

### Caching Strategy

- **Build-time**: Configuration and mappings injected
- **Request-level**: GraphQL caching headers
- **Client-side**: SWR or Apollo caching

### Error Resilience

All resolvers return safe defaults on error:

```javascript
catch (error) {
  console.error(`Error in resolver:`, error);
  // Return valid structure for SSR resilience
  return {
    items: [],
    totalCount: 0,
    page_info: { current_page: 1, page_size: 20, total_pages: 0 }
  };
}
```

## API Differences

### Critical Service Differences

| Feature                | Live Search                      | Catalog Service                |
| ---------------------- | -------------------------------- | ------------------------------ |
| **Sort Parameter**     | `sort: [{attribute, direction}]` | `sort: {attribute, direction}` |
| **Category Filter**    | `categories`                     | `categoryPath`                 |
| **Requires phrase**    | Optional                         | **Required** (can be empty)    |
| **Facets Support**     | ✅ Full                          | ❌ None                        |
| **AI Relevance**       | ✅ Yes                           | ❌ No                          |
| **Product Attributes** | ❌ Limited                       | ✅ Complete                    |

### Common Pitfalls

1. **Wrong sort field**: Use `attribute` not `name`
2. **Missing phrase**: Catalog Service requires it (even if empty)
3. **Category field**: Different names between services
4. **Facet fragments**: Must use inline fragments for bucket types

## Schema Conventions

### Naming Patterns

```graphql
# Types
type Citisignal_ProductCard      # Domain objects
type Citisignal_ProductCardResult # Response wrappers
input Citisignal_ProductFilter    # Input types

# Queries
Citisignal_productCards          # Resource + action
Citisignal_categoryNavigation
Citisignal_searchSuggestions

# Fields
current_page  # snake_case (Adobe convention)
_debug        # Meta fields with underscore
```

### Response Structure

```graphql
type Citisignal_ProductCardResult {
  items: [Citisignal_ProductCard] # Actual data
  totalCount: Int # Total available
  page_info: Citisignal_PageInfo # Pagination
  facets: [Citisignal_Facet] # Filters
  _debug: String # Debug info
}
```

## Development Workflow

### Adding New Features

1. **Define Schema**: Add types to `schema/*.graphql`
2. **Create Resolver**: Write in `resolvers-src/`
3. **Use Utilities**: Just call functions (injection handles rest)
4. **Build**: `npm run build`
5. **Test**: Use GraphQL playground
6. **Deploy**: `npm run update`

### Debugging

1. **Use `_debug` field**: Returns detailed execution info
2. **Check service responses**: Test upstream APIs directly
3. **Incremental deployment**: Add resolvers one at a time
4. **Monitor logs**: Adobe Developer Console

## Best Practices

### Resolver Development

- Follow the 9-section structure pattern
- Use utilities from modules (don't duplicate)
- Return safe defaults on error
- Include all required schema fields
- Test with minimal queries first

### Performance

- Use parallel queries where possible
- Fetch only needed fields
- Cache at appropriate levels
- Monitor query complexity

### Maintenance

- Update utilities in one place
- Keep resolver logic focused
- Document service differences
- Test thoroughly before deployment

## Conclusion

Commerce Mesh provides a sophisticated orchestration layer that combines the best features of multiple Adobe Commerce services. Through smart architectural decisions like hybrid search, utility injection, and parallel execution, it delivers a fast, maintainable, and feature-rich API for modern e-commerce applications.

## Related Documentation

- [Resolver Patterns](../implementation/resolver-patterns.md)
- [Utility Injection System](../build-system/utility-injection.md)
- [API Differences](api-differences.md)
- [Debugging Guide](../development/debugging-guide.md)
- [Schema Conventions](schema-conventions.md)
