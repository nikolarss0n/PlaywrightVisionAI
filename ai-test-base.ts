import { test as baseTest, expect, Page, TestInfo } from '@playwright/test';
import { marked } from 'marked';
import {
  callDebuggingAI,
  AiDebuggingResult,
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox,
} from './aiDebugger';
import { extractSelectorFromError } from './errorUtils';

interface AiAnalysisInput {
  html?: string;
  screenshotBase64?: string;
  errorMsg: string;
  stackTrace?: string;
  failingSelector?: string;
  testTitle?: string;
}

function escapeHtml(unsafe: string | undefined | null): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
        let aiAnalysisResult: AiDebuggingResult | null = null; // To store AI result
        let aiAnalysisHtml: string = '<p>AI Analysis could not be performed.</p>'; // Default HTML content
        let usageInfoHtml: string = ''; // Default usage HTML

        try {
          // --- Context Gathering ---
          console.log(`\n${TOP_BORDER}`);
          console.log(createCenteredHeader("🤖 AI Debugging Assistant Activated 🤖"));
          console.log(`${SEPARATOR}`);
          console.log(`Test Failed: "${testInfo.title}"`);
          console.log(`Status: ${testInfo.status}`);
          console.log(`Duration: ${testInfo.duration}ms`);
          console.log(`${SEPARATOR}`);
          console.log("Gathering context for analysis...");

          const startTime = Date.now();
          let html: string | undefined;
          let screenshotBase64: string | undefined;
          let errorMsg: string;
          let stackTrace: string | undefined;
          let failingSelector: string | null | undefined;

          // Capture HTML content
          try {
            html = await page.content();
            console.log("✅ HTML content captured.");
          } catch (htmlError: any) {
            console.warn(`⚠️ Could not capture HTML content: ${htmlError.message}`);
            html = `Error capturing HTML: ${htmlError.message}`;
          }

          // Capture Screenshot
          try {
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            screenshotBase64 = screenshotBuffer.toString('base64');
            console.log("✅ Screenshot captured.");
          } catch (screenshotError: any) {
            console.warn(`⚠️ Could not capture screenshot: ${screenshotError.message}`);
            screenshotBase64 = undefined; // Indicate screenshot failed
          }

          // Extract Error Details
          errorMsg = testInfo.error.message || 'No error message provided.';
          stackTrace = testInfo.error.stack;
          failingSelector = extractSelectorFromError(testInfo.error); // Use the utility function

          const contextTime = Date.now() - startTime;
          console.log(`✅ Context gathered in ${contextTime}ms.`);
          console.log(`Failing Selector (extracted): ${failingSelector || 'N/A'}`);
          console.log(`${SEPARATOR}`);
          // --- End Context Gathering ---

          // --- Prepare AI Input ---
          const aiInput: AiAnalysisInput = {
            html: html,
            screenshotBase64: screenshotBase64,
            errorMsg: errorMsg,
            stackTrace: stackTrace,
            failingSelector: failingSelector || undefined,
            testTitle: testInfo.title,
          };

          // --- Call AI *BEFORE* Generating HTML Report ---
          console.log("🧠 Calling AI for analysis...");
          const aiStartTime = Date.now();
          aiAnalysisResult = await callDebuggingAI(aiInput);
          const aiEndTime = Date.now();
          console.log(`✅ AI analysis completed in ${aiEndTime - aiStartTime}ms.`);

          // --- Prepare AI Content for HTML ---
          if (aiAnalysisResult?.errorMarkdown) {
            console.error("AI Analysis Error:", aiAnalysisResult.errorMarkdown);
            aiAnalysisHtml = marked.parse(aiAnalysisResult.errorMarkdown) as string;
          } else if (aiAnalysisResult?.analysisMarkdown) {
            aiAnalysisHtml = marked.parse(aiAnalysisResult.analysisMarkdown) as string;
          } else {
            aiAnalysisHtml = '<p>AI analysis returned no content.</p>';
          }

          // Prepare Usage Info HTML (optional)
          if (aiAnalysisResult?.usageInfoMarkdown) {
            usageInfoHtml = marked.parse(aiAnalysisResult.usageInfoMarkdown) as string;
          }

          // --- Generate Final HTML Report ---
          const reportTitle = `AI Debug Analysis: ${escapeHtml(testInfo.title)}`;
          const glassmorphismHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${reportTitle}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    /* --- Your existing CSS styles --- */
                    .glass-effect {
                        background: rgba(0, 0, 0, 0.55); /* Example adjustment */
                        backdrop-filter: blur(16px) saturate(150%);
                        -webkit-backdrop-filter: blur(16px) saturate(150%);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
                        position: relative;
                        z-index: 1;
                        color: #e5e7eb; /* Default light text */
                    }
                    /* Add styles for rendered Markdown if needed */
                    .ai-content-area h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #f9fafb; }
                    .ai-content-area p { margin-bottom: 0.75rem; line-height: 1.6; }
                    .ai-content-area code { background-color: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 3px 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 0.9em; border: 1px solid rgba(255, 255, 255, 0.2); color: #93c5fd; }
                    .ai-content-area pre code { display: block; white-space: pre; padding: 0.5rem; } /* Adjust if needed */
                    .ai-content-area strong { font-weight: 600; color: #dbeafe; }
                    .ai-content-area ul, .ai-content-area ol { margin-left: 1.5rem; margin-bottom: 1rem; list-style: revert; }
                    .ai-content-area li { margin-bottom: 0.25rem; }
                    .ai-content-area hr { border-color: rgba(255, 255, 255, 0.2); margin-top: 1rem; margin-bottom: 1rem; }
                    .ai-content-area table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
                    .ai-content-area th, .ai-content-area td { border: 1px solid rgba(255, 255, 255, 0.3); padding: 0.5rem; text-align: left; }
                    .ai-content-area th { background-color: rgba(255, 255, 255, 0.1); font-weight: 600; }
                    .ai-content-area details { background-color: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5rem; margin-bottom: 1rem;}
                    .ai-content-area summary { cursor: pointer; font-weight: 500; }

                    /* --- Include other styles (Lucide, body, body::before, etc.) --- */
                    @font-face { font-family: 'LucideIcons'; src: url(https://cdn.jsdelivr.net/npm/lucide-static@0.473.0/font/lucide.ttf) format('truetype'); }
                    .lucide { font-family: 'LucideIcons'; font-size: 1.2em; line-height: 1; vertical-align: middle; margin-right: 0.5em; }
                    .lucide-clipboard-list::before { content: "\\e888"; color: #a5b4fc; }
                    .lucide-search::before { content: "\\ec2a"; color: #7dd3fc; }
                    .lucide-lightbulb::before { content: "\\eb1f"; color: #fbbf24; }
                    .lucide-alert-triangle::before { content: "\\e6c7"; color: #f87171; }
                    .lucide-brain-circuit::before { content: "\\ed94"; color: #86efac; } /* Example for AI */
                    .lucide-bar-chart-big::before { content: "\\e7e8"; color: #facc15; } /* Example for Usage */

                    body { font-family: 'Inter', sans-serif; min-height: 100vh; box-sizing: border-box; position: relative; overflow-x: hidden; background-color: #1a202c; } /* Darker fallback */
                    body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://preview.redd.it/macos-sonoma-wallpapers-5120x2160-v0-j9vwvbq8h5wb1.jpg?width=5120&format=pjpg&auto=webp&s=943e6f75b62ea11c987d13b3ba7091abecd48ab6'); background-size: cover, cover; background-position: center center, center center; background-attachment: fixed, fixed; filter: blur(10px); -webkit-filter: blur(10px); transform: scale(1.05); }
                    code.inline-code { border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 2px 5px; font-size: 0.9em; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; background-color: rgba(0,0,0,0.2); color: #93c5fd;}
                    code.error-block-code { display: block; background-color: rgba(153, 27, 27, 0.3); border: 1px solid rgba(220, 38, 38, 0.5); padding: 0.75rem; border-radius: 0.375rem; color: #fecaca; font-size: 0.75rem; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
                    details > summary { cursor: pointer; color: #d1d5db; }
                    details > summary:hover { color: #f9fafb; }
                    details > pre { margin-top: 0.25rem; padding: 0.5rem; background-color: rgba(0, 0, 0, 0.4); border-radius: 0.375rem; font-size: 0.75rem; color: #d1d5db; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
                    details > pre > code { background-color: transparent; border: none; padding: 0; color: inherit; }

                </style>
                <script>
                    tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'sans-serif'] } } } }
                </script>
            </head>
            <body>
                <main class="flex flex-col items-center space-y-6 w-full min-h-screen p-4 md:p-8">

                    <div class="glass-effect rounded-2xl p-5 md:p-6 max-w-3xl w-full">
                        <h2 class="text-2xl md:text-3xl font-bold text-white mb-2">Test Run Details</h2>
                        <p><strong>Test:</strong> ${escapeHtml(testInfo.title)}</p>
                        <p><strong>Status:</strong> <strong class="font-semibold ${testInfo.status === 'failed' ? 'text-red-300' : 'text-orange-300'}">${escapeHtml(testInfo.status)}</strong></p>
                        <p><strong>Duration:</strong> ${testInfo.duration}ms</p>
                        ${failingSelector ? `<p><strong>Failing Selector:</strong> <code class="inline-code">${escapeHtml(failingSelector)}</code></p>` : ''}
                    </div>

                    <div class="glass-effect rounded-2xl p-6 md:p-8 max-w-3xl w-full">
                        <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-3">Failure Details</h3>
                        <p class="text-sm md:text-base leading-relaxed text-gray-200 mb-3">
                            The test failed${failingSelector ? ` possibly while interacting with the element targeted by <code class="inline-code">${escapeHtml(failingSelector)}</code>` : ''}. See the error message and stack trace below.
                        </p>
                        <div class="mt-4 text-sm space-y-3">
                            <p><strong class="font-medium text-gray-50">Error Message:</strong>
                                <code class="error-block-code">${escapeHtml(errorMsg)}</code>
                            </p>
                            ${stackTrace ? `<details class="mt-2">
                                    <summary>Show Stack Trace</summary>
                                    <pre><code>${escapeHtml(stackTrace)}</code></pre>
                                </details>` : ''}
                        </div>
                    </div>

                    <div class="glass-effect rounded-2xl p-6 md:p-8 max-w-3xl w-full">
                        <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-4">AI Debugging Analysis</h3>
                        <div class="ai-content-area text-sm md:text-base leading-relaxed text-gray-200">
                            ${aiAnalysisHtml}
                        </div>
                    </div>

                    ${usageInfoHtml ? `
                    <div class="glass-effect rounded-2xl p-6 md:p-8 max-w-3xl w-full">
                        <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-4">AI Usage & Estimated Cost</h3>
                        <div class="ai-content-area text-sm">
                            ${usageInfoHtml}
                        </div>
                    </div>
                    ` : ''}


                </main>
            </body>
            </html>
            `;
          // --- End HTML Generation ---

          // --- Attach the FINAL HTML Report ---
          try {
            await testInfo.attach('ai-debug-analysis.html', {
              body: glassmorphismHtml,
              contentType: 'text/html',
            });
            console.log(`✅ Successfully attached 'ai-debug-analysis.html' report.`);
          } catch (attachError: any) {
            console.error(`\n❌ Error attaching HTML report: ${attachError.message}`, attachError);
          }

          if (testInfo.error) {
            const consoleSeparator = `\n\n${SEPARATOR}\n${createCenteredHeader("💡 AI Debugging Suggestions (Raw) 💡")}\n${SEPARATOR}\n\n`;
            const consoleContent = aiAnalysisResult?.errorMarkdown ?? aiAnalysisResult?.analysisMarkdown ?? "No AI content available.";
            const consoleUsage = aiAnalysisResult?.usageInfoMarkdown ?? "";
            testInfo.error.stack = (stackTrace || errorMsg) + consoleSeparator + consoleContent + "\n\n" + consoleUsage + `\n\n${BOTTOM_BORDER}\n`;
          }

          try {
            const rawAiContent = aiAnalysisResult?.errorMarkdown ?? aiAnalysisResult?.analysisMarkdown ?? "No AI content.";
            await testInfo.attach('ai-suggestions-raw.md', { // Attach as Markdown
              body: `# AI Debugging Analysis\n\n${rawAiContent}\n\n---\n\n# Usage\n\n${aiAnalysisResult?.usageInfoMarkdown ?? "N/A"}`,
              contentType: 'text/markdown', // Use markdown type
            });
            console.log(`✅ Successfully attached 'ai-suggestions-raw.md'.`);
          } catch (attachError: any) {
            console.warn(`⚠️ Could not attach AI suggestions as markdown file: ${attachError.message}`);
          }


        } catch (captureError: any) {
          console.error(`\n❌ Critical error during failure processing: ${captureError.message}`, captureError);
          const captureErrorBox = `
            ${TOP_BORDER}
            ${createCenteredHeader("❌ Context Capture/Processing Error ❌")}
            ${SEPARATOR}
            ${wrapTextInBox(`Failed to capture context, generate report, or call AI.`)}
            ${wrapTextInBox(`Error: ${captureError?.message || captureError}`)}
            ${BOTTOM_BORDER}
            `;
          console.error(captureErrorBox);
          if (testInfo.error) {
            const separator = `\n\n${SEPARATOR}\n${createCenteredHeader("❌ Error During Failure Handling ❌")}\n${SEPARATOR}\n\n`;
            testInfo.error.stack = (testInfo.error.stack || testInfo.error.message || 'Unknown initial error') + separator + `Failed to capture context or process failure: ${captureError?.message || captureError}` + `\n\n${BOTTOM_BORDER}\n`;
          }
        }
      } else if (page.isClosed()) {
        console.warn(`\n${TOP_BORDER}`);
        console.warn(createCenteredHeader("⚠️ Page Closed Warning ⚠️"));
        console.warn(`${SEPARATOR}`);
        console.warn(wrapTextInBox("Page was closed before context could be captured for AI analysis. Test: " + testInfo.title));
        console.warn(`${BOTTOM_BORDER}`);
        if (testInfo.error) {
          testInfo.error.stack = (testInfo.error.stack || testInfo.error.message || '') + "\n\n[Warning: Page closed before full context capture.]";
        }
      } else if (!testInfo.error) {
        console.warn(`\n${TOP_BORDER}`);
        console.warn(createCenteredHeader("⚠️ No Error Info Warning ⚠️"));
        console.warn(`${SEPARATOR}`);
        console.warn(wrapTextInBox(`Test status is '${testInfo.status}' but no error object was found. Cannot perform AI analysis. Test: ${testInfo.title}`));
        console.warn(`${BOTTOM_BORDER}`);
      }
    }
  }
});

// Re-export expect
export { expect } from '@playwright/test';