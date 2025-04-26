/**
 * Module for calling the Gemini AI model
 */
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
  type GenerateContentResult,
  type UsageMetadata,
} from "@google/generative-ai";
import { AiAnalysisInput, AiDebuggingResult } from './types';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// API key for Gemini
const apiKey: string | undefined = process.env.GEMINI_API_KEY;

// Model name with fallback
export const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-pro-latest";

// Pricing information (per 1000 tokens)
const MODEL_PRICING: { [key: string]: { inputPer1k: number; outputPer1k: number; currency: string } } = {
  // 2.0 Models
  "gemini-2.0-flash": { inputPer1k: 0.0003125, outputPer1k: 0.00125, currency: "USD" },
  
  // 1.5 Models
  "gemini-1.5-pro-latest": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" },
  "gemini-1.5-flash-latest": { inputPer1k: 0.0003125, outputPer1k: 0.00125, currency: "USD" },
  "gemini-1.5-pro-vision": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" },
  
  // 1.0 Models (if needed)
  "gemini-pro-vision": { inputPer1k: 0.0025, outputPer1k: 0.0075, currency: "USD" },
  "gemini-1.0-pro-vision": { inputPer1k: 0.0025, outputPer1k: 0.0075, currency: "USD" },
  
  // Default pricing for any other model not explicitly listed
  "default": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" }
};

// Safety settings for the AI
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Generation configuration
const generationConfig = {
  temperature: 0.4,
  topK: 32,
  topP: 1,
  maxOutputTokens: 1024, // Max tokens for the *output*
};

/**
 * Cleans a base64 string by removing data URL prefix
 */
export function cleanBase64(base64String: string): string {
  return base64String.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * Extracts the body content from HTML
 */
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
 * Core AI analysis processor with enhanced context handling
 */
export async function callDebuggingAI(data: AiAnalysisInput): Promise<AiDebuggingResult> {
  console.log(`🧠 Using ${MODEL_NAME} for visual-logical analysis`);
  const result: AiDebuggingResult = {
    analysisMarkdown: null,
    usageInfoMarkdown: null,
    errorMarkdown: null,
  };

  if (!apiKey) {
    result.errorMarkdown = "**Configuration Error:** GEMINI_API_KEY is not set. AI analysis cannot proceed.";
    return result;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig,
    });

    // Enhanced HTML context processing with semantic chunking
    const {htmlContext, htmlContextDescription} = processHtmlContext(data.html);

    // Structured prompt engineering with clear role definition
    const textPrompt = buildAnalysisPrompt(data, htmlContextDescription);
    


    // Prepare parts for the AI call
    const promptParts: Part[] = [];
    promptParts.push({ text: textPrompt });

    // Add screenshot if available
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

    // Call the AI model
    const apiResponse: GenerateContentResult = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
    });

    // Process the response
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

  } catch (error: unknown) {
    console.error("Error during AI API call:", error); // Log detailed error
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errorMarkdown = `**API Call Exception:** Error during AI analysis: ${errorMessage}.\n\nCheck console logs for details.`;
  }

  return result;
}

///// Enhanced Processing Functions /////

/**
 * Processes HTML content with semantic chunking and relevance scoring
 */
function processHtmlContext(originalHtml?: string): {htmlContext: string; htmlContextDescription: string} {
  const MAX_CONTEXT_TOKENS = 12000; // Adjusted for typical token-word ratio
  const htmlContext = 'HTML not available.';
  const htmlContextDescription = 'HTML not available.';

  if (!originalHtml) {
    return {htmlContext, htmlContextDescription};
  }

  const bodyContent = extractBodyContent(originalHtml);
  if (!bodyContent) {
    return {htmlContext: 'Could not extract body content.', htmlContextDescription: 'HTML body extraction failed'};
  }

  // Simple token estimation (1 token ≈ 4 characters)
  const tokenCount = Math.floor(bodyContent.length / 4);
  
  if (tokenCount <= MAX_CONTEXT_TOKENS) {
    return {
      htmlContext: bodyContent,
      htmlContextDescription: `Full sanitized body (${tokenCount.toLocaleString()} tokens)`
    };
  }

  // Dynamic chunking with priority to interactive elements
  const interactiveElements = bodyContent.match(/<(a|button|input|form)[^>]*>/gi) || [];
  const interactiveContext = interactiveElements.slice(0, 20).join('\n');
  
  // Preserve structural elements
  const structuralElements = bodyContent.match(/<(header|main|nav|section|footer)[^>]*>/gi) || [];
  
  return {
    htmlContext: `<!-- SEMANTIC CONTEXT EXTRACTION -->\n${
      structuralElements.slice(0, 5).join('\n')
    }\n\n<!-- KEY INTERACTIVE ELEMENTS -->\n${
      interactiveContext
    }\n\n<!-- TRUNCATED CONTEXT -->\n[...${tokenCount - MAX_CONTEXT_TOKENS} tokens omitted]`,
    htmlContextDescription: `Semantic HTML chunks (${MAX_CONTEXT_TOKENS.toLocaleString()} token window)`
  };
}

/**
 * Constructs structured analysis prompt with role-based instructions
 */
function buildAnalysisPrompt(data: AiAnalysisInput, htmlContextDesc: string): string {
  // Escape backticks within the prompt string for Markdown code formatting
  return `
**Role**: You are a Senior Quality Engineer analyzing a test failure in a complex web application.

**Context**:
- ${data.screenshotBase64 ? 'Visual snapshot available - prioritize visual analysis.' : 'No visual context available.'}
- HTML Context: ${htmlContextDesc}
- ${data.networkRequests ? 'Network activity data provided.' : 'No network data provided.'}

**Analysis Framework & Instructions**:
Based *primarily on the screenshot* (if provided) and secondarily on the HTML context:

1.  **Identify Element:** Clearly identify the specific UI element the test likely intended to interact with, given the failing selector \\\`${data.failingSelector || 'N/A'}\\\` and error message. Describe its visual appearance and location *from the screenshot*. If no screenshot, infer from HTML.

2.  **Suggest Playwright Locators (Prioritized):** Suggest 1-3 robust **alternative** locators for this element, following Playwright best practices (User-Facing > Test ID > CSS/XPath).
    *   Clearly label the type (e.g., "**User-Facing (Role):**").
    *   Format the locator code like \\\`page.getByRole(...)\\\`.
    *   Briefly explain the reasoning for *each* suggestion.
    *   Aim for uniqueness and stability.

3.  **Explain Failure:** Provide a concise explanation of the *most likely* reason the original selector (\\\`${data.failingSelector || 'N/A'}\\\`) failed, consistent with the screenshot/HTML.
    ${data.networkRequests ? '*   Check if network requests indicate any API issues that might be related to the failure.' : ''}

${data.testCode ? `4.  **Test Improvement Suggestions:** Review the test code provided below and suggest improvements:
    *   Replace hardcoded waits (like \`page.waitForTimeout\`) with proper web assertions or state checks (e.g., \`expect(locator).toBeVisible()\`).
    *   Suggest better selectors or waiting strategies if applicable.
    *   Identify potential flakiness issues.
    *   Recommend additional assertions or validations based on the UI.
` : ''}

5.  **Format Output (Pure Markdown):** Present the analysis using **standard Markdown**. Use level 3 headings (e.g., \\\`### Element Identification\\\`), bold text (\\\`**bold**\\\`), inline code (\\\`code\\\`), and numbered/bullet lists. Structure into ${data.testCode ? 'four' : 'three'} sections, EACH separated by horizontal rules (\`---\`):
    *   \`### Element Identification\`
    *   \`---\`
    *   \`### Suggested Locators\`
    *   \`---\`
    *   \`### Failure Explanation\`
    ${data.testCode ? '*   `---`\n*   `### Test Improvement Suggestions`' : ''}

**IMPORTANT**: Insert a horizontal rule (\`---\`) BETWEEN EACH of the main sections.

=== Technical Details ===
Test: ${data.testTitle || 'Unnamed Test'}
Error: ${data.errorMsg}
Selector Attempted: ${data.failingSelector || 'N/A'}
${data.stackTrace ? `Stack Trace:\n\\\`\\\`\\\`\n${data.stackTrace}\n\\\`\\\`\\\`` : ''}
${data.testCode ? `\nTest Code:\n\\\`\\\`\\\`javascript\n${data.testCode}\n\\\`\\\`\\\`` : ''}
`;
}

/**
 * Enhanced usage analytics with cost validation
 */
function processUsageAndCost(usage?: UsageMetadata): string | null {
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
    // Get pricing info for the model, or use default if not specifically listed
    const modelPricingInfo = MODEL_PRICING[MODEL_NAME] || MODEL_PRICING.default;
    
    currency = modelPricingInfo.currency;
    const inputCost = (promptTokens / 1000) * modelPricingInfo.inputPer1k;
    const outputCost = (completionTokens / 1000) * modelPricingInfo.outputPer1k;
    const totalCost = inputCost + outputCost;
    // Use a reasonable number of decimal places
    estimatedCostString = `$${totalCost.toFixed(totalCost < 0.01 ? 6 : 4)} ${currency}`;

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
  }
  
  // Return simpler message if counts are missing
  return `*Usage information incomplete or unavailable. Cost cannot be estimated.* (Model: ${MODEL_NAME})`;
}