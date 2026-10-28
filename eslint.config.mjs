// ESLint — yalnız geliştirme; pakete girmez. Kapsam: kaynak JS (assets/src, blocks, tests, tools, scripts).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['assets/build/**', 'node_modules/**', 'vendor/**', 'vendor-dev/**', 'build/**', 'dev/design/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { complexity: ['error', 15] },
  },
  {
    files: ['assets/src/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['tests/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['blocks/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, wp: 'readonly' } },
  },
];
