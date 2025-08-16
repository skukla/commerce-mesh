// Test what sort fields are available in Catalog Service
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MESH_ENDPOINT = 'https://edge-sandbox-graph.adobe.io/api/d5818ebf-e560-45b3-9830-79183dbfaf27/graphql';

// Test different sort field names
const sortFields = [
  'position',      // Category position
  'price',         // Price (we know this works)
  'name',          // Name (we know this works)
  'created_at',    // Date created
  'updated_at',    // Date updated
  'bestsellers',   // Popularity/bestsellers
  'relevance',     // Relevance score
  'new',           // New products
  'date',          // Generic date
  'popularity',    // Generic popularity
  'rating',        // Product rating
  'reviews_count', // Number of reviews
];

async function testSortField(fieldName) {
  const query = `
    query {
      Catalog_productSearch(
        phrase: ""
        filter: [{attribute: "categoryPath", in: ["phones"]}]
        sort: {attribute: "${fieldName}", direction: DESC}
        page_size: 2
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
  `;
  
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ADOBE_CATALOG_API_KEY,
    'Magento-Environment-Id': process.env.ADOBE_COMMERCE_ENVIRONMENT_ID,
    'Magento-Website-Code': process.env.ADOBE_COMMERCE_WEBSITE_CODE,
    'Magento-Store-Code': process.env.ADOBE_COMMERCE_STORE_CODE,
    'Magento-Store-View-Code': process.env.ADOBE_COMMERCE_STORE_VIEW_CODE,
  };

  try {
    const response = await fetch(MESH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.log(`\nError for ${fieldName}:`, result.errors[0].message);
      return { field: fieldName, status: '❌', error: result.errors[0].message };
    } else if (result.data?.Catalog_productSearch) {
      const count = result.data.Catalog_productSearch.total_count;
      return { field: fieldName, status: count > 0 ? '✅' : '⚠️', count };
    }
  } catch (error) {
    return { field: fieldName, status: '❌', error: error.message };
  }
}

async function testAllSortFields() {
  console.log('Testing Catalog Service sort fields...\n');
  console.log('Field           | Status | Results');
  console.log('----------------|--------|--------');
  
  for (const field of sortFields) {
    const result = await testSortField(field);
    const status = result.status;
    const info = result.error ? 'Error' : result.count ? `${result.count} items` : 'No results';
    console.log(`${field.padEnd(15)} | ${status}      | ${info}`);
  }
  
  console.log('\n✅ = Works with results');
  console.log('⚠️  = Works but no results');
  console.log('❌ = Field not supported');
}

testAllSortFields();