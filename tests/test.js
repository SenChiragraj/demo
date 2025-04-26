import axios from 'axios';
import { exec } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = process.env.SERVER_START_CMD || 'node src/app.js';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

let serverProcess; // Track server process globally

/**
 * Check server health
 */
async function isServerRunning() {
  try {
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return false;
  }
}

/**
 * Start the server
 */
async function startServer() {
  console.log(`Starting server with command: ${SERVER_START_CMD}`);
  return new Promise((resolve) => {
    serverProcess = exec(SERVER_START_CMD, (error) => {
      if (error) {
        console.error(`Server failed to start: ${error}`);
        process.exit(1);
      }
    });

    // Capture output but don't block
    serverProcess.stdout?.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.includes('Server running')) {
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });
  });
}

/**
 * Wait for server to be ready
 */
async function waitForServer() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    console.log(`Attempt ${i}/${MAX_RETRIES}: Checking server...`);
    if (await isServerRunning()) {
      console.log('✅ Server is healthy and responding!');
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  throw new Error('❌ Server failed to start after retries');
}

/**
 * Cleanup function
 */
function cleanup() {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill();
  }
}

// Run tests
(async () => {
  try {
    await startServer();
    await waitForServer();

    // Run your actual test cases here
    console.log('Running test cases...');
    const healthCheck = await isServerRunning();
    console.assert(healthCheck, 'Health check should pass');

    console.log('All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
})();
