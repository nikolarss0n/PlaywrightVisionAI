import { test } from '@playwright/test';
import { setupAiDebugging } from './dist/index';

// Set up AI debugging for this test file
setupAiDebugging(test);

/**
 * This test intentionally fails after making various network requests 
 * to verify our network request capture functionality works properly.
 * 
 * NOTE: This is a verification test - it's EXPECTED to fail.
 * Check the HTML report after running to verify network requests are captured.
 */
test('verify network request capture in headless mode', async ({ page }) => {
  console.log('Starting network request verification test');
  
  // First make a regular page request
  await page.goto('https://jsonplaceholder.typicode.com/');
  await page.waitForLoadState('networkidle');
  console.log('✅ Loaded main page');
  
  // Create a small delay to ensure page is fully loaded
  await page.waitForTimeout(500);
  
  // Make some XHR/fetch requests with different methods
  await page.evaluate(() => {
    // Display a message in the browser console
    console.log('Beginning network request tests...');
    
    // Helper to log each request
    const logRequest = (method, url) => {
      console.log(`Sending ${method} request to ${url}`);
      return { timestamp: new Date().toISOString(), method, url };
    };
    
    // Track all requests in window object for debugging
    window._testRequests = [];
    
    // GET request - standard API call
    window._testRequests.push(logRequest('GET', 'https://jsonplaceholder.typicode.com/posts/1'));
    fetch('https://jsonplaceholder.typicode.com/posts/1')
      .then(r => r.json())
      .then(data => console.log('GET response:', data));
    
    // POST request - create resource
    window._testRequests.push(logRequest('POST', 'https://jsonplaceholder.typicode.com/posts'));
    fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Network Test Post',
        body: 'This is a verification test for network request capture',
        userId: 123,
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
        'X-Test-Header': 'network-verification',
      },
    })
      .then(r => r.json())
      .then(data => console.log('POST response:', data));
    
    // PUT request - update resource
    window._testRequests.push(logRequest('PUT', 'https://jsonplaceholder.typicode.com/posts/1'));
    fetch('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 1,
        title: 'Updated Test Title',
        body: 'Updated test body text for verification',
        userId: 456,
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    })
      .then(r => r.json())
      .then(data => console.log('PUT response:', data));
    
    // DELETE request - delete resource
    window._testRequests.push(logRequest('DELETE', 'https://jsonplaceholder.typicode.com/posts/1'));
    fetch('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'DELETE',
    })
      .then(r => r.json())
      .then(data => console.log('DELETE response:', data));
      
    // PATCH request - partial update
    window._testRequests.push(logRequest('PATCH', 'https://jsonplaceholder.typicode.com/posts/1'));
    fetch('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Patched Title Only',
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    })
      .then(r => r.json())
      .then(data => console.log('PATCH response:', data));
    
    console.log('All test requests sent!');
  });
  
  // Wait for network requests to complete
  console.log('Waiting for network requests to complete...');
  await page.waitForTimeout(3000);
  
  // Extract request info from the page for verification
  const testRequests = await page.evaluate(() => window._testRequests || []);
  console.log(`Completed ${testRequests.length} test requests`);
  
  // Intentionally fail the test to trigger the debug report
  await test.step('intentional failure to generate debug report', async () => {
    console.log('⚠️ Intentionally failing test to generate debug report');
    throw new Error('EXPECTED FAILURE: This test fails intentionally to generate the AI debug report with network requests');
  });
});