/**
 * routes/eventRoutes.js
 * ----------------------
 * Event management routes with Swagger/OpenAPI 3.0 annotations.
 *
 * Access matrix:
 *   GET  /api/events              — Public
 *   GET  /api/events/:id          — Public
 *   POST /api/events              — Organizer
 *   PUT  /api/events/:id          — Organizer (owns the event)
 *   DELETE /api/events/:id        — Organizer (owns the event)
 *   GET  /api/events/:id/attendees — Organizer (owns the event)
 */

const express     = require('express');
const router      = express.Router();
const eventCtrl   = require('../controllers/eventController');
const verifyToken = require('../middleware/auth');
const checkRole   = require('../middleware/checkRole');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event listing, creation, and management
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Browse all upcoming events
 *     tags: [Events]
 *     description: Returns events where eventDate is in the future. Supports optional category and city filters.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter events by category (e.g. Technology, Music, Sports)
 *         example: Technology
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter events by city name (partial match on venue field)
 *         example: Mumbai
 *     responses:
 *       200:
 *         description: List of upcoming events
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
 *                     $ref: '#/components/schemas/Event'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', eventCtrl.getAllEvents);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event details with live available ticket count
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore document ID of the event
 *         example: event_techconf_2026
 *     responses:
 *       200:
 *         description: Event details including live availableTickets count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', eventCtrl.getEventById);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event listing (Organizer only)
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventCreateRequest'
 *           example:
 *             title: "Global Cloud & AI Summit 2026"
 *             description: "Annual flagship backend conference"
 *             category: "Technology"
 *             eventDate: "2026-06-15T09:00:00Z"
 *             venue: "Bandra Kurla Complex, Mumbai"
 *             ticketPrice: 1499
 *             totalCapacity: 500
 *     responses:
 *       201:
 *         description: Event created. availableTickets is initialized to totalCapacity.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Event created successfully." }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Validation error (missing fields, past eventDate)
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
 *         description: Forbidden — user is not an Organizer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', verifyToken, checkRole('organizer'), eventCtrl.createEvent);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update event details (Organizer + event ownership required)
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore document ID of the event to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               category:    { type: string }
 *               eventDate:   { type: string, format: date-time }
 *               venue:       { type: string }
 *               ticketPrice: { type: number }
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: No valid fields provided or invalid eventDate
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
 *         description: Forbidden — not the event organizer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', verifyToken, checkRole('organizer'), eventCtrl.updateEvent);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Cancel and delete an event (Organizer + event ownership required)
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore document ID of the event to delete
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Event has been cancelled and deleted." }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — not the event organizer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', verifyToken, checkRole('organizer'), eventCtrl.deleteEvent);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/events/{id}/attendees:
 *   get:
 *     summary: List all registered attendees for an event (Organizer + ownership)
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore document ID of the event
 *     responses:
 *       200:
 *         description: List of confirmed attendees for this event
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 event:   { type: string, example: "Global Cloud & AI Summit 2026" }
 *                 count:   { type: integer, example: 18 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ticketId:      { type: string }
 *                       attendeeName:  { type: string }
 *                       attendeeEmail: { type: string }
 *                       quantity:      { type: integer }
 *                       bookingRef:    { type: string }
 *                       bookedAt:      { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — not the event organizer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id/attendees', verifyToken, checkRole('organizer'), eventCtrl.getEventAttendees);

module.exports = router;
