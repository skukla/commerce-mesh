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
    files: ['build/resolvers/**/*.js', 'resolvers-src/utils/**/*.js'],
    languageOptions: {
      globals: {
        FACET_MAPPINGS: 'readonly',
        attributeCodeToUrlKey: 'readonly',
        urlKeyToAttributeCode: 'readonly',
        extractPriceValue: 'readonly',
        findAttributeValue: 'readonly',
        isOnSale: 'readonly',
        calculateDiscountPercent: 'readonly',
        extractVariantOptions: 'readonly',
        ensureHttpsUrl: 'readonly',
        formatPrice: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', 'mesh.json', 'build/**'],
  },
];
