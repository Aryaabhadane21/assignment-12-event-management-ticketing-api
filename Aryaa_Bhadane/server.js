/**
 * server.js
 * ----------
 * Express application entry point.
 *
 * Responsibilities:
 *   • Load environment variables from .env
 *   • Initialize Firebase via config/firebaseConfig.js
 *   • Mount global middleware (cors, json, rate-limiter)
 *   • Mount API routers
 *   • Mount Swagger UI at GET /api-docs
 *   • Start HTTP server
 */

require('dotenv').config(); // Must be first — loads .env before any other module reads env vars

const express         = require('express');
const cors            = require('cors');
const swaggerUi       = require('swagger-ui-express');
const swaggerSpec     = require('./config/swagger');

// Route modules
const authRoutes   = require('./routes/authRoutes');
const eventRoutes  = require('./routes/eventRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

// General (relaxed) rate limiter for all /api/* routes as a baseline DoS guard
const { generalRateLimiter } = require('./middleware/rateLimiter');

// Initialize Firebase Admin SDK (singleton — runs once when this module loads)
require('./config/firebaseConfig');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────────────────────────────────────

// Allow cross-origin requests (needed for Swagger UI and front-end clients)
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Parse URL-encoded form bodies
app.use(express.urlencoded({ extended: true }));

// Apply the relaxed general rate limiter to all /api/* routes as a baseline
// The strict booking-specific limiter is applied inside ticketRoutes.js only
app.use('/api', generalRateLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/events',  eventRoutes);
app.use('/api/tickets', ticketRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Swagger UI — Interactive API Documentation
// Visit http://localhost:5000/api-docs in your browser
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Event Ticketing API — Swagger UI',
    swaggerOptions: {
      persistAuthorization: true, // Keeps the JWT token across page refreshes
      docExpansion: 'list',       // Collapse sections by default for readability
      filter: true,               // Show the search/filter box
    },
  }),
);

// Expose the raw OpenAPI JSON spec (useful for import into Postman / Insomnia)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Event Ticketing API is running.',
    timestamp: new Date().toISOString(),
    docsUrl: `http://localhost:${PORT}/api-docs`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler — catch-all for undefined routes
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler — catches errors forwarded with next(err)
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📚 Swagger UI   : http://localhost:${PORT}/api-docs`);
  console.log(`🏥 Health Check : http://localhost:${PORT}/health`);
  console.log(`📄 OpenAPI JSON : http://localhost:${PORT}/api-docs.json\n`);
});

module.exports = app; // exported for testing purposes
