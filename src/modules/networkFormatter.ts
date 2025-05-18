/**
 * Module for formatting network requests for AI analysis
 */
import { NetworkRequest } from './types';

/**
 * Formats network requests for AI analysis
 * @param requests Array of network requests
 * @returns Formatted network requests as a string
 */
export function formatNetworkRequestsForAi(requests: NetworkRequest[]): string[] {
  if (!requests || requests.length === 0) {
    return [];
  }

  return requests.map((request, index) => {
    // Format the request
    const formattedRequest = {
      index,
      url: request.url,
      method: request.method,
      status: request.status,
      requestHeaders: request.requestHeaders,
      responseHeaders: request.responseHeaders,
      requestBody: request.requestPostData, // Use requestPostData instead of requestBody
      responseBody: request.responseBody
    };

    // Convert to JSON string with pretty formatting
    return JSON.stringify(formattedRequest, null, 2);
  });
}
