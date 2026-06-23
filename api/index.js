// Vercel serverless entry point
// The Express app is already built in backend/src/index.js
const app = require('../backend/src/index');

module.exports = app;
