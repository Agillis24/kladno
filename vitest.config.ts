import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Testy čtou schémata rovnou ze zdrojů, aby nebylo nutné nejdřív buildovat.
      '@kladno/schema': fileURLToPath(new URL('./packages/schema/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
