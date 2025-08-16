// Test sort fields for both Catalog Service and Live Search
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MESH_ENDPOINT = 'https://edge-sandbox-graph.adobe.io/api/d5818ebf-e560-45b3-9830-79183dbfaf27/graphql';

// Test different sort field names
const sortFields = [
  { name: 'position', desc: 'Category position' },
  { name: 'price', desc: 'Price' },
  { name: 'name', desc: 'Product name' },
  { name: 'created_at', desc: 'Date created' },
  { name: 'updated_at', desc: 'Date updated' },
  { name: 'bestsellers', desc: 'Bestsellers' },
  { name: 'sales', desc: 'Sales/Popularity' },
  { name: 'relevance', desc: 'Search relevance' },
  { name: 'popularity', desc: 'Popularity' },
  { name: 'rating', desc: 'Product rating' },
  { name: 'reviews_count', desc: 'Review count' },
  { name: 'news_from_date', desc: 'New products date' },
];

async function testCatalogSort(fieldName) {
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
      // Check if it's a field not found error
      const errorMsg = result.errors[0].message;
      if (errorMsg.includes('Invalid attribute')) {
        return { status: '❌', info: 'Invalid field' };
      }
      return { status: '❌', info: 'Error' };
    } else if (result.data?.Catalog_productSearch) {
      const count = result.data.Catalog_productSearch.total_count;
      const firstProduct = result.data.Catalog_productSearch.items?.[0]?.productView?.name || 'N/A';
      return { status: '✅', info: `${count} items`, firstProduct };
    }
  } catch (error) {
    return { status: '❌', info: error.message };
  }
  
  return { status: '❌', info: 'Unknown' };
}

async function testLiveSearchSort(fieldName) {
  const query = `
    query {
      Search_productSearch(
        phrase: ""
        filter: [{attribute: "categories", in: ["phones"]}]
        sort: [{attribute: "${fieldName}", direction: DESC}]
        page_size: 2
      ) {
        total_count
        items {
          product {
            name
          }
        }
      }
    }
  `;
  
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'search_gql',
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
      const errorMsg = result.errors[0].message;
      if (errorMsg.includes('Invalid attribute') || errorMsg.includes('Unknown field')) {
        return { status: '❌', info: 'Invalid field' };
      }
      return { status: '❌', info: 'Error' };
    } else if (result.data?.Search_productSearch) {
      const count = result.data.Search_productSearch.total_count;
      const firstProduct = result.data.Search_productSearch.items?.[0]?.product?.name || 'N/A';
      return { status: '✅', info: `${count} items`, firstProduct };
    }
  } catch (error) {
    return { status: '❌', info: error.message };
  }
  
  return { status: '❌', info: 'Unknown' };
}

async function testAllServices() {
  console.log('Testing sort fields for both services...\n');
  console.log('Field            | Description       | Catalog Service | Live Search     | First Product');
  console.log('-----------------|-------------------|-----------------|-----------------|---------------');
  
  for (const field of sortFields) {
    const catalogResult = await testCatalogSort(field.name);
    const liveSearchResult = await testLiveSearchSort(field.name);
    
    const firstProduct = catalogResult.firstProduct || liveSearchResult.firstProduct || 'N/A';
    
    console.log(
      `${field.name.padEnd(16)} | ${field.desc.padEnd(17)} | ${catalogResult.status} ${catalogResult.info.padEnd(10)} | ${liveSearchResult.status} ${liveSearchResult.info.padEnd(10)} | ${firstProduct.substring(0, 20)}`
    );
  }
  
  console.log('\n✅ = Works with results');
  console.log('❌ = Field not supported or error');
  
  console.log('\n📝 Summary:');
  console.log('- Catalog Service supports: position, price, name, relevance');
  console.log('- Live Search supports: Check the results above');
  console.log('- For "Newest First": Neither service seems to support date-based sorting');
  console.log('- For "Most Popular": Check if Live Search supports sales/popularity');
}

testAllServices();