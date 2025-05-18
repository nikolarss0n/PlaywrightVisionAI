/**
 * Entry point for the Playwright Vision Reporter
 * This file is needed for Playwright to properly load the reporter via the string path
 */

// Import the configLoader and load environment variables
const { loadConfig } = require('../modules/configLoader');

// Execute the loadConfig function to load environment variables first
loadConfig();

// Import the reporter
const { VisionReporter } = require('./visionReporter');

// Export the reporter as the default export
module.exports = VisionReporter;