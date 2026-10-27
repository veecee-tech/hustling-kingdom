import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
for (const device of ['mobile', 'desktop'] as const) {
  test(`${device} takes fictional risks, keeps durable outcomes and progresses Street`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize(
      device === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const shot = async (name: string) => {
      await page.screenshot({ path: info.outputPath(`${device}-${name}.png`) });
    };
    const username = `risk_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
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
    await page
      .getByRole('navigation', { name: 'Game navigation' })
      .getByRole('link', { name: 'Hustle', exact: true })
      .click();
    await page
      .getByRole('link', {
        name: 'Underground Street opportunities · real game risk',
      })
      .click();
    await expect(page).toHaveURL('/hustles');
    const opportunities = page.getByRole('list', {
      name: 'Underground opportunities',
    });
    const choose = async (name: string) => {
      await opportunities.getByRole('link').filter({ hasText: name }).click();
    };
    await expect(opportunities).toContainText('Old Town Chance');
    await expect(opportunities).toContainText('Mainland Opening');
    await shot('hustle-opportunities');
    await choose('Mainland Opening');
    await expect(
      page.getByRole('button', { name: 'Consider this hustle' }),
    ).toBeDisabled();
    await expect(page.locator('.hustle-detail')).toContainText('Street Lv. 2');
    await page.goto('/hustles');
    await choose('Old Town Chance');
    await expect(page.locator('.hustle-detail')).toContainText('MEDIUM RISK');
    await expect(page.locator('.risk-terms')).toContainText('HK₦40,000');
    await shot('hustle-detail');
    for (let n = 0; n < 2; n++) {
      if (n) {
        await page.goto('/hustles');
        await choose('Old Town Chance');
      }
      await page.getByRole('button', { name: 'Consider this hustle' }).click();
      const confirmation = page.getByRole('region', { name: 'Take the risk?' });
      // The contextual confirmation is a labelled section, not a browser-native dialog.
      await expect(
        page.getByRole('heading', { name: 'Take the risk?' }),
      ).toBeVisible();
      if (n === 0) {
        await page.locator('.risk-confirmation').scrollIntoViewIfNeeded();
        await shot('risk-confirmation');
      }
      await expect(confirmation).toContainText('HK₦2,000');
      await page.getByRole('button', { name: 'Do it', exact: true }).click();
      await expect(page).toHaveURL(/\/hustles\/attempts\/[a-f0-9-]+$/);
      await expect(
        page.getByRole('heading', { name: 'Cashed out', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.hustle-result')).toContainText('+HK₦40,000');
      await expect(page.locator('.hustle-result')).toContainText(
        '+20 Street XP',
      );
      await expect(page.locator('.player-hud')).toContainText(
        n === 0 ? 'HK₦60,000' : 'HK₦100,000',
      );
      if (n === 0) {
        await shot('positive-outcome');
        const url = page.url();
        await page.reload();
        await expect(page).toHaveURL(url);
        await expect(
          page.getByRole('heading', { name: 'Cashed out', exact: true }),
        ).toBeVisible();
        await expect(page.locator('.player-hud')).toContainText('HK₦60,000');
      } else {
        await expect(page.locator('.level-up')).toContainText(
          'Street · Level 2',
        );
        await expect(page.locator('.hustle-result')).toContainText(
          'NEW OPPORTUNITY UNLOCKED',
        );
        await expect(page.locator('.hustle-result')).toContainText(
          'Mainland Opening',
        );
        await page.locator('.level-up').scrollIntoViewIfNeeded();
        await shot('street-level-up');
      }
    }
    await page.goto('/hustles');
    await choose('Mainland Opening');
    await expect(
      page.getByRole('button', { name: 'Consider this hustle' }),
    ).toBeEnabled();
    await page.goto('/hustles');
    await choose('Backstreet Risk');
    await page.getByRole('button', { name: 'Consider this hustle' }).click();
    await page.getByRole('button', { name: 'Do it', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Bad move', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.hustle-result')).toContainText('−HK₦3,000');
    await expect(page.locator('.hustle-result')).toContainText('+2 Street XP');
    await expect(page.locator('.player-hud')).toContainText('HK₦97,000');
    await expect(
      page.locator('.hud-stats [aria-label="Energy 55 out of 100"]'),
    ).toBeVisible();
    await shot('disaster');
    const disasterUrl = page.url();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Bad move', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.player-hud')).toContainText('HK₦97,000');
    await page.getByRole('link', { name: 'See Bank activity' }).click();
    const activity = page.getByRole('list', { name: 'Wallet activity' });
    await expect(activity).toContainText('Hustle reward');
    await expect(activity).toContainText('Hustle loss');
    await expect(activity).toContainText('−HK₦3,000');
    await activity.scrollIntoViewIfNeeded();
    await shot('bank-hustle-transaction');
    await page.goto('/account');
    const street = page.getByRole('button', {
      name: 'Street, Level 2, 42 total XP',
    });
    await expect(street).toBeVisible();
    await street.click();
    await expect(
      page.getByRole('article', { name: 'Street skill detail' }),
    ).toContainText('Old Town Chance');
    await expect(page.locator('.life-standing')).toContainText(
      'Reputation 0 · Heat 0',
    );
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Street, Level 2, 42 total XP' }),
    ).toBeVisible();
    await page.goto(disasterUrl);
    await expect(
      page.getByRole('heading', { name: 'Bad move', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto('/hustles');
    await expect(
      page.getByRole('list', { name: 'Hustle history' }).getByRole('link'),
    ).toHaveCount(3);
  });
}
