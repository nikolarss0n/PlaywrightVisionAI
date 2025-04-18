import { test, expect } from './ai-test-base';

// Test that would fail due to network request issues - the AI should be able to identify
// that the failure is related to API data not matching expectations
test('should correctly display API data from JSONPlaceholder', async ({ page }) => {
  // Set up request interception for API calls to JSONPlaceholder
  await page.route('**/posts/**', async route => {
    // Modify the response to simulate an API issue
    const json = {
      id: 1,
      title: "Modified API Response",
      body: "This is a modified response that will cause the test to fail",
      userId: 999 // Modified userId that won't match expectations
    };
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
    
    console.log('Intercepted and modified API response');
  });

  // Navigate to JSONPlaceholder demo site
  await page.goto('https://jsonplaceholder.typicode.com/posts/1');
  
  // Wait for API data to load
  await page.waitForSelector('pre');
  
  // The test should fail here because we've modified the API response
  // and the userId no longer matches what we expect
  try {
    await expect(page.getByText('"userId": 1')).toBeVisible({
      timeout: 5000
    });
  } catch (error) {
    // Throw a custom error message that will be captured by the AI debugger
    throw new Error('Expected to find userId: 1 in the response, but it was modified by our API interceptor');
  }
});

// Another test that fails due to a network error status code
test('should handle API error responses correctly', async ({ page }) => {
  // Set up request interception for API calls to JSONPlaceholder
  await page.route('**/posts/**', async route => {
    // Return a 500 error status
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: "Internal Server Error" })
    });
    
    console.log('Intercepted and returned 500 error');
  });

  // Navigate to JSONPlaceholder demo site
  await page.goto('https://jsonplaceholder.typicode.com/posts/1');
  
  // Wait for the page to render something
  await page.waitForTimeout(1000);
  
  // The test should fail because we expect a success element that won't show up due to the 500 error
  await page.locator('[data-testid="success-message"]').waitFor({
    timeout: 5000,
    state: 'visible'
  }).catch(error => {
    // Throw a custom error message that will be captured by the AI debugger
    throw new Error('Expected to find success message, but it likely failed due to API 500 error');
  });
});

// Original test for reference
test('should find and click the get started button', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  await page.locator('.getStarted').click({ timeout: 3000 });

  await expect(page.getByText("Installation")).toBeVisible();
});