# Debugging Resolvers

Since `console.log` doesn't work in Adobe API Mesh resolvers, we use a `_debug` field approach.

## Adding Debug Support

### 1. Add Debug Field to Schema
```graphql
type Citisignal_ProductCardResult {
  items: [Citisignal_ProductCard]
  page_info: Citisignal_PageInfo
  _debug: String  # Debug information when requested
}
```

### 2. Build Debug Info in Resolver
```javascript
const debugInfo = {};

// Capture input
debugInfo.receivedArgs = args;
debugInfo.searchResultExists = !!searchResult;

// Capture intermediate values
debugInfo.calculated = {
  currentPage,
  pageSize,
  totalPages,
  itemsLength: items.length
};

// Capture upstream responses
debugInfo.searchResultPageInfo = searchResult?.page_info;
```

### 3. Conditionally Include Debug Field
```javascript
// Only include debug field if requested in selection set
const includeDebug = info?.fieldNodes?.[0]?.selectionSet?.selections?.some(
  s => s.name?.value === '_debug'
);

if (includeDebug) {
  response._debug = JSON.stringify(debugInfo, null, 2);
}
```

## Using Debug in Queries

### Basic Debug Query
```graphql
query {
  Citisignal_productCards(limit: 10) {
    items { name }
    page_info { current_page }
    _debug  # Request debug info
  }
}
```

### Nested Debug
```graphql
query {
  Citisignal_productPageData {
    products {
      _debug  # Debug from productCards resolver
    }
    _debug  # Debug from productPageData resolver
  }
}
```

## Debug Output Format

The `_debug` field returns a JSON string containing:
```json
{
  "receivedArgs": {
    "limit": 10,
    "page": 1
  },
  "searchResultExists": true,
  "searchResultPageInfo": {
    "current_page": 1,
    "page_size": 10,
    "total_pages": 5
  },
  "calculated": {
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 5,
    "itemsLength": 10
  }
}
```

## Best Practices

1. **Remove in Production**: Consider removing debug fields from production schema
2. **Limit Data**: Don't include sensitive data in debug output
3. **Structure Output**: Use consistent structure for debug info
4. **Performance**: Only build debug info when requested (check `includeDebug`)

## Common Debug Scenarios

### Debugging Null Values
```javascript
debugInfo.nullChecks = {
  hasSearchResult: !!searchResult,
  hasPageInfo: !!searchResult?.page_info,
  currentPageValue: searchResult?.page_info?.current_page,
  fallbackUsed: !searchResult?.page_info?.current_page
};
```

### Debugging Transformations
```javascript
debugInfo.transformation = {
  input: originalData,
  output: transformedData,
  filterApplied: !!filter,
  itemsBeforeFilter: allItems.length,
  itemsAfterFilter: filteredItems.length
};
```

### Debugging Parallel Calls
```javascript
debugInfo.parallelCalls = {
  call1Duration: call1Time,
  call2Duration: call2Time,
  call1Success: !!result1,
  call2Success: !!result2
};
```