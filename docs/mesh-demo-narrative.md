# API Mesh Demo Narrative: Product Cards Resolver

## Overview

This document provides a demo script for walking through the `product-cards.js` resolver, showcasing how Adobe API Mesh transforms complex e-commerce data into simple, business-focused responses.

## The Story: From Complex to Simple

### Opening: What We're Building

"We're creating a custom GraphQL query called `Citisignal_productCards` that transforms Adobe's complex commerce data into exactly what our frontend needs - clean, simple product cards."

## Demo Walkthrough (Top to Bottom)

### 1. Service Orchestration

**Code Section**: `shouldUseLiveSearch()`

**Talking Points**:

- "First, we make an intelligent decision about which Adobe service to use"
- "If the user is searching, we use Live Search for AI-powered ranking"
- "For browsing and filtering, we use Catalog Service for speed"
- "This is business logic that optimizes for the best user experience"

**Value**: Automatic service selection based on context

### 2. Navigating Complex Data Structures

**Code Section**: Data extraction helpers

**Show Raw Data Example**:

```javascript
// What Adobe gives us:
{
  productView: {
    __typename: "Catalog_ComplexProductView",
    priceRange: {
      minimum: {
        regular: {
          amount: {
            value: 999.99,
            currency: "USD"
          }
        },
        final: {
          amount: {
            value: 799.99,
            currency: "USD"
          }
        }
      }
    }
  }
}

// What we need:
{
  price: "$799.99",
  originalPrice: "$999.99"
}
```

**Talking Points**:

- "Notice how deeply nested the price data is"
- "We have helper functions to extract these values safely"
- "This handles both simple and complex product types"

### 3. Business Transformations

**Code Section**: `attributeCodeToUrlKey()`, `calculateDiscountPercentage()`, `formatPrice()`

**Example Transformation**:

```javascript
// Input: cs_manufacturer = "Apple"
// Output: manufacturer = "Apple"

// Input: regular: 999.99, final: 799.99
// Output: discountPercent = 20
```

**Talking Points**:

- "We remove technical prefixes like 'cs\_' that don't belong in business data"
- "We calculate business metrics like discount percentages"
- "Prices are formatted with currency symbols and thousand separators"
- "These are value-add transformations that save frontend work"

### 4. The Core Value: Response Reshaping

**Code Section**: `transformProductToCard()`

**Show The Transformation**:

```javascript
// Complex Adobe structure becomes:
{
  id: "123",
  sku: "IP15-PRO",
  name: "iPhone 15 Pro",
  manufacturer: "Apple",
  price: "$799.99",
  originalPrice: "$999.99",
  discountPercent: 20,
  inStock: true,
  image: {
    url: "https://...",
    altText: "iPhone 15 Pro"
  }
}
```

**Talking Points**:

- "This is where the magic happens"
- "Complex nested structure becomes flat and simple"
- "Every field is business-ready and frontend-friendly"
- "No more navigating through multiple levels of objects"

### 5. Performance Optimization

**Code Section**: Parallel query execution

**Visual Comparison**:

```
Sequential: [Live Search: 300ms] → [Catalog: 400ms] = 700ms
Parallel:   [Live Search: 300ms]
            [Catalog: 400ms]     = 400ms (43% faster!)
```

**Talking Points**:

- "When searching, we need both AI ranking AND product details"
- "Instead of waiting for each query sequentially, we run them in parallel"
- "This cuts response time nearly in half"
- "The mesh handles the complexity of coordinating multiple services"

### 6. The Final Result

**Code Section**: Main resolver

**Talking Points**:

- "The resolver orchestrates everything we've seen"
- "Frontend developers just call `Citisignal_productCards`"
- "They get consistent, clean data regardless of which services we use"
- "All the complexity is hidden behind this simple interface"

## Key Value Propositions

### For IT Leaders

1. **Reduced Development Time**: Frontend doesn't need to understand Adobe's complex structures
2. **Performance**: Parallel execution and intelligent service selection
3. **Maintainability**: Business logic centralized in one place
4. **Flexibility**: Easy to add new transformations or business rules

### For Developers

1. **Clean API**: Simple, predictable response structure
2. **No Adobe Learning Curve**: Don't need to understand Commerce/Catalog/Search differences
3. **Business-Ready Data**: Formatted prices, calculated discounts, clean names
4. **Consistent Interface**: Same response structure regardless of underlying service

## Demo Tips

1. **Start with Why**: Begin by showing the complex Adobe response to establish the problem
2. **Walk Through Linearly**: Follow the code from top to bottom as a story
3. **Show Comparisons**: Use before/after examples for transformations
4. **Emphasize Business Value**: Connect technical features to business outcomes
5. **End with Simplicity**: Show the clean final response that frontend receives

## Common Questions & Answers

**Q: Why not just use Adobe's services directly?**
A: The complexity would leak into every frontend component. This way, we handle it once, centrally.

**Q: How hard is it to add new fields?**
A: Very easy - just add a new transformation in the `transformProductToCard` function.

**Q: What about performance overhead?**
A: The transformation overhead is minimal (< 10ms) compared to the network calls (400-700ms).

**Q: Can we cache these responses?**
A: Yes, the mesh supports caching strategies at multiple levels.

## Closing Statement

"With API Mesh, we've transformed Adobe's powerful but complex commerce data into exactly what our business needs - simple, clean, and fast. This resolver is a perfect example of how we can build a business-focused API layer on top of enterprise services."
