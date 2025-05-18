// Import the enhanced test and expect from our centralized fixtures
import { test, expect } from '../fixtures';

test('should fail with API call comparison', async ({ page }) => {
  // Go to JSONPlaceholder API demo site for context
  await page.goto('https://jsonplaceholder.typicode.com/');
  
  // Make multiple API calls - all automatically captured in trace
  // First API call
  const response1 = await page.request.get('https://jsonplaceholder.typicode.com/posts/1');
  const data1 = await response1.json();
  console.log('First post title:', data1.title);
  
  // Second API call
  const response2 = await page.request.get('https://jsonplaceholder.typicode.com/posts/2');
  const data2 = await response2.json();
  console.log('Second post title:', data2.title);
  
  // Comparison that will fail on purpose to see AI analysis
  expect(data1.title).toBe(data2.title, 'The two posts should have the same title');
});