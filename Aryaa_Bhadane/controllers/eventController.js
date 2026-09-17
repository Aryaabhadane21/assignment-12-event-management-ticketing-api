/**
 * controllers/eventController.js
 * --------------------------------
 * CRUD operations for the `events` Firestore collection.
 *
 * Business rules enforced here:
 *  • Only Organizers can create, update, or delete events (enforced via
 *    checkRole middleware on the routes, double-checked via organizerId).
 *  • PUT / DELETE verify event.organizerId === req.user.id (ownership).
 *  • GET /api/events returns only UPCOMING events by default (eventDate > now)
 *    and supports ?category= and ?city= query filters.
 *  • GET /api/events/:id returns the event plus the live availableTickets count.
 */

const { db } = require('../config/firebaseConfig');

const EVENTS_COLLECTION = 'events';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events   — Browse all upcoming events with optional filters
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllEvents = async (req, res) => {
  try {
    const { category, city } = req.query;
    const now = new Date().toISOString(); // ISO string for Firestore string comparison

    let query = db.collection(EVENTS_COLLECTION)
      .where('eventDate', '>', now) // Only upcoming events (eventDate in the future)
      .orderBy('eventDate', 'asc'); // Soonest events first

    // ── Optional filters ──────────────────────────────────────────────────────
    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    let events = snapshot.docs.map((doc) => doc.data());

    // ── City filter (post-query because Firestore can't compound-filter strings inside a field) ──
    if (city) {
      const cityLower = city.toLowerCase();
      events = events.filter((e) =>
        e.venue && e.venue.toLowerCase().includes(cityLower),
      );
    }

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error('[eventController.getAllEvents]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/:id   — View event details & live remaining tickets
// ─────────────────────────────────────────────────────────────────────────────
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const eventDoc = await db.collection(EVENTS_COLLECTION).doc(id).get();

    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, message: `Event with id "${id}" not found.` });
    }

    return res.status(200).json({ success: true, data: eventDoc.data() });
  } catch (error) {
    console.error('[eventController.getEventById]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch event.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events   — Create a new event (Organizer only)
// ─────────────────────────────────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const { title, description, category, eventDate, venue, ticketPrice, totalCapacity } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!title || !description || !category || !eventDate || !venue || ticketPrice == null || !totalCapacity) {
      return res.status(400).json({
        success: false,
        message: 'title, description, category, eventDate, venue, ticketPrice, and totalCapacity are required.',
      });
    }
    if (new Date(eventDate) <= new Date()) {
      return res.status(400).json({ success: false, message: 'eventDate must be in the future.' });
    }
    if (totalCapacity < 1) {
      return res.status(400).json({ success: false, message: 'totalCapacity must be at least 1.' });
    }

    // ── Build the event document ───────────────────────────────────────────────
    const eventRef = db.collection(EVENTS_COLLECTION).doc();

    const eventData = {
      id:               eventRef.id,
      title,
      description,
      category,
      eventDate:        new Date(eventDate).toISOString(),
      venue,
      organizerId:      req.user.id, // Set from the verified JWT payload
      ticketPrice:      Number(ticketPrice),
      totalCapacity:    parseInt(totalCapacity, 10),
      availableTickets: parseInt(totalCapacity, 10), // Initially all seats are available
      createdAt:        new Date().toISOString(),
    };

    await eventRef.set(eventData);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: eventData,
    });
  } catch (error) {
    console.error('[eventController.createEvent]', error);
    return res.status(500).json({ success: false, message: 'Failed to create event.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/events/:id   — Update event details (Organizer + ownership check)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventRef = db.collection(EVENTS_COLLECTION).doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, message: `Event with id "${id}" not found.` });
    }

    const eventData = eventDoc.data();

    // ── Ownership check — only the organizer who created the event can edit it ──
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only update events that you created.',
      });
    }

    // ── Build update payload from allowed fields (ignore protected fields) ────
    const allowedUpdates = ['title', 'description', 'category', 'eventDate', 'venue', 'ticketPrice'];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate eventDate if provided
    if (updates.eventDate && new Date(updates.eventDate) <= new Date()) {
      return res.status(400).json({ success: false, message: 'eventDate must be in the future.' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update provided.' });
    }

    updates.updatedAt = new Date().toISOString();
    await eventRef.update(updates);

    const updatedDoc = await eventRef.get();
    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      data: updatedDoc.data(),
    });
  } catch (error) {
    console.error('[eventController.updateEvent]', error);
    return res.status(500).json({ success: false, message: 'Failed to update event.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/events/:id   — Cancel and delete event (Organizer + ownership)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventRef = db.collection(EVENTS_COLLECTION).doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, message: `Event with id "${id}" not found.` });
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    if (eventDoc.data().organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only delete events that you created.',
      });
    }

    await eventRef.delete();

    return res.status(200).json({
      success: true,
      message: `Event "${eventDoc.data().title}" has been cancelled and deleted.`,
    });
  } catch (error) {
    console.error('[eventController.deleteEvent]', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/:id/attendees   — List attendees for an event (Organizer only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getEventAttendees = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the event exists and belongs to this organizer
    const eventDoc = await db.collection(EVENTS_COLLECTION).doc(id).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, message: `Event with id "${id}" not found.` });
    }

    if (eventDoc.data().organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only view attendees for your own events.',
      });
    }

    // Fetch all confirmed tickets for this event
    const ticketsSnapshot = await db
      .collection('tickets')
      .where('eventId', '==', id)
      .where('status', '==', 'confirmed')
      .get();

    const attendees = ticketsSnapshot.docs.map((doc) => {
      const t = doc.data();
      return {
        ticketId:      t.id,
        attendeeName:  t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        quantity:      t.quantity,
        bookingRef:    t.bookingRef,
        bookedAt:      t.bookedAt,
      };
    });

    return res.status(200).json({
      success: true,
      event: eventDoc.data().title,
      count: attendees.length,
      data: attendees,
    });
  } catch (error) {
    console.error('[eventController.getEventAttendees]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendees.' });
  }
};
