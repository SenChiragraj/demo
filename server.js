import express, { json, urlencoded } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
// Initialize Express app
const app = express();
dotenv.config();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(morgan('dev')); // HTTP request logger

// ======================
// HEALTH CHECK ENDPOINT
// ======================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ======================
// WEBHOOK ENDPOINT (EXAMPLE)
// ======================
app.post('/webhook', (req, res) => {
  // Verify GitHub webhook secret (if needed)
  const signature = req.headers['x-hub-signature-256'];
  if (process.env.GITHUB_WEBHOOK_SECRET && signature) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest =
      'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

    if (signature !== digest) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  console.log('Received webhook payload:', req.body);
  res.status(200).json({ received: true });
});

// ======================
// ERROR HANDLING
// ======================
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ======================
// SERVER STARTUP
// ======================
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server terminated');
  });
});

export default server; // For testing purposes
