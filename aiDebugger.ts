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

// --- Box Drawing Configuration ---
export const BOX_WIDTH = 100; // More reasonable width for terminal/report viewing
export const TOP_BORDER = '┌' + '─'.repeat(BOX_WIDTH) + '┐';
export const BOTTOM_BORDER = '└' + '─'.repeat(BOX_WIDTH) + '┘';
export const SEPARATOR = '├' + '─'.repeat(BOX_WIDTH) + '┤';

/**
 * Creates a centered header line for the box.
 * @param text The text to center.
 * @returns A formatted string for the header line.
 */
export function createCenteredHeader(text: string): string {
  const padding = Math.max(0, BOX_WIDTH - text.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = Math.ceil(padding / 2);
  return '│' + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + '│';
}

/**
 * Wraps multi-line text within the box side borders.
 * Adds padding to the left.
 * @param text The text block to wrap.
 * @param indent Number of spaces to indent text inside the border.
 * @returns Formatted text block with borders.
 */
export function wrapTextInBox(text: string, indent: number = 2): string {
  const indentStr = ' '.repeat(indent);
  // Adjust max line length based on the new BOX_WIDTH and indent
  const maxLineLength = BOX_WIDTH - indent - 1; // -1 for the right border '│'

  return text
    .split('\n')
    .map(originalLine => {
      let currentLine = originalLine;
      let resultLines: string[] = [];

      while (currentLine.length > maxLineLength) {
        let breakPoint = currentLine.lastIndexOf(' ', maxLineLength);
        if (breakPoint === -1 || breakPoint === 0) {
          breakPoint = maxLineLength;
        }
        resultLines.push(currentLine.substring(0, breakPoint));
        currentLine = currentLine.substring(breakPoint).trimStart();
      }
      resultLines.push(currentLine);

      return resultLines.map(subLine =>
        '│' + indentStr + subLine.padEnd(BOX_WIDTH - indent) + '│'
      ).join('\n');
    })
    .join('\n');
}
// --- End Box Drawing Configuration ---


export function cleanBase64(base64String: string): string {
  return base64String.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * Extracts and cleans body content from HTML string
 * Removes scripts, style tags, and excessive whitespace to reduce token count
 * @param html HTML string to process
 * @returns Cleaned body content or null if not found
 */
function extractBodyContent(html: string | undefined): string | null {
  if (!html) return null;

  // Extract body content
  const bodyMatch = html.match(/<body(?:[^>]*?)>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;

  let bodyContent = bodyMatch[1].trim();

  // Remove all script tags and their contents (major token reduction)
  bodyContent = bodyContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all style tags and their contents (major token reduction)
  bodyContent = bodyContent.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove inline styles (reduces tokens)
  bodyContent = bodyContent.replace(/\s+style\s*=\s*"[^"]*"/gi, '');
  bodyContent = bodyContent.replace(/\s+style\s*=\s*'[^']*'/gi, '');

  // Remove data attributes (reduces tokens)
  bodyContent = bodyContent.replace(/\s+data-[^=\s>]*\s*=\s*"[^"]*"/gi, '');
  bodyContent = bodyContent.replace(/\s+data-[^=\s>]*\s*=\s*'[^']*'/gi, '');

  // Remove inline JavaScript events (onclick, onload, etc.)
  bodyContent = bodyContent.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
  bodyContent = bodyContent.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');

  // Remove HTML comments (reduces tokens)
  bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize whitespace to reduce token count
  bodyContent = bodyContent.replace(/\s+/g, ' ');

  // Log token optimization
  const originalSize = bodyMatch[1].trim().length;
  const optimizedSize = bodyContent.length;
  const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

  return bodyContent;
}


export async function callDebuggingAI(data: AiAnalysisInput): Promise<string | null> {
  if (!apiKey) {
    return `
      ${TOP_BORDER}
      ${createCenteredHeader(" Configuration Error ")}
      ${SEPARATOR}
      ${wrapTextInBox("GOOGLE_API_KEY is not set or is a placeholder.")}
      ${wrapTextInBox("AI analysis cannot proceed.")}
      ${BOTTOM_BORDER}
      `;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig,
    });

    // --- HTML Context Preparation ---
    const MAX_BODY_CONTEXT_SIZE = 16000;
    let htmlContext = 'HTML not available.';
    let htmlContextDescription = 'HTML not available.';
    const originalHtml = data.html;
    if (originalHtml) {
      const bodyContent = extractBodyContent(originalHtml);
      if (bodyContent) {
        if (bodyContent.length <= MAX_BODY_CONTEXT_SIZE) {
          htmlContext = bodyContent;
          htmlContextDescription = 'Only <body> content is provided (<head> excluded).';
        } else {
          const chunkSize = Math.floor(MAX_BODY_CONTEXT_SIZE / 2);
          const startChunk = bodyContent.substring(0, chunkSize);
          const endChunk = bodyContent.substring(bodyContent.length - chunkSize);
          htmlContext = `${startChunk}\n\n...\n[BODY CONTENT TRUNCATED IN THE MIDDLE]\n...\n\n${endChunk}`;
          htmlContextDescription = 'Only <body> content is provided (<head> excluded), AND the body content itself was truncated due to length.';
        }
      } else {
        console.warn("Could not extract body content, falling back to start/end chunks of full HTML.");
        const MAX_CHUNK_SIZE = 8000;
        if (originalHtml.length <= MAX_CHUNK_SIZE * 2) {
          htmlContext = originalHtml;
          htmlContextDescription = 'Full HTML provided (could not extract body).';
        } else {
          const startChunk = originalHtml.substring(0, MAX_CHUNK_SIZE);
          const endChunk = originalHtml.substring(originalHtml.length - MAX_CHUNK_SIZE);
          htmlContext = `${startChunk}\n\n...\n[FULL HTML TRUNCATED IN THE MIDDLE]\n...\n\n${endChunk}`;
          htmlContextDescription = 'Full HTML provided but truncated due to length (could not extract body).';
        }
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
1. ${data.screenshotBase64
        ? 'A screenshot of the web page at the time of the error is provided below. PLEASE PRIORITIZE THIS SCREENSHOT for visual analysis.'
        : 'No screenshot is available.'
      }
2. Below is the HTML source code context, cleaned to remove scripts, styles, and unnecessary attributes. Note: ${htmlContextDescription}

Instructions:
Based *primarily on the screenshot* (if provided) and secondarily on the provided HTML body content:

1.  **Identify Element:** Clearly identify the specific UI element the test likely intended to interact with, given the failing selector (\`${data.failingSelector || 'N/A'}\`) and the error message. Describe its visual appearance and location *based on the screenshot*.

2.  **Suggest Playwright Locators (Prioritized):** Suggest 1-3 robust alternative locators for this element, following Playwright's recommended best practices in this order of preference:
    * **a) User-Facing Attributes:** Target using \`getByRole\`, \`getByText\`, \`getByLabel\`, \`getByPlaceholder\`, \`getByAltText\`, or \`getByTitle\` based on visible/inferred attributes.
    * **b) Test IDs:** Use \`getByTestId\` if stable \`data-testid\` (or similar) exists.
    * **c) CSS or XPath (Fallback):** Suggest concise CSS/XPath if others aren't suitable. Prioritize stable attributes.
    * Ensure suggestions aim for uniqueness and reliability.

3.  **Explain Failure:** Provide a concise explanation of the *most likely* reason the original selector (\`${data.failingSelector || 'N/A'}\`) failed, consistent with the screenshot and HTML.

4.  **Format Output (Markdown):** Present the analysis using **Markdown** for clear, structured readability within an HTML report. Use level 3 headings (like \`-=== Heading ===-\`), bold text (like \`**bold**\`), inline code formatting (using single backticks like \`code\`), and lists. Structure the output into three distinct sections exactly as follows, separated by horizontal rules at the middle (\`-------------------------------------------------------------------------------------------------\`):
    * \`-===  Element Identification\`
    * \`-===  Suggested Locators\` (Use a numbered list, clearly label locator type, e.g., "**User-Facing:**", and format locator code with backticks like \`locator.code()\`)
    * \`-===  Failure Explanation\`

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
            mimeType: 'image/png',
            data: cleanedScreenshotData,
          },
        });
      }
    }

    const result: GenerateContentResponse = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
    });

    // --- Response and Usage/Cost Processing ---
    if (!result.response || result.response.promptFeedback?.blockReason) {
      const blockReason = result.response?.promptFeedback?.blockReason;
      const safetyRatings = JSON.stringify(result.response?.promptFeedback?.safetyRatings || {}, null, 2);

      // Return a formatted error box (wider)
      const errorMsg = `AI analysis failed: No valid response generated.`;
      const reasonMsg = `Reason: ${blockReason || 'Blocked/Unknown/Empty'}.`;
      const checkMsg = `Check safety settings/prompt or API status.`;
      return `
${TOP_BORDER}
${createCenteredHeader(" A I   E R R O R ")}
${SEPARATOR}
${wrapTextInBox(errorMsg)}
${wrapTextInBox(reasonMsg)}
${wrapTextInBox(checkMsg)}
${wrapTextInBox(`Safety Ratings: ${safetyRatings}`)}
${BOTTOM_BORDER}
`;
    }

    const responseText = result.response.text();

    if (!responseText) {
      // Still show cost even if response is empty
      const analysisBoxContent = `
${TOP_BORDER}
${createCenteredHeader(" Gemini Analysis ")}
${SEPARATOR}
${wrapTextInBox("AI analysis returned no suggestions or an empty response.")}
${BOTTOM_BORDER}
`;
      const costBoxContent = processUsageAndCost(result.response?.usageMetadata);
      return analysisBoxContent + "\n" + costBoxContent;
    }

    // --- Calculate Cost and Format Usage Box ---
    const costBoxContent = processUsageAndCost(result.response?.usageMetadata);
    // --- End Cost Calculation and Formatting ---

    const analysisBoxContent = `
${TOP_BORDER}
${createCenteredHeader(" Gemini Analysis ")}
${SEPARATOR}
${wrapTextInBox(responseText.trim())}
${BOTTOM_BORDER}
`;

    return analysisBoxContent + "\n" + costBoxContent;

  } catch (error: any) {

    const errorMsg = `Error during AI analysis: ${error.message}.`;
    const checkMsg = `Check console logs for details.`;
    return `
${TOP_BORDER}
${createCenteredHeader(" API Call Exception ")}
${SEPARATOR}
${wrapTextInBox(errorMsg)}
${wrapTextInBox(checkMsg)}
${BOTTOM_BORDER}
`;
  }
}

/**
 * Processes usage metadata and returns a formatted box string.
 * Uses the global BOX_WIDTH constant.
 * @param usage UsageMetadata object from the API response.
 * @returns A string containing the formatted usage and cost box.
 *
 * Note: Our HTML cleaning reduces token usage by removing scripts, styles,
 * HTML comments, and unnecessary attributes, which lowers API costs.
 */
function processUsageAndCost(usage: UsageMetadata | undefined): string {
  let usageContentLines: string[] = [];

  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;
  let usageAvailable = false;
  let estimatedCostString = "N/A";
  let currency = "USD";

  if (usage) {
    if (typeof usage.promptTokenCount === 'number' && typeof usage.candidatesTokenCount === 'number' && typeof usage.totalTokenCount === 'number') {
      promptTokens = usage.promptTokenCount;
      completionTokens = usage.candidatesTokenCount;
      totalTokens = usage.totalTokenCount;
      usageAvailable = true;
    } else if (typeof usage.promptTokenCount === 'number' && typeof usage.totalTokenCount === 'number') {
      promptTokens = usage.promptTokenCount;
      totalTokens = usage.totalTokenCount;
      completionTokens = totalTokens - promptTokens;
      usageAvailable = true;
    }
  }

  if (usageAvailable && promptTokens !== undefined && completionTokens !== undefined && totalTokens !== undefined) {
    const modelPricingInfo = MODEL_PRICING[MODEL_NAME];

    if (modelPricingInfo) {
      currency = modelPricingInfo.currency;
      const inputCost = (promptTokens / 1000) * modelPricingInfo.inputPer1k;
      const outputCost = (completionTokens / 1000) * modelPricingInfo.outputPer1k;
      const totalCost = inputCost + outputCost;
      estimatedCostString = `$${totalCost.toFixed(5)} ${currency}`;
    } else {
      estimatedCostString = `N/A (pricing missing for ${MODEL_NAME})`;
    }

    // Prepare content lines
    usageContentLines = [
      `Model Used: ${MODEL_NAME}`,
      `Prompt Tokens: ${promptTokens}`,
      `Completion Tokens: ${completionTokens}`,
      `Total Tokens: ${totalTokens}`,
      `Estimated Cost: ${estimatedCostString}`,
      ``,
      `(Note: Pricing as of March 2025, check ai.google.dev/pricing for latest rates)`
    ];

  } else {
    // Fallback message if usage info is missing or incomplete
    if (usage) {
      usageContentLines = [
        `Model Used: ${MODEL_NAME}`,
        `Usage information incomplete. Cost cannot be estimated.`
      ];
    } else {
      usageContentLines = [
        `Model Used: ${MODEL_NAME}`,
        `Usage information not available. Cost cannot be estimated.`
      ];
    }
  }

  // Wrap all content lines
  const wrappedUsageContent = usageContentLines.map(line => wrapTextInBox(line, 4)).join('\n'); // Indent content lines

  // Final box string
  return `
${TOP_BORDER}
${createCenteredHeader(" Usage & Estimated Cost ")}
${SEPARATOR}
${wrappedUsageContent}
${BOTTOM_BORDER}
`;
}