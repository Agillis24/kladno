import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'data/**', 'pipeline/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Pipeline běží v GitHub Actions, log do konzole je její jediný výstup do runneru.
      'no-console': 'off',
    },
  },
);
