// Test script to debug Catalog Service sorting
// Run with: node test-catalog-sort.js

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MESH_ENDPOINT = 'https://edge-sandbox-graph.adobe.io/api/d5818ebf-e560-45b3-9830-79183dbfaf27/graphql';

// Test different sort options directly against Catalog Service
const testQueries = [
  {
    name: 'No sort',
    query: `
      query {
        Catalog_productSearch(
          filter: [{attribute: "categoryPath", in: ["phones"]}]
          page_size: 5
        ) {
          total_count
          items {
            productView {
              name
              sku
            }
          }
        }
      }
    `
  },
  {
    name: 'Sort by price',
    query: `
      query {
        Catalog_productSearch(
          filter: [{attribute: "categoryPath", in: ["phones"]}]
          sort: {name: "price", direction: "ASC"}
          page_size: 5
        ) {
          total_count
          items {
            productView {
              name
              sku
            }
          }
        }
      }
    `
  },
  {
    name: 'Sort by name',
    query: `
      query {
        Catalog_productSearch(
          filter: [{attribute: "categoryPath", in: ["phones"]}]
          sort: {name: "name", direction: "ASC"}
          page_size: 5
        ) {
          total_count
          items {
            productView {
              name
              sku
            }
          }
        }
      }
    `
  },
  {
    name: 'Sort by position (default category sort)',
    query: `
      query {
        Catalog_productSearch(
          filter: [{attribute: "categoryPath", in: ["phones"]}]
          sort: {name: "position", direction: "ASC"}
          page_size: 5
        ) {
          total_count
          items {
            productView {
              name
              sku
            }
          }
        }
      }
    `
  }
];

async function testSort() {
  console.log('Testing Catalog Service sorting...\n');
  
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ADOBE_CATALOG_API_KEY,
    'Magento-Environment-Id': process.env.ADOBE_COMMERCE_ENVIRONMENT_ID,
    'Magento-Website-Code': process.env.ADOBE_COMMERCE_WEBSITE_CODE,
    'Magento-Store-Code': process.env.ADOBE_COMMERCE_STORE_CODE,
    'Magento-Store-View-Code': process.env.ADOBE_COMMERCE_STORE_VIEW_CODE,
  };

  for (const test of testQueries) {
    console.log(`Testing: ${test.name}`);
    console.log('Query:', test.query);
    
    try {
      const response = await fetch(MESH_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: test.query })
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.log('❌ Errors:', result.errors);
      } else if (result.data?.Catalog_productSearch) {
        const data = result.data.Catalog_productSearch;
        console.log(`✅ Results: ${data.total_count} products`);
        if (data.items?.length > 0) {
          console.log('First product:', data.items[0].productView?.name);
        }
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('---\n');
  }
}

testSort();