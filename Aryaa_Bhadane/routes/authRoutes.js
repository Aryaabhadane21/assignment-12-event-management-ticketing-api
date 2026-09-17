/**
 * routes/authRoutes.js
 * --------------------
 * Authentication routes with Swagger/OpenAPI 3.0 annotations.
 */

const express      = require('express');
const router       = express.Router();
const authCtrl     = require('../controllers/authController');
const verifyToken  = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration, login, and profile management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (Organizer or Attendee)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             organizer:
 *               summary: Register as Organizer
 *               value:
 *                 name: "Aryaa Bhadane"
 *                 email: "aryaa@example.com"
 *                 password: "Secret@123"
 *                 role: "organizer"
 *             attendee:
 *               summary: Register as Attendee
 *               value:
 *                 name: "Kunal Sharma"
 *                 email: "kunal@gmail.com"
 *                 password: "Pass@456"
 *                 role: "attendee"
 *     responses:
 *       201:
 *         description: User registered successfully. Returns JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User registered successfully." }
 *                 token:   { type: string, description: "JWT Bearer token" }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error (missing fields, invalid role, weak password)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', authCtrl.register);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and obtain a JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Login successful." }
 *                 token:   { type: string, description: "JWT Bearer token (valid 7 days)" }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', authCtrl.login);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No token provided or token is invalid/expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found in database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', verifyToken, authCtrl.getProfile);

module.exports = router;
