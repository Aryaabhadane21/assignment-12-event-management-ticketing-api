/**
 * controllers/ticketController.js
 * --------------------------------
 * Atomic ticket booking and cancellation via Firestore ACID transactions.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY runTransaction?
 * ────────────────────────────────────────────────────────────────────────────
 * Under high concurrency multiple attendees may attempt to book the last N
 * tickets simultaneously.  A naive read-then-write approach would allow all
 * of them to read the same `availableTickets` value (e.g. 2), conclude there
 * are enough tickets, and each write a ticket document — resulting in
 * overselling (negative inventory).
 *
 * Firestore's `runTransaction` solves this with Optimistic Concurrency Control:
 *   1. All reads inside the transaction callback are snapshotted at the same
 *      logical timestamp.
 *   2. The writes are only committed if NONE of the read documents have been
 *      mutated by another transaction since the snapshot.
 *   3. If a conflict is detected, Firestore automatically retries the
 *      transaction (up to 5 times) with a fresh snapshot.
 *
 * This guarantees `availableTickets` never drops below 0, even when thousands
 * of concurrent requests race against the same event document.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RULE: Never read-then-write ticket counts outside of runTransaction.
 * ────────────────────────────────────────────────────────────────────────────
 */

const { db } = require('../config/firebaseConfig');

const EVENTS_COLLECTION  = 'events';
const TICKETS_COLLECTION = 'tickets';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/book   — Atomic booking (Attendee only, rate-limited)
// ─────────────────────────────────────────────────────────────────────────────
exports.bookTicket = async (req, res) => {
  const { eventId, quantity, attendeeName, attendeeEmail } = req.body;
  const userId = req.user.id;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!eventId || !quantity || !attendeeName || !attendeeEmail) {
    return res.status(400).json({
      success: false,
      message: 'eventId, quantity, attendeeName, and attendeeEmail are required.',
    });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'quantity must be a positive integer.' });
  }

  // Pre-allocate the ticket document reference BEFORE the transaction so we
  // can use ticketRef.id inside the transaction callback without another round-trip.
  const eventRef  = db.collection(EVENTS_COLLECTION).doc(eventId);
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(); // auto-ID

  try {
    // ── FIRESTORE ACID TRANSACTION ────────────────────────────────────────────
    // All reads occur first (required by Firestore SDK), then all writes.
    // The transaction is retried automatically on contention.
    const result = await db.runTransaction(async (t) => {

      // ── Step 1: Read the event document inside the transaction ──────────────
      // This read is part of the transaction snapshot — if another transaction
      // modifies this document before we commit, Firestore will retry us.
      const eventDoc = await t.get(eventRef);

      if (!eventDoc.exists) {
        // Throwing inside a transaction aborts it without retrying
        throw new Error('Event not found.');
      }

      const eventData = eventDoc.data();

      // ── Step 2: Check if the event is still in the future ──────────────────
      if (new Date(eventData.eventDate) <= new Date()) {
        throw new Error('Cannot book tickets for a past event.');
      }

      // ── Step 3: Check ticket availability ───────────────────────────────────
      // This is the critical guard — if multiple transactions read the same
      // availableTickets value and it equals qty, only one will succeed;
      // the rest will be retried and then fail here (insufficient tickets).
      if (eventData.availableTickets < qty) {
        throw new Error(
          `Insufficient tickets. Requested: ${qty}, Available: ${eventData.availableTickets}.`,
        );
      }

      // ── Step 4: Atomically decrement availableTickets ───────────────────────
      // This write is only committed if the read in Step 1 is still fresh.
      // No other booking can interleave between our read and this write.
      t.update(eventRef, {
        availableTickets: eventData.availableTickets - qty,
      });

      // ── Step 5: Create the ticket document in the same atomic batch ─────────
      const bookingRef = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      const newTicket = {
        id:            ticketRef.id,
        eventId,
        eventTitle:    eventData.title,
        userId,
        attendeeName,
        attendeeEmail,
        quantity:      qty,
        totalPaid:     qty * eventData.ticketPrice,
        bookingRef,
        status:        'confirmed',
        bookedAt:      new Date().toISOString(),
      };

      t.set(ticketRef, newTicket);

      // The return value is resolved as the transaction result
      return newTicket;
    });
    // ── END OF TRANSACTION ────────────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: 'Tickets booked successfully.',
      data: result,
    });
  } catch (error) {
    console.error('[ticketController.bookTicket]', error.message);

    // Firestore transaction errors vs. our own business-logic errors
    const isBusinessError = [
      'Event not found.',
      'Cannot book tickets for a past event.',
      'Insufficient tickets.',
    ].some((msg) => error.message.startsWith(msg));

    return res.status(isBusinessError ? 400 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/my-tickets   — View all tickets for the logged-in attendee
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const snapshot = await db
      .collection(TICKETS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('bookedAt', 'desc')
      .get();

    const tickets = snapshot.docs.map((doc) => doc.data());

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    console.error('[ticketController.getMyTickets]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/cancel   — Cancel ticket & atomically restore inventory
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelTicket = async (req, res) => {
  const { id } = req.params;
  const userId  = req.user.id;

  const ticketRef = db.collection(TICKETS_COLLECTION).doc(id);

  try {
    // ── FIRESTORE ACID TRANSACTION ────────────────────────────────────────────
    // Mirrors the booking transaction in reverse:
    //   1. Read the ticket and the related event atomically.
    //   2. Validate the cancellation (ownership, status).
    //   3. Atomically set ticket status = 'cancelled' AND restore the seats.
    // This ensures inventory is never double-restored or missed on concurrent
    // cancel requests for the same ticket.
    const result = await db.runTransaction(async (t) => {

      // ── Step 1: Read the ticket document ────────────────────────────────────
      const ticketDoc = await t.get(ticketRef);

      if (!ticketDoc.exists) {
        throw new Error('Ticket not found.');
      }

      const ticketData = ticketDoc.data();

      // ── Step 2: Ownership check ──────────────────────────────────────────────
      if (ticketData.userId !== userId) {
        throw new Error('Forbidden. You can only cancel your own tickets.');
      }

      // ── Step 3: Status guard — prevent double-cancellation ───────────────────
      if (ticketData.status === 'cancelled') {
        throw new Error('This ticket has already been cancelled.');
      }

      // ── Step 4: Read the related event inside the same transaction ───────────
      const eventRef  = db.collection(EVENTS_COLLECTION).doc(ticketData.eventId);
      const eventDoc  = await t.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error('Associated event not found.');
      }

      const eventData = eventDoc.data();

      // ── Step 5: Atomically restore ticket inventory ──────────────────────────
      t.update(eventRef, {
        availableTickets: eventData.availableTickets + ticketData.quantity,
      });

      // ── Step 6: Mark ticket as cancelled ────────────────────────────────────
      t.update(ticketRef, {
        status:      'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      return {
        ...ticketData,
        status:      'cancelled',
        cancelledAt: new Date().toISOString(),
      };
    });
    // ── END OF TRANSACTION ────────────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      message: 'Ticket cancelled and inventory restored successfully.',
      data: result,
    });
  } catch (error) {
    console.error('[ticketController.cancelTicket]', error.message);

    const isBusinessError = [
      'Ticket not found.',
      'Forbidden.',
      'This ticket has already been cancelled.',
      'Associated event not found.',
    ].some((msg) => error.message.startsWith(msg));

    const statusCode = error.message.startsWith('Forbidden') ? 403 : isBusinessError ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};
