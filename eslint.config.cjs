const globals = require('globals');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'eslint.config.cjs',
      'dental-app-web/**',
      'dental_app_mobile/**',
      'DentalApp.Desktop/**',
      'DentalApp.Desktop.Tests/**',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
      'prettier/prettier': 'error',
    },
  },
];
