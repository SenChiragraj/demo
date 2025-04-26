import axios from 'axios';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = 'http://localhost:4000';
const HEALTH_ENDPOINT = '/health';
const SERVER_START_CMD = 'npm start';
const SERVER_TIMEOUT = 4000; // 4 seconds
const MAX_RETRIES = 3;

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

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = exec(SERVER_START_CMD, {
      killSignal: 'SIGKILL',
    });

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
        const interval = setInterval(async () => {
          await checkStartup();
          if (serverStarted) clearInterval(interval);
        }, 200);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => reject(err));

    setTimeout(() => {
      if (!serverStarted) reject(new Error('Server startup timed out'));
    }, SERVER_TIMEOUT);
  });
}

async function stopServer() {
  if (!serverProcess) return;
  return new Promise((resolve, reject) => {
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
  let attempts = 0;
  let serverStarted = false;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      console.log(`Attempt ${attempts}: Starting server...`);
      await startServer();

      if (await isServerRunning()) {
        console.log('✅ Server is up and running');
        serverStarted = true;
        break;
      }
    } catch (error) {
      console.error(`Attempt ${attempts} failed: ${error.message}`);
      await stopServer(); // Cleanup if it failed
    }
  }

  if (!serverStarted) {
    console.error('❌ Failed to start server after maximum retries');
    process.exit(1);
  }

  try {
    console.log('🏃 Running test cases...');
    const response = await axios.get(`${SERVER_URL}${HEALTH_ENDPOINT}`);
    console.log(
      `Server: ${response.config.method.toUpperCase()} ${
        response.config.url
      } => ${response.status}`
    );
    console.log('✅ All tests passed!');
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
