// ESLint — yalnız geliştirme; pakete girmez. Kapsam: assets/js (kaynak).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['assets/js/build/**', 'assets/vendor/**', '**/*.min.js', 'node_modules/**', 'vendor/**', 'vendor-dev/**', 'build/**', 'tests/**', 'tools/**', 'scripts/**'] },
  js.configs.recommended,
  {
    files: ['assets/src/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  {
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, jQuery: 'readonly', wp: 'readonly', elementor: 'readonly', elementorFrontend: 'readonly', wdpData: 'readonly' },
    },
  },
  {
    files: ['src/**/assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },
];
