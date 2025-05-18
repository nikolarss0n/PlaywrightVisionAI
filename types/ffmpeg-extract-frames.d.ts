declare module 'ffmpeg-extract-frames' {
  /**
   * Options for extracting frames from a video
   */
  interface ExtractFramesOptions {
    /** Path to the input video file */
    input: string;
    /** Path where the output frame will be saved */
    output: string;
    /** Array of timestamp offsets in milliseconds to extract frames at */
    offsets: number[];
    /** Optional size parameter for frame dimensions, format: "WIDTHxHEIGHT" */
    size?: string;
    /** Quality for JPEG frames (1-100) */
    quality?: number;
    /** Format for the output frames (jpg, png) */
    format?: string;
  }

  /**
   * Extract frames from a video file at specified timestamps
   * @param options Options for extraction
   * @returns Promise that resolves when extraction is complete
   */
  function extractFrames(options: ExtractFramesOptions): Promise<void>;

  export = extractFrames;
}