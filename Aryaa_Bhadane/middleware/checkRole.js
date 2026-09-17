/**
 * middleware/checkRole.js
 * -----------------------
 * Role-Based Access Control (RBAC) guard middleware factory.
 *
 * Usage:
 *   router.post('/events', verifyToken, checkRole('organizer'), createEvent);
 *   router.post('/tickets/book', verifyToken, checkRole('attendee'), bookTicket);
 *
 * `checkRole` returns an Express middleware that reads `req.user.role` (set by
 * the JWT verifyToken middleware) and either continues the request pipeline
 * (`next()`) or short-circuits with 403 Forbidden when the caller's role doesn't
 * match the required role.
 *
 * Multiple roles may be passed to allow more than one role access to a route:
 *   checkRole('organizer', 'attendee')   ← any authenticated user
 */

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is guaranteed to exist here — verifyToken runs first
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user?.role || 'none'}.`,
      });
    }
    next();
  };
};

module.exports = checkRole;
