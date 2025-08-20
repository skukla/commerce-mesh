# API Mesh Resolver Patterns

## Standard Resolver Structure

All resolvers follow this consistent pattern for maintainability and debugging:

```javascript
/**
 * RESOLVER NAME - PURPOSE
 * 
 * What Adobe gives us: [Complex structure description]
 * What we deliver: [Simple structure description]
 */

// ============================================================================
// CUSTOM QUERY DEFINITION - The API we're creating
// ============================================================================
// Document the GraphQL query and expected output

// ============================================================================
// HELPER FUNCTIONS - Reusable business logic
// ============================================================================
// Extract common transformations

// ============================================================================
// DATA TRANSFORMATION - Complex to simple
// ============================================================================
// Transform Adobe's structure to our clean API

// ============================================================================
// QUERY EXECUTION - Get data from services
// ============================================================================
// Execute queries against upstream services

// ============================================================================
// MAIN RESOLVER - Export the resolver
// ============================================================================
module.exports = {
  resolvers: {
    Query: {
      Citisignal_queryName: {
        resolve: async (root, args, context, info) => {
          try {
            // Execute logic
            // Transform data
            // Return structure matching schema
          } catch (error) {
            console.error('Resolver error:', error);
            // Return valid empty structure
          }
        }
      }
    }
  }
};
```

## Common Helper Functions

### Used Across Multiple Resolvers

```javascript
// Remove technical prefixes (cs_, attr_)
const cleanAttributeName = (name) => {
  if (!name) return '';
  return name.replace(/^(cs_|attr_)/, '');
};

// Format prices consistently
const formatPrice = (amount) => {
  if (!amount) return null;
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// Calculate discount percentage
const calculateDiscountPercent = (regular, final) => {
  if (!regular || !final || regular <= final) return 0;
  return Math.round(((regular - final) / regular) * 100);
};

// Ensure HTTPS for security
const ensureHttps = (url) => {
  if (!url) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return url.replace(/^http:\/\//, 'https://');
};

// Extract price value from nested structure
const extractPriceValue = (product, priceType, isComplex) => {
  if (isComplex) {
    return priceType === 'regular'
      ? product.priceRange?.minimum?.regular?.amount?.value
      : product.priceRange?.minimum?.final?.amount?.value;
  }
  return priceType === 'regular'
    ? product.price?.regular?.amount?.value
    : product.price?.final?.amount?.value;
};

// Find attribute value by name
const findAttributeValue = (attributes, name) => {
  if (!attributes || !Array.isArray(attributes)) return null;
  const attr = attributes.find(a => 
    a.name === name || a.name === `cs_${name}`
  );
  return attr?.value;
};

// Extract variant options dynamically
const extractVariantOptions = (options) => {
  const variantOptions = {};
  if (!options || !Array.isArray(options)) return variantOptions;
  
  options.forEach(option => {
    if (option.id?.startsWith('cs_')) {
      const cleanName = cleanAttributeName(option.id);
      if (cleanName === 'color' && option.values) {
        variantOptions.colors = option.values.map(v => ({
          name: v.title,
          hex: v.value || '#000000'
        }));
      } else if (option.values) {
        variantOptions[cleanName] = option.values.map(v => v.title);
      }
    }
  });
  
  return variantOptions;
};
```

## Service Query Patterns

### Live Search (AI-powered search)
```javascript
context.LiveSearchSandbox.Query.Search_productSearch({
  root: {},
  args: {
    phrase: searchTerm,
    filter: filters,
    page_size: limit,
    current_page: page
  },
  context,
  selectionSet: `{ ... }`
})
```

### Catalog Service (fast category browsing)
```javascript
context.CatalogServiceSandbox.Query.Catalog_productSearch({
  root: {},
  args: {
    filter: filters,
    page_size: limit,
    current_page: page
  },
  context,
  selectionSet: `{ ... }`
})
```

### Commerce GraphQL (category tree, etc.)
```javascript
context.CommerceGraphQL.Query.Commerce_categoryList({
  root: {},
  args: {
    filters: {}
  },
  context,
  selectionSet: `{ ... }`
})
```

## Response Structure Patterns

### Product List Response
```javascript
return {
  items: products || [],
  totalCount: total || 0,
  hasMoreItems: currentPage < totalPages,
  currentPage: currentPage || 1,
  page_info: {
    current_page: currentPage,
    page_size: pageSize,
    total_pages: totalPages
  }
};
```

### Facets Response
```javascript
return {
  facets: facets.map(facet => ({
    key: cleanAttributeName(facet.attribute),
    title: facet.title || cleanAttribute,
    type: facet.type || 'STANDARD',
    options: facet.buckets.map(bucket => ({
      id: bucket.title,
      name: bucket.title,
      count: bucket.count || 0
    }))
  })),
  totalCount: total || 0
};
```

### Navigation Response
```javascript
return {
  items: navigationItems || [],
  headerNav: items.slice(0, 5).map(cat => ({
    href: cat.href,
    label: cat.label,
    category: cat.urlKey
  })),
  footerNav: items.slice(0, 8).map(cat => ({
    href: cat.href,
    label: cat.label
  }))
};
```

## Error Handling Pattern

Always return a valid structure that matches the schema:

```javascript
catch (error) {
  console.error('Resolver name error:', error);
  return {
    // Return complete structure with defaults
    items: [],
    totalCount: 0,
    hasMoreItems: false,
    // Include ALL required fields
  };
}
```

## Testing Pattern

For each resolver:
1. Test with minimal query first
2. Test with filters/parameters
3. Test error cases
4. Verify all required fields are present

```bash
# Minimal test
query { 
  Citisignal_resolver { 
    totalCount 
  } 
}

# Full test
query { 
  Citisignal_resolver(param: "value") { 
    items { 
      id 
      name 
    }
    totalCount
  } 
}
```