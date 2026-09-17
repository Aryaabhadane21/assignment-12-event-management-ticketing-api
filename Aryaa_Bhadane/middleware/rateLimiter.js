/**
 * middleware/rateLimiter.js
 * -------------------------
 * Express-rate-limit configuration for the ticket booking route.
 *
 * Why this route specifically?
 *   POST /api/tickets/book is the primary target for scalping bots that try to
 *   flood the endpoint concurrently and grab all seats before real users can.
 *   A tight per-IP window of 10 requests/minute is intentionally strict to stop
 *   automated scripts while still allowing legitimate users to book.
 *
 * The 429 Too Many Requests response includes a Retry-After header so API
 * clients know when the window resets.
 *
 * Other routes (events listing, auth) are NOT subject to this strict limit
 * because they don't have the same abuse-potential and we don't want to
 * accidentally block legitimate browsing or login retries at this rate.
 */

const rateLimit = require('express-rate-limit');

// ── Strict booking limiter — 10 requests per 60-second window per IP ──────────
const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 60-second sliding window
  max: 10,               // Maximum 10 booking requests per IP within the window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers (RFC 6585)
  legacyHeaders: false,  // Disable the deprecated `X-RateLimit-*` headers

  // Custom 429 response body — returned when the limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        'Too many booking requests from this IP. ' +
        'Maximum 10 bookings per minute allowed to prevent ticket scalping. ' +
        'Please wait before trying again.',
      retryAfter: `${Math.ceil(req.rateLimit.resetTime / 1000)} seconds`,
    });
  },

  // Key generator — use IP as the rate-limit key (default behaviour)
  keyGenerator: (req) => req.ip,

  // Skip rate limiting for trusted internal health-check calls (optional — none here)
  skip: () => false,
});

// ── General API limiter — relaxed limit for other endpoints ───────────────────
// Applied globally in server.js to all /api/* routes as a baseline DoS protection.
// Much more permissive than the booking limiter.
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 200,                  // 200 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down and try again later.',
  },
});

module.exports = { bookingRateLimiter, generalRateLimiter };
