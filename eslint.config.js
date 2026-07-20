import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default [
  {
    // Sadece backend (src/, tests/, scripts/) lint edilir — diğer platformların
    // kendi araçları var (ng lint, dotnet, flutter analyze)
    ignores: [
      '**/node_modules/**',
      'eslint.config.js',
      'coverage/**',
      'dental-app-web/**',
      'DentalApp.Desktop/**',
      'dental_app_mobile/**',
      'flutter/**',
      'deploy/**',
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
