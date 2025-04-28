/**
 * Module for generating HTML reports
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TestInfo } from '@playwright/test';
import { marked } from 'marked';
import type { NetworkRequest } from './types';

/**
 * Helper function to escape HTML characters
 */
export function escapeHtml(unsafe: string | undefined | null): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper function to safely convert an error message to string
 */
export function safeErrorToString(errorMsg: unknown): string {
  if (errorMsg === null || errorMsg === undefined) {
    return 'No error message available';
  }
  
  if (typeof errorMsg === 'string') {
    return errorMsg;
  }
  
  if (typeof errorMsg === 'object') {
    try {
      // Try to stringify the object with proper formatting
      return JSON.stringify(errorMsg, null, 2);
    } catch (e) {
      // If JSON.stringify fails, fall back to simpler approach
      return Object.prototype.toString.call(errorMsg);
    }
  }
  
  // For anything else, convert to string
  return String(errorMsg);
}

/**
 * Saves the HTML report and attaches it to the test results
 */
export async function saveAndAttachReport(
  testInfo: TestInfo,
  htmlReport: string,
  analysisMarkdown?: string,
  usageInfoMarkdown?: string
): Promise<void> {
  try {
    // Create a folder for AI debug reports if it doesn't exist
    const reportFolder = path.join(process.cwd(), 'ai-analysis');
    if (!fs.existsSync(reportFolder)) {
      fs.mkdirSync(reportFolder, { recursive: true });
    }

    // Generate a timestamp-based filename to avoid overwriting
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportFilePath = path.join(reportFolder, `ai-debug-analysis-${timestamp}.html`);
    
    // Write the HTML report to a file
    fs.writeFileSync(reportFilePath, htmlReport);
    console.log(`✅ HTML report saved to: ${reportFilePath}`);
    
    // Attach the report to the test results
    await testInfo.attach('ai-debug-report.html', {
      path: reportFilePath,
      contentType: 'text/html',
    });
    
    // Also save markdown files if provided
    if (analysisMarkdown) {
      const markdownPath = path.join(reportFolder, `ai-analysis-${timestamp}.md`);
      fs.writeFileSync(markdownPath, analysisMarkdown);
      await testInfo.attach('ai-analysis.md', {
        path: markdownPath,
        contentType: 'text/markdown',
      });
    }
    
    if (usageInfoMarkdown) {
      const usagePath = path.join(reportFolder, `usage-info-${timestamp}.md`);
      fs.writeFileSync(usagePath, usageInfoMarkdown);
      await testInfo.attach('usage-info.md', {
        path: usagePath,
        contentType: 'text/markdown',
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to save or attach report: ${errorMessage}`);
  }
}

/**
 * Generates the HTML report from the collected data - with terminal-like styling
 */
export function generateHtmlReport({
  testInfo,
  failingSelector,
  testCode,
  errorMsg,
  stackTrace,
  networkRequests,
  aiAnalysisHtml,
  usageInfoHtml,
  screenshotBase64
}: {
  testInfo: TestInfo;
  failingSelector?: string | null;
  testCode?: string;
  errorMsg: string;
  stackTrace?: string;
  networkRequests: NetworkRequest[];
  aiAnalysisHtml: string;
  usageInfoHtml: string;
  screenshotBase64?: string;
}): string {
  const reportTitle = `Playwright Vision AI Debug Report: ${escapeHtml(testInfo.title)}`;
  
  // Generate HTML header with styling
  const htmlHeader = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        });
    </script>
    <style>
        /* Reset box model for consistent layout */
        * {
            box-sizing: border-box;
        }

        /* --- Terminal-like styling --- */
        :root {
            --bg-color: #151718;
            --text-color: #d9d9d9;
            --heading-color: #ffffff;
            --prompt-char-color: #5fb3b3;
            --terminal-border: #303436;
            --code-bg: #1c1e1f;
            --accent-color: #7b9db4;
            --success-color: #99c794;
            --error-color: #ec5f67;
            --warn-color: #fac863;
            --purple-color: #c594c5;
            --link-color: #6699cc;
            --dim-color: #65737e;
            --selection-bg: #3e4451;
            --selection-text: #dfe1e8;
            --claude-purple: #8a56ac;
            --claude-orange: #ff9500;
            --claude-green: #28a745;
            --tab-hover: rgba(32, 34, 35, 0.8);
            --tab-active: rgba(27, 29, 30, 0.8);
        }
        
        /* Blurred background image */
        .bg-blur {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://preview.redd.it/macos-sonoma-wallpapers-5120x2160-v0-j9vwvbq8h5wb1.jpg?width=5120&format=pjpg&auto=webp&s=943e6f75b62ea11c987d13b3ba7091abecd48ab6');
            background-size: cover, cover;
            background-position: center center, center center;
            background-attachment: fixed;
            filter: blur(8px);
            -webkit-filter: blur(8px);
            transform: scale(1.05);
        }

        /* Basic styles */
        html, body {
            color: var(--text-color);
            font-family: 'JetBrains Mono', monospace;
            line-height: 1.5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
        }

        /* Terminal container */
        main {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
            position: relative;
            z-index: 1;
        }

        /* Terminal section */
        .terminal-section {
            background-color: rgba(21, 23, 24, 0.85);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            margin-bottom: 2rem;
            overflow: hidden;
            border: 1px solid var(--terminal-border);
        }

        /* Terminal header */
        .terminal-header {
            background-color: rgba(28, 30, 31, 0.9);
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            border-bottom: 1px solid var(--terminal-border);
        }

        .terminal-title {
            color: var(--heading-color);
            font-size: 1rem;
            margin: 0;
            flex-grow: 1;
            position: relative;
            padding-left: 1.5rem;
        }

        .terminal-title::before {
            content: '●';
            position: absolute;
            left: 0;
            color: var(--claude-purple);
            font-size: 0.8em;
        }

        /* Terminal body */
        .terminal-body {
            padding: 1rem;
            overflow-x: auto;
        }

        /* Headings */
        h2, h3 {
            color: var(--heading-color);
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 1rem;
            position: relative;
            padding-left: 1.25rem;
            letter-spacing: 0.01em;
        }

        h2::before, h3::before {
            content: '▶';
            position: absolute;
            left: 0;
            color: var(--claude-blue);
            font-size: 0.8em;
        }

        /* Method colors for network requests */
        .method-get { color: var(--link-color); }
        .method-post { color: var(--success-color); }
        .method-put { color: var(--warn-color); }
        .method-delete { color: var(--error-color); }
        .method-options { color: var(--purple-color); }
        
        /* Status colors */
        .status-success { color: var(--success-color); }
        .status-redirect { color: var(--warn-color); }
        .status-error { color: var(--error-color); }

        /* Link styles */
        a {
            color: var(--link-color);
            text-decoration: none;
            transition: all 0.2s ease;
        }

        a:hover {
            text-decoration: underline;
            opacity: 0.9;
        }

        /* List styles */
        ul, ol {
            padding-left: 1.5rem;
            margin: 0.5rem 0 1rem;
        }

        li {
            margin-bottom: 0.25rem;
        }

        /* Table styles */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.9rem;
        }

        thead {
            background-color: rgba(28, 30, 31, 0.8);
            color: var(--heading-color);
        }

        th, td {
            padding: 0.5rem 0.75rem;
            text-align: left;
            border-bottom: 1px solid var(--terminal-border);
        }

        tr:hover {
            background-color: rgba(255, 255, 255, 0.02);
        }

        /* Button styling */
        button {
            background-color: var(--code-bg);
            color: var(--accent-color);
            border: 1px solid var(--terminal-border);
            border-radius: 4px;
            padding: 0.25rem 0.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        button:hover {
            background-color: var(--accent-color);
            color: var(--bg-color);
        }

        /* Utility classes */
        .hidden { display: none; }
        .mt-4 { margin-top: 1rem; }
        .mb-4 { margin-bottom: 1rem; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .overflow-x-auto { overflow-x: auto; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-purple { color: var(--purple-color); }
        .text-dim { color: var(--dim-color); }
        .text-success { color: var(--success-color); }
        .text-error { color: var(--error-color); }
        .text-warn { color: var(--warn-color); }
        .text-link { color: var(--link-color); }

        /* Input style */
        input[type="text"] {
            background-color: rgba(28, 30, 31, 0.7);
            color: var(--text-color);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            padding: 0.5rem;
            border: 1px solid var(--terminal-border);
            border-radius: 4px;
            width: 100%;
            margin-bottom: 0.5rem;
        }

        input[type="text"]:focus {
            outline: none;
            border-color: var(--claude-purple);
            box-shadow: 0 0 0 2px rgba(138, 86, 172, 0.3);
        }

        /* Filter button styles */
        .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .filter-btn {
            padding: 4px 8px;
            border-radius: 4px;
            background-color: rgba(40, 42, 44, 0.8);
            color: var(--text-color);
            border: 1px solid var(--terminal-border);
            font-size: 0.8rem;
            transition: all 0.2s ease;
        }

        .filter-btn:hover {
            background-color: rgba(60, 62, 64, 0.8);
        }

        .filter-btn.active-filter {
            background-color: var(--claude-purple);
            color: white;
        }

        .error-filter.active-filter {
            background-color: var(--error-color);
            color: white;
        }

        /* Screenshot thumbnail styling */
        .screenshot-thumbnail {
            max-width: 350px;
            margin: 1rem 0;
            border-radius: 6px;
            border: 2px solid var(--terminal-border);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .screenshot-thumbnail:hover {
            transform: scale(1.02);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
            border-color: var(--claude-purple);
        }
        
        .screenshot-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            background-color: rgba(21, 23, 24, 0.95);
            backdrop-filter: blur(5px);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
            padding: 15px;
            width: 90%;
            max-width: 1200px;
            max-height: 90%;
            overflow: hidden;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border: 1px solid var(--terminal-border);
        }
        
        .screenshot-modal-content {
            display: block;
            border-radius: 6px;
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
            margin: 0 auto;
        }
        
        .screenshot-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--terminal-border);
        }
        
        .screenshot-modal-title {
            color: var(--heading-color);
            font-size: 0.9rem;
            margin: 0;
            font-weight: 500;
        }
        
        .screenshot-close {
            color: var(--text-color);
            background-color: var(--code-bg);
            border: 1px solid var(--terminal-border);
            border-radius: 4px;
            padding: 2px 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .screenshot-close:hover,
        .screenshot-close:focus {
            background-color: var(--error-color);
            color: white;
            text-decoration: none;
            border-color: var(--error-color);
            cursor: pointer;
        }

        /* Screenshot in Failure Explanation section */
        .failure-explanation-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: flex-start;
            margin-top: 15px;
        }
        
        .failure-screenshot {
            flex: 0 0 300px;
            max-width: 300px;
            margin-bottom: 15px;
            border-radius: 6px;
            border: 2px solid var(--terminal-border);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .failure-screenshot:hover {
            transform: scale(1.02);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
            border-color: var(--claude-purple);
        }
        
        .failure-text {
            flex: 1;
            min-width: 250px;
        }

        /* AI content area */
        .ai-content-area p { 
            margin-bottom: 0.75rem;
            margin-top: 0.5rem;
            line-height: 1.6;
        }
        
        /* Enhanced bullet points and list styling for AI analysis */
        .ai-content-area ul {
            padding-left: 1.5rem;
            margin: 0.8rem 0 1.2rem;
        }
        
        .ai-content-area ul li {
            margin-bottom: 0.6rem;
            position: relative;
            padding-left: 0.5rem;
            list-style-type: none;
        }
        
        .ai-content-area ul li::before {
            content: "✦";
            color: var(--claude-green);
            position: absolute;
            left: -1.2rem;
            font-weight: bold;
        }
        
        /* Improved section separation */
        .ai-content-area hr {
            border: none;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--claude-purple) 50%, transparent);
            margin: 1rem 0px 2rem
        }
        
        /* Enhanced heading styling */
        .ai-content-area h3 {
            color: var(--claude-orange);
        }
        
        /* Code block highlighting */
        .ai-content-area code { 
            background-color: rgba(28, 30, 31, 0.7); 
            padding: 2px 4px; 
            border-radius: 3px; 
            font-size: 0.9em; 
            color: var(--claude-blue);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .ai-content-area pre { 
            background-color: rgba(28, 30, 31, 0.7);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
        }
        
        .ai-content-area pre code { 
            background: none; 
            padding: 0; 
            border: none;
        }
        
        .ai-highlight {
            background-color: rgba(138, 86, 172, 0.3);
            border-radius: 2px;
            padding: 0 2px;
        }

        /* Tabs styling */
        .tabs-container {
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .tab-buttons {
            overflow-x: auto;
            border-bottom: 1px solid var(--terminal-border);
            padding-left: 1rem;
            padding-right: 1rem;
            padding-bottom: 0.5rem;
        }

        .tab-button {
            padding: 0.75rem 1.25rem;
            background-color: transparent;
            color: var(--dim-color);
            border: none;
            border-bottom: 2px solid transparent;
            border-radius: 7px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .tab-button:hover {
            color: var(--heading-color);
            background-color: var(--tab-hover);
            border-radius: 7px;
        }

        .tab-button.active {
            color: var(--heading-color);
            border-bottom: 2px solid var(--claude-purple);
            background-color: var(--tab-active);
        }

        .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 2px;
            background-color: var(--claude-purple);
        }

        .tab-button:focus {
            outline: none;
        }

        .tab-content {
            display: none;
            padding: 1rem;
        }

        .tab-content.active {
            display: block;
        }

        .view-btn {
            padding: 5px 10px;
            border-radius: 4px;
        }

        .badge {
            font-size: 0.65rem;
            padding: 0.1rem 0.4rem;
            border-radius: 10px;
            margin-left: 0.5rem;
            display: inline-block;
            vertical-align: middle;
            text-align: center;
        }

        .badge-error {
            background-color: var(--error-color);
            color: white;
        }

        .badge-warning {
            background-color: var(--warn-color);
            color: var(--bg-color);
        }

        .badge-info {
            background-color: var(--link-color);
            color: white;
        }

        /* Code styling */
        code, pre {
            font-family: 'JetBrains Mono', monospace;
        }

        code {
            border-radius: 4px;
        }

        /* Override highlight.js backgrounds while preserving syntax highlighting */
        .hljs {
            background: transparent !important; /* Remove hljs background */
        }

        pre {
            background-color: rgba(28, 30, 31, 0.7);
            border-radius: 6px;
            padding: 0.75rem;
            margin: 0.75rem 0;
            overflow-x: auto;
            border: 1px solid var(--claude-purple);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
        }

        code.error-block-code {
            display: block;
            background-color: rgba(236, 95, 103, 0.1);
            color: var(--error-color);
            padding: 0.75rem;
            border-radius: 4px;
            border-left: 2px solid var(--error-color);
            white-space: pre-wrap;
            word-break: break-all;
        }

        /* Command styling (Claude Code specific) */
        .command-input::before {
            content: "$ ";
            color: var(--claude-green);
            font-weight: bold;
        }

        /* Claude Code thinking style */
        .thinking {
            color: var(--claude-orange);
            font-style: italic;
        }

        /* Sub tabs for filtering AI content */
        .ai-filter-tabs {
            display: flex;
            overflow-x: auto;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--terminal-border);
            padding-bottom: 0.5rem;
        }

        .ai-filter-btn {
            padding: 4px 12px;
            margin-right: 4px;
            border-radius: 7px;
            background-color: rgba(40, 42, 44, 0.8);
            color: var(--text-color);
            border: 1px solid var(--terminal-border);
            border-bottom: none;
            font-size: 0.8rem;
            transition: all 0.2s ease;
        }

        .ai-filter-btn:hover {
            background-color: rgba(60, 62, 64, 0.8);
        }

        .ai-filter-btn.active-filter {
            background-color: var(--claude-purple);
            color: white;
        }

        /* Card styling */
        .card {
            margin-bottom: 1rem;
            overflow: hidden;
        }

        .card-header {
            background-color: rgba(37, 39, 40, 0.8);
            border-radius: 7px;
            padding: 0.75rem 1rem;
            border: 1px solid var(--claude-orange);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-title {
            color: var(--claude-orange);
            font-size: 0.9rem;
            margin: 0;
            font-weight: 500;
        }

        .card-body {
            padding: 1rem;
        }

        /* Dividers */
        .divider {
            height: 1px;
            width: 100%;
            background-color: var(--terminal-border);
            margin: 1rem 0;
        }

        /* Mobile responsive - adjust layout for small screens */
        @media (max-width: 640px) {
            .tab-buttons {
                flex-wrap: wrap;
            }

            .tab-button {
                border-radius: 7px;
                flex: 1 1 auto;
                padding: 0.5rem;
                font-size: 0.75rem;
                text-align: center;
            }

            .filter-buttons {
                flex-wrap: wrap;
            }

            .filter-btn {
                flex: 1 1 auto;
                text-align: center;
                font-size: 0.7rem;
                padding: 3px 6px;
            }
        }
    </style>
</head>`;
  // Body start with blur background and terminal section
  const bodyStart = `
<body>
    <div class="bg-blur"></div>
    <main>
        <section class="terminal-section">
            <div class="terminal-header">
                <h2 class="terminal-title">Playwright Vision AI Debugger</h2>
            </div>
            <div class="terminal-body">
                <div class="tabs-container">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="overview">Test Overview</button>
                        <button class="tab-button" data-tab="error">Error Details <span class="badge badge-error">1</span></button>
                        <button class="tab-button" data-tab="ai">AI Analysis</button>
                        <button class="tab-button" data-tab="network">Network Requests <span class="badge badge-info">${networkRequests.length}</span></button>
                        <button class="tab-button" data-tab="usage">Usage Info</button>
                    </div>`;

  // Test Overview Tab
  const overviewTab = `
                    <!-- Test Overview Tab -->
                    <div class="tab-content active" id="overview-tab">
                        <div class="card mt-4">
                            <div class="card-header">
                                <h3 class="card-title">Test Information</h3>
                            </div>
                            <div class="card-body">
                                <p><strong>Test:</strong> ${escapeHtml(testInfo.title)}</p>
                                <p><strong>File:</strong> ${escapeHtml(path.relative(process.cwd(), testInfo.file))}</p>
                                <p><strong>Browser:</strong> ${escapeHtml(testInfo.project.name)}</p>
                                <p><strong>Status:</strong> <span class="text-error">failed</span></p>
                                <p><strong>Duration:</strong> ${testInfo.duration}ms</p>
                            </div>
                        </div>

                        ${failingSelector ? `
                        <div class="card mt-4">
                            <div class="card-header">
                                <h3 class="card-title">Failing Selector</h3>
                            </div>
                            <div class="card-body">
                                <code>${escapeHtml(failingSelector)}</code>
                            </div>
                        </div>` : ''}

                        ${testCode ? `
                        <div class="card mt-4">
                            <div class="card-header">
                                <h3 class="card-title">Test Code</h3>
                            </div>
                            <div class="card-body">
                                <pre><code class="language-javascript">${escapeHtml(testCode)}</code></pre>
                            </div>
                        </div>` : ''}
                    </div>`;

  // Error Details Tab
  const errorTab = `
                    <!-- Error Details Tab -->
                    <div class="tab-content" id="error-tab">
                        <div class="card mt-4">
                            <div class="card-header">
                                <h3 class="card-title">Error Information</h3>
                            </div>
                            <div class="card-body">
                                <p><strong class="text-error">Error Message:</strong></p>
                                <code class="error-block-code">${escapeHtml(safeErrorToString(errorMsg))}</code>
                                
                                ${stackTrace ? `
                                <div class="mt-4">
                                    <details>
                                        <summary>Show Stack Trace</summary>
                                        <pre><code class="language-javascript">${escapeHtml(stackTrace)}</code></pre>
                                    </details>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>`;

  // AI Analysis Tab
  const aiAnalysisTab = `
                    <!-- AI Analysis Tab -->
                    <div class="tab-content" id="ai-tab">
                        <div class="mb-4">
                            <div class="ai-filter-tabs">
                                <button class="ai-filter-btn active-filter" data-filter="all" onclick="filterAiContent('all')">All</button>
                                <button class="ai-filter-btn" data-filter="root-cause" onclick="filterAiContent('root-cause')">Root Cause</button>
                                <button class="ai-filter-btn" data-filter="solution" onclick="filterAiContent('solution')">Solutions</button>
                                <button class="ai-filter-btn" data-filter="debugging" onclick="filterAiContent('debugging')">Debugging Steps</button>
                                <button class="ai-filter-btn" data-filter="code" onclick="filterAiContent('code')">Code Examples</button>
                            </div>
                        </div>
                        <div id="aiContentContainer" class="ai-content-area">
                            ${aiAnalysisHtml}
                        </div>
                        
                        ${screenshotBase64 ? `
                        <!-- Modal for fullscreen screenshot -->
                        <div id="screenshotModal" class="screenshot-modal">
                            <div class="screenshot-modal-header">
                                <h4 class="screenshot-modal-title">Screenshot Preview</h4>
                                <button class="screenshot-close" onclick="closeScreenshotModal()">Close</button>
                            </div>
                            <img class="screenshot-modal-content" src="data:image/png;base64,${screenshotBase64}" />
                        </div>` : ''}
                    </div>`;

  // Network Requests Tab
  const networkTabStart = `
                    <!-- Network Requests Tab -->
                    <div class="tab-content" id="network-tab">
                        <div class="card-header">
                            <h2 class="card-title">Network Requests</h2>
                        </div>
                        <div class="mb-4">
                            <input type="text" id="networkSearch" placeholder="Search network requests..." 
                                onkeyup="filterNetworkRequests()">
                            <div class="filter-buttons">
                                <button class="filter-btn active-filter" data-filter="all" onclick="filterByType('all')">All</button>
                                <button class="filter-btn" data-filter="xhr" onclick="filterByType('xhr')">XHR</button>
                                <button class="filter-btn" data-filter="fetch" onclick="filterByType('fetch')">Fetch</button>
                                <button class="filter-btn" data-filter="document" onclick="filterByType('document')">Document</button>
                                <button class="filter-btn" data-filter="stylesheet" onclick="filterByType('stylesheet')">CSS</button>
                                <button class="filter-btn" data-filter="script" onclick="filterByType('script')">JS</button>
                                <button class="filter-btn" data-filter="image" onclick="filterByType('image')">Images</button>
                                <button class="filter-btn error-filter" onclick="filterByStatus('error')">Errors</button>
                            </div>
                        </div>
                        
                        <div class="overflow-x-auto">
                            <table id="networkTable">
                                <thead>
                                    <tr>
                                        <th>Method</th>
                                        <th>Type</th>
                                        <th>URL</th>
                                        <th>Status</th>
                                        <th>Content-Type</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                                
  // Generate network rows
  const networkTableRows = networkRequests.length > 0 
    ? networkRequests.map((req, index) => {
        const statusClass = (req.status ?? 0) >= 400 ? 'status-error' : ((req.status ?? 0) >= 300 ? 'status-redirect' : 'status-success');
        const methodClass = req.method?.toLowerCase() === 'get' ? 'method-get' : 
                          req.method?.toLowerCase() === 'post' ? 'method-post' :
                          req.method?.toLowerCase() === 'put' ? 'method-put' :
                          req.method?.toLowerCase() === 'delete' ? 'method-delete' : '';
        
        return `
                                    <tr class="network-row" data-type="${escapeHtml(req.resourceType || '')}" data-url="${escapeHtml(req.url || '')}" data-status="${req.status || 0}">
                                        <td class="${methodClass}">${escapeHtml(req.method || 'GET')}</td>
                                        <td class="text-purple">${escapeHtml(req.resourceType || '')}</td>
                                        <td class="font-mono text-xs" style="max-width: 250px; word-break: break-all;">${escapeHtml(req.url || '')}</td>
                                        <td class="${statusClass}">${req.status || 0}</td>
                                        <td class="font-mono text-xs">${escapeHtml(req.responseHeaders?.['content-type'] || '')}</td>
                                        <td>
                                            <button class="view-btn" onclick="toggleDetails('request-${index}')">View</button>
                                        </td>
                                    </tr>
                                    <tr id="request-${index}" class="hidden">
                                        <td colspan="6">
                                            <div class="text-xs">
                                                ${req.requestPostData ? `
                                                <div class="mb-4">
                                                    <strong class="text-link">Request Data:</strong>
                                                    <pre><code>${escapeHtml(
                                                        (() => {
                                                            try {
                                                                const json = JSON.parse(req.requestPostData);
                                                                return JSON.stringify(json, null, 2);
                                                            } catch (e) {
                                                                return req.requestPostData;
                                                            }
                                                        })()
                                                    )}</code></pre>
                                                </div>` : ''}
                                                ${req.responseBody ? `
                                                <div class="mb-4">
                                                    <strong class="text-success">Response Body:</strong>
                                                    <pre><code>${escapeHtml(
                                                        (() => {
                                                            try {
                                                                const json = JSON.parse(req.responseBody);
                                                                return JSON.stringify(json, null, 2);
                                                            } catch (e) {
                                                                return req.responseBody;
                                                            }
                                                        })()
                                                    )}</code></pre>
                                                </div>` : ''}
                                                ${req.requestHeaders ? `
                                                <div>
                                                    <strong class="text-warn">Request Headers:</strong>
                                                    <pre><code>${escapeHtml(JSON.stringify(req.requestHeaders, null, 2))}</code></pre>
                                                </div>` : ''}
                                                ${req.responseHeaders ? `
                                                <div class="mt-4">
                                                    <strong class="text-warn">Response Headers:</strong>
                                                    <pre><code>${escapeHtml(JSON.stringify(req.responseHeaders, null, 2))}</code></pre>
                                                </div>` : ''}
                                            </div>
                                        </td>
                                    </tr>`;
    }).join('') 
    : '<tr><td colspan="6">No network requests recorded</td></tr>';

  const networkTabEnd = `
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-4">
                            <details>
                                <summary>Network Stats</summary>
                                <div class="card mt-2">
                                    <div class="card-body">
                                        <p><strong>Total Requests:</strong> ${networkRequests.length}</p>
                                        <p><strong>Request Types:</strong> ${
                                            Object.entries(networkRequests.reduce((acc, req) => {
                                                if (req.resourceType) acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
                                                return acc;
                                            }, {} as Record<string, number>)).map(([type, count]) => `${type} (${count})`).join(', ') || 'None'
                                        }</p>
                                        <p><strong>Status Codes:</strong> ${
                                            Object.entries(networkRequests.reduce((acc, req) => {
                                                if (req.status) {
                                                    const key = req.status >= 500 ? '5xx' : 
                                                              req.status >= 400 ? '4xx' :
                                                              req.status >= 300 ? '3xx' :
                                                              req.status >= 200 ? '2xx' : '1xx';
                                                    acc[key] = (acc[key] || 0) + 1;
                                                }
                                                return acc;
                                            }, {} as Record<string, number>)).map(([code, count]) => `${code} (${count})`).join(', ') || 'None'
                                        }</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>`;

  // Usage Info Tab
  const usageTab = `
                    <!-- Usage Info Tab -->
                    <div class="tab-content" id="usage-tab">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">AI Model Details</h3>
                            </div>
                            <div class="card-body">
                                <p><strong>Model:</strong> gemini-1.5-pro-latest</p>
                                <p><strong>Provider:</strong> Google Generative AI</p>
                                <div id="usageContentContainer">
                                    ${usageInfoHtml}
                                </div>
                            </div>
                        </div>
                    </div>`;

  const bodyEnd = `
                </div>
            </div>
        </section>
    </main>`;

  // JavaScript for functionality
  const javaScript = `
    <script>
        // Tab switching
        document.addEventListener('DOMContentLoaded', function() {
            const tabButtons = document.querySelectorAll('.tab-button');
            tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Get the tab ID from the data-tab attribute
                    const tabId = this.dataset.tab;
                    
                    // Remove active class from all buttons and tabs
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                    
                    // Add active class to clicked button and corresponding tab
                    this.classList.add('active');
                    document.getElementById(tabId + '-tab').classList.add('active');
                });
            });
            
            // Apply styles to filter buttons
            const filterButtons = document.querySelectorAll('.filter-btn');
            filterButtons.forEach(btn => {
                if (btn.classList.contains('active-filter')) {
                    btn.style.backgroundColor = 'var(--claude-purple)';
                    btn.style.color = 'white';
                }
            });
            
            // Apply styles to AI filter buttons
            const aiFilterButtons = document.querySelectorAll('.ai-filter-btn');
            aiFilterButtons.forEach(btn => {
                if (btn.classList.contains('active-filter')) {
                    btn.style.backgroundColor = 'var(--claude-purple)';
                    btn.style.color = 'white';
                }
            });
        });
        
        // Toggle request details
        function toggleDetails(id) {
            const element = document.getElementById(id);
            if (element.classList.contains('hidden')) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
        
        // Network request filtering functions
        function filterNetworkRequests() {
            const searchText = document.getElementById('networkSearch').value.toLowerCase();
            const rows = document.querySelectorAll('#networkTable tbody tr.network-row');
            
            rows.forEach(row => {
                const url = row.getAttribute('data-url').toLowerCase();
                const detailsRowId = 'request-' + (row.rowIndex - 2);
                const detailsRow = document.getElementById(detailsRowId);
                
                // If the search text is found in the URL
                if (url.includes(searchText)) {
                    row.style.display = '';
                    // Also handle any open detail rows
                    if (detailsRow && !detailsRow.classList.contains('hidden')) {
                        detailsRow.style.display = '';
                    }
                } else {
                    row.style.display = 'none';
                    // Also hide any open detail rows
                    if (detailsRow) {
                        detailsRow.style.display = 'none';
                    }
                }
            });
        }
        
        function filterByType(type) {
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.getAttribute('data-filter') === type) {
                    btn.classList.add('active-filter');
                    btn.style.backgroundColor = 'var(--claude-purple)';
                    btn.style.color = 'white';
                } else {
                    btn.classList.remove('active-filter');
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                }
                
                if (btn.classList.contains('error-filter')) {
                    btn.classList.remove('active-filter');
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                }
            });
            
            const rows = document.querySelectorAll('#networkTable tbody tr.network-row');
            rows.forEach(row => {
                const rowType = row.getAttribute('data-type');
                const detailsRowId = 'request-' + (row.rowIndex - 2);
                const detailsRow = document.getElementById(detailsRowId);
                
                if (type === 'all' || rowType === type) {
                    row.style.display = '';
                    if (detailsRow && !detailsRow.classList.contains('hidden')) {
                        detailsRow.style.display = '';
                    }
                } else {
                    row.style.display = 'none';
                    if (detailsRow) {
                        detailsRow.style.display = 'none';
                    }
                }
            });
        }
        
        function filterByStatus(status) {
            const rows = document.querySelectorAll('#networkTable tbody tr.network-row');
            rows.forEach(row => {
                const status = parseInt(row.getAttribute('data-status') || '0');
                const detailsRowId = 'request-' + (row.rowIndex - 2);
                const detailsRow = document.getElementById(detailsRowId);
                
                if (status >= 400) {
                    row.style.display = '';
                    if (detailsRow && !detailsRow.classList.contains('hidden')) {
                        detailsRow.style.display = '';
                    }
                } else {
                    row.style.display = 'none';
                    if (detailsRow) {
                        detailsRow.style.display = 'none';
                    }
                }
            });
        }
        
        // AI content filtering functions
        function searchAiContent() {
            const searchText = document.getElementById('aiSearchInput').value.toLowerCase();
            const container = document.getElementById('aiContentContainer');
            
            if (!searchText.trim()) {
                // If search is empty, show everything and reset highlighting
                showAllAiSections();
                return;
            }
            
            // Extract all headings and paragraphs for text search
            const contentElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, code');
            
            // Track if we found any matches
            let foundMatch = false;
            
            contentElements.forEach(element => {
                const text = element.textContent.toLowerCase();
                
                // Check if this element contains the search text
                if (text.includes(searchText)) {
                    // Make sure this element and all its parents are visible
                    let parent = element;
                    while (parent && parent !== container) {
                        if (parent.style) parent.style.display = '';
                        parent = parent.parentElement;
                    }
                    
                    // Highlight the matching text
                    const originalHTML = element.innerHTML;
                    const regex = new RegExp('(' + searchText + ')', 'gi');
                    element.innerHTML = originalHTML.replace(regex, '<mark class="ai-highlight">$1</mark>');
                    
                    foundMatch = true;
                } else if (element.style) {
                    // Hide non-matching elements
                    element.style.display = 'none';
                }
            });
            
            // If no match found, show a message
            if (!foundMatch) {
                const noResults = document.createElement('p');
                noResults.textContent = 'No results found for "' + searchText + '"';
                noResults.classList.add('text-dim');
                noResults.id = 'ai-no-results';
                
                // Remove any existing no-results message
                const existingMessage = document.getElementById('ai-no-results');
                if (existingMessage) existingMessage.remove();
                
                container.prepend(noResults);
            } else {
                // Remove any existing no-results message
                const existingMessage = document.getElementById('ai-no-results');
                if (existingMessage) existingMessage.remove();
            }
        }
        
        function showAllAiSections() {
            const container = document.getElementById('aiContentContainer');
            const allElements = container.querySelectorAll('*');
            
            allElements.forEach(el => {
                if (el.style) el.style.display = '';
            });
            
            // Remove any existing no-results message
            const existingMessage = document.getElementById('ai-no-results');
            if (existingMessage) existingMessage.remove();
        }
        
        function filterAiContent(type) {
            // Update active button state
            const buttons = document.querySelectorAll('.ai-filter-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-filter') === type) {
                    btn.classList.add('active-filter');
                    btn.style.backgroundColor = 'var(--claude-purple)';
                    btn.style.color = 'white';
                } else {
                    btn.classList.remove('active-filter');
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                }
            });
            
            // Reset search field
            if (document.getElementById('aiSearchInput')) {
                document.getElementById('aiSearchInput').value = '';
            }
            
            // Show all sections first
            showAllAiSections();
            
            // If 'all' is selected, we're done
            if (type === 'all') return;
            
            const container = document.getElementById('aiContentContainer');
            
            // Depending on the filter, show/hide relevant sections
            switch(type) {
                case 'root-cause':
                    highlightSections(['root cause', 'issue', 'problem', 'error', 'failure', 'bug']);
                    break;
                case 'solution':
                    highlightSections(['solution', 'fix', 'resolve', 'recommendation', 'suggest']);
                    break;
                case 'debugging':
                    highlightSections(['debug', 'step', 'investigate', 'check', 'verify', 'test']);
                    break;
                case 'code':
                    // Show all code blocks
                    const codeBlocks = container.querySelectorAll('pre, code');
                    codeBlocks.forEach(block => {
                        // Make the code block and its container visible
                        let parent = block;
                        while (parent && parent !== container) {
                            if (parent.style) parent.style.display = '';
                            parent = parent.parentElement;
                        }
                    });
                    
                    // Hide elements that don't contain code
                    const nonCodeElements = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');
                    nonCodeElements.forEach(el => {
                        if (!el.querySelector('code') && !el.closest('pre')) {
                            el.style.display = 'none';
                        }
                    });
                    break;
            }
            
            // Helper function to highlight sections with specific keywords
            function highlightSections(keywords) {
                // Get all section elements - each section starts with an h3 and ends at the next h3 or end of container
                const sections = [];
                const headings = container.querySelectorAll('h3');
                
                headings.forEach((heading, index) => {
                    // Create a section object with the heading and all elements until next heading
                    const section = {
                        heading: heading,
                        elements: []
                    };
                    
                    // Get all elements after this heading until the next heading
                    let currentElement = heading.nextElementSibling;
                    while (currentElement && currentElement.tagName !== 'H3') {
                        section.elements.push(currentElement);
                        currentElement = currentElement.nextElementSibling;
                    }
                    
                    // Add this section to our sections array
                    sections.push(section);
                });
                
                // Now filter each section based on keywords
                sections.forEach(section => {
                    // Get the text content of the entire section
                    let sectionText = section.heading.textContent.toLowerCase();
                    section.elements.forEach(el => {
                        sectionText += ' ' + el.textContent.toLowerCase();
                    });
                    
                    let shouldShow = false;
                    for (const keyword of keywords) {
                        if (sectionText.includes(keyword)) {
                            shouldShow = true;
                            break;
                        }
                    }
                    
                    if (!shouldShow) {
                        // Hide this section
                        section.heading.style.display = 'none';
                        section.elements.forEach(el => {
                            el.style.display = 'none';
                        });
                    }
                });
            }
        }

        // Screenshot modal functions
        function openScreenshotModal() {
            const modal = document.getElementById('screenshotModal');
            if (modal) {
                modal.style.display = 'block';
            }
        }
        
        function closeScreenshotModal() {
            const modal = document.getElementById('screenshotModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
        
        // Close modal if clicking outside the image
        window.onclick = function(event) {
            const modal = document.getElementById('screenshotModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }

        // Initialize highlightjs after DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Set up direct click handlers for screenshots
            document.querySelectorAll('.failure-screenshot, .screenshot-thumbnail').forEach(thumbnail => {
                thumbnail.addEventListener('click', function(e) {
                    const modal = document.getElementById('screenshotModal');
                    if (modal) {
                        // Position the modal near the click position
                        const x = e.pageX;
                        const y = e.pageY;
                        
                        // Set max sizes to avoid modal going out of viewport
                        const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                        const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                        
                        // Calculate position, ensuring the modal stays within viewport
                        let modalLeft = x - 20;
                        let modalTop = y - 20;
                        
                        // Get modal dimensions (after temporarily making it visible offscreen)
                        modal.style.display = 'block';
                        modal.style.top = '-9999px';
                        modal.style.left = '-9999px';
                        const modalWidth = modal.offsetWidth;
                        const modalHeight = modal.offsetHeight;
                        
                        // Adjust if the modal would go outside viewport
                        if (modalLeft + modalWidth > viewportWidth) {
                            modalLeft = viewportWidth - modalWidth - 20;
                        }
                        if (modalTop + modalHeight > viewportHeight) {
                            modalTop = viewportHeight - modalHeight - 20;
                        }
                        
                        // Ensure we don't go off the left or top edges
                        modalLeft = Math.max(20, modalLeft);
                        modalTop = Math.max(20, modalTop);
                        
                        // Position and show the modal
                        modal.style.left = modalLeft + 'px';
                        modal.style.top = modalTop + 'px';
                    }
                });
            });
            
            // Also make sure the close button works
            const closeButton = document.querySelector('.screenshot-close');
            if (closeButton) {
                closeButton.addEventListener('click', function() {
                    const modal = document.getElementById('screenshotModal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                });
            }

            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            
            // Apply card-header styling to headings in the AI Analysis tab
            const aiContainer = document.getElementById('aiContentContainer');
            if (aiContainer) {
                const h3Elements = aiContainer.querySelectorAll('h3');
                h3Elements.forEach(h3 => {
                    // Create a new div with the card-header class
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'card-header';
                    
                    // Clone the h3 and add the card-title class
                    const newHeading = h3.cloneNode(true);
                    newHeading.className = 'card-title';
                    
                    // Insert the heading into the header div
                    headerDiv.appendChild(newHeading);
                    
                    // Replace the original h3 with the header div
                    h3.parentNode.insertBefore(headerDiv, h3);
                    h3.remove();
                });
                
                // Find the Failure Explanation heading and insert screenshot
                ${screenshotBase64 ? `
                // Find the failure explanation section
                const failureHeading = Array.from(aiContainer.querySelectorAll('.card-title')).find(
                    heading => heading.textContent && heading.textContent.toLowerCase().includes('failure explanation')
                );
                
                if (failureHeading) {
                    // Get the parent card header
                    const cardHeader = failureHeading.closest('.card-header');
                    
                    if (cardHeader) {
                        // Get all content elements following this header until the next header
                        const contentContainer = document.createElement('div');
                        contentContainer.className = 'failure-explanation-container';
                        
                        // Create screenshot element
                        const screenshot = document.createElement('img');
                        screenshot.className = 'failure-screenshot';
                        screenshot.src = 'data:image/png;base64,${screenshotBase64}';
                        screenshot.alt = 'Error Screenshot';
                        screenshot.onclick = function() { openScreenshotModal(); };
                        
                        // Create the text container for the explanation
                        const textContainer = document.createElement('div');
                        textContainer.className = 'failure-text';
                        
                        // Find all elements after the card header until the next card header or hr
                        let currentElement = cardHeader.nextElementSibling;
                        const collectedElements = [];
                        
                        while (currentElement && 
                               !currentElement.matches('hr, .card-header')) {
                            collectedElements.push(currentElement);
                            const nextElement = currentElement.nextElementSibling;
                            currentElement.remove();
                            currentElement = nextElement;
                        }
                        
                        // Append all collected elements to the text container
                        collectedElements.forEach(el => {
                            textContainer.appendChild(el);
                        });
                        
                        // Add screenshot and text container to the content container
                        contentContainer.appendChild(screenshot);
                        contentContainer.appendChild(textContainer);
                        
                        // Insert the content container after the header
                        if (currentElement) {
                            cardHeader.parentNode.insertBefore(contentContainer, currentElement);
                        } else {
                            cardHeader.parentNode.appendChild(contentContainer);
                        }
                    }
                }` : ''}
            }
        });
    </script>
</body>
</html>`;

  // Combine all parts
  return htmlHeader + bodyStart + overviewTab + errorTab + aiAnalysisTab + networkTabStart 
    + networkTableRows + networkTabEnd + usageTab + bodyEnd + javaScript;
}