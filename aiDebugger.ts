import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
  GenerateContentResponse,
  UsageMetadata,
} from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

interface AiAnalysisInput {
  html?: string;
  screenshotBase64?: string;
  errorMsg: string;
  stackTrace?: string;
  failingSelector?: string;
  testTitle?: string;
}

// --- Result structure from AI call ---
export interface AiDebuggingResult {
  analysisMarkdown: string | null;
  usageInfoMarkdown: string | null;
  errorMarkdown: string | null;
}

// --- IMPORTANT ---
const apiKey: string | undefined = process.env.API_KEY;

// --- SELECT MODEL ---
export const MODEL_NAME = "gemini-1.5-flash-latest";
// const MODEL_NAME = "gemini-1.5-pro-latest";
// --------------------

// --- Illustrative Pricing (per 1000 tokens) ---
// Note: Pricing as of March 2025 - may change, check https://ai.google.dev/pricing for latest
const MODEL_PRICING: { [key: string]: { inputPer1k: number; outputPer1k: number; currency: string } } = {
  "gemini-1.5-pro-latest": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" },
  "gemini-1.5-flash-latest": { inputPer1k: 0.0003125, outputPer1k: 0.00125, currency: "USD" },
};
// -------------------------------------------------

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig = {
  temperature: 0.4,
  topK: 32,
  topP: 1,
  maxOutputTokens: 1024, // Max tokens for the *output*
};

// --- Styling Configuration (Primarily for Console Fallback Now) ---
export const BOX_WIDTH = 100;
export const TOP_BORDER = '┌' + '─'.repeat(BOX_WIDTH) + '┐';
export const BOTTOM_BORDER = '└' + '─'.repeat(BOX_WIDTH) + '┘';
export const SEPARATOR = '├' + '─'.repeat(BOX_WIDTH) + '┤';

// These helpers might still be useful for console logs, but not the primary output mechanism
export function createStyledMarkdownBox(title: string, content: string, type: 'analysis' | 'usage' | 'error' = 'analysis'): string {
  let emoji = '🔍';
  if (type === 'usage') emoji = '📊';
  else if (type === 'error') emoji = '⚠️';
  else if (type === 'analysis') emoji = '🧠';
  const formattedContent = content.split('\n').map(line => line.trim() ? line : '').join('\n');
  return `\n---\n\n## ${emoji} ${title}\n\n${formattedContent}\n\n---\n`;
}
export function createCenteredHeader(text: string): string {
  const padding = Math.max(0, BOX_WIDTH - text.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = Math.ceil(padding / 2);
  return '│' + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + '│';
}
export function wrapTextInBox(text: string, indent: number = 2): string {
  const indentStr = ' '.repeat(indent);
  const maxLineLength = BOX_WIDTH - indent - 1;
  return text.split('\n').map(originalLine => {
    let currentLine = originalLine;
    let resultLines: string[] = [];
    while (currentLine.length > maxLineLength) {
      let breakPoint = currentLine.lastIndexOf(' ', maxLineLength);
      if (breakPoint <= 0) breakPoint = maxLineLength;
      resultLines.push(currentLine.substring(0, breakPoint));
      currentLine = currentLine.substring(breakPoint).trimStart();
    }
    resultLines.push(currentLine);
    return resultLines.map(subLine => '│' + indentStr + subLine.padEnd(BOX_WIDTH - indent) + '│').join('\n');
  }).join('\n');
}
// --- End Styling Configuration ---


export function cleanBase64(base64String: string): string {
  return base64String.replace(/^data:image\/\w+;base64,/, '');
}

function extractBodyContent(html: string | undefined): string | null {
  if (!html) return null;
  const bodyMatch = html.match(/<body(?:[^>]*?)>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;
  let bodyContent = bodyMatch[1].trim();

  bodyContent = bodyContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  bodyContent = bodyContent.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  bodyContent = bodyContent.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  bodyContent = bodyContent.replace(/\s+data-[^=\s>]*\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  bodyContent = bodyContent.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, '');
  bodyContent = bodyContent.replace(/\s+/g, ' ');
  return bodyContent;
}


/**
 * Calls the Generative AI model for debugging analysis.
 * @param data Input data including context like HTML, screenshot, error.
 * @returns A Promise resolving to an AiDebuggingResult object.
 */
export async function callDebuggingAI(data: AiAnalysisInput): Promise<AiDebuggingResult> {
  const result: AiDebuggingResult = {
    analysisMarkdown: null,
    usageInfoMarkdown: null,
    errorMarkdown: null,
  };

  if (!apiKey) {
    result.errorMarkdown = `**Configuration Error:** GOOGLE_API_KEY is not set. AI analysis cannot proceed.`;
    return result;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig,
    });

    // --- HTML Context Preparation ---
    const MAX_BODY_CONTEXT_SIZE = 16000; // Adjust as needed
    let htmlContext = 'HTML not available.';
    let htmlContextDescription = 'HTML not available.';
    const originalHtml = data.html;
    if (originalHtml) {
      const bodyContent = extractBodyContent(originalHtml);
      if (bodyContent) {
        if (bodyContent.length <= MAX_BODY_CONTEXT_SIZE) {
          htmlContext = bodyContent;
          htmlContextDescription = 'Only sanitized <body> content provided.';
        } else {
          const chunkSize = Math.floor(MAX_BODY_CONTEXT_SIZE / 2);
          const startChunk = bodyContent.substring(0, chunkSize);
          const endChunk = bodyContent.substring(bodyContent.length - chunkSize);
          htmlContext = `${startChunk}\n\n...\n[BODY CONTENT TRUNCATED]\n...\n\n${endChunk}`;
          htmlContextDescription = 'Sanitized <body> content provided, but truncated due to length.';
        }
      } else {
        // Fallback if body extraction fails
        htmlContext = 'Could not extract body content.';
        htmlContextDescription = 'HTML provided but body extraction failed.';
      }
    }
    // --- End HTML Context Preparation ---

    const textPrompt = `
Analyze the following Playwright test failure:

Test Title: ${data.testTitle || 'N/A'}
Error Message: ${data.errorMsg}
Failing Selector Attempted: \`${data.failingSelector || 'N/A'}\`

--- Stack Trace (if relevant) ---
${data.stackTrace || 'N/A'}
--- End Stack Trace ---


Context:
1. ${data.screenshotBase64 ? 'A screenshot of the web page at the time of error IS PROVIDED. **Prioritize visual analysis of the screenshot.**' : 'No screenshot is available.'}
2. HTML source code context is provided below. Note: ${htmlContextDescription}

Instructions:
Based *primarily on the screenshot* (if provided) and secondarily on the HTML context:

1.  **Identify Element:** Clearly identify the specific UI element the test likely intended to interact with, given the failing selector (\`${data.failingSelector || 'N/A'}\`) and error. Describe its visual appearance and location *from the screenshot*. If no screenshot, infer from HTML.

2.  **Suggest Playwright Locators (Prioritized):** Suggest 1-3 robust **alternative** locators for this element, following Playwright best practices (User-Facing > Test ID > CSS/XPath).
    * Clearly label the type (e.g., "**User-Facing (Role):**").
    * Format the locator code like \`page.getByRole(...)\`.
    * Briefly explain the reasoning for *each* suggestion.
    * Aim for uniqueness and stability.

3.  **Explain Failure:** Provide a concise explanation of the *most likely* reason the original selector (\`${data.failingSelector || 'N/A'}\`) failed, consistent with the screenshot/HTML.

4.  **Format Output (Pure Markdown):** Present the analysis using **standard Markdown**. Use level 3 headings (e.g., \`### Element Identification\`), bold text (\`**bold**\`), inline code (\`code\`), and numbered/bullet lists. Structure into three sections separated by horizontal rules (\`---\`):
    * \`### Element Identification\`
    * \`### Suggested Locators\`
    * \`### Failure Explanation\`

=== HTML Source Context ===
${htmlContext}
=== End HTML Source Context ===
`; // End of textPrompt

    const promptParts: Part[] = [];
    promptParts.push({ text: textPrompt });

    if (data.screenshotBase64) {
      const cleanedScreenshotData = cleanBase64(data.screenshotBase64);
      if (cleanedScreenshotData) {
        promptParts.push({
          inlineData: {
            mimeType: 'image/png', // Assuming PNG, adjust if needed
            data: cleanedScreenshotData,
          },
        });
      }
    }

    const apiResponse: GenerateContentResponse = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
    });

    // --- Process Response ---
    result.usageInfoMarkdown = processUsageAndCost(apiResponse.response?.usageMetadata);

    if (!apiResponse.response || apiResponse.response.promptFeedback?.blockReason) {
      const blockReason = apiResponse.response?.promptFeedback?.blockReason || 'Blocked/Unknown/Empty';
      const safetyRatings = JSON.stringify(apiResponse.response?.promptFeedback?.safetyRatings || {}, null, 2);
      result.errorMarkdown = `**AI Analysis Failed:** Response blocked or empty.\n\nReason: ${blockReason}\n\nCheck safety settings/prompt or API status.\n\n<details><summary>Safety Ratings</summary>\n\n\`\`\`json\n${safetyRatings}\n\`\`\`\n</details>`;
      console.error("AI Response Blocked/Empty. Reason:", blockReason);
    } else {
      const responseText = apiResponse.response.text();
      if (responseText) {
        // Basic cleanup and ensure standard Markdown is used
        result.analysisMarkdown = responseText.trim()
          .replace(/-===(.*?)===-/g, '### $1')
          .replace(/-------------------------------------------------------------------------------------------------/g, '\n---\n'); // Standard horizontal rules
      } else {
        result.analysisMarkdown = "*AI analysis returned no suggestions or an empty response.*";
      }
    }

  } catch (error: any) {
    console.error("Error during AI API call:", error); // Log detailed error
    result.errorMarkdown = `**API Call Exception:** Error during AI analysis: ${error.message}.\n\nCheck console logs for details.`;
  }

  return result;
}

/**
 * Processes usage metadata and returns a formatted Markdown string for usage info.
 * @param usage UsageMetadata object from the API response.
 * @returns A Markdown string for usage/cost, or null if unavailable.
 */
function processUsageAndCost(usage: UsageMetadata | undefined): string | null {
  if (!usage) return null;

  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;
  let usageAvailable = false;
  let estimatedCostString = "N/A";
  let currency = "USD";

  if (typeof usage.promptTokenCount === 'number' && typeof usage.candidatesTokenCount === 'number' && typeof usage.totalTokenCount === 'number') {
    promptTokens = usage.promptTokenCount;
    completionTokens = usage.candidatesTokenCount;
    totalTokens = usage.totalTokenCount;
    usageAvailable = true;
  } else if (typeof usage.promptTokenCount === 'number' && typeof usage.totalTokenCount === 'number') {
    promptTokens = usage.promptTokenCount;
    totalTokens = usage.totalTokenCount;
    completionTokens = totalTokens - promptTokens; // Calculate completion tokens
    usageAvailable = true;
  }

  if (usageAvailable && promptTokens !== undefined && completionTokens !== undefined && totalTokens !== undefined) {
    const modelPricingInfo = MODEL_PRICING[MODEL_NAME];
    if (modelPricingInfo) {
      currency = modelPricingInfo.currency;
      const inputCost = (promptTokens / 1000) * modelPricingInfo.inputPer1k;
      const outputCost = (completionTokens / 1000) * modelPricingInfo.outputPer1k;
      const totalCost = inputCost + outputCost;
      // Use a reasonable number of decimal places
      estimatedCostString = `$${totalCost.toFixed(totalCost < 0.01 ? 6 : 4)} ${currency}`;
    } else {
      estimatedCostString = `N/A (pricing missing for ${MODEL_NAME})`;
    }

    // Return Markdown Table
    return `
| Category          | Value                  |
|-------------------|------------------------|
| **Model** | ${MODEL_NAME}          |
| **Total Tokens** | ${totalTokens.toLocaleString()}  |
| **Prompt Tokens** | ${promptTokens.toLocaleString()} |
| **Comp. Tokens** | ${completionTokens.toLocaleString()}|
| **Est. Cost** | ${estimatedCostString}     |

*Pricing as of March 2025. Check [ai.google.dev/pricing](https://ai.google.dev/pricing) for latest rates.*
`;
  } else {
    // Return simpler message if counts are missing
    return `*Usage information incomplete or unavailable. Cost cannot be estimated.* (Model: ${MODEL_NAME})`;
  }
}