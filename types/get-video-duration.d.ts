declare module 'get-video-duration' {
  /**
   * Get the duration of a video file in seconds
   * @param filePath Path to the video file
   * @returns Promise resolving to the duration in seconds
   */
  export function getVideoDurationInSeconds(filePath: string): Promise<number>;
}