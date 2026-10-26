import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          testTimeout: 15000,
          include: [
            'packages/**/*.test.ts',
            'apps/api/test/**/*.test.ts',
            'apps/web/src/api/**/*.test.ts',
          ],
        },
      },
      {
        root: './apps/web',
        plugins: [vue()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['test/**/*.test.ts'],
          env: { VITE_API_BASE_URL: 'http://localhost:3000' },
        },
      },
    ],
  },
});
