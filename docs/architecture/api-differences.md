# Critical API Differences Between Live Search and Catalog Service

These subtle differences can cause hours of debugging if not understood.

## Sort Parameter Structure

### ❌ WRONG - Returns Empty Results

```javascript
// Catalog Service - INCORRECT
sort: {
  name: "price",        // Field doesn't exist!
  direction: "ASC"
}
```

### ✅ CORRECT

```javascript
// Catalog Service
sort: {
  attribute: "price",   // Must use "attribute"
  direction: "ASC"      // String value
}

// Live Search (expects array)
sort: [{
  attribute: "price",
  direction: "ASC"
}]
```

## Category Filter Fields

Services use different field names for the same data:

```javascript
// Catalog Service
filter: [
  {
    attribute: 'categoryPath', // Note: categoryPath
    in: ['phones'],
  },
];

// Live Search
filter: [
  {
    attribute: 'categories', // Note: categories
    in: ['phones'],
  },
];
```

## Required Parameters

### Catalog Service

- `phrase` is **REQUIRED**, even if empty `""`
- Omitting causes: `"Cannot return null for non-nullable field"`
- Always include: `phrase: args.phrase || ''`

### Live Search

- Requires `Magento-Environment-Id` header
- Missing causes: `"Missing Magento-Environment-Id Header"`

## Facets Support

**Corrected Information:**

- ✅ Live Search: AI-powered facets with contextual relevance and buckets structure
- ✅ Catalog Service: **FULL FACETS SUPPORT** with buckets structure

Both services support facets, but with different strengths:

- **Catalog Service**: Fast, category-optimized facets for browsing
- **Live Search**: AI-enhanced, search-context-aware facets for searching

## Relevance Sorting

- ✅ Live Search: AI-powered relevance ranking
- ❌ Catalog Service: No relevance sorting

When sort is "RELEVANCE" in catalog mode, return `null` - don't try to pass it.

## Quick Reference Table

| Feature                 | Live Search            | Catalog Service         |
| ----------------------- | ---------------------- | ----------------------- |
| **Sort field name**     | `attribute` (in array) | `attribute` (in object) |
| **Category filter**     | `categories`           | `categoryPath`          |
| **Manufacturer field**  | `manufacturer`         | `cs_manufacturer`       |
| **Requires phrase**     | Optional               | **REQUIRED**            |
| **Facets support**      | ✅ AI-enhanced         | ✅ **FULL SUPPORT**     |
| **AI Relevance**        | ✅ Yes                 | ❌ No                   |
| **ConfigurableProduct** | ❌ Limited             | ✅ Full                 |

## Common Errors

| Error                                         | Cause                 | Fix                            |
| --------------------------------------------- | --------------------- | ------------------------------ |
| `"Cannot return null for non-nullable field"` | Missing `phrase`      | Add `phrase: ""`               |
| `"Field 'name' is not defined"`               | Wrong sort field      | Use `attribute`                |
| `"Missing Magento-Environment-Id"`            | Missing header        | Check API route                |
| Empty results with sort                       | Wrong field structure | Use `attribute` not `name`     |
| Empty results with category                   | Wrong filter field    | Use `categoryPath` for Catalog |
