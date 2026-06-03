require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Wire up API router
app.use('/api', apiRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Legal Case Monitoring System API is active.'
  });
});

const scraperService = require('./services/scraperService');

// Start listening
const server = app.listen(PORT, () => {
  console.log(`[Server] Legal case monitoring backend listening on port ${PORT}`);
  scraperService.initScheduler();
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server process terminated.');
    process.exit(0);
  });
});
