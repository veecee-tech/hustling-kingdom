import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const device of ['mobile', 'desktop'] as const) {
  test(`${device} world, phone and bank preserve the economic journey`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const size =
      device === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 };
    await page.setViewportSize(size);
    const shot = async (screen: string) => {
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });
      await page.screenshot({
        path: testInfo.outputPath(`${device}-${screen}.png`),
      });
    };
    const username = `world_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    const password = `fixture ${randomUUID()}`;
    await page.goto('/register');
    await page
      .getByLabel('Email', { exact: true })
      .fill(`${username}@example.test`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(page).toHaveURL('/create-character');
    await expect(
      page.getByRole('heading', { name: 'Create your character' }),
    ).toBeVisible();
    await page
      .getByLabel('Character name', { exact: true })
      .fill('Ada Kingdom');
    await page
      .getByRole('radio', { name: 'Hair: braids', exact: true })
      .check();
    await shot('character-creation');
    await page
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(page).toHaveURL('/');
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Me', exact: true })
      .click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/login');
    // Required returning-player journey starts with a real login.
    await page.getByLabel('Email or username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/');
    const world = page.getByRole('region', { name: 'Family House courtyard' });
    await expect(world).toBeVisible();
    await expect(
      world.getByRole('img', {
        name: 'Ada Kingdom, your character at Family House',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Family House', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Player status' }),
    ).toContainText('HK₦20,000');
    await expect(page.locator('.world-player')).toContainText('Ada Kingdom');
    await expect(
      page.getByRole('list', { name: 'Wallet activity' }),
    ).toHaveCount(0);
    const frameFits = async () =>
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
    await frameFits();
    await shot('home');
    const phoneTrigger = page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Phone', exact: true });
    await phoneTrigger.click();
    await expect(page).toHaveURL('/phone');
    await expect(
      page.getByRole('dialog', { name: 'Phone', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Messages Locked', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Jobs Locked', exact: true }),
    ).toBeDisabled();
    await shot('phone');
    await page.getByRole('link', { name: 'Bank', exact: true }).click();
    await expect(page).toHaveURL('/wallet');
    await expect(
      page.getByRole('dialog', { name: 'Bank', exact: true }),
    ).toBeVisible();
    const balances = page.getByRole('region', { name: 'Wallet balances' });
    await expect(balances).toContainText('HK₦15,000');
    await page.getByLabel('Amount in HK₦').fill('5000');
    await page
      .getByRole('button', { name: 'Move cash to bank', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText(
      'HK₦5,000 moved to Bank.',
    );
    await expect(balances.locator('.balance-split')).toHaveText(
      /CashHK₦10,000.*BankHK₦10,000/s,
    );
    await expect(
      page.getByRole('list', { name: 'Wallet activity' }),
    ).toContainText('Cash moved to bank');
    await expect(page.locator('.player-hud')).toContainText('HK₦20,000');
    await page
      .locator('.panel-body')
      .evaluate((element) => element.scrollTo(0, 0));
    await shot('bank');
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(page).toHaveURL('/');
    await expect(world).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Player status' }),
    ).toContainText('HK₦20,000');
    await page.getByRole('link', { name: 'Open phone', exact: true }).click();
    await page.getByRole('link', { name: 'Bank', exact: true }).click();
    await expect(balances.locator('.balance-split')).toHaveText(
      /CashHK₦10,000.*BankHK₦10,000/s,
    );
    await page.reload();
    await expect(
      page.getByRole('dialog', { name: 'Bank', exact: true }),
    ).toBeVisible();
    await expect(balances).toContainText('HK₦10,000');
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await page.getByLabel('Amount in HK₦').fill('2000');
    await page
      .getByRole('button', { name: 'Move bank to cash', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText(
      'HK₦2,000 moved to Cash.',
    );
    await expect(balances).toContainText('HK₦12,000');
    await expect(balances).toContainText('HK₦8,000');
    await page
      .getByRole('link', { name: 'Back to phone', exact: true })
      .click();
    await expect(page).toHaveURL('/phone');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Me', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Ada Kingdom', exact: true }),
    ).toBeVisible();
    await shot('me');
    await page.getByRole('radio', { name: 'Hair: afro', exact: true }).check();
    await page.getByRole('button', { name: 'Save appearance' }).click();
    await expect(page.getByRole('status')).toHaveText('Appearance saved.');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/');
    // Native dialog focus returns to the connected initiating dock link.
    await expect(
      page
        .getByRole('navigation', { name: 'Game navigation' })
        .getByRole('link', { name: 'Me', exact: true }),
    ).toBeFocused();
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'City', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'City', exact: true }),
    ).toContainText('Royal Island');
    await expect(
      page.getByRole('dialog', { name: 'City', exact: true }),
    ).toContainText('Travel is not available yet.');
    await page.getByRole('button', { name: 'Close panel' }).click();
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Hustle', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Hustle', exact: true }),
    ).toContainText('still locked');
    await page.keyboard.press('Escape');
    await frameFits();
    await page.setViewportSize({ width: 768, height: 1000 });
    await frameFits();
    await expect(page.locator('.world-player')).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page
        .getByRole('link', { name: 'Open phone', exact: true })
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe('0s');
    await page.goto('/account');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/login');
    await page.goto('/login');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#game-content')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email or username')).toBeFocused();
  });
}
