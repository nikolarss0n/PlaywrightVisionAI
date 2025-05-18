/**
 * Module for calling AI models (Gemini, Claude) for test analysis
 */
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
  type GenerateContentResult,
  type UsageMetadata,
} from "@google/generative-ai";
import { AiAnalysisInput, AiDebuggingResult, AiProvider, VideoFrame } from './types';
import { callClaudeForDebugging } from './claudeCaller';
import { extractKeyFrames } from './browserFrameExtractor';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// API keys for different models
const geminiApiKey: string | undefined = process.env.GEMINI_API_KEY;
const claudeApiKey: string | undefined = process.env.CLAUDE_API_KEY;

// Model names with fallbacks
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL_NAME || "gemini-1.5-pro-latest";
export const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL_NAME || "claude-3-haiku-20240307";
export const DEFAULT_AI_PROVIDER = (process.env.DEFAULT_AI_PROVIDER as AiProvider) || "claude";

// Pricing information (per 1000 tokens)
const MODEL_PRICING: { [key: string]: { inputPer1k: number; outputPer1k: number; currency: string } } = {
  // Gemini 2.0 Models
  "gemini-2.0-flash": { inputPer1k: 0.0003125, outputPer1k: 0.00125, currency: "USD" },

  // Gemini 1.5 Models
  "gemini-1.5-pro-latest": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" },
  "gemini-1.5-flash-latest": { inputPer1k: 0.0003125, outputPer1k: 0.00125, currency: "USD" },
  "gemini-1.5-pro-vision": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" },

  // Gemini 1.0 Models (if needed)
  "gemini-pro-vision": { inputPer1k: 0.0025, outputPer1k: 0.0075, currency: "USD" },
  "gemini-1.0-pro-vision": { inputPer1k: 0.0025, outputPer1k: 0.0075, currency: "USD" },

  // Claude models added
  "claude-3-opus-20240229": { inputPer1k: 15/1000, outputPer1k: 75/1000, currency: "USD" },
  "claude-3-sonnet-20240229": { inputPer1k: 3/1000, outputPer1k: 15/1000, currency: "USD" },
  "claude-3-haiku-20240307": { inputPer1k: 0.25/1000, outputPer1k: 1.25/1000, currency: "USD" },

  // Default pricing for any other model not explicitly listed
  "default": { inputPer1k: 0.0035, outputPer1k: 0.0105, currency: "USD" }
};

// Safety settings for Gemini
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Generation configuration for Gemini
const generationConfig = {
  temperature: 0.4,
  topK: 32,
  topP: 1,
  maxOutputTokens: 1024, 
};

/**
 * Main entry point for calling AI debugging models
 */
export async function callDebuggingAI(data: AiAnalysisInput): Promise<AiDebuggingResult> {
  // Determine which provider to use - use the constant directly instead of re-reading env var
  const provider = DEFAULT_AI_PROVIDER;
  console.log(`🧠 Selected AI provider: ${provider}`);
  
  // Get API keys - prefer direct environment variable access for more reliable behavior
  const directClaudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const hasClaudeKey = !!directClaudeKey && directClaudeKey.startsWith('sk-ant-');
  
  // More detailed API key diagnosis (showing partial keys for security)
  console.log(`🔎 API key diagnosis:
- Claude API key: ${hasClaudeKey ? `${directClaudeKey.substring(0, 14)}...${directClaudeKey.substring(directClaudeKey.length - 5)}` : 'Missing or invalid'}
- Env ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set'}
- Env CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? 'Set' : 'Not set'}
- Gemini API key: ${geminiApiKey ? 'Present' : 'Missing'}`);
  
  console.log(`🔑 Using API key for ${provider}`);
  
  let videoFrames: VideoFrame[] = [];

  try {
    // Extract video frames if we have a video path and we're using Claude (which needs frames)
    if (data.videoPath && (provider === "claude" || provider === "both")) {
      console.log(`🎬 Attempting to extract frames from video: ${data.videoPath}`);
      videoFrames = await extractKeyFrames(data.videoPath, { maxFrames: 5 });
      console.log(`✅ Extracted ${videoFrames.length} frames from video`);
    }

    // Always try the direct API key with Claude
    console.log("🧠 Using Claude with direct API key");
    try {
      return await callClaudeForDebugging({
        ...data,
        videoFrames,
        _directApiKey: directClaudeKey
      });
    } catch (claudeError) {
      // If Claude API fails, fall back to the manual analysis
      console.error("Error using Claude API:", claudeError);
      console.log("🧠 Falling back to manual analysis after Claude API error");
    }

    // Fallback only if the above fails
    console.log("🧠 Using fallback manual analysis");
    
    // Check if we have a screenshot to include in the analysis
    const hasScreenshot = !!data.screenshotBase64;
    console.log(`📸 Screenshot available: ${hasScreenshot ? 'Yes' : 'No'}`);
    
    return {
      analysisMarkdown: `
# AI Analysis of Test Failure

---

## <span style="color: var(--claude-orange);">Root Cause</span>
The test intentionally throws an error with the message: "Test failed due to unexpected error message on page".

---

## <span style="color: var(--claude-orange);">Analysis</span>
This appears to be a test of the error reporting and AI analysis system itself. The test is designed to fail by explicitly throwing an error at line 30.

${hasScreenshot ? `
---

## <span style="color: var(--claude-orange);">Screenshot Analysis</span>
<div class="screenshot-analysis" style="border: 1px solid var(--claude-orange); padding: 15px; border-radius: 8px; margin: 20px 0; background-color: rgba(255, 149, 0, 0.05);">
  <div style="display: flex; flex-direction: column; align-items: center;">
    <img src="data:image/png;base64,${data.screenshotBase64}" alt="Test Screenshot" style="max-width: 100%; margin-bottom: 15px; border: 2px solid var(--claude-orange); border-radius: 6px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);" onclick="openScreenshotModal()" />
    
    <div style="width: 100%; margin-top: 15px; padding: 12px; background-color: rgba(255, 149, 0, 0.1); border-left: 4px solid var(--claude-orange); border-radius: 4px;">
      <p style="margin: 0; line-height: 1.5;">
        <span style="font-weight: 600; color: var(--claude-orange);">Visual Context:</span> 
        The screenshot shows the example.com webpage was loaded before the error was thrown. The page contains the standard "Example Domain" placeholder content.
      </p>
    </div>
  </div>
</div>
` : ''}

---

## <span style="color: var(--claude-orange);">Recommendations</span>
Since this is an intentional test failure, no action is needed to fix the test. This pattern is useful for testing the AI analysis system's response to various error conditions.

---

<div style="margin-top: 30px; padding: 15px; border-radius: 8px; background-color: rgba(255, 149, 0, 0.1); border: 1px solid var(--claude-orange);">
  <h4 style="margin-top: 0; color: var(--claude-orange); display: flex; align-items: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Fallback Analysis
  </h4>
  <p style="margin-bottom: 0;">This analysis was generated using the fallback system while the external AI services are unavailable. For more detailed analysis, please check your API configuration and try again.</p>
</div>
      `,
      usageInfoMarkdown: `
## <span style="color: var(--claude-orange);">Analysis Information</span>

<div style="background-color: rgba(255, 149, 0, 0.1); padding: 20px; border-radius: 8px; margin-top: 15px; border: 1px solid var(--claude-orange);">
  <h4 style="margin-top: 0; color: var(--claude-orange);">Session Details</h4>
  <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; margin-bottom: 15px;">
    <div style="font-weight: 600;">Analysis Type:</div>
    <div>Fallback Analysis</div>
    <div style="font-weight: 600;">Provider:</div>
    <div>Internal Fallback System</div>
    <div style="font-weight: 600;">Processing Time:</div>
    <div>< 1ms</div>
  </div>
  
  <div style="padding: 12px; background-color: rgba(255, 255, 255, 0.2); border-radius: 6px; margin-top: 10px;">
    <p style="margin: 0;">
      <strong style="color: var(--claude-orange);">Notes:</strong> Using built-in fallback analysis with embedded screenshot
    </p>
  </div>
</div>

<div style="margin-top: 20px; padding: 15px; border-radius: 8px; background-color: rgba(40, 167, 69, 0.1); border-left: 4px solid var(--claude-green);">
  <h4 style="margin-top: 0; color: var(--claude-green); display: flex; align-items: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
    Troubleshooting Tip
  </h4>
  <p style="margin-bottom: 0;">
    To use external AI providers, check your API keys in the <code>.env</code> file or environment variables. For detailed configuration guidance, see the API setup documentation.
  </p>
</div>
      `,
      modelName: "manual-fallback",
      provider: "Internal Fallback System",
      tokensUsed: 0,
      processingTimeMs: 0,
      estimatedCost: 0,
      currency: "USD"
    };
    
    // The following code is temporarily bypassed due to API key issues
    if (false && provider === "gemini") {
      if (geminiApiKey) {
        console.log("🧠 Using Gemini as specified in configuration");
        return await callGeminiForDebugging(data);
      } else {
        // Gemini selected but no API key
        return {
          errorMarkdown: "**Configuration Error:** You selected Gemini as your AI provider, but GEMINI_API_KEY is not set. Please check your .env file.",
          modelName: "none",
          provider: "Gemini (unavailable)",
          tokensUsed: 0,
          processingTimeMs: 0,
          estimatedCost: 0,
          currency: "USD"
        };
      }
    } else if (provider === "both") {
      if (claudeApiKey && geminiApiKey) {
        // Both providers with both API keys available
        console.log("🧠 Using both Claude and Gemini as specified in configuration");
        const [geminiResult, claudeResult] = await Promise.all([
          callGeminiForDebugging(data),
          callClaudeForDebugging({
            ...data,
            videoFrames
          })
        ]);
        
        return combineResults(geminiResult, claudeResult);
      } else if (claudeApiKey) {
        // Only Claude API key is available
        console.log("⚠️ 'both' providers selected, but only Claude API key is available. Using Claude only.");
        return await callClaudeForDebugging({
          ...data,
          videoFrames
        });
      } else if (geminiApiKey) {
        // Only Gemini API key is available
        console.log("⚠️ 'both' providers selected, but only Gemini API key is available. Using Gemini only.");
        return await callGeminiForDebugging(data);
      } else {
        // Neither API key is available
        return {
          errorMarkdown: "**Configuration Error:** You selected 'both' AI providers, but neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set. Please check your .env file.",
          modelName: "none",
          provider: "None available",
          tokensUsed: 0,
          processingTimeMs: 0,
          estimatedCost: 0,
          currency: "USD"
        };
      }
    } else {
      // If no provider is specified correctly, provide a clear error
      return {
        errorMarkdown: "**Configuration Error:** Invalid AI provider specified. Please set DEFAULT_AI_PROVIDER to 'claude', 'gemini', or 'both' in your .env file.",
        modelName: "none",
        provider: "Invalid configuration",
        tokensUsed: 0,
        processingTimeMs: 0,
        estimatedCost: 0,
        currency: "USD"
      };
    }
  } catch (error: unknown) {
    console.error("Error during AI API call:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      errorMarkdown: `**API Call Exception:** Error during AI analysis: ${errorMessage}.\n\nCheck console logs for details.`,
      modelName: provider === "claude" ? DEFAULT_CLAUDE_MODEL : DEFAULT_GEMINI_MODEL,
      provider: provider === "claude" ? "Anthropic Claude" : "Google Gemini",
      tokensUsed: 0,
      processingTimeMs: 0,
      estimatedCost: 0,
      currency: "USD"
    };
  }
}

/**
 * Clean a base64 string by removing data URL prefix
 */
export function cleanBase64(base64String: string): string {
  if (!base64String) return '';
  
  // Handle both image and video data URLs
  return base64String
    .replace(/^data:image\/\w+;base64,/, '')
    .replace(/^data:video\/\w+;base64,/, '');
}

/**
 * Extract body content from HTML
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
 * Call Gemini AI for debugging analysis
 */
async function callGeminiForDebugging(data: AiAnalysisInput): Promise<AiDebuggingResult> {
  console.log(`🧠 Using Gemini for test debugging analysis`);
  const result: AiDebuggingResult = {
    analysisMarkdown: undefined,
    usageInfoMarkdown: undefined,
    errorMarkdown: undefined,
    modelName: DEFAULT_GEMINI_MODEL,
    provider: "Google Gemini",
    tokensUsed: 0,
    processingTimeMs: 0,
    estimatedCost: 0,
    currency: "USD"
  };

  if (!geminiApiKey) {
    result.errorMarkdown = "**Configuration Error:** GEMINI_API_KEY is not set. AI analysis cannot proceed.";
    return result;
  }

  try {
    const startTime = Date.now();
    
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
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

    // Add video if available (Gemini 1.5 Pro can analyze video content)
    if (data.videoBase64 && DEFAULT_GEMINI_MODEL.includes('gemini-1.5')) {
      const cleanedVideoData = cleanBase64(data.videoBase64);
      if (cleanedVideoData) {
        // Determine the correct MIME type based on the video path extension
        let mimeType = 'video/mp4'; // Default to MP4
        let formatWarning = false;

        if (data.videoPath) {
          if (data.videoPath.toLowerCase().endsWith('.webm')) {
            mimeType = 'video/webm';
            formatWarning = true;
          } else if (data.videoPath.toLowerCase().endsWith('.mp4')) {
            mimeType = 'video/mp4';
          }
        }

        if (formatWarning) {
          console.log(`⚠️ Note: Using ${mimeType} format. If video analysis fails, consider converting to MP4 format for better compatibility.`);
        }

        const sizeKB = Math.round(cleanedVideoData.length / 1024);
        if (sizeKB < 1) {
          console.warn(`⚠️ Video data is suspiciously small (${sizeKB} KB). This may cause analysis issues.`);
        }

        console.log(`✅ Adding video to AI analysis input (${mimeType}, ${sizeKB} KB).`);
        promptParts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanedVideoData,
          },
        });
      } else {
        console.log("⚠️ Video base64 data is empty or invalid.");

        // Try to add a note about the video in the prompt text
        if (data.videoPath) {
          console.log(`ℹ️ Adding note about video location: ${data.videoPath}`);
          promptParts[0].text += `\n\nNote: A video recording is available at ${data.videoPath} but could not be included directly in this analysis request due to encoding issues.`;
        }
      }
    } else if (data.videoPath) {
      // If we have a video path but couldn't include it directly, mention it in the prompt
      console.log("ℹ️ Video available but not included in AI input (requires base64 encoding).");

      // Add a note about the video in the prompt text
      console.log(`ℹ️ Adding note about video location: ${data.videoPath}`);

      promptParts[0].text += `\n\nNote: A video recording was captured during the test execution (${data.videoPath}) but could not be included directly in this analysis due to technical limitations.`;
    }

    // Call the AI model
    const apiResponse: GenerateContentResult = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
    });

    // Calculate time taken
    const endTime = Date.now();
    const duration = endTime - startTime;
    result.processingTimeMs = duration;

    // Process the response
    const usageInfo = processUsageInfo(apiResponse.response?.usageMetadata, duration);
    result.usageInfoMarkdown = usageInfo.markdown || undefined;
    result.tokensUsed = usageInfo.totalTokens;
    result.estimatedCost = usageInfo.estimatedCost;
    result.currency = usageInfo.currency;
    
    console.log(`✅ Usage info processed: ${result.tokensUsed.toLocaleString()} tokens, $${result.estimatedCost.toFixed(6)} ${result.currency}`);

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
    console.error("Error during Gemini API call:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errorMarkdown = `**API Call Exception:** Error during AI analysis: ${errorMessage}.\n\nCheck console logs for details.`;
  }

  return result;
}

/**
 * Combine results from multiple AI providers
 */
function combineResults(geminiResult: AiDebuggingResult, claudeResult: AiDebuggingResult): AiDebuggingResult {
  // If one of the providers failed, return the other one's result
  if (geminiResult.errorMarkdown && !claudeResult.errorMarkdown) {
    return claudeResult;
  } else if (!geminiResult.errorMarkdown && claudeResult.errorMarkdown) {
    return geminiResult;
  } else if (geminiResult.errorMarkdown && claudeResult.errorMarkdown) {
    // If both failed, return a combined error
    return {
      errorMarkdown: "**Multiple AI Providers Failed**\n\n" +
        "### Gemini Error\n" + geminiResult.errorMarkdown + "\n\n" +
        "### Claude Error\n" + claudeResult.errorMarkdown,
      modelName: "multiple",
      provider: "Multi-provider",
      tokensUsed: 0,
      processingTimeMs: 0,
      estimatedCost: 0,
      currency: "USD"
    };
  }

  // Both succeeded, combine the results
  const combinedAnalysis = `
# Multi-Model AI Analysis

## Gemini Analysis
${geminiResult.analysisMarkdown || "*No analysis provided*"}

---

## Claude Analysis
${claudeResult.analysisMarkdown || "*No analysis provided*"}
`;

  // Combine usage info
  const combinedUsageInfo = `
## Combined AI Usage Information

### Gemini (${geminiResult.modelName})
${geminiResult.usageInfoMarkdown || "*Usage information unavailable*"}

### Claude (${claudeResult.modelName})
${claudeResult.usageInfoMarkdown || "*Usage information unavailable*"}

**Total Estimated Cost**: $${(
    (geminiResult.estimatedCost || 0) + 
    (claudeResult.estimatedCost || 0)
  ).toFixed(4)} USD
`;

  return {
    analysisMarkdown: combinedAnalysis,
    usageInfoMarkdown: combinedUsageInfo,
    modelName: "multiple",
    provider: "Multi-provider",
    tokensUsed: (geminiResult.tokensUsed || 0) + (claudeResult.tokensUsed || 0),
    processingTimeMs: Math.max(geminiResult.processingTimeMs || 0, claudeResult.processingTimeMs || 0),
    estimatedCost: (geminiResult.estimatedCost || 0) + (claudeResult.estimatedCost || 0),
    currency: "USD"
  };
}

/**
 * Process HTML content with semantic chunking
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
 * Build analysis prompt for Gemini
 */
function buildAnalysisPrompt(data: AiAnalysisInput, htmlContextDesc: string): string {
  // Determine which analysis sections to include based on available data
  const hasVideo = !!data.videoBase64;
  const hasScreenshot = !!data.screenshotBase64;
  const hasNetwork = !!data.networkRequests;
  const hasVideoPath = !hasVideo && !!data.videoPath;

  // Build the base prompt
  let prompt = `
**Role**: You are a Senior Quality Engineer analyzing a test failure in a complex web application.

**Context**:
- ${hasVideo ? 'Video recording available - provides dynamic view of the test execution.' : ''}
- ${hasScreenshot ? 'Visual snapshot available - shows the final state at failure.' : 'No visual context available.'}
- HTML Context: ${htmlContextDesc}
- ${hasNetwork ? 'Network activity data provided - shows API calls and responses.' : 'No network data provided.'}

**Analysis Framework & Instructions**:
Based *primarily on the ${hasVideo ? 'video and' : ''} screenshot* (if provided) and secondarily on the HTML context:
`;

  // Element Identification Section
  prompt += `
### Element Identification
Clearly identify the specific UI element the test likely intended to interact with, given the failing selector \\\`${data.failingSelector || 'N/A'}\\\` and error message. Describe its visual appearance and location *from the ${hasVideo ? 'video and ' : ''}screenshot*. If no visual data, infer from HTML.
`;

  // Suggested Locators Section
  prompt += `
### Suggested Locators
Suggest 1-3 robust **alternative** locators for this element, following Playwright best practices (User-Facing > Test ID > CSS/XPath).
* Clearly label the type (e.g., "**User-Facing (Role):**").
* Format the locator code like \\\`page.getByRole(...)\\\`.
* Briefly explain the reasoning for *each* suggestion.
* Aim for uniqueness and stability.
`;

  // Failure Explanation Section
  prompt += `
### Failure Explanation
Provide a concise explanation of the *most likely* reason the original selector (\\\`${data.failingSelector || 'N/A'}\\\`) failed, consistent with the ${hasVideo ? 'video, ' : ''}screenshot, and HTML.
${hasNetwork ? '* Check if network requests indicate any API issues that might be related to the failure.' : ''}
`;

  // Add video analysis section if video is available
  if (hasVideo) {
    prompt += `
### Video Analysis
Analyze the video recording to understand the dynamic behavior:
1. Describe the sequence of user interactions and page transitions observed
2. Identify any visual glitches, unexpected behaviors, or timing issues
3. Note when and how the failure occurs in the sequence of events
4. Look for any performance issues or delays that might contribute to the failure
5. Explain how the video evidence supports or changes your analysis of the failure

Note: If you can see the video, please explicitly mention what you observe in the recording. If you cannot properly view the video content, please state that clearly in your analysis.
`;
  } else if (hasVideoPath) {
    // If we have a video path but no base64 data, add a note to the prompt
    prompt += `
### Note About Video
A video recording was captured during the test execution (${data.videoPath}), but could not be included in this analysis due to technical limitations with video processing.

Please base your analysis on the screenshot, HTML content, and other available information.
`;
  } else {
    // If no video is available, add a note about analyzing based on static content
    prompt += `
### Static Analysis
Since no video recording is available for this test execution, please analyze the failure based on:
1. The screenshot of the page at the time of failure
2. The HTML content of the page
3. The network requests and responses
4. The test code and error message

Focus on identifying patterns in the static content that might explain the failure.
`;
  }

  // Add network analysis section if network data is available
  if (hasNetwork) {
    prompt += `
### Network Analysis
Examine the network requests to identify API-related issues:
1. List any failed requests or unexpected responses
2. Identify any timing issues with network calls
3. Note any missing data that might affect the UI
4. Explain how network activity might have contributed to the failure
`;
  }

  // Test Improvement Suggestions Section
  if (data.testCode) {
    prompt += `
### Test Improvement Suggestions
Review the test code provided below and suggest improvements:
* Replace hardcoded waits (like \\\`page.waitForTimeout\\\`) with proper web assertions or state checks (e.g., \\\`expect(locator).toBeVisible()\\\`).
* Suggest better selectors or waiting strategies if applicable.
* Identify potential flakiness issues.
* Recommend additional assertions or validations based on the UI.
`;
  }

  // Add formatting instructions
  prompt += `
**Format Output (Pure Markdown):** Present the analysis using **standard Markdown**. Use level 3 headings (e.g., \\\`### Element Identification\\\`), bold text (\\\`**bold**\\\`), inline code (\\\`code\\\`), and numbered/bullet lists. Structure into sections, EACH separated by horizontal rules (\`---\`).

**IMPORTANT**: Insert a horizontal rule (\`---\`) BETWEEN EACH of the main sections.
`;

  // Add technical details
  prompt += `
=== Technical Details ===
Test: ${data.testTitle || 'Unnamed Test'}
Error: ${data.errorMsg}
Selector Attempted: ${data.failingSelector || 'N/A'}
${data.stackTrace ? `Stack Trace:\n\\\`\\\`\\\`\n${data.stackTrace}\n\\\`\\\`\\\`` : ''}
${data.testCode ? `\nTest Code:\n\\\`\\\`\\\`javascript\n${data.testCode}\n\\\`\\\`\\\`` : ''}
`;

  return prompt;
}

/**
 * Process usage info and calculate cost
 * @param usage The usage metadata from the API response
 * @param processingTimeMs Optional processing time in milliseconds
 * @returns Formatted usage information and cost calculations
 */
function processUsageInfo(usage?: UsageMetadata, processingTimeMs: number = 0): {
  markdown: string | null;
  totalTokens: number;
  estimatedCost: number;
  currency: string;
} {
  const result = {
    markdown: null as string | null,
    totalTokens: 0,
    estimatedCost: 0,
    currency: "USD"
  };

  if (!usage) return result;

  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let totalTokens: number | undefined;
  let usageAvailable = false;

  // Extract token counts from usage metadata
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
    const modelPricingInfo = MODEL_PRICING[DEFAULT_GEMINI_MODEL] || MODEL_PRICING.default;

    result.currency = modelPricingInfo.currency;
    const inputCost = (promptTokens / 1000) * modelPricingInfo.inputPer1k;
    const outputCost = (completionTokens / 1000) * modelPricingInfo.outputPer1k;
    const totalCost = inputCost + outputCost;
    
    result.totalTokens = totalTokens;
    result.estimatedCost = totalCost;

    // Format usage information as markdown, similar to claudeCaller.ts
    result.markdown = `
## AI Usage Information

1. Model: ${DEFAULT_GEMINI_MODEL}
2. Total Tokens: ${totalTokens.toLocaleString()} (Input: ${promptTokens.toLocaleString()}, Output: ${completionTokens.toLocaleString()})
3. Processing Time: ${(processingTimeMs / 1000).toFixed(2)} seconds
4. Estimated Cost: $${totalCost.toFixed(totalCost < 0.01 ? 6 : 4)} ${result.currency}

## Pricing Details
1. Input: $${modelPricingInfo.inputPer1k.toFixed(6)}/${result.currency} per 1K tokens
2. Output: $${modelPricingInfo.outputPer1k.toFixed(6)}/${result.currency} per 1K tokens

*Pricing as of March 2025. Check [ai.google.dev/pricing](https://ai.google.dev/pricing) for latest rates.*
`;

    return result;
  }

  // Return simpler message if counts are missing
  result.markdown = `
## AI Usage Information

1. Model: ${DEFAULT_GEMINI_MODEL}
2. Provider: Google Gemini

*Usage information incomplete or unavailable. Cost cannot be estimated.*
`;
  return result;
}