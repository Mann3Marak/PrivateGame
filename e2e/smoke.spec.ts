import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('@smoke gameplay and dashboard flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Local Spinner Game')).toBeVisible();
  await expect(page.getByText('Active Player: P1')).toBeVisible();

  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(page.getByText('Active Player: P2')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('@a11y core pages have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');

  const gameplayResults = await new AxeBuilder({ page }).analyze();
  const gameplaySerious = gameplayResults.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? '')
  );
  expect(gameplaySerious).toHaveLength(0);

  await page.goto('/dashboard');
  const dashboardResults = await new AxeBuilder({ page }).analyze();
  const dashboardSerious = dashboardResults.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? '')
  );
  expect(dashboardSerious).toHaveLength(0);
});
