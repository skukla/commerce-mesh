# Schema Conventions

## Naming Conventions

### Type Prefix

All custom types MUST use the `Citisignal_` prefix to avoid conflicts:

```graphql
type Citisignal_ProductCard {  # ✅ Good
type ProductCard {              # ❌ Bad - may conflict
```

### Type Categories

- **Response Types**: `Citisignal_*Response` or `Citisignal_*Result`
- **Input Types**: `Citisignal_*Input` or `Citisignal_*Filter`
- **Enum Types**: `Citisignal_*` (e.g., `Citisignal_SortDirection`)
- **Info Types**: `Citisignal_*Info` (e.g., `Citisignal_PageInfo`)

## Field Conventions

### Required vs Optional

```graphql
type Citisignal_PageInfo {
  current_page: Int! # Required - use ! for non-nullable
  page_size: Int! # Required
  total_pages: Int! # Required
}

type Citisignal_ProductCard {
  id: String! # Required - every product has an ID
  manufacturer: String # Optional - not all products have this
}
```

### Field Naming

- Use `snake_case` for consistency with Adobe Commerce conventions
- Exception: `_debug` field for debugging (leading underscore indicates meta field)

## Query Conventions

### Query Naming

```graphql
extend type Query {
  # Pattern: Citisignal_<resource><Action>
  Citisignal_productCards(...)
  Citisignal_categoryNavigation(...)
  Citisignal_searchSuggestions(...)
}
```

### Pagination Arguments

```graphql
# Consistent pagination pattern
Citisignal_productCards(
  page: Int = 1        # Current page (1-based)
  limit: Int = 20      # Items per page
): Citisignal_ProductCardResult
```

### Filter Arguments

```graphql
# Dedicated filter input type
input Citisignal_ProductFilter {
  category: String
  priceMin: Float
  priceMax: Float
}
```

## Response Conventions

### List Responses

```graphql
type Citisignal_ProductCardResult {
  items: [Citisignal_ProductCard] # The actual items
  totalCount: Int # Total available items
  page_info: Citisignal_PageInfo # Pagination details
  facets: [Citisignal_Facet] # Optional filters/facets
}
```

### Error Handling

- Return empty arrays rather than null for lists
- Provide fallback values for required fields
- Use the `_debug` field for troubleshooting

## Schema Organization

### File Structure

```
schema/
├── common-types.graphql    # Shared types (filters, sorting)
├── product-cards.graphql   # Product listing types
├── product-facets.graphql  # Faceting/filtering types
├── category-*.graphql      # Category-related types
└── extensions.graphql      # Extensions to Adobe types
```

### Type Dependencies

- Define base types before types that reference them
- Group related types in the same file
- Use comments to explain complex types

## Documentation

### Type Comments

```graphql
# Product card type for listing pages
# Simplified view of product data optimized for performance
type Citisignal_ProductCard {
  id: String! # Unique product identifier
  sku: String! # Stock keeping unit
}
```

### Deprecation

```graphql
type Citisignal_Product {
  oldField: String @deprecated(reason: "Use newField instead")
  newField: String
}
```
