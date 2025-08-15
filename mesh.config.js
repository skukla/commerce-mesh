// Load environment variables
require('dotenv').config();

module.exports = {
  meshConfig: {
    sources: [
      {
        name: "CommerceGraphQL",
        handler: {
          graphql: {
            endpoint: "{env.ADOBE_COMMERCE_GRAPHQL_ENDPOINT}",
            operationHeaders: {
              "Content-Type": "application/json",
              "Store": "{context.headers['store']}"
            }
          }
        },
        transforms: [
          {
            prefix: {
              value: "Commerce_",
              includeRootOperations: true
            }
          }
        ]
      },
      {
        name: "CatalogServiceSandbox",
        handler: {
          graphql: {
            endpoint: "{env.ADOBE_SANDBOX_CATALOG_SERVICE_ENDPOINT}",
            operationHeaders: {
              "Content-Type": "application/json",
              "Magento-Environment-Id": "{context.headers['magento-environment-id']}",
              "Magento-Website-Code": "{context.headers['magento-website-code']}",
              "Magento-Store-View-Code": "{context.headers['magento-store-view-code']}",
              "Magento-Store-Code": "{context.headers['magento-store-code']}",
              "Magento-Customer-Group": "{context.headers['magento-customer-group']}",
              "X-Api-Key": "{context.headers['x-api-key']}",
              "Authorization": "{context.headers['Authorization']}"
            },
            schemaHeaders: {
              "x-api-key": "{env.ADOBE_CATALOG_API_KEY}"
            }
          }
        },
        transforms: [
          {
            prefix: {
              value: "Catalog_",
              includeRootOperations: true
            }
          }
        ],
        responseConfig: {
          headers: ["X-Magento-Cache-Id"]
        }
      },
      {
        name: "LiveSearchSandbox",
        handler: {
          graphql: {
            endpoint: "{env.ADOBE_SANDBOX_CATALOG_SERVICE_ENDPOINT}",
            operationHeaders: {
              "Content-Type": "application/json",
              "Magento-Environment-Id": "{context.headers['magento-environment-id']}",
              "Magento-Website-Code": "{context.headers['magento-website-code']}",
              "Magento-Store-View-Code": "{context.headers['magento-store-view-code']}",
              "Magento-Store-Code": "{context.headers['magento-store-code']}",
              "Magento-Customer-Group": "{context.headers['magento-customer-group']}",
              "X-Api-Key": "search_gql"
            },
            schemaHeaders: {
              "x-api-key": "{env.ADOBE_CATALOG_API_KEY}",
              "Magento-Environment-Id": "{env.ADOBE_COMMERCE_ENVIRONMENT_ID}",
              "Magento-Website-Code": "{env.ADOBE_COMMERCE_WEBSITE_CODE}",
              "Magento-Store-View-Code": "{env.ADOBE_COMMERCE_STORE_VIEW_CODE}",
              "Magento-Store-Code": "{env.ADOBE_COMMERCE_STORE_CODE}",
              "X-Api-Key": "search_gql"
            }
          }
        },
        transforms: [
          {
            prefix: {
              value: "Search_",
              includeRootOperations: true
            }
          }
        ]
      }
    ],
    transforms: [
      {
        filterSchema: {
          mode: "wrap",
          filters: [
            "Query.{Citisignal_*, Catalog_productSearch}",
            "Type.!Mutation"
          ]
        }
      }
    ],
    // additionalTypeDefs will be added by build script
    additionalResolvers: [
      "./resolvers/product-queries.js",
      "./resolvers/field-extensions.js"
    ],
    responseConfig: {
      CORS: {
        credentials: true,
        exposedHeaders: ["Content-Range", "X-Content-Range", "X-Magento-Cache-Id"],
        maxAge: 60480,
        methods: ["GET", "POST"],
        origin: "*"
      }
    }
  }
};