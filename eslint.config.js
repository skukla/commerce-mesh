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
    files: ['resolvers/**/*.js'],
    languageOptions: {
      globals: {
        FACET_MAPPINGS: 'readonly',
        attributeCodeToUrlKey: 'readonly',
        urlKeyToAttributeCode: 'readonly',
      },
    },
  },
  {
    // Template file is not meant to be executed directly
    files: ['resolvers/shared-utilities-template.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'build/**', 'mesh.json', 'resolvers-processed/**'],
  },
];
