# Playwright AI Overlay

An open-source tool that transforms Playwright test debugging with AI-powered visual analysis.

## What It Is

Playwright AI Overlay captures screenshots, HTML, and error details when tests fail, then uses Gemini 1.5 to visually analyze what went wrong and suggest fixes.

## Key Features

1. **Visual Element Detection**: Identifies UI elements in screenshots
2. **Smart Selector Recommendations**: Suggests better selectors following Playwright best practices
3. **Root Cause Analysis**: Explains why your tests failed in plain language
4. **Markdown-Formatted Results**: Integrates cleanly into your test reports
5. **Token Optimization**: Cleans HTML to reduce token usage and minimize API costs

## Implementation Highlights

The main components:
- A test base extension that captures context on failure
- Integration with Google's Generative AI
- Clean error presentation with formatted boxes
- HTML optimization to reduce token usage and API costs

## Getting Started

### Prerequisites

- Node.js 16 or higher
- Playwright Test setup
- Google Gemini API key

### Installation

```bash
npm install playwright-ai-overlay
```

### Configuration

1. Get a Google Gemini API key from the [Google AI Studio](https://makersuite.google.com/)
2. Add your API key to the `aiDebugger.ts` file or use environment variables

### Usage

Replace your Playwright test imports with the AI-enhanced version:

```typescript
// Instead of this:
// import { test, expect } from '@playwright/test';

// Use this:
import { test, expect } from 'playwright-ai-overlay';

// Write tests as normal
test('my test', async ({ page }) => {
  // Your test code
});
```

When a test fails, the AI overlay will:
1. Capture a screenshot and HTML
2. Clean HTML to reduce token usage
3. Send the optimized context to Gemini AI
4. Add detailed analysis to your test report

## Example Output

When a test fails, you'll see detailed AI analysis in your test report:

```
### 🎯 Element Identification
The test was trying to interact with an API link in the navigation menu, which appears in the top part of the page.

### ✨ Suggested Locators
1. **User-Facing:** `page.getByRole('link', { name: 'API' })`
2. **CSS:** `page.locator('nav >> text=API')`
3. **XPath:** `page.locator('//a[contains(text(),"API")]')`

### ❓ Failure Explanation
The element might not have been visible within the timeout period (3000ms). This could be due to page loading time, animation effects, or the element being located in a dropdown that needs to be opened first.
```

## Screenshots

Screenshots of the implementation and results will be added soon!

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Feel free to fork, open issues, or submit pull requests.

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing testing framework
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the visual intelligence capabilities