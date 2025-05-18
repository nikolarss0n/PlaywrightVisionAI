# Playwright Vision AI Debugger

Transforms Playwright test debugging with AI-powered visual analysis.

## What It Is

Playwright Vision AI Debugger captures screenshots, HTML, and error details when tests fail, then uses advanced AI models (Google's Gemini and Anthropic's Claude) to visually analyze what went wrong and suggest fixes.

## Key Features

- **Visual Element Detection**: Identifies UI elements in screenshots
- **Smart Selector Recommendations**: Suggests better selectors following Playwright best practices
- **Root Cause Analysis**: Explains why your tests failed in plain language
- **Comprehensive Network Analysis**: Captures and analyzes all network requests including API calls, XHR, fetch requests, headers, request/response bodies, and more
- **Beautiful Glass UI Reports**: Generates elegant HTML reports with detailed analysis
- **Token Optimization**: Cleans HTML to reduce token usage and minimize API costs
- **Test Code Context**: Includes the failing test code for better debugging context
- **Terminal-Style UI Option**: Modern terminal-inspired interface for more intuitive debugging
- **One-Line Integration**: Ultra-simple one-line setup for hassle-free integration
- **Multi-Model Analysis**: Support for both Google's Gemini and Anthropic's Claude models
- **Video Frame Extraction**: Advanced video processing to extract key frames for more efficient analysis
- **Model Fallback**: Graceful fallback between models if one fails or hits rate limits
- **Automatic Network Request Capture**: Built-in utilities to capture and analyze network traffic

## Simple Example

Check out the [reporter-example](./examples/reporter-example) for a minimal implementation showing how to integrate Playwright Vision AI Debugger with just one line of code.

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

### Simple One-Line Setup (Recommended)

The simplest way to add AI debugging to your tests is with our one-line setup:

1. **Install the package:**
   ```bash
   npm install playwright-vision-ai-debugger
   ```

2. **Create a test base file:**
   ```typescript
   // tests/base.ts
   import { createAiTest } from 'playwright-vision-ai-debugger';
   export const test = createAiTest();
   export { expect } from '@playwright/test';
   ```

3. **Use in your tests:**
   ```typescript
   // tests/example.spec.ts
   import { test, expect } from './base';
   
   test('my test', async ({ page }) => {
     await page.goto('https://example.com');
     // Your test code here
   });
   ```

4. **Add your API key(s):**
   Create a `.env` file in your project root with either (or both) API keys:
   ```
   # Choose one or both:
   GEMINI_API_KEY=your-gemini-api-key-here
   ANTHROPIC_API_KEY=your-claude-api-key-here
   
   # Optional: Set your preferred model
   DEFAULT_AI_PROVIDER=gemini  # Options: gemini, claude, both
   ```
   
   Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/)
   Get your Claude API key from [Anthropic Console](https://console.anthropic.com/)

That's it! When a test fails, you'll get AI-powered analysis automatically.

### Adding AI Debugging to Existing Custom Test Setup

If you already have a custom test setup with fixtures, use this approach:

```typescript
// tests/base.ts
import { test as baseTest } from '@playwright/test';
import { addAiDebugging } from 'playwright-vision-ai-debugger';

// Your existing test setup
const myCustomTest = baseTest.extend({
  // Your custom fixtures here
});

// Add AI debugging to your custom test
export const test = addAiDebugging(myCustomTest);
export { expect } from '@playwright/test';
```

### Advanced Configuration Options

For more control, you can configure the behavior in your test setup or set environment variables:

#### Configuration via Code

```typescript
// tests/multi-model-base.ts
import { createAiTest } from 'playwright-vision-ai-debugger';

export const test = createAiTest({
  // AI Provider options
  aiProvider: 'both',                // 'gemini', 'claude', or 'both'
  preferredModel: 'claude',          // Which model's results to prioritize
  fallbackToSecondaryModel: true,    // Use secondary model if primary fails
  
  // Video processing options (especially for Claude)
  useVideoFrames: true,              // Extract frames instead of using full video
  maxFrames: 5,                      // Maximum number of frames to extract
  frameInterval: 0,                  // 0 = extract at key moments
  
  // Core options
  runOnlyOnFailure: true,            // Only run AI analysis on test failures
  includeNetworkCapture: true,       // Include network requests in analysis
  openReportAutomatically: true,     // Open report in browser when generated
});

export { expect } from '@playwright/test';
```

#### Configuration via Environment Variables

Set these in your `.env` file:

```
# API Keys
GEMINI_API_KEY=your-gemini-api-key-here
ANTHROPIC_API_KEY=your-claude-api-key-here

# Model Configuration
DEFAULT_AI_PROVIDER=both         # Options: gemini, claude, both
PREFERRED_AI_MODEL=claude        # Options: gemini, claude
GEMINI_MODEL_NAME=gemini-1.5-pro-latest  # Specific Gemini model
CLAUDE_MODEL=claude-3-opus-20240229      # Specific Claude model

# Video Processing
USE_VIDEO_FRAMES=true            # Extract frames instead of using full video
MAX_VIDEO_FRAMES=5               # Maximum number of frames to extract
VIDEO_FRAME_INTERVAL=0           # 0 = extract at key moments
```

#### Available Models

**Gemini Models**:
- `gemini-1.5-pro-latest` (default) - Latest Pro model with best capabilities
- `gemini-1.5-flash-latest` - Faster and lower cost
- `gemini-1.5-pro-vision` - Specialized vision model
- `gemini-pro-vision` - 1.0 vision model
- Other Gemini models with vision capabilities

**Claude Models**:
- `claude-3-opus-20240229` (default) - Highest capability model
- `claude-3-sonnet-20240229` - Balance of intelligence and speed
- `claude-3-haiku-20240307` - Fastest, most cost-effective model
- Other Claude models with vision capabilities

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

<img width="1214" alt="Screenshot 2025-05-01 at 15 11 04" src="https://github.com/user-attachments/assets/9f20bc18-395c-4026-bec3-5a46b7935b68" />

## Using the Playwright Vision Reporter

In addition to the test fixture integration, you can use the Playwright Vision Reporter directly in your Playwright configuration. This allows AI-powered test analysis to work with any test, without modifying your test code.

### Reporter Setup

1. **Configure in your playwright.config.ts file:**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // Reporter configuration
  reporter: [
    ['html'],
    ['list'],
    // Use the Vision Reporter
    ['playwright-vision-ai-debugger/reporter', {
      outputDir: 'playwright-vision-reports',
      aiProvider: 'claude',
      openReportAutomatically: true,
      maxScreenshots: 5
    }]
  ],
  
  // Enable tracing for test failures (required for the reporter)
  use: {
    trace: 'on',
    screenshot: 'only-on-failure'
  }
});
```

2. **Make sure your API keys are set in your environment:**

```
GEMINI_API_KEY=your-gemini-api-key-here
ANTHROPIC_API_KEY=your-claude-api-key-here
```

### How It Works

The Vision Reporter:
1. Automatically attaches to failed tests
2. Extracts data from Playwright traces (screenshots, HTML, network requests)
3. Analyzes test failures with AI
4. Generates comprehensive HTML reports
5. Optionally opens the reports in your browser

### Reporter Options

The reporter accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | string | 'playwright-vision-reports' | Directory where reports will be saved |
| `aiProvider` | 'claude' \| 'gemini' \| 'both' | 'claude' | Which AI provider to use for analysis |
| `openReportAutomatically` | boolean | true | Whether to open reports in browser after generation |
| `maxScreenshots` | number | 5 | Maximum number of screenshots to extract from traces |

### Benefits of Using the Reporter

- **Zero Code Changes**: Works with your existing tests without modification
- **Automatic Trace Analysis**: Extracts and analyzes trace data after test runs
- **Comprehensive Reporting**: Creates detailed reports with AI insights for all test failures
- **Easy Integration**: Just add to your Playwright config - no need to modify test files

## API Reference

The package exports the following:

### Test Integration API

#### `setupAiDebugging(testInstance)`

Sets up AI debugging for a Playwright test instance.

Parameters:
- `testInstance`: Playwright Test object

Returns:
- Enhanced test object with AI debugging capabilities

#### `enhanceTestWithAiDebugging(testInstance)`

New one-line integration method for adding AI debugging to any test setup.

Parameters:
- `testInstance`: Playwright Test object

Returns:
- Enhanced test object with AI debugging capabilities

#### `runAiDebuggingAnalysis(page, testInfo, error, existingNetworkRequests?)`

The main function that orchestrates the AI debugging analysis process.

Parameters:
- `page`: Playwright Page object
- `testInfo`: Playwright TestInfo object
- `error`: Error object from the failed test
- `existingNetworkRequests`: (Optional) Array of already captured network requests

### Reporter API

#### `VisionReporter`

Playwright reporter that analyzes test failures with AI.

Options:
- `outputDir`: Directory where reports will be saved
- `aiProvider`: Which AI provider to use ('claude', 'gemini', or 'both')
- `openReportAutomatically`: Whether to open reports automatically
- `maxScreenshots`: Maximum number of screenshots to include

### Network Utilities

#### `setupNetworkCapture(page)`

Sets up network request capture for a Playwright page.

Parameters:
- `page`: Playwright Page object

Returns:
- Object containing networkRequests array and teardown function

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

### API Keys and Model Selection

If you see API key errors:

1. Make sure your `.env` file is in the root of your project
2. Verify it contains the appropriate API keys:
   ```
   GEMINI_API_KEY=your-actual-gemini-key
   ANTHROPIC_API_KEY=your-actual-claude-key
   ```
3. The package auto-loads environment variables, but you can also do it manually:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

#### Changing AI Models

##### Using Environment Variables:
```
# Select the AI provider
DEFAULT_AI_PROVIDER=both         # Options: gemini, claude, both
PREFERRED_AI_MODEL=claude        # Which model to prioritize when using 'both'

# Specific model selection
GEMINI_MODEL_NAME=gemini-1.5-flash-latest
CLAUDE_MODEL=claude-3-sonnet-20240229
```

##### Using Code Configuration:
```typescript
const test = createAiTest({
  aiProvider: 'both', 
  preferredModel: 'claude'
});
```

#### Video Frame Extraction for Claude

Claude doesn't support direct video analysis like Gemini does. The package automatically extracts key frames from videos for Claude analysis:

```typescript
const test = createAiTest({
  aiProvider: 'claude',
  useVideoFrames: true,  // Enabled by default for Claude
  maxFrames: 8          // Extract up to 8 key frames
});
```

Or via environment variables:
```
USE_VIDEO_FRAMES=true
MAX_VIDEO_FRAMES=8
```

#### Pricing Considerations

- The pricing automatically adjusts based on the models you select
- Using frame extraction for Claude can reduce token usage compared to sending full videos to Gemini
- Using 'both' will increase costs but provide more comprehensive analysis

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Feel free to fork, open issues, or submit pull requests.

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing testing framework
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the visual intelligence capabilities
- [Anthropic Claude](https://www.anthropic.com/claude) for advanced multimodal analysis capabilities
