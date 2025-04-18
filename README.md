# Playwright Vision AI Debugger

Transforms Playwright test debugging with AI-powered visual analysis.

## What It Is

Playwright Vision AI Debugger captures screenshots, HTML, and error details when tests fail, then uses Google's Gemini 1.5 Pro Vision model to visually analyze what went wrong and suggest fixes.

## Key Features

- **Visual Element Detection**: Identifies UI elements in screenshots
- **Smart Selector Recommendations**: Suggests better selectors following Playwright best practices
- **Root Cause Analysis**: Explains why your tests failed in plain language
- **Network Request Analysis**: Examines API calls and XHR requests to identify backend issues
- **Beautiful Glass UI Reports**: Generates elegant HTML reports with detailed analysis
- **Token Optimization**: Cleans HTML to reduce token usage and minimize API costs
- **Test Code Context**: Includes the failing test code for better debugging context

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
import { runAiDebuggingAnalysis } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Extend base test with AI debugging
export const test = baseTest.extend({
  // Your custom fixtures here
});

// Add a global hook for failed tests
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'failed' && testInfo.error) {
    await runAiDebuggingAnalysis(page, testInfo, testInfo.error);
  }
});
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

The AI analysis includes:
- Screenshot analysis with element identification
- Better locator suggestions
- Failure explanation
- Network request analysis (API calls, XHR requests)
- Test code improvement suggestions

## Example Output

When a test fails, you'll see detailed AI analysis in your test report:

![full_latest](https://github.com/user-attachments/assets/a1da4119-5631-46d4-8d15-d279f0ed3e04)

![image](https://github.com/user-attachments/assets/94daecc2-da56-4078-a537-49078f9663d6)

## API Reference

The package exports the following:

### `runAiDebuggingAnalysis(page, testInfo, error)`

The main function that orchestrates the AI debugging analysis process.

Parameters:
- `page`: Playwright Page object
- `testInfo`: Playwright TestInfo object
- `error`: Error object from the failed test

### `AiDebuggingResult`

Interface for type hinting in consuming projects.

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

This project is licensed under the ISC License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Feel free to fork, open issues, or submit pull requests.

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing testing framework
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the visual intelligence capabilities
