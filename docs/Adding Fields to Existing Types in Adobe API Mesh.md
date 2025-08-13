<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Adding Fields to Existing Types in Adobe API Mesh

**Yes, you can add fields to existing types** in Adobe's API Mesh using the `additionalTypeDefs` and `additionalResolvers` configuration options. Here's how to do it:

## Basic Approach: `additionalTypeDefs` + `additionalResolvers`

### 1. **Extend Existing Types with `additionalTypeDefs`**

You can extend any existing type in your unified schema by using the GraphQL `extend type` syntax:[^1]

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "Commerce",
        "handler": {
          "graphql": {
            "endpoint": "https://your-commerce-site/graphql"
          }
        }
      }
    ],
    "additionalTypeDefs": "extend type Product { customField: String loyaltyPoints: Int reviews: [Review] }",
    "additionalResolvers": ["./custom-resolvers.js"]
  }
}
```


### 2. **Implement Custom Resolvers**

Create a JavaScript file to handle the new field logic:

**custom-resolvers.js:**

```javascript
module.exports = {
  resolvers: {
    Product: {
      customField: {
        selectionSet: '{ sku name }',
        resolve: (root, args, context, info) => {
          // Custom business logic
          return `Custom data for ${root.name}`;
        }
      },
      loyaltyPoints: {
        selectionSet: '{ price { regularPrice { amount { value } } } }',
        resolve: (root, args, context, info) => {
          // Calculate loyalty points based on price
          const price = root.price?.regularPrice?.amount?.value || 0;
          return Math.floor(price * 0.1); // 10% as points
        }
      },
      reviews: {
        selectionSet: '{ sku }',
        resolve: async (root, args, context, info) => {
          // Fetch from external API
          const response = await fetch(`https://reviews-api.com/products/${root.sku}`);
          return response.json();
        }
      }
    }
  }
};
```


## Advanced Example: Cross-Source Data Integration

### **Adding Fields from Different Sources**:

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "Commerce",
        "handler": {
          "graphql": {
            "endpoint": "https://your-commerce-site/graphql"
          }
        }
      },
      {
        "name": "ReviewsAPI",
        "handler": {
          "openapi": {
            "source": "https://reviews-api.com/openapi.json"
          }
        }
      }
    ],
    "additionalTypeDefs": "extend type Product { externalReviews: [ExternalReview] averageRating: Float }",
    "additionalResolvers": ["./cross-source-resolvers.js"]
  }
}
```

**cross-source-resolvers.js:**

```javascript
module.exports = {
  resolvers: {
    Product: {
      externalReviews: {
        selectionSet: '{ sku }',
        resolve: (root, args, context, info) => {
          // Call the Reviews API source
          return context.ReviewsAPI.Query.getReviewsBySku({
            root,
            args: { sku: root.sku },
            context,
            info
          });
        }
      },
      averageRating: {
        selectionSet: '{ sku }',
        resolve: async (root, args, context, info) => {
          const reviews = await context.ReviewsAPI.Query.getReviewsBySku({
            root,
            args: { sku: root.sku },
            context,
            info
          });
          const total = reviews.reduce((sum, review) => sum + review.rating, 0);
          return reviews.length > 0 ? total / reviews.length : 0;
        }
      }
    }
  }
};
```


## Alternative: Declarative Resolvers

For **simpler field mapping without JavaScript**, use declarative resolvers:

```json
{
  "meshConfig": {
    "sources": [
      {
        "name": "Commerce", 
        "handler": { "graphql": { "endpoint": "..." } }
      },
      {
        "name": "InventoryAPI",
        "handler": { "openapi": { "source": "..." } }
      }
    ],
    "additionalTypeDefs": "extend type Product { stockLevel: Int }",
    "additionalResolvers": [
      {
        "targetTypeName": "Product",
        "targetFieldName": "stockLevel", 
        "sourceName": "InventoryAPI",
        "sourceTypeName": "Query",
        "sourceFieldName": "getInventory",
        "sourceArgs": {
          "productSku": "{root.sku}"
        },
        "result": "quantity"
      }
    ]
  }
}
```


## Key Configuration Options

### **Required Fields**:

- **`additionalTypeDefs`**: GraphQL schema extensions using `extend type` syntax
- **`additionalResolvers`**: Path to JavaScript file or array of resolver configurations


### **Resolver Configuration**:[^2]

- **`selectionSet`**: Fields to fetch from the original type
- **`resolve`**: Custom resolver function with access to `root`, `args`, `context`, `info`
- **Target/Source mapping**: For declarative resolvers connecting different sources


## Real-World Use Cases

### **1. Commerce Enhancement**:[^3]

```javascript
// Add localized labels to categories
extend type CategoryTree {
  localizedLabel: String
}

// Resolver fetches from translation service
resolve: (root, args, context) => {
  const locale = context.request.headers['accept-language'];
  return getTranslation(root.name, locale);
}
```


### **2. Inventory Integration**:

```javascript  
// Add real-time stock data
extend type Product {
  realTimeStock: StockInfo
}

// Resolver calls inventory microservice
resolve: (root) => {
  return inventoryService.getStock(root.sku);
}
```


### **3. Personalization**:

```javascript
// Add user-specific data
extend type Product {
  userRecommendations: [Product]
  inWishlist: Boolean
}
```

**Best Practices**: Use `additionalTypeDefs` and `additionalResolvers` for extending existing types with custom business logic, cross-source data integration, and personalization features while maintaining type safety and performance optimization through proper `selectionSet` usage.

<div style="text-align: center">⁂</div>

[^1]: https://developer.adobe.com/graphql-mesh-gateway/mesh/advanced/extend/

[^2]: https://developer.adobe.com/graphql-mesh-gateway/mesh/advanced/extend/resolvers/

[^3]: https://www.youtube.com/watch?v=t89yHW_La4g

[^4]: https://graphql.wtf/episodes/46-graphql-mesh-extended-types

[^5]: https://developer.adobe.com/graphql-mesh-gateway/mesh/basic/create-mesh/

[^6]: https://experienceleague.adobe.com/en/docs/experience-platform/xdm/tutorials/specific-fields-api

[^7]: https://stackoverflow.com/questions/48917863/how-do-you-extend-types-in-graphql

[^8]: https://www.youtube.com/watch?v=AbBt8vNcdkk

[^9]: https://the-guild.dev/graphql/mesh/docs/transforms/extend

[^10]: https://developer.adobe.com/commerce/extensibility/app-development/examples/

[^11]: https://the-guild.dev/graphql/mesh/docs/guides/extending-unified-schema

[^12]: https://experienceleague.adobe.com/en/docs/commerce-learn/tutorials/api-mesh/getting-started-api-mesh

[^13]: https://developer.adobe.com/graphql-mesh-gateway/mesh/basic/transforms/replace-field/

[^14]: https://www.youtube.com/watch?v=EmRq352n9Jk

[^15]: https://developer.adobe.com/graphql-mesh-gateway/mesh/basic/transforms/type-merging/

[^16]: https://hygraph.com/blog/graphql-mesh-vs-apollo-federation-vs-content-federation

[^17]: https://developer.adobe.com/graphql-mesh-gateway/mesh/resources/

[^18]: https://developer.ibm.com/articles/awb-data-modeling-graphql-extending-combining-types/

[^19]: https://developer.adobe.com/graphql-mesh-gateway/mesh/basic/handlers/json-schema/

[^20]: https://github.com/ardatan/graphql-mesh/discussions/2863

