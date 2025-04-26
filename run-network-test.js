// Simple script to run our network request capture test
const { execSync } = require('child_process');

try {
  console.log('Running network capture verification test...');
  execSync('npx playwright test ./test-network-capture.ts', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Add any environment variables needed
      DEBUG: 'pw:api'
    }
  });
} catch (error) {
  // Expected to fail with an error (our test intentionally fails)
  console.log('Test completed with expected failure.');
  console.log('Check the playwright-report directory for the HTML report.');
  
  // Open the report automatically
  try {
    execSync('npx playwright show-report', { stdio: 'inherit' });
  } catch (e) {
    console.error('Could not open the report:', e.message);
  }
}