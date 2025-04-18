# Playwright Vision AI

Transforms Playwright test debugging with AI-powered visual analysis.

## What It Is

Playwright Vision captures screenshots, HTML, and error details when tests fail, then uses AI models to visually analyze what went wrong and suggest fixes.

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

### Configuration

1. Get a Google Gemini API key from the [Google AI Studio](https://makersuite.google.com/)
2. Add your API key to the `aiDebugger.ts` file or use environment variables

### Usage

Replace your Playwright test imports with the AI-enhanced version:

```typescript
// Instead of this:
// import { test, expect } from '@playwright/test';

// Use this:
import { test, expect } from './ai-test-base';

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

## Screenshots

![full_latest](https://github.com/user-attachments/assets/a1da4119-5631-46d4-8d15-d279f0ed3e04)

![image](https://github.com/user-attachments/assets/94daecc2-da56-4078-a537-49078f9663d6)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Feel free to fork, open issues, or submit pull requests.

## Acknowledgments

- [Playwright](https://playwright.dev/) for the amazing testing framework
- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the visual intelligence capabilities
