# Basic Test Example with AI Debugging

This example demonstrates how to set up a simple test base that integrates Playwright Vision AI debugging capabilities.

## Files

- `ai-test-base.ts`: A reusable test base that sets up network capture and automatic AI debugging when tests fail.
- `my-feature.spec.ts`: An example test that demonstrates a failure scenario where the AI debugger will be triggered.

## How It Works

1. The test base (`ai-test-base.ts`) extends Playwright's default test object with:
   - Automatic network request capturing
   - AI debugging analysis on test failures
   - Proper cleanup of resources

2. The test file (`my-feature.spec.ts`) intentionally creates a scenario where an API response is modified, causing the test to fail. This demonstrates how the AI debugger can help identify network-related issues.

## Running the Example

To run this example:

```bash
npx playwright test examples/basic-test-example/my-feature.spec.ts
```

This will run the test, which will fail, triggering the AI debugger to analyze the failure and provide insights into what went wrong.

## Expected Output

After the test fails, the AI debugger will:
1. Capture the test context (HTML, screenshot, network requests)
2. Analyze the failure with AI
3. Generate an HTML report with debugging insights
4. Attach the report to the test results