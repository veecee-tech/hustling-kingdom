import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
for (const device of ['mobile', 'desktop'] as const) {
  test(`${device} progresses from customer work to a new career`, async ({
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
    const username = `skill_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
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
    await page.goto('/account');
    const roster = page.getByRole('list', { name: 'Skills', exact: true });
    await expect(roster.getByRole('button')).toHaveCount(6);
    await expect(
      roster.getByRole('button', { name: 'Social, Level 1, 0 total XP' }),
    ).toBeVisible();
    await roster.scrollIntoViewIfNeeded();
    await shot('skills');
    await roster
      .getByRole('button', { name: 'Social, Level 1, 0 total XP' })
      .click();
    const detail = page.getByRole('article', { name: 'Social skill detail' });
    await expect(detail).toContainText('Sales Rep');
    await detail.scrollIntoViewIfNeeded();
    await shot('skill-detail');
    await page.goto('/jobs');
    const posting = (name: string) =>
      page
        .getByRole('list', { name: 'Jobs', exact: true })
        .getByRole('link')
        .filter({ hasText: name });
    await posting('Sales Rep').click();
    await expect(
      page.getByRole('button', { name: 'Start shift', exact: true }),
    ).toBeDisabled();
    await expect(page.locator('.job-detail')).toContainText('Social Lv. 2');
    await shot('locked-job');
    for (let n = 0; n < 2; n++) {
      await page.goto('/jobs');
      await posting('Shop Assistant').click();
      await page
        .getByRole('button', { name: 'Start shift', exact: true })
        .click();
      await expect(page).toHaveURL('/jobs/work');
      const complete = page.getByRole('button', {
        name: 'Complete shift',
        exact: true,
      });
      await expect(complete).toBeEnabled({ timeout: 15000 });
      await complete.click();
      await expect(page.locator('.xp-reward')).toContainText('+15 Social XP');
      await expect(page.locator('.salary-reward')).toContainText('+HK₦10,000');
      await expect(page.locator('.player-hud')).toContainText(
        n === 0 ? 'HK₦30,000' : 'HK₦40,000',
      );
      if (n === 0) {
        await shot('xp-earned');
        await page.goto('/account');
        await expect(
          roster.getByRole('button', { name: 'Social, Level 1, 15 total XP' }),
        ).toBeVisible();
        await page.reload();
        await expect(
          roster.getByRole('button', { name: 'Social, Level 1, 15 total XP' }),
        ).toBeVisible();
      } else {
        await expect(page.locator('.level-up')).toContainText(
          'Social · Level 2',
        );
        await expect(page.locator('.xp-reward')).toContainText(
          'NEW JOB UNLOCKED',
        );
        await expect(page.locator('.xp-reward')).toContainText('Sales Rep');
        await page.locator('.level-up').scrollIntoViewIfNeeded();
        await shot('level-up');
      }
    }
    await page.goto('/account');
    await expect(
      roster.getByRole('button', { name: 'Social, Level 2, 30 total XP' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      roster.getByRole('button', { name: 'Social, Level 2, 30 total XP' }),
    ).toBeVisible();
    await page.goto('/jobs');
    await posting('Sales Rep').click();
    await expect(page.locator('.job-detail')).toContainText('Your level: 2');
    const start = page.getByRole('button', {
      name: 'Start shift',
      exact: true,
    });
    await expect(start).toBeEnabled();
    await shot('newly-unlocked-job');
    await start.click();
    await expect(
      page.getByRole('heading', { name: 'Sales Rep', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.hud-stats [aria-label="Energy 76 out of 100"]'),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
