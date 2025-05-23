/**
 * Utilities for error handling and extraction
 */

/**
 * Extracts a selector from an error message
 * @param error The error object
 * @returns The extracted selector or undefined
 */
export function extractSelectorFromError(error: Error | undefined): string | undefined {
  if (!error?.message) {
    return undefined;
  }

  const timeoutMatch = error.message.match(/waiting for selector "(.*?)"/);
  if (timeoutMatch && timeoutMatch[1]) {
    return timeoutMatch[1];
  }

  const locatorMatch = error.message.match(/locator\((['"`])(.*?)\1\)/);
  if (locatorMatch && locatorMatch[2]) {
    return locatorMatch[2];
  }

  return undefined; // Selector couldn't be reliably extracted
}