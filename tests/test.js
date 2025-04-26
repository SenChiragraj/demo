import axios from 'axios';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = 'http://localhost:4000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = 'npm start';
const SERVER_TIMEOUT = 4000; // 4 seconds
const MAX_ATTEMPTS = 3;

let serverProcess = null;

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

async function waitForServer(timeoutMs = SERVER_TIMEOUT) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await isServerRunning()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 300)); // Wait 300ms before retrying
  }
  throw new Error('Server did not become healthy in time');
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = exec(SERVER_START_CMD, {
      killSignal: 'SIGKILL',
    });

    let serverStarted = false;
    const startupTimeout = setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('Server startup timed out'));
      }
    }, SERVER_TIMEOUT);

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.includes('Server running') && !serverStarted) {
        clearTimeout(startupTimeout); // 🛑 Clear timeout on success
        serverStarted = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
      clearTimeout(startupTimeout); // 🛑 Clear timeout on error
      reject(err);
    });
  });
}

async function stopServer() {
  if (!serverProcess) return;
  return new Promise((resolve) => {
    serverProcess.once('exit', resolve);
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
  });
}

async function runTests() {
  let attempt = 0;
  let serverStarted = false;

  while (attempt < MAX_ATTEMPTS && !serverStarted) {
    attempt++;
    console.log(`\nAttempt ${attempt}: Starting server...`);

    try {
      await startServer();
      console.log('⏳ Waiting for server to be up...');
      await waitForServer(); // 💬 Now this function exists
      serverStarted = true;
      console.log('✅ Server started successfully!');
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      await stopServer();
    }
  }

  if (!serverStarted) {
    console.error('❌ Server failed to start after multiple attempts.');
    process.exit(1);
  }

  try {
    console.log('🏃 Running tests...');
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`);
    console.log(
      `Server responded: ${response.config.method.toUpperCase()} ${
        response.config.url
      } => ${response.status}`
    );
    console.log('✅ Tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('🛑 Shutting down server...');
    await stopServer();
    console.log('✅ Server shutdown complete');
    process.exit();
  }
}

runTests();
