import axios from 'axios';
import { exec } from 'child_process';
import { config } from 'dotenv';

config();
const SERVER_URL = 'http://localhost:4000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = 'npm start';
const SERVER_TIMEOUT = 5000; // 5 seconds timeout for operations

let serverProcess;

async function isServerRunning() {
  try {
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`, {
      timeout: 1000,
      validateStatus: () => true,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = exec(SERVER_START_CMD, {
      killSignal: 'SIGKILL',
      timeout: SERVER_TIMEOUT,
    });

    // Handle process errors
    serverProcess.on('error', reject);

    // Handle early exit
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Buffer to collect output for verification
    let serverStarted = false;
    const checkStartup = async () => {
      if (!serverStarted && (await isServerRunning())) {
        serverStarted = true;
        resolve();
      }
    };

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.includes('Server running')) {
        // Start checking health endpoint
        const interval = setInterval(checkStartup, 100);
        // Stop checking once resolved
        serverProcess.once('exit', () => clearInterval(interval));
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('Server startup timed out'));
      }
    }, SERVER_TIMEOUT);
  });
}

async function stopServer() {
  if (!serverProcess) return;

  return new Promise((resolve, reject) => {
    // Set cleanup handlers first
    const cleanup = () => {
      clearInterval(checkInterval);
      clearTimeout(failTimeout);
      serverProcess = null;
    };

    // Force kill after timeout
    const failTimeout = setTimeout(() => {
      cleanup();
      reject(new Error('Failed to stop server within timeout'));
    }, SERVER_TIMEOUT);

    // Confirm server is down
    const checkInterval = setInterval(async () => {
      if (!(await isServerRunning())) {
        cleanup();
        resolve();
      }
    }, 100);

    // Send kill signals
    serverProcess.once('exit', () => {
      cleanup();
      resolve();
    });

    // Try SIGTERM first, then SIGKILL after delay
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  });
}

async function runTests() {
  try {
    await startServer();

    if (!(await isServerRunning())) {
      throw new Error('Server not responding after startup');
    }

    console.log('Running test cases...');
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`);
    console.log(
      `Server: ${response.config.method} ${response.config.url} ${response.status}`
    );

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    try {
      await stopServer();
      console.log('Test process completed');
    } catch (error) {
      console.error('❌ Failed to stop server:', error.message);
      process.exitCode = 1;
    }
  }
}

runTests();
