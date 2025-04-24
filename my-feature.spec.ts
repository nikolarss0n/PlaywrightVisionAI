import { test, expect } from './ai-test-base';

// Test that would fail due to network request issues - the AI should be able to identify
// that the failure is related to API data not matching expectations

// Original test for reference
test('should find and click the get started button', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  await page.locator('.getStarted').click({ timeout: 3000 });

  await expect(page.getByText("Installation")).toBeVisible();
});