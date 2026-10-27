import { defineConfig, devices } from '@playwright/test';
import './infrastructure/scripts/windows-path.mjs';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Launch Vite directly so Windows teardown does not leave a pnpm child running.
      command:
        'node node_modules/vite/bin/vite.js apps/web --config apps/web/vite.config.ts --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:3100' },
    },
    {
      command: 'node apps/api/dist/main.js',
      url: 'http://127.0.0.1:3100/health/ready',
      reuseExistingServer: false,
      env: {
        API_PORT: '3100',
        WEB_ORIGIN: 'http://127.0.0.1:5174',
        NODE_ENV: 'test',
        JOBS_DEV_DURATION_SECONDS: '4',
        AUTH_RATE_LIMIT: '1000',
        REDIS_URL: 'redis://127.0.0.1:6379/2',
      },
    },
  ],
});
