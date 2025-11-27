# commerce-mesh v1.0.0-beta.1

**⚠️ Beta Release**

Initial beta release of the Commerce API Mesh - a unified GraphQL API for Adobe Commerce that orchestrates Catalog Service, Live Search, and Commerce Core GraphQL into a single, optimized endpoint.

## 🚀 What's Implemented

### Core Features

- **Unified GraphQL Endpoint**: Single API combining multiple Adobe Commerce services
- **Dynamic Facet System**: SEO-friendly URL mapping with configurable attribute handling
- **SSR-Optimized Queries**: Complete page data in single requests for Next.js
- **Custom Resolvers**: 10+ custom resolvers following `Citisignal_*` naming convention

### Product Features

- **Category Pages** (`Citisignal_categoryPageData`): Unified category data with products, facets, navigation, and breadcrumbs
- **Product Cards** (`Citisignal_productCards`): Product listings with pagination and filtering
- **Product Detail** (via extensions): Enhanced product data with semantic images and dual pricing
- **Search & Filters** (`Citisignal_productSearchFilter`): Search with dynamic facets
- **Product Facets** (`Citisignal_productFacets`): Dynamic filter options

### Navigation & Structure

- **Category Navigation** (`Citisignal_categoryNavigation`): Multi-level navigation menus
- **Breadcrumbs** (`Citisignal_categoryBreadcrumbs`): Flat URL structure breadcrumb trails
- **Search Suggestions**: Typeahead suggestions for search

### Cart Operations ✅ **NEW**

- **Add to Cart**: `Citisignal_addProductsToCart`
- **Update Cart**: `Citisignal_updateCartItems`
- **Remove from Cart**: `Citisignal_removeItemFromCart`
- **Clear Cart**: `Citisignal_clearCart`
- Duplicate detection to prevent accidental double-adds

### Technical Features

- **Build-Time Injection Pattern**: Overcomes API Mesh limitations by injecting utilities at build time
- **Smart Utility Injection**: Eliminates code duplication across resolvers
- **Configurable Facet Mappings**: JSON-based attribute-to-URL mapping system
- **Environment-Aware**: Staging and production deployment support

## 📋 Requirements

- **Node.js**: 14, 16, or 18
- **Adobe I/O CLI**: Latest version with `api-mesh` plugin installed
- **Adobe Commerce**: Active instance with:
  - Catalog Service
  - Live Search
  - Commerce Core GraphQL
- **Adobe Developer Console**: Organization with App Builder access

## 🛠️ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Adobe Commerce credentials

# 3. Build mesh configuration
npm run build

# 4. Deploy to staging
npm run update

# 5. Deploy to production
npm run update:prod
```

## 📁 What's Included

- `resolvers-src/` - 10 custom resolvers + utilities
  - `cart-operations.js` - Cart add/update/remove/clear
  - `category-page.js` - Unified category data (SSR-optimized)
  - `product-cards.js` - Product listings
  - `product-facets.js` - Dynamic filters
  - `utils/` - 8 transformation utilities
- `config/facet-mappings.json` - SEO-friendly attribute mappings
- `schema/` - GraphQL schema definitions
- `scripts/` - Build system with injection + deployment automation
- `mesh.json` - Generated mesh configuration

## 🎯 Recent Updates

### Cart Functionality (Latest)

- Full cart operations with duplicate detection
- Proper error handling and validation
- Cart mutations enabled in mesh configuration

### Product Enhancements

- Semantic image fields (base, small, thumbnail)
- Dual pricing support (regular + special prices)
- Configurable options for variant selection
- Flat URL structure for breadcrumbs

### Build System

- Improved dynamic file detection
- Better resolver processing
- Environment variable standardization

## 🚧 Known Limitations

- No checkout flow (handled by Commerce Core or custom implementation)
- Facet mappings require manual configuration for custom attributes
- No built-in authentication (handled by consuming application)

## 🐛 Issues & Feedback

This is a beta release. Please report:

- Performance issues with specific queries
- Missing or incorrect data transformations
- Build or deployment problems

**GitHub Issues**: https://github.com/skukla/commerce-mesh/issues

## 📝 Next Steps

Future releases will include:

- Additional payment/checkout resolvers
- Enhanced caching strategies
- More comprehensive error handling
- Performance optimizations for large catalogs
- Additional data source integrations

## 📚 Related Projects

- **CitiSignal Next.js** (`citisignal-nextjs`): Frontend consuming this mesh
- **Kukla Integration Service** (`kukla-integration-service`): Product data export service

---

**Version**: v1.0.0-beta.1  
**Release Date**: January 2025  
**Node Version**: 14+ || 16 || 18  
**Status**: Beta (use for demos and testing)
