import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
for (const device of ['mobile', 'desktop'] as const) {
  test(`${device} first playable loop earns salary exactly once and restores work`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize(
      device === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    const shot = async (name: string) => {
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .map((a) => a.finished.catch(() => undefined)),
        );
      });
      await page.screenshot({
        path: testInfo.outputPath(`${device}-${name}.png`),
      });
    };
    const username = `work_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
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
    await page.getByLabel('Character name', { exact: true }).fill('Yuddy');
    await page
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.player-hud')).toContainText('HK₦20,000');
    await expect(
      page.locator('.hud-stats [aria-label="Energy 100 out of 100"]'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Find your first job', exact: false }),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Hustle', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Hustle', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', {
        name: 'Find work Jobs around Kingdom City',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL('/jobs');
    await expect(
      page.getByRole('list', { name: 'Jobs', exact: true }),
    ).toContainText('Cleaner');
    await shot('jobs');
    await page
      .getByRole('list', { name: 'Jobs', exact: true })
      .getByRole('link')
      .filter({ hasText: 'Delivery Rider' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Start shift', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText('Requires a vehicle · future progression', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'All jobs', exact: false }).click();
    await page
      .getByRole('list', { name: 'Jobs', exact: true })
      .getByRole('link')
      .filter({ hasText: 'Cleaner' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Cleaner', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('HK₦8,000', { exact: true })).toBeVisible();
    await shot('job-detail');
    await page
      .getByRole('button', { name: 'Start shift', exact: true })
      .click();
    await expect(page).toHaveURL('/jobs/work');
    await expect(
      page.getByText('SHIFT STARTED', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.work-avatar')).toBeVisible();
    await shot('work-active');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Cleaner', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.player-hud')).toContainText('HK₦20,000');
    const complete = page.getByRole('button', {
      name: 'Complete shift',
      exact: true,
    });
    await expect(complete).toBeEnabled({ timeout: 15000 });
    await complete.click();
    await expect(
      page.getByRole('heading', { name: 'Shift complete', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.salary-reward')).toContainText('+HK₦8,000');
    await expect(page.locator('.salary-reward')).toContainText('−10 Energy');
    await expect(page.locator('.player-hud')).toContainText('HK₦28,000');
    await expect(
      page.locator('.hud-stats [aria-label="Energy 90 out of 100"]'),
    ).toBeVisible();
    await shot('shift-complete');
    await page
      .getByRole('dialog', { name: 'Work', exact: true })
      .getByRole('link', { name: 'Open phone', exact: true })
      .click();
    await page.getByRole('link', { name: 'Bank', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Wallet balances' }),
    ).toContainText('HK₦28,000');
    await expect(
      page.getByRole('region', { name: 'Wallet balances' }),
    ).toContainText('HK₦13,000');
    await expect(
      page.getByRole('list', { name: 'Wallet activity' }),
    ).toContainText('Job salary');
    await expect(
      page.getByRole('list', { name: 'Wallet activity' }),
    ).toContainText('+HK₦8,000');
    await page
      .getByRole('list', { name: 'Wallet activity' })
      .scrollIntoViewIfNeeded();
    await shot('bank-after-salary');
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Wallet balances' }),
    ).toContainText('HK₦28,000');
    await expect(
      page.locator('.hud-stats [aria-label="Energy 90 out of 100"]'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.first-move')).toHaveCount(0);
    await page.goto('/jobs/work');
    await expect(
      page.getByRole('heading', { name: 'Shift complete', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.player-hud')).toContainText('HK₦28,000');
    await page
      .getByRole('link', { name: 'Find another shift', exact: true })
      .click();
    await page
      .getByRole('list', { name: 'Jobs', exact: true })
      .getByRole('link')
      .filter({ hasText: 'Cleaner' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Start shift', exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page
        .getByRole('button', { name: 'Start shift', exact: true })
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
  });
}
