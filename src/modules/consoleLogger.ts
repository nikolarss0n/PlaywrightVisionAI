/**
 * Module for console logging utilities
 */

// Box styling constants
export const BOX_WIDTH = 100;
export const TOP_BORDER = `┌${'─'.repeat(BOX_WIDTH)}┐`;
export const BOTTOM_BORDER = `└${'─'.repeat(BOX_WIDTH)}┘`;
export const SEPARATOR = `├${'─'.repeat(BOX_WIDTH)}┤`;

/**
 * Creates a styled box with markdown content
 */
export function createStyledMarkdownBox(title: string, content: string, type: 'analysis' | 'usage' | 'error' = 'analysis'): string {
  let emoji = '🔍';
  if (type === 'usage') emoji = '📊';
  else if (type === 'error') emoji = '⚠️';
  else if (type === 'analysis') emoji = '🧠';
  const formattedContent = content.split('\n').map(line => line.trim() ? line : '').join('\n');
  return `\n---\n\n## ${emoji} ${title}\n\n${formattedContent}\n\n---\n`;
}

/**
 * Creates a centered header for console output
 */
export function createCenteredHeader(text: string): string {
  const padding = Math.max(0, BOX_WIDTH - text.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = Math.ceil(padding / 2);
  return `│${' '.repeat(leftPad)}${text}${' '.repeat(rightPad)}│`;
}

/**
 * Wraps text in a console box with proper formatting
 */
export function wrapTextInBox(text: string, indent = 2): string {
  const indentStr = ' '.repeat(indent);
  const maxLineLength = BOX_WIDTH - indent - 1;
  return text.split('\n').map(originalLine => {
    let currentLine = originalLine;
    const resultLines: string[] = [];
    while (currentLine.length > maxLineLength) {
      let breakPoint = currentLine.lastIndexOf(' ', maxLineLength);
      if (breakPoint <= 0) breakPoint = maxLineLength;
      resultLines.push(currentLine.substring(0, breakPoint));
      currentLine = currentLine.substring(breakPoint).trimStart();
    }
    resultLines.push(currentLine);
    return resultLines.map(subLine => `│${indentStr}${subLine.padEnd(BOX_WIDTH - indent)}│`).join('\n');
  }).join('\n');
}

/**
 * Logs a test start message
 */
export function logTestStart(testTitle: string | undefined, testStatus: string, testDuration: number): void {
  console.log(`\n${TOP_BORDER}`);
  console.log(createCenteredHeader("🤖 AI Debugging Assistant Activated 🤖"));
  console.log(`${SEPARATOR}`);
  console.log(`Test Failed: "${testTitle || 'Unknown Test'}"`);
  console.log(`Status: ${testStatus}`);
  console.log(`Duration: ${testDuration}ms`);
  console.log(`${SEPARATOR}`);
  console.log("Gathering context for analysis...");
}

/**
 * Logs a context completion message
 */
export function logContextComplete(contextTime: number, failingSelector?: string | null): void {
  console.log(`✅ Context gathered in ${contextTime}ms.`);
  console.log(`Failing Selector (extracted): ${failingSelector || 'N/A'}`);
  console.log(`${SEPARATOR}`);
}

/**
 * Logs an error box
 */
export function logErrorBox(title: string, errorMessage: string): void {
  const captureErrorBox = `
${TOP_BORDER}
${createCenteredHeader(title)}
${SEPARATOR}
${wrapTextInBox("Failed to capture context, generate report, or call AI.")}
${wrapTextInBox(`Error: ${errorMessage}`)}
${BOTTOM_BORDER}
`;
  console.error(captureErrorBox);
}

/**
 * Logs a warning box
 */
export function logWarningBox(title: string, warningMessage: string): void {
  const warningBox = `
${TOP_BORDER}
${createCenteredHeader(title)}
${SEPARATOR}
${wrapTextInBox(warningMessage)}
${BOTTOM_BORDER}
`;
  console.warn(warningBox);
}

/**
 * Logs an analysis completion message
 */
export function logAnalysisComplete(): void {
  console.log(`\n${SEPARATOR}\n${createCenteredHeader("💡 AI Debugging Complete 💡")}\n${SEPARATOR}`);
  console.log("AI analysis results attached to test report.");
  console.log("View HTML report and markdown attachment for details.");
}