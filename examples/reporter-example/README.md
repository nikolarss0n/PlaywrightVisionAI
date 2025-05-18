# Playwright Vision AI - Super Simple Example

This example demonstrates how to use Playwright Vision AI with the simplest possible setup, showing how all network requests including API calls made with `page.request.*` methods are automatically captured.

## Key Features

- **ONE Line Setup**: Just ONE line needed to add AI debugging to your tests
- **Automatic Network Capture**: All network requests automatically captured - no extra code needed
- **Direct API Call Support**: API calls made with `page.request.*` methods are automatically captured
- **No Manual Tracking**: No need to manually track or store network requests
- **Error Handling**: Automatically analyzes API errors and test failures

## Centralized ONE Line Setup

This example uses a centralized setup through a fixtures file. This is the recommended approach for projects with multiple test files.

### 1. Create a fixtures.ts file

```typescript
// fixtures.ts
import { test as baseTest } from '@playwright/test';
import { enhanceTestWithAiDebugging } from '../../src/modules/core';

// SINGLE setup for all test files
export const test = enhanceTestWithAiDebugging(baseTest);
export { expect } from '@playwright/test';
```

### 2. Import the enhanced test in your test files

```typescript
// example.spec.ts
import { test, expect } from '../fixtures';

// Now use 'test' as you normally would - AI debugging included!
test('my test', async ({ page }) => {
  // Your test code...
});
```

This approach:
- Requires no additional base files or complex configuration
- Works with standard Playwright tests
- Automatically captures ALL network requests, including direct API calls
- Automatically handles AI analysis on test failures

## Making Direct API Calls

With automatic network capture, you can make direct API calls and they'll be automatically captured:

```typescript
test('example with direct API call', async ({ page }) => {
  // Make API call - automatically captured
  const response = await page.request.get('https://api.example.com/data');
  const data = await response.json();
  
  // That's it! No manual tracking needed
  
  // Continue with test...
  expect(data.status).toBe('success');
});
```

## Running the Example

```bash
# From the reporter-example directory
npx playwright test tests/super-simple.spec.ts
```

## Environment Variables

Set your API key in the `.env` file:

```
ANTHROPIC_API_KEY=your-claude-api-key
```

## Default Configuration

No configuration is required! All features are enabled by default:

- ✅ Automatic network request capture
- ✅ AI analysis of test failures
- ✅ Direct API call tracking
- ✅ Screenshots and error analysis

The defaults provide the best experience for most users - you don't need to configure or add anything else!