import { test as baseTest, expect, Page, TestInfo } from '@playwright/test';
import {
  callDebuggingAI,
  MODEL_NAME,
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox
} from './aiDebugger.ts';
import { extractSelectorFromError } from './errorUtils';

// Define the shape of the AI analysis input
interface AiAnalysisInput {
  html?: string;
  screenshotBase64?: string;
  errorMsg: string;
  stackTrace?: string;
  failingSelector?: string;
  testTitle?: string;
}

// Extend the base test object
export const test = baseTest.extend<{ aiEnhancedPage: Page }>({

  // Define an afterEach hook
  async page({ page }, use, testInfo: TestInfo) {
    // Run the test using the original page fixture
    await use(page);

    // --- This code runs AFTER the test body has finished ---
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      if (testInfo.error && !page.isClosed()) {
        try {
          // --- Log Context Gathering Boxes ---
          let contextLogLines: string[] = [`Status: Gathering context for AI analysis...`];

          const startTime = Date.now();
          const html = await page.content();
          const screenshotBuffer = await page.screenshot({ fullPage: true });
          const screenshotBase64 = screenshotBuffer.toString('base64');
          const errorMsg = testInfo.error.message || 'No error message';
          const stackTrace = testInfo.error.stack;
          const contextTime = Date.now() - startTime;
          const failingSelector = extractSelectorFromError(testInfo.error);

          contextLogLines.push(`Status: Context captured in ${contextTime}ms.`);
          contextLogLines.push(`Failing Selector: ${failingSelector || 'Extraction failed or N/A'}`);
          contextLogLines.push(`HTML Length: ${html?.length ?? 'N/A'}`);
          contextLogLines.push(`Screenshot Length: ${screenshotBase64?.length ?? 'N/A'}`);

          // --- End Context Gathering Boxes ---


          // Prepare AI Input
          const aiInput: AiAnalysisInput = {
            html,
            screenshotBase64,
            errorMsg,
            stackTrace,
            failingSelector,
            testTitle: testInfo.title,
          };

          // --- End Context Gathering Boxes ---

          // ****** Add await back here ******
          await callDebuggingAI(aiInput)
            .then(async suggestions => {
              const aiAnalysisResult = suggestions || wrapTextInBox("AI analysis returned empty.", 4); // You have the result here
              // Decide if you need the extra delay from the original code
              await new Promise(resolve => setTimeout(resolve, 1500));
              if (testInfo.error) { // Check if error object exists
                const separator = "\n\n" + SEPARATOR + "\n" + createCenteredHeader(" AI Debugging Analysis ") + "\n" + SEPARATOR + "\n\n";
                // Make sure stack exists, initialize if not (though it should if error exists)
                testInfo.error.stack = (testInfo.error.stack || '') + separator + aiAnalysisResult;
              }
            })
            .catch(aiError => {
              const aiErrorBox = `
                ${TOP_BORDER}
                ${createCenteredHeader("⚠️ AI Analysis Error ⚠️")}
                ${SEPARATOR}
                ${wrapTextInBox(`Error calling AI: ${aiError?.message || aiError}`)}
                ${BOTTOM_BORDER}
                `;

              console.log(aiErrorBox)
            });

        } catch (captureError: any) {
          // --- Log Capture Error Box ---
          const captureErrorBox = `
            ${TOP_BORDER}
            ${createCenteredHeader("⚠️ Context Capture Error ⚠️")}
            ${SEPARATOR}
            ${wrapTextInBox(`Failed to capture context or prepare AI input.`)}
            ${wrapTextInBox(`Error: ${captureError?.message || captureError}`)}
            ${BOTTOM_BORDER}
            `;
          console.error(captureErrorBox, captureError);
        }
      } else if (page.isClosed()) {
        // --- Log Page Closed Warning Box ---
        const pageClosedBox = `...`;
        console.warn(pageClosedBox);
      } else {
        // --- Log No Error Object Warning Box ---
        const noErrorBox = `...`;
        console.warn(noErrorBox);
      }
    }
  }
});

export { expect } from '@playwright/test';