import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('account registration, restoration, logout, login and logout all', async ({
  page,
  context,
}) => {
  const username = `e2e_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const email = `${username}@example.test`;
  const password = `test passphrase ${randomUUID()}`;
  await page.goto('/account');
  await expect(page).toHaveURL('/login');
  await page.getByRole('link', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL('/create-character');
  await page
    .getByLabel('Character name', { exact: true })
    .fill('Adé of Kingdom');
  await page
    .getByRole('button', { name: 'Create character', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'hk_refresh',
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  expect(cookie?.path).toBe('/api/v1/auth');
  expect(
    await page.evaluate(() => document.cookie.includes('hk_refresh')),
  ).toBe(false);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your account' }),
  ).toBeVisible();
  const rotated = (await context.cookies()).find(
    (item) => item.name === 'hk_refresh',
  );
  expect(rotated?.value === cookie?.value).toBe(false);
  await page.goto('/login');
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Email or username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('incorrect password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Email, username or password is incorrect.',
  );
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out all devices' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/account');
  await expect(page).toHaveURL('/login');
});
