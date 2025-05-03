import axios from 'axios';
import { exec } from 'child_process';
import { config } from 'dotenv';
import treeKill from 'tree-kill';

// Load environment variables
config();

//Comment Check
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = process.env.SERVER_START_CMD || 'node server.js';

let serverProcess;

import net from 'net';

function waitForPortToBeFree(port, host = '127.0.0.1', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const socket = net.createConnection(port, host);
      socket.once('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          resolve();
        } else {
          if (Date.now() - start > timeout)
            reject(new Error('Timeout waiting for port to be free'));
          else setTimeout(check, 200);
        }
      });
      socket.once('connect', () => {
        socket.end();
        if (Date.now() - start > timeout)
          reject(new Error('Timeout waiting for port to be free'));
        else setTimeout(check, 200);
      });
    })();
  });
}

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
  return new Promise((resolve) => {
    if (serverProcess) {
      console.log('Terminating server process...');
      treeKill(serverProcess.pid, 'SIGKILL', () => {
        serverProcess = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
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
    // Wait for port to be free before starting
    await waitForPortToBeFree(4000);

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
    await stopServer();
    await waitForPortToBeFree(4000); // Ensure port is free before exiting
    process.exit();
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
