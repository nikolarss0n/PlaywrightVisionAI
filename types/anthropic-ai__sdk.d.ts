declare module '@anthropic-ai/sdk' {
  export interface AnthropicOptions {
    /** API key for Claude */
    apiKey: string;
    /** Optional base URL for the API */
    baseURL?: string;
  }

  export interface Message {
    /** Role of the message author */
    role: 'user' | 'assistant' | 'system';
    /** Content of the message */
    content: any; // Can be a string or content blocks
  }

  export interface TextContent {
    /** Type of content block */
    type: 'text';
    /** Text content */
    text: string;
  }

  export interface ImageContent {
    /** Type of content block */
    type: 'image';
    /** Image source information */
    source: {
      /** Type of image source */
      type: 'base64';
      /** Media type of the image */
      media_type: string;
      /** Base64-encoded image data */
      data: string;
    };
  }

  export interface UsageMetadata {
    /** Number of input tokens used */
    input_tokens: number;
    /** Number of output tokens used */
    output_tokens: number;
  }

  export interface MessageResponse {
    /** Type of the response */
    type: string;
    /** ID of the message */
    id: string;
    /** Array of content blocks */
    content: Array<TextContent | ImageContent>;
    /** Role of the responder */
    role: string;
    /** Model used for the response */
    model: string;
    /** Token usage information */
    usage?: UsageMetadata;
  }

  export interface MessageCreateParams {
    /** Model to use for the message */
    model: string;
    /** System prompt */
    system?: string;
    /** Array of message objects */
    messages: Message[];
    /** Maximum number of tokens to generate */
    max_tokens: number;
    /** Temperature parameter for randomness */
    temperature?: number;
    /** Top-p parameter for nucleus sampling */
    top_p?: number;
  }

  export class Messages {
    /**
     * Create a new message
     * @param params Message creation parameters
     * @returns Promise resolving to the message response
     */
    create(params: MessageCreateParams): Promise<MessageResponse>;
  }

  export default class Anthropic {
    /** Messages API endpoint */
    messages: Messages;

    /**
     * Create a new Anthropic API client
     * @param options Options for the client
     */
    constructor(options: AnthropicOptions);
  }
}