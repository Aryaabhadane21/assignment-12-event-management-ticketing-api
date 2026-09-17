/**
 * routes/ticketRoutes.js
 * -----------------------
 * Ticket booking and cancellation routes with Swagger/OpenAPI 3.0 annotations.
 *
 * POST /api/tickets/book is protected by:
 *   1. verifyToken        — must be authenticated
 *   2. checkRole('attendee') — must be an Attendee role
 *   3. bookingRateLimiter — max 10 requests/min per IP (anti-scalping)
 */

const express               = require('express');
const router                = express.Router();
const ticketCtrl            = require('../controllers/ticketController');
const verifyToken           = require('../middleware/auth');
const checkRole             = require('../middleware/checkRole');
const { bookingRateLimiter } = require('../middleware/rateLimiter');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket booking, cancellation, and personal ticket history
 */

/**
 * @swagger
 * /api/tickets/book:
 *   post:
 *     summary: Atomically book tickets for an event (Attendee only — rate limited 10/min)
 *     tags: [Tickets]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Uses a Firestore ACID transaction (`runTransaction`) to atomically:
 *       1. Verify event exists and has sufficient available tickets.
 *       2. Decrement `availableTickets` on the event document.
 *       3. Create a confirmed ticket document.
 *
 *       This prevents overselling under concurrent traffic.
 *
 *       **Rate limit:** Maximum 10 requests per minute per IP address.
 *       Exceeding this returns `429 Too Many Requests`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookTicketRequest'
 *           example:
 *             eventId: "your-firestore-event-doc-id"
 *             quantity: 2
 *             attendeeName: "Kunal Sharma"
 *             attendeeEmail: "kunal@gmail.com"
 *     responses:
 *       201:
 *         description: Tickets booked successfully via Firestore transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Tickets booked successfully." }
 *                 data:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Insufficient tickets, event not found, or past event
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — missing or invalid JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not an Attendee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded — more than 10 booking requests per minute
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:    { type: boolean, example: false }
 *                 message:    { type: string, example: "Too many booking requests from this IP." }
 *                 retryAfter: { type: string, example: "45 seconds" }
 */
router.post(
  '/book',
  bookingRateLimiter,       // Anti-scalping: 10 req/min per IP — applied FIRST
  verifyToken,              // JWT verification
  checkRole('attendee'),    // Only attendees can book
  ticketCtrl.bookTicket,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/tickets/my-tickets:
 *   get:
 *     summary: Get all tickets purchased by the logged-in attendee
 *     tags: [Tickets]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of tickets for the authenticated user (sorted by booking date, newest first)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count:   { type: integer, example: 3 }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ticket'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — user is not an Attendee
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/my-tickets', verifyToken, checkRole('attendee'), ticketCtrl.getMyTickets);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/tickets/{id}/cancel:
 *   post:
 *     summary: Cancel a ticket and atomically restore inventory (Attendee only)
 *     tags: [Tickets]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Uses a Firestore ACID transaction to atomically:
 *       1. Verify the ticket exists and belongs to the authenticated user.
 *       2. Check the ticket is not already cancelled.
 *       3. Restore `availableTickets` on the event document.
 *       4. Set the ticket `status` to `"cancelled"`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore document ID of the ticket to cancel
 *     responses:
 *       200:
 *         description: Ticket cancelled and inventory restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Ticket cancelled and inventory restored successfully." }
 *                 data:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Ticket already cancelled or associated event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — ticket does not belong to the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/cancel', verifyToken, checkRole('attendee'), ticketCtrl.cancelTicket);

module.exports = router;
