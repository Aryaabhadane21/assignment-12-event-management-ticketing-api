/**
 * middleware/auth.js
 * ------------------
 * JWT verification middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the token with
 * the JWT_SECRET, and attaches the decoded payload as `req.user` so that
 * downstream middleware and controllers can access the caller's id, email,
 * name, and role without hitting the database again.
 *
 * On failure, returns 401 Unauthorized immediately — no token should ever
 * propagate past this guard without being valid.
 */

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Extract the raw Authorization header
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided. Use Authorization: Bearer <token>',
    });
  }

  // Strip the "Bearer " prefix to get the raw token string
  const token = authHeader.split(' ')[1];

  try {
    // Verify signature and expiry — throws if either check fails
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload to the request object for downstream use
    req.user = decoded; // { id, name, email, role, iat, exp }
    next();
  } catch (err) {
    // Differentiate between expired and otherwise invalid tokens
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = verifyToken;
