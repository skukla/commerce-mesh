# Adobe API Mesh: Unified Query Pattern Analysis

## Executive Summary

We've implemented a unified GraphQL query (`Citisignal_productPageData`) that demonstrates Adobe API Mesh's ability to orchestrate multiple backend services in a single query. While this showcases the platform's capabilities, it reveals a significant architectural limitation that impacts maintainability.

## The Value Proposition

**Single Query Benefits:**
- Frontend makes ONE GraphQL call instead of 3-4 separate calls
- Backend services run in parallel (faster than sequential client calls)
- Simplified frontend code with single loading state
- Ideal for server-side rendering

**Example Performance Gain:**
- Sequential client calls: 200ms + 150ms + 180ms + 100ms = 630ms total
- Unified parallel query: ~250ms total

## The Critical Limitation

**Adobe API Mesh does NOT support custom resolvers calling other custom resolvers.**

This means our unified resolver cannot reuse existing resolver logic:

```javascript
// ❌ What we CAN'T do (would be ideal):
const navigation = await context.Query.Citisignal_categoryNavigation();
const products = await context.Query.Citisignal_productCards();

// ✅ What we MUST do (code duplication):
const navigation = await context.CommerceGraphQL.Query.Commerce_categoryList();
// ... then duplicate all transformation logic from categoryNavigation resolver
```

## The Maintenance Problem

This limitation creates significant code duplication:

1. **Individual Resolvers** (`Citisignal_productCards`, `Citisignal_categoryNavigation`, etc.)
   - Contain business logic for data transformation
   - Used when components need specific data

2. **Unified Resolver** (`Citisignal_productPageData`)
   - Must duplicate ALL transformation logic from individual resolvers
   - Cannot reuse existing resolver code
   - Maintenance nightmare: update logic in multiple places

## Current Implementation

We have both patterns implemented:
- **Individual queries**: Used by actual product pages (flexible, maintainable)
- **Unified query**: Used by demo page (showcases capability, but duplicates code)

## Recommendation

**Use individual queries as the primary pattern** for these reasons:
- No code duplication
- Easier maintenance
- More flexible caching strategies
- Components can update independently

**Reserve unified queries for:**
- High-traffic pages where performance gain justifies code duplication
- Demo/POC scenarios to showcase API Mesh capabilities
- Server-side rendered pages where single query is critical

## The Ideal Solution

Adobe API Mesh should support resolver composition, allowing custom resolvers to call other custom resolvers. This would enable unified queries without code duplication, making the pattern viable for production use.

## Bottom Line

The unified query pattern demonstrates powerful orchestration capabilities but comes with a significant maintenance cost due to code duplication. Until Adobe API Mesh supports resolver composition, individual queries remain the more maintainable approach for most use cases.