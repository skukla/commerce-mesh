# Enhanced Query Examples for Adobe API Mesh

This document provides examples of GraphQL queries that leverage the enhanced resolvers in our Adobe API Mesh configuration. These queries provide cleaner, more intuitive access to product data while maintaining full compatibility with the original Catalog Service API.

## Table of Contents
- [Simple Products Query](#simple-products-query)
- [Complex Products Query](#complex-products-query)
- [Filtering Examples](#filtering-examples)
- [Field Comparison](#field-comparison)

## Simple Products Query

This query retrieves simple products with enhanced fields for cleaner data access:

```graphql
query SimpleProducts {
  products(
    phrase: ""
    limit: 10
    page: 1
  ) {
    total
    items {
      product {
        __typename
        id
        name
        sku
        urlKey
        description
        images {
          url
          label
          roles
        }
        ... on Catalog_SimpleProductView {
          # Enhanced Fields (via resolvers)
          manufacturer              # Clean, no cs_ prefix
          is_on_sale               # Computed boolean
          display_price            # Direct price access
          display_currency         # Direct currency access
          discount_percentage      # Computed discount
          in_stock                # Boolean status
          
          # Original price structure (still available)
          price {
            regular {
              amount {
                value
                currency
              }
            }
            final {
              amount {
                value
                currency
              }
            }
          }
          
          # Enhanced specifications (cleaned attributes)
          specifications {
            name    # Cleaned attribute names
            value   # Attribute values
          }
          
          # Structured category access
          primary_category {
            name
            url_path
          }
        }
      }
      relevance
    }
    page_info {
      current_page
      page_size
      total_pages
    }
  }
}
```

## Complex Products Query

This query retrieves complex/configurable products with all enhanced fields:

```graphql
query ComplexProducts {
  products(
    phrase: ""
    limit: 10
    page: 1
  ) {
    total
    items {
      product {
        __typename
        id
        name
        sku
        urlKey
        description
        images {
          url
          label
          roles
        }
        ... on Catalog_ComplexProductView {
          # Enhanced Fields (via resolvers)
          manufacturer              # Clean, no cs_ prefix
          memory_options           # Array of memory options
          available_colors {       # Structured color data
            name
            hex
          }
          is_on_sale              # Computed boolean
          display_price           # Direct min price access
          display_currency        # Direct currency access
          discount_percentage     # Computed discount
          in_stock               # Boolean status
          
          # Formatted options for better structure
          formatted_options {
            id
            title
            required
            values {
              id
              title
              value
            }
          }
          
          # Original price structure (still available)
          priceRange {
            minimum {
              regular {
                amount {
                  value
                  currency
                }
              }
              final {
                amount {
                  value
                  currency
                }
              }
            }
          }
          
          # Enhanced specifications (cleaned attributes)
          specifications {
            name    # Cleaned attribute names
            value   # Attribute values
          }
          
          # Structured category access
          primary_category {
            name
            url_path
          }
          
          # Original categories field (still available)
          categories
        }
      }
      relevance
    }
    page_info {
      current_page
      page_size
      total_pages
    }
  }
}
```

## Filtering Examples

The enhanced `products` query supports flexible filtering:

### Filter by Category
```graphql
query ProductsByCategory {
  products(
    filter: [{ attribute: "categories", eq: "phones" }]
    limit: 20
    page: 1
  ) {
    total
    items {
      product {
        name
        manufacturer
        display_price
        is_on_sale
      }
    }
  }
}
```

### Search with Phrase
```graphql
query SearchProducts {
  products(
    phrase: "laptop"
    limit: 10
    page: 1
  ) {
    total
    items {
      product {
        name
        display_price
        discount_percentage
      }
      relevance
    }
  }
}
```

### Multiple Filters
```graphql
query FilteredProducts {
  products(
    filter: [
      { attribute: "categories", eq: "electronics" },
      { attribute: "manufacturer", eq: "Apple" }
    ]
    limit: 10
    page: 1
  ) {
    total
    items {
      product {
        name
        sku
        display_price
      }
    }
  }
}
```

## Field Comparison

### Original vs Enhanced Fields

| Original Field | Enhanced Field | Benefits |
|---------------|---------------|----------|
| `attributes[].name` with `cs_manufacturer` | `manufacturer` | Direct access, no prefix |
| Calculate: `regular.value > final.value` | `is_on_sale` | Pre-computed boolean |
| Calculate: `(regular - final) / regular * 100` | `discount_percentage` | Pre-computed percentage |
| `stock_status === 'IN_STOCK'` | `in_stock` | Simple boolean |
| `priceRange.minimum.final.amount.value` | `display_price` | Direct access |
| `priceRange.minimum.final.amount.currency` | `display_currency` | Direct access |
| `custom_attributes` | `specifications` | Cleaned names and structure |
| `categories[0]` | `primary_category` | Structured with name and url_path |
| `options` | `formatted_options` | Better structured for UI |

### Additional Enhanced Fields

**For Simple Products:**
- `manufacturer` - Manufacturer name without prefix
- `is_on_sale` - Boolean sale status
- `display_price` - Direct price value
- `display_currency` - Currency code
- `discount_percentage` - Calculated discount
- `in_stock` - Boolean stock status
- `specifications` - Clean attribute array
- `primary_category` - Main category with details

**For Complex Products (includes all simple fields plus):**
- `memory_options` - Array of memory configurations
- `available_colors` - Array with color names and hex values
- `formatted_options` - Structured configurable options

## Benefits of Using Enhanced Queries

1. **Cleaner Data Access** - No need to handle `cs_` prefixes or complex attribute structures
2. **Pre-computed Values** - Sale status, discounts, and stock availability calculated server-side
3. **Type Safety** - Strongly typed fields instead of generic attributes
4. **Backward Compatible** - All original fields remain accessible
5. **Better Performance** - Clients can query only the fields they need
6. **Improved Developer Experience** - Intuitive field names and structures

## Migration Guide

To migrate from original Catalog queries to enhanced mesh queries:

1. Replace `Catalog_productSearch` with `products` query
2. Use enhanced fields for cleaner access (e.g., `manufacturer` instead of parsing attributes)
3. Leverage computed fields (e.g., `is_on_sale`, `discount_percentage`)
4. Use `specifications` for custom attributes with clean names
5. Access `primary_category` for main category information
6. Original fields remain available if needed for compatibility