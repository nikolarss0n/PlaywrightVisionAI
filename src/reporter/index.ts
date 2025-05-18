/**
 * Main entry point for the Playwright Vision Reporter
 */
import { VisionReporter, VisionReporterOptions } from './visionReporter';

// Export the reporter
export default VisionReporter;
export { VisionReporterOptions };

// Add additional exports
export * from './traceReader';
export * from './dataTransformer';