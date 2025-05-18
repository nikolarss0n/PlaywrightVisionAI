/**
 * Module for calling the Claude AI model
 */
import Anthropic from '@anthropic-ai/sdk';
import { AiAnalysisInput, AiDebuggingResult, VideoFrame } from './types';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// API key for Claude - check both environment variables for backward compatibility
const apiKey: string | undefined = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

// Model name with fallback (check both environment variables for backward compatibility)
export const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || process.env.CLAUDE_MODEL_NAME || "claude-3-haiku-20240307";

// Model pricing information (per 1M tokens)
const MODEL_PRICING: { [key: string]: { inputPer1M: number; outputPer1M: number; currency: string } } = {
  // Claude 3 Opus
  "claude-3-opus-20240229": { inputPer1M: 15, outputPer1M: 75, currency: "USD" },
  
  // Claude 3 Sonnet
  "claude-3-sonnet-20240229": { inputPer1M: 3, outputPer1M: 15, currency: "USD" },
  
  // Claude 3 Haiku
  "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25, currency: "USD" },
  
  // Default pricing
  "default": { inputPer1M: 15, outputPer1M: 75, currency: "USD" }
};

/**
 * Call Claude AI to debug a failed test
 * @param data Input data for AI analysis
 * @returns Promise resolving to the AI debugging result
 */
export async function callClaudeForDebugging(
  data: AiAnalysisInput & { videoFrames?: VideoFrame[], _directApiKey?: string }
): Promise<AiDebuggingResult> {
  console.log(`🧠 Using Claude for test debugging analysis`);
  
  try {
    // Use direct API key if provided (for testing purposes)
    const effectiveApiKey = data._directApiKey || apiKey;
    
    if (!effectiveApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    
    console.log('🔍 Claude API key found, using for analysis');
    
    // Initialize the Anthropic client
    const anthropic = new Anthropic({
      apiKey: effectiveApiKey
    });
    
    // Model to use - use the constant directly instead of re-reading env var
    const model = DEFAULT_CLAUDE_MODEL;
    console.log(`🧠 Using ${model} for analysis`);
    
    // Build the prompt for Claude
    const systemPrompt = buildSystemPrompt();
    const userPrompt: any[] = [{ type: "text", text: buildUserPrompt(data) }];
    
    // Add screenshot if available
    if (data.screenshotBase64) {
      // Clean the base64 string by removing the data URL prefix
      const cleanedScreenshotBase64 = data.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
      
      userPrompt.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: cleanedScreenshotBase64
        }
      });
      console.log("✅ Added screenshot to Claude analysis input");
    }
    
    // Add video frames if available
    if (data.videoFrames && data.videoFrames.length > 0) {
      for (const frame of data.videoFrames) {
        if (frame.base64) {
          // Clean the base64 string by removing the data URL prefix
          const cleanedFrameBase64 = frame.base64.replace(/^data:image\/\w+;base64,/, '');
          
          userPrompt.push({
            type: "image",
            source: {
              type: "base64",
              media_type: frame.mimeType || "image/jpeg",
              data: cleanedFrameBase64
            }
          });
          // Add frame description after each image
          userPrompt.push({
            type: "text",
            text: `Video frame at position ${frame.position.toFixed(2)}s of test execution`
          });
        }
      }
      console.log(`✅ Added ${data.videoFrames.length} video frames to Claude analysis input`);
    }
    
    // Start timestamp for performance measurement
    const startTime = Date.now();
    
    // Call the Claude API
    const response = await anthropic.messages.create({
      model: model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4000,
    });
    
    // Calculate time taken
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Extract the response text
    const responseText = response.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('\n');
    
    // Calculate token usage
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Get pricing for the model
    const pricing = MODEL_PRICING[model] || MODEL_PRICING.default;
    
    // Calculate cost (convert from per 1M tokens to actual cost)
    const inputCost = (inputTokens / 1000000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1000000) * pricing.outputPer1M;
    const totalCost = inputCost + outputCost;
    
    // Format usage information as simplified markdown to avoid rendering issues
    const usageInfoMarkdown = `
## AI Usage Information

1. Model: ${model}
2. Total Tokens: ${totalTokens.toLocaleString()} (Input: ${inputTokens.toLocaleString()}, Output: ${outputTokens.toLocaleString()})
3. Processing Time: ${(duration / 1000).toFixed(2)} seconds
4. Estimated Cost: $${totalCost.toFixed(4)} ${pricing.currency}

## Pricing Details
1. Input: $${pricing.inputPer1M.toFixed(4)}/${pricing.currency} per 1M tokens
2. Output: $${pricing.outputPer1M.toFixed(4)}/${pricing.currency} per 1M tokens
`;
    
    console.log(`✅ Claude analysis completed in ${duration}ms (${totalTokens.toLocaleString()} tokens)`);
    
    return {
      analysisMarkdown: responseText,
      usageInfoMarkdown,
      errorMarkdown: undefined,
      modelName: model,
      provider: "Anthropic Claude",
      tokensUsed: totalTokens,
      processingTimeMs: duration,
      estimatedCost: totalCost,
      currency: pricing.currency
    };
  } catch (error: any) {
    console.error("Error during Claude API call:", error);
    
    return {
      errorMarkdown: `**API Call Exception:** Error during AI analysis: ${error.message || error}.\n\nCheck console logs for details.`,
      modelName: DEFAULT_CLAUDE_MODEL,
      provider: "Anthropic Claude",
      tokensUsed: 0,
      processingTimeMs: 0,
      estimatedCost: 0,
      currency: "USD"
    };
  }
}

/**
 * Build the system prompt for Claude
 */
function buildSystemPrompt(): string {
  return `You are an expert QA Engineer and Playwright testing specialist. Your job is to analyze failed Playwright tests and provide detailed, actionable insights.

When analyzing test failures:
1. First examine the screenshot to understand the UI state at failure time
2. Look for common Playwright issues (selector problems, timing issues, unexpected UI states)
3. Check the test code for potential issues or improvements
4. Analyze any network requests for API/server issues
5. Look at additional video frames to understand the sequence of events

Provide your analysis in this format:

## Test Failure Analysis

[Your overall assessment of what caused the failure]

## Root Cause

[Identify the most likely cause]

## Visual Analysis

[Describe what's visible in the screenshot and video frames]

## Recommended Fix

[Provide specific code or configuration changes to fix the issue]

## Selector Suggestions

[If applicable, suggest more reliable CSS selectors]

BE SPECIFIC AND ACTIONABLE. Provide code examples where appropriate.`;
}

/**
 * Build the user prompt with test details
 */
function buildUserPrompt(data: AiAnalysisInput): string {
  let prompt = `Please analyze this failed Playwright test and identify the root cause.

## Error Details
Error Message: ${data.errorMsg || "No error message provided"}
${data.failingSelector ? `Failing Selector: ${data.failingSelector}` : ""}
${data.stackTrace ? `Stack Trace:\n\`\`\`\n${data.stackTrace}\n\`\`\`` : ""}

## Test Information
Test Title: ${data.testTitle || "Unnamed Test"}
`;

  // Add test code if available
  if (data.testCode) {
    prompt += `\n## Test Code\n\`\`\`typescript\n${data.testCode}\n\`\`\`\n`;
  }
  
  // Add HTML if available (optional, as it can be very large)
  if (data.html) {
    // Truncate HTML if it's too long
    const maxHtmlLength = 10000;
    const truncatedHtml = data.html.length > maxHtmlLength
      ? data.html.substring(0, maxHtmlLength) + "\n... [HTML truncated]"
      : data.html;
      
    prompt += `\n## Page HTML (at time of failure)\n\`\`\`html\n${truncatedHtml}\n\`\`\`\n`;
  }
  
  // Add network requests if available
  if (data.networkRequests) {
    prompt += `\n## Network Requests\n`;
    
    try {
      if (typeof data.networkRequests === 'string') {
        if (data.networkRequests === "No network requests captured.") {
          prompt += "No network requests were captured during the test execution.\n";
        } else {
          // Try to parse as JSON
          try {
            const requests = JSON.parse(data.networkRequests);
            
            // Limit to the last 10 requests to keep context size manageable
            if (Array.isArray(requests)) {
              const lastRequests = requests.slice(-10);
              lastRequests.forEach((req, index) => {
                prompt += `${index + 1}. ${req.method || 'GET'} ${req.url || 'unknown'} (${req.status || "No status"})\n`;
                
                // Add important details
                if (req.resourceType) {
                  prompt += `   Type: ${req.resourceType}\n`;
                }
                
                if (req.requestHeaders && Object.keys(req.requestHeaders).length > 0) {
                  prompt += `   Request Headers: ${JSON.stringify(req.requestHeaders)}\n`;
                }
                
                if (req.responseHeaders && Object.keys(req.responseHeaders).length > 0) {
                  prompt += `   Response Headers: ${JSON.stringify(req.responseHeaders)}\n`;
                }
                
                if (req.requestBody) {
                  prompt += `   Request Body: ${JSON.stringify(req.requestBody)}\n`;
                }
                
                if (req.responseBody) {
                  prompt += `   Response Body: ${JSON.stringify(req.responseBody)}\n`;
                }
                
                if (req.error) {
                  prompt += `   Error: ${req.error}\n`;
                }
                
                prompt += "\n";
              });
            } else {
              // Not an array, just print the raw string (limited length)
              prompt += `${data.networkRequests.substring(0, 1000)}${data.networkRequests.length > 1000 ? '...(truncated)' : ''}\n`;
            }
          } catch (jsonError) {
            // Not valid JSON, just print the raw string (limited length)
            prompt += `${data.networkRequests.substring(0, 1000)}${data.networkRequests.length > 1000 ? '...(truncated)' : ''}\n`;
          }
        }
      } else if (Array.isArray(data.networkRequests)) {
        // Handle direct array of network requests
        const lastRequests = data.networkRequests.slice(-10);
        lastRequests.forEach((req, index) => {
          prompt += `${index + 1}. ${req.method || 'GET'} ${req.url || 'unknown'} (${req.status || "No status"})\n`;
          if (req.error) {
            prompt += `   Error: ${req.error}\n`;
          }
        });
      } else {
        prompt += `Network requests data available but couldn't be processed.\n`;
      }
    } catch (e) {
      prompt += `Network requests data available but couldn't be processed: ${e.message || String(e)}.\n`;
    }
  }
  
  prompt += "\nI'll now show you the screenshot of the failure state and video frames from the test execution. Carefully analyze these images to understand what happened during the test.";
  
  return prompt;
}