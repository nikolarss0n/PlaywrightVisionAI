# Playwright Vision AI Debugger

Transforms Playwright test debugging with AI-powered visual analysis.

## What It Is

Playwright Vision AI Debugger captures screenshots, HTML, and error details when tests fail, then uses Google's Gemini 1.5 Pro Vision model to visually analyze what went wrong and suggest fixes.

## Key Features

- **Visual Element Detection**: Identifies UI elements in screenshots
- **Smart Selector Recommendations**: Suggests better selectors following Playwright best practices
- **Root Cause Analysis**: Explains why your tests failed in plain language
- **Comprehensive Network Analysis**: Captures and analyzes all network requests including API calls, XHR, fetch requests, headers, request/response bodies, and more
- **Beautiful Glass UI Reports**: Generates elegant HTML reports with detailed analysis
- **Token Optimization**: Cleans HTML to reduce token usage and minimize API costs
- **Test Code Context**: Includes the failing test code for better debugging context
- **Terminal-Style UI Option**: Modern terminal-inspired interface for more intuitive debugging
- **Enhanced Test Integration**: Simplified one-line integration with complex test setups
- **Flexible Model Selection**: Support for all Gemini models with vision capabilities
- **Automatic Network Request Capture**: Built-in utilities to capture and analyze network traffic

## Installation

### From NPM

```bash
# Install the package and its peer dependencies
npm install playwright-vision-ai-debugger @playwright/test dotenv
```

### Local Development & Linking

If you're working on this package locally or want to use it before publishing to npm:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/playwright-vision-ai-debugger.git
   cd playwright-vision-ai-debugger
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the package:**
   ```bash
   npm run build
   ```

4. **Link the package globally:**
   ```bash
   npm link
   ```

5. **In your test project, link to the package:**
   ```bash
   cd /path/to/your/test/project
   npm link playwright-vision-ai-debugger
   npm install dotenv @playwright/test # if not already installed
   ```

## Setup

1. **Get a Google Gemini API Key:**
   - Visit [Google AI Studio](https://makersuite.google.com/) and create an API key
   - Create a `.env` file in your project root with:
     ```
     GEMINI_API_KEY=your-api-key-here
     GEMINI_MODEL_NAME=gemini-1.5-pro-latest  # Optional: Change the AI model
     ```
   - Available models (any Gemini model with vision capabilities works):
     - `gemini-1.5-pro-latest` (default) - Latest Pro model with best capabilities
     - `gemini-1.5-flash-latest` - Faster and lower cost
     - `gemini-1.5-pro-vision` - Specialized vision model
     - `gemini-pro-vision` - 1.0 vision model
     - Other Gemini models with vision capabilities

2. **Install dotenv:**
   ```bash
   npm install dotenv
   ```

3. **Configure Your Tests:**
   - Create or update your Playwright test base file:

```typescript
// tests/base.ts
import { test as baseTest } from '@playwright/test';
import { setupAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Option 1: Simple setup - use the built-in setupAiDebugging function
export const test = setupAiDebugging(baseTest);
export { expect } from '@playwright/test';

// Option 2: Advanced setup with custom configuration
/*
// Extend base test with tracing for better debugging
export const test = baseTest.extend({
  // Enable tracing for all tests
  context: async ({ context }, use, testInfo) => {
    // Start tracing before using the context
    await context.tracing.start({
      screenshots: true,
      snapshots: true, 
      sources: true
    });
    
    await use(context);
    
    // After the test runs, stop tracing and save to a file if test failed
    if (testInfo.status !== 'passed') {
      await context.tracing.stop({
        path: testInfo.outputPath('trace.zip')
      });
    } else {
      await context.tracing.stop();
    }
  }
});

// Set up AI debugging with the configured test
export const test = setupAiDebugging(test);
export { expect } from '@playwright/test';
*/
```

## Integration with Complex Test Setups

If you have a complex test setup with custom fixtures, page objects, or other extensions, you can use these approaches:

### Method 1: Using the Enhanced setupAiDebugging Function (Recommended)

As of version 1.3.0+, the `setupAiDebugging` function has been improved to handle complex test setups:

```typescript
// tests/base.ts
import { test as baseTest } from './your-existing-test-setup'; // Your existing test with fixtures
import { setupAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// The enhanced setupAiDebugging function will work with most complex test setups
export const test = setupAiDebugging(baseTest);

// Re-export everything else from your original test setup
export * from './your-existing-test-setup';
```

### Method 2: Using the New enhanceTestWithAiDebugging Function

The new one-line integration method makes it even easier to add AI debugging to your tests:

```typescript
// tests/base.ts
import { test as baseTest } from './your-existing-test-setup';
import { enhanceTestWithAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// One-line integration with your existing test setup
export const test = enhanceTestWithAiDebugging(baseTest);

// Re-export everything else
export * from './your-existing-test-setup';
```

### Method 3: Direct afterEach Hook Integration

If the above methods don't work with your test setup, you can use this more direct approach:

```typescript
// tests/ai-base.ts
import { test as baseTest } from './your-existing-test-setup';
import { runAiDebuggingAnalysis } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Add AI debugging through an afterEach hook
baseTest.afterEach(async ({ page, customPage }, testInfo) => {
  // Only run AI debugging for failed tests
  if (testInfo.status === 'failed' && testInfo.error) {
    try {
      // Convert the error to ensure it has the right properties
      const error = testInfo.error instanceof Error
        ? testInfo.error
        : new Error(String(testInfo.error));
      
      // Use whichever page object is available in your fixtures
      const pageToUse = customPage || page;
      
      // Run the AI debugging analysis
      await runAiDebuggingAnalysis(pageToUse, testInfo, error);
    } catch (e) {
      console.error('Error in AI debugging:', e);
    }
  }
});

// Export your test with AI debugging capabilities
export const test = baseTest;

// Re-export everything else
export * from './your-existing-test-setup';
```

## Network Request Capture

You can use the built-in network capture utilities to analyze network traffic in your tests:

```typescript
// tests/network-base.ts
import { test as baseTest } from '@playwright/test';
import { setupNetworkCapture } from 'playwright-vision-ai-debugger';

export const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    // Set up network capture
    const { networkRequests, teardown } = setupNetworkCapture(page);
    
    await use(page);
    
    // Access captured network requests after the test
    console.log(`Captured ${networkRequests.length} network requests`);
    
    // Clean up
    teardown();
  }
});

export { expect } from '@playwright/test';
```

## Usage

Now, import your extended test in your test files:

```typescript
// tests/my-test.spec.ts
import { test } from './base';
import { expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('text=Non-existent button');  // This will fail
  expect(await page.isVisible('.some-selector')).toBeTruthy();
});
```

When tests fail, the AI debugging report will be attached to the test report:

```bash
# Run your tests
npx playwright test
```

## Viewing Reports

After running your tests:

1. Open the Playwright HTML report
   ```bash
   npx playwright show-report
   ```
2. Click on a failed test
3. Find the "ai-debug-analysis.html" attachment
4. Click to view the AI analysis report

You can also find report files in two locations:
- **Terminal-style reports**: `debug-html-reports/ai-debug-analysis-[timestamp].html`
- **Classic reports**: `test-output/ai-debug-analysis.html`

The AI analysis includes:
- Screenshot analysis with element identification
- Better locator suggestions
- Failure explanation
- Network request analysis (API calls, XHR requests)
- Test code improvement suggestions

## Example Output

When a test fails, you'll see detailed AI analysis in your test report:

### Terminal-Style Report
Our new terminal-inspired interface design makes debugging more intuitive:

![terminal_style_report](https://github.com/user-attachments/assets/a1da4119-5631-46d4-8d15-d279f0ed3e04)

### Classic Glass Effect UI
The original glass-effect design is still available:

![classic_glass_ui](https://github.com/user-attachments/assets/94daecc2-da56-4078-a537-49078f9663d6)

## API Reference

The package exports the following:

### `setupAiDebugging(testInstance)`

Sets up AI debugging for a Playwright test instance.

Parameters:
- `testInstance`: Playwright Test object

Returns:
- Enhanced test object with AI debugging capabilities

### `enhanceTestWithAiDebugging(testInstance)`

New one-line integration method for adding AI debugging to any test setup.

Parameters:
- `testInstance`: Playwright Test object

Returns:
- Enhanced test object with AI debugging capabilities

### `runAiDebuggingAnalysis(page, testInfo, error, existingNetworkRequests?)`

The main function that orchestrates the AI debugging analysis process.

Parameters:
- `page`: Playwright Page object
- `testInfo`: Playwright TestInfo object
- `error`: Error object from the failed test
- `existingNetworkRequests`: (Optional) Array of already captured network requests

### `setupNetworkCapture(page)`

Sets up network request capture for a Playwright page.

Parameters:
- `page`: Playwright Page object

Returns:
- Object containing networkRequests array and teardown function

### Network Utilities

- `setupAutomaticNetworkCapture(page)`: Automatically captures network requests
- `getCapturedNetworkRequests()`: Returns captured network requests

## Requirements

- Node.js 16 or higher
- Playwright Test 1.30.0 or higher
- A Google Gemini API key

## Troubleshooting

### Module Not Found Errors

If you encounter "Cannot find module 'playwright-vision-ai-debugger'" errors when using npm link:

1. Make sure you've built the package with `npm run build`
2. Verify the link is correctly set up by checking node_modules:
   ```bash
   ls -la node_modules/playwright-vision-ai-debugger
   ```
   It should be a symbolic link to your package directory
3. Try unlinking and relinking:
   ```bash
   npm unlink playwright-vision-ai-debugger
   # In the package directory
   npm unlink
   npm link
   # Back in your test project
   npm link playwright-vision-ai-debugger
   ```

### API Key and Model Selection

If you see "Configuration Error: GEMINI_API_KEY is not set":

1. Make sure your `.env` file is in the root of your project
2. Verify it contains `GEMINI_API_KEY=your-actual-key`
3. Make sure you're importing and configuring dotenv before using the package:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

To change the AI model:
1. Add `GEMINI_MODEL_NAME` to your `.env` file:
   ```
   GEMINI_MODEL_NAME=gemini-1.5-flash-latest
   ```
2. You can use any Gemini model with vision capabilities:
   - `gemini-1.5-pro-latest` (default) - Latest Pro model with best capabilities
   - `gemini-1.5-flash-latest` - Faster analysis, lower cost
   - `gemini-1.5-pro-vision` - Specialized vision model
   - `gemini-pro-vision` - 1.0 vision model
   - Any other Gemini model with multimodal/vision support

3. The pricing will automatically adjust based on the model you select.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Feel free to fork, open issues, or submit pull requests.

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing testing framework
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the visual intelligence capabilities
