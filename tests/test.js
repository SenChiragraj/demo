import axios from 'axios';
import { exec } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = process.env.SERVER_START_CMD || 'node server.js';

let serverProcess;

/**
 * Start the server
 */
function startServer() {
  return new Promise((resolve) => {
    serverProcess = exec(SERVER_START_CMD);

    // Wait for server to start
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.includes('Server running')) {
        setTimeout(resolve, 500);
      }
    });

    // Ensure errors don't hang the process
    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      process.exit(1);
    });
  });
}

/**
 * Stop the server forcefully
 */
function stopServer() {
  if (serverProcess) {
    console.log('Terminating server process...');
    serverProcess.kill('SIGKILL'); // Forceful termination
    serverProcess = null;
  }
}

/**
 * Test the health endpoint
 */
async function testHealthEndpoint() {
  try {
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`);
    console.log('✅ Health endpoint response:', {
      status: response.status,
      data: response.data,
    });
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('Starting server...');
    await startServer();

    console.log('Testing health endpoint...');
    const healthOk = await testHealthEndpoint();

    if (!healthOk) {
      throw new Error('Health check failed');
    }

    console.log('🚀 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    stopServer();
    process.exit(); // Explicitly exit the process
  }
}

// Run the tests
runTests();

// Handle any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  stopServer();
  process.exit(1);
});

// Handle promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  stopServer();
  process.exit(1);
});
