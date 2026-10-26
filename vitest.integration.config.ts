import { defineConfig } from 'vitest/config';
import { apiTestTransform } from './infrastructure/test-api-transform';

export default defineConfig({
  plugins: [apiTestTransform()],
  test: {
    environment: 'node',
    include: ['apps/api/test/**/*.integration.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
