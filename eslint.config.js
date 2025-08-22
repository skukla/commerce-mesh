const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
  {
    // Special globals for resolver files that will be injected at build time
    files: ['build/resolvers/**/*.js', 'resolvers-src/**/*.js'],
    languageOptions: {
      globals: {
        FACET_MAPPINGS: 'readonly',
        attributeCodeToUrlKey: 'readonly',
        urlKeyToAttributeCode: 'readonly',
        extractPriceValue: 'readonly',
        findAttributeValue: 'readonly',
        isOnSale: 'readonly',
        calculateDiscountPercent: 'readonly',
        calculateDiscountPercentage: 'readonly',
        extractVariantOptions: 'readonly',
        ensureHttpsUrl: 'readonly',
        formatPrice: 'readonly',
        transformProductToCard: 'readonly',
        transformCategory: 'readonly',
        filterForNavigation: 'readonly',
        buildHeaderNav: 'readonly',
        buildFooterNav: 'readonly',
        buildBreadcrumbs: 'readonly',
        buildPageFilters: 'readonly',
        buildCatalogFilters: 'readonly',
        buildLiveSearchFilters: 'readonly',
        transformFacets: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', 'mesh.json', 'build/**'],
  },
];
