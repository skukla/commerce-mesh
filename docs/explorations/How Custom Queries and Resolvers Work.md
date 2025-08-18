# How Custom Queries and Resolvers Work in Adobe API Mesh

This document explains how our custom `products` query works with field resolvers to provide enhanced, clean data from the Adobe Commerce Catalog Service.

## Table of Contents
- [Overview](#overview)
- [The Architecture](#the-architecture)
- [How It Works Step-by-Step](#how-it-works-step-by-step)
- [The Key Insight](#the-key-insight)
- [Code Walkthrough](#code-walkthrough)
- [Common Misconceptions](#common-misconceptions)

## Overview

Our API Mesh implementation uses two types of resolvers that work together:

1. **Query Resolver** (`products`) - Fetches data from the Catalog Service
2. **Field Resolvers** - Enhance individual fields on the native Catalog types

The magic is that these work **independently but cooperatively** through GraphQL's type system.

## The Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Frontend  │──────▶│   products   │──────▶│ Catalog Service │
│    Query    │       │   Resolver   │       │  (Native API)   │
└─────────────┘       └──────────────┘       └─────────────────┘
                              │
                              ▼
                      Returns Native Types
                   (Catalog_SimpleProductView)
                              │
                              ▼
                   ┌──────────────────────┐
                   │   Field Resolvers    │
                   │  • manufacturer      │
                   │  • is_on_sale        │
                   │  • display_price     │
                   └──────────────────────┘
                              │
                              ▼
                      Clean Data to Frontend
```

## How It Works Step-by-Step

### Step 1: Frontend Makes a Query

```graphql
query {
  products(filter: [{attribute: "categories", eq: "phones"}]) {
    items {
      product {
        name
        manufacturer    # Custom field!
        is_on_sale     # Custom field!
      }
    }
  }
}
```

### Step 2: Products Query Resolver Executes

The `products` resolver in `resolvers.js`:

```javascript
Query: {
  products: {
    resolve: async (root, args, context) => {
      // Programmatically call the Catalog Service
      const searchResult = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
        root: {},
        args: {
          filter: args.filter,
          page_size: args.limit,
          current_page: args.page
        },
        context,
        selectionSet: PRODUCT_SEARCH_QUERY  // What fields to fetch
      });

      // Minimal reshaping - mostly just renaming
      return {
        items: searchResult.items?.map(item => ({
          product: item.productView  // ← KEY LINE: Returns native Catalog type!
        })) || [],
        total: searchResult.total_count || 0,
        page_info: searchResult.page_info
      };
    }
  }
}
```

### Step 3: GraphQL Recognizes Native Types

The crucial part: `product: item.productView` returns a **native Catalog type** (`Catalog_SimpleProductView` or `Catalog_ComplexProductView`).

GraphQL's type system recognizes these types and knows there are field resolvers defined for them.

### Step 4: Field Resolvers Automatically Apply

When the frontend requests `manufacturer`, GraphQL:
1. Sees the field is on a `Catalog_SimpleProductView` type
2. Finds the corresponding field resolver
3. Executes it automatically

```javascript
Catalog_SimpleProductView: {
  manufacturer: {
    selectionSet: '{ attributes { name value } }',
    resolve: (root) => {
      // Clean up the cs_manufacturer attribute
      return extractManufacturer(root.attributes);
    }
  }
}
```

### Step 5: Frontend Receives Clean Data

```json
{
  "products": {
    "items": [{
      "product": {
        "name": "iPhone 15",
        "manufacturer": "Apple",     // No cs_ prefix!
        "is_on_sale": true           // Calculated boolean!
      }
    }]
  }
}
```

## The Key Insight

**The `products` query resolver doesn't call other resolvers!** Instead:

1. It fetches data from the Catalog Service
2. Returns it wrapped in a minimal new structure
3. **Preserves the native type identity**
4. GraphQL automatically applies field resolvers based on type

This is like a factory assembly line:
- The main factory (`products` resolver) gets raw materials
- Assembly line stations (field resolvers) automatically activate as products pass through
- Each station only processes if its specific field was requested

## Code Walkthrough

### Types Definition (mesh.json)

```graphql
# Custom wrapper types
type ProductSearchResult {
  items: [ProductItem]
  total: Int
  page_info: PageInfo
}

type ProductItem {
  product: Catalog_ProductView  # References native type!
}

# Custom query
extend type Query {
  products(...): ProductSearchResult
}

# Extend native types with custom fields
extend type Catalog_SimpleProductView {
  manufacturer: String
  is_on_sale: Boolean
  display_price: Float
  # ... more custom fields
}
```

### Query Resolver Pattern

```javascript
// CORRECT: Programmatic call using context
Query: {
  products: {
    resolve: async (root, args, context) => {
      const result = await context.CatalogServiceSandbox.Query.Catalog_productSearch({
        // ... args and selectionSet
      });
      return transformedResult;
    }
  }
}

// INCORRECT: selectionSet at resolver level (doesn't work!)
Query: {
  products: {
    selectionSet: `{ Catalog_productSearch(...) }`,  // ❌ Won't auto-execute!
    resolve: (root) => {
      // root.Catalog_productSearch would be undefined
    }
  }
}
```

### Field Resolver Pattern

```javascript
Catalog_SimpleProductView: {
  manufacturer: {
    selectionSet: '{ attributes { name value } }',  // Parent fields needed
    resolve: (root) => {
      // root contains the parent object with attributes
      return extractManufacturer(root.attributes);
    }
  }
}
```

## Common Misconceptions

### Misconception 1: "selectionSet auto-executes queries"
**Reality:** `selectionSet` in field resolvers only specifies which parent fields to fetch. It doesn't execute queries.

### Misconception 2: "The products resolver orchestrates field resolvers"
**Reality:** The products resolver just returns data. GraphQL's type system automatically applies field resolvers.

### Misconception 3: "We need to transform all data in the products resolver"
**Reality:** Minimal transformation is needed. Field resolvers handle the detailed cleaning.

## Benefits of This Architecture

1. **Separation of Concerns**
   - Query resolver: Handles fetching and structure
   - Field resolvers: Handle field-specific transformations

2. **Reusability**
   - Field resolvers work for ANY query returning those types
   - Not tied to the specific `products` query

3. **Performance**
   - Field resolvers only run for requested fields
   - No wasted computation

4. **Maintainability**
   - Logic for each field is isolated
   - Easy to add new enhanced fields

## Summary

The custom `products` query is a thin wrapper that:
1. Fetches data from the Catalog Service using `context`
2. Does minimal reshaping (mainly renaming)
3. Returns native Catalog types
4. Lets field resolvers automatically enhance the data

The real magic happens through GraphQL's type system, which automatically applies your field resolvers to the native types, giving you clean, enhanced data without complex orchestration.