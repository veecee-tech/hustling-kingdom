import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid session.',
          details: {},
          requestId: 'req_smoke',
        },
      },
    }),
  );
});

test('home boots with router, store, API client and Tailwind', async ({
  page,
}) => {
  // Isolate browser smoke from service availability; real services have an integration suite.
  await page.route('**/health/ready', (route) =>
    route.fulfill({ json: { status: 'ok' } }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: /Your life\.\s*Your own way\./,
      exact: false,
    }),
  ).toBeVisible();
  await page.getByText('Connection status', { exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'API and required services are ready.',
  );
  await expect(
    page.getByRole('link', { name: 'Start your story' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Family House courtyard' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toContainText('are ready');
});

test('unavailable API displays a recoverable error', async ({ page }) => {
  await page.route('**/health/ready', (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service unavailable.',
          details: {},
          requestId: 'req_smoke',
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByText('Connection status', { exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Service unavailable.');
  await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled();
});
