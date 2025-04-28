# Playwright Vision AI Debugger Examples

This directory contains example integrations and demonstrations of how to use the Playwright Vision AI Debugger library in different scenarios.

## Available Examples

### Integration Examples

These files show different ways to integrate the AI debugger with your Playwright test suite:

- **simple-integration.ts**: The most straightforward one-line integration for basic test setups.
- **complex-setup-integration.ts**: Examples for more advanced test setups with custom fixtures.
- **consumer-integration.ts**: A real-world integration example with a customer project.
- **network-capture-integration.ts**: Focused example of how to capture network requests for AI analysis.

### Complete Examples

These directories contain complete, runnable examples:

- **[basic-test-example](./basic-test-example)**: A simple test setup that demonstrates AI debugging with network capture.

## How to Use These Examples

1. **For integration patterns**: Review the `.ts` files in this directory to understand different ways to integrate with your test framework.

2. **For runnable examples**: Navigate to the subdirectories (like `basic-test-example`) which contain complete, runnable test examples.

3. **For application in your project**: Copy and adapt the integration patterns that best match your project's structure and needs.

## Getting Started

The simplest way to get started is:

```typescript
// In your test setup file
import { test as baseTest } from '@playwright/test';
import { enhanceTestWithAiDebugging } from 'playwright-vision-ai-debugger';

// One-line integration
export const test = enhanceTestWithAiDebugging(baseTest);
export { expect } from '@playwright/test';
```

This gives you automatic network request capturing and AI debugging on test failures.