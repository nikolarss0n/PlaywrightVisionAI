/**
 * Custom type declarations for external modules
 */

declare module 'ffprobe-static' {
  interface FfprobeStatic {
    path: string;
    version: string;
  }
  const ffprobeStatic: FfprobeStatic;
  export = ffprobeStatic;
}

declare module 'ffmpeg-static' {
  const ffmpegPath: string;
  export = ffmpegPath;
}

declare module 'ffmpeg-extract-frames' {
  interface ExtractFramesOptions {
    input: string;
    output: string;
    offsets: number[];
  }
  
  function extractFrames(options: ExtractFramesOptions): Promise<void>;
  export = extractFrames;
}

declare module 'get-video-duration' {
  function getVideoDurationInSeconds(input: string): Promise<number>;
  export { getVideoDurationInSeconds };
}