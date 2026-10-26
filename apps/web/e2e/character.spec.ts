import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('mobile onboarding, cosmetic changes, restoration and existing-character routing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const username = `ph2_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await page.goto('/register');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`${username}@example.test`);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill(`fixture ${randomUUID()}`);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL('/create-character');
  await expect(
    page.getByRole('button', { name: 'Create character', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Character name', { exact: true }).fill('Nneka Ọlá');
  await page.getByLabel('Gender presentation').selectOption('FEMALE');
  await page.getByRole('radio', { name: 'Hair: braids', exact: true }).check();
  await page.getByRole('radio', { name: 'Top: ankara', exact: true }).check();
  await expect(
    page.getByRole('img', { name: 'Character appearance preview' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create character', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Nneka Ọlá' })).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Me', exact: true }),
  ).toContainText('Family House');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('radio', { name: 'Hair: afro', exact: true }).check();
  await page.getByRole('button', { name: 'Save appearance' }).click();
  await expect(page.getByRole('status')).toHaveText('Appearance saved.');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nneka Ọlá' })).toBeVisible();
  await expect(
    page.getByRole('radio', { name: 'Hair: afro', exact: true }),
  ).toBeChecked();
  for (const path of ['/create-character', '/login', '/register']) {
    await page.goto(path);
    await expect(page).toHaveURL('/');
  }
});
