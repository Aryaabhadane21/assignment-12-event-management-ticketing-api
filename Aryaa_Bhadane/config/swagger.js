/**
 * config/swagger.js
 * -----------------
 * Builds the OpenAPI 3.0 specification object consumed by swagger-ui-express.
 * All route-level JSDoc @swagger tags are picked up via the `apis` glob patterns
 * defined in `swaggerOptions.apis`.
 */

const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management & Ticketing API',
      version: '1.0.0',
      description:
        'High-concurrency Event Ticketing REST API backed by Firebase Firestore. ' +
        'Features JWT Role-Based Access Control (Organizer vs Attendee), ' +
        'Firestore ACID transactions for atomic ticket booking, ' +
        'and API rate limiting to prevent ticket-scalping bots.',
      contact: {
        name: 'Aryaa Bhadane',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
      },
      {
        url: 'https://your-app-name.onrender.com',
        description: 'Render production server',
      },
    ],
    // ── Reusable security scheme ──────────────────────────────────────────────
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token (obtained from POST /api/auth/login)',
        },
      },
      // ── Reusable schema definitions ───────────────────────────────────────
      schemas: {
        // ── Auth ──
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name:     { type: 'string', example: 'Aryaa Bhadane' },
            email:    { type: 'string', format: 'email', example: 'aryaa@example.com' },
            password: { type: 'string', minLength: 6, example: 'Secret@123' },
            role:     { type: 'string', enum: ['organizer', 'attendee'], example: 'attendee' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'aryaa@example.com' },
            password: { type: 'string', example: 'Secret@123' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:        { type: 'string', example: 'usr_abc123' },
            name:      { type: 'string', example: 'Aryaa Bhadane' },
            email:     { type: 'string', example: 'aryaa@example.com' },
            role:      { type: 'string', enum: ['organizer', 'attendee'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Events ──
        EventCreateRequest: {
          type: 'object',
          required: ['title', 'description', 'category', 'eventDate', 'venue', 'ticketPrice', 'totalCapacity'],
          properties: {
            title:         { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            description:   { type: 'string', example: 'Annual flagship backend conference' },
            category:      { type: 'string', example: 'Technology' },
            eventDate:     { type: 'string', format: 'date-time', example: '2026-06-15T09:00:00Z' },
            venue:         { type: 'string', example: 'Bandra Kurla Complex, Mumbai' },
            ticketPrice:   { type: 'number', example: 1499 },
            totalCapacity: { type: 'integer', example: 500 },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id:               { type: 'string', example: 'event_techconf_2026' },
            title:            { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            description:      { type: 'string' },
            category:         { type: 'string', example: 'Technology' },
            eventDate:        { type: 'string', format: 'date-time' },
            venue:            { type: 'string', example: 'Bandra Kurla Complex, Mumbai' },
            organizerId:      { type: 'string' },
            ticketPrice:      { type: 'number', example: 1499 },
            totalCapacity:    { type: 'integer', example: 500 },
            availableTickets: { type: 'integer', example: 482 },
            createdAt:        { type: 'string', format: 'date-time' },
          },
        },
        // ── Tickets ──
        BookTicketRequest: {
          type: 'object',
          required: ['eventId', 'quantity', 'attendeeName', 'attendeeEmail'],
          properties: {
            eventId:       { type: 'string', example: 'event_techconf_2026' },
            quantity:      { type: 'integer', minimum: 1, example: 2 },
            attendeeName:  { type: 'string', example: 'Kunal Sharma' },
            attendeeEmail: { type: 'string', format: 'email', example: 'kunal@gmail.com' },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            id:            { type: 'string', example: 'ticket_rec_88219' },
            eventId:       { type: 'string', example: 'event_techconf_2026' },
            eventTitle:    { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            userId:        { type: 'string' },
            attendeeName:  { type: 'string', example: 'Kunal Sharma' },
            attendeeEmail: { type: 'string', example: 'kunal@gmail.com' },
            quantity:      { type: 'integer', example: 2 },
            totalPaid:     { type: 'number', example: 2998 },
            bookingRef:    { type: 'string', example: 'TKT-2026-88219' },
            status:        { type: 'string', enum: ['confirmed', 'cancelled'], example: 'confirmed' },
            bookedAt:      { type: 'string', format: 'date-time' },
          },
        },
        // ── Generic responses ──
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data:    { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
          },
        },
      },
    },
  },
  // Tell swagger-jsdoc where to find @swagger JSDoc annotations
  apis: ['./routes/*.js', './controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
