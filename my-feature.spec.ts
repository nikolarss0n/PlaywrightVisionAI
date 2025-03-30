import { test, expect } from './ai-test-base';

test('should find and click the submit button', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  await page.locator('.getStarted').click({ timeout: 3000 });

  await expect(page.getByText("Installation")).toBeVisible();
});