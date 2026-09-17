/**
 * controllers/authController.js
 * ------------------------------
 * Handles user registration, login, and profile retrieval.
 *
 * Data store : Firestore `users` collection
 * Auth layer : JWT signed with JWT_SECRET (no Firebase Auth)
 * Passwords  : hashed with bcryptjs (salt rounds = 12)
 *
 * Firestore user document shape:
 * {
 *   id        : string  — Firestore auto-generated doc ID prefixed with "usr_"
 *   name      : string
 *   email     : string  — unique (enforced by query-before-insert)
 *   password  : string  — bcrypt hash
 *   role      : 'organizer' | 'attendee'
 *   createdAt : ISO-8601 string
 * }
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db }  = require('../config/firebaseConfig');

const USERS_COLLECTION = 'users';
const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '7d'; // JWT is valid for 7 days

// ── Helper: sign a JWT for the given user object ─────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password, and role are required.' });
    }
    if (!['organizer', 'attendee'].includes(role)) {
      return res.status(400).json({ success: false, message: 'role must be either "organizer" or "attendee".' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'password must be at least 6 characters.' });
    }

    // ── Uniqueness check — ensure email is not already registered ─────────────
    const existing = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    // ── Hash the password before storing ──────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ── Persist to Firestore ───────────────────────────────────────────────────
    const newUserRef = db.collection(USERS_COLLECTION).doc();
    const userId     = `usr_${newUserRef.id}`;

    const userData = {
      id:        userId,
      name,
      email,
      password:  hashedPassword,
      role,
      createdAt: new Date().toISOString(),
    };

    await newUserRef.set(userData);

    // ── Issue JWT ─────────────────────────────────────────────────────────────
    const token = signToken(userData);

    // Never return the hashed password to the client
    const { password: _pw, ...safeUser } = userData;

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      data: safeUser,
    });
  } catch (error) {
    console.error('[authController.register]', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required.' });
    }

    // ── Look up user by email ─────────────────────────────────────────────────
    const snapshot = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const userDoc  = snapshot.docs[0].data();

    // ── Compare provided password against stored hash ────────────────────────
    const isMatch = await bcrypt.compare(password, userDoc.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ── Issue JWT ─────────────────────────────────────────────────────────────
    const token = signToken(userDoc);

    const { password: _pw, ...safeUser } = userDoc;

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      data: safeUser,
    });
  } catch (error) {
    console.error('[authController.login]', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile   (requires verifyToken middleware)
// ─────────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    // req.user is populated by the verifyToken middleware — fetch fresh data
    const snapshot = await db.collection(USERS_COLLECTION).where('id', '==', req.user.id).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { password: _pw, ...safeUser } = snapshot.docs[0].data();

    return res.status(200).json({ success: true, data: safeUser });
  } catch (error) {
    console.error('[authController.getProfile]', error);
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
};
