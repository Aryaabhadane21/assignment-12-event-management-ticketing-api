# Event Management & Ticketing API

A high-concurrency REST API for event ticketing and live seat booking, built with **Express.js** and **Firebase Firestore**. Features Firestore ACID transactions to prevent ticket overselling, JWT Role-Based Access Control (Organizer vs Attendee), API rate limiting against scalping bots, and interactive Swagger UI documentation.

---

## 🏗️ Project Structure

```
Aryaa_Bhadane/
├── config/
│   ├── firebaseConfig.js     # Firebase Admin SDK init (env-var or local file)
│   └── swagger.js            # OpenAPI 3.0 spec configuration
├── controllers/
│   ├── authController.js     # Register / Login / Profile
│   ├── eventController.js    # CRUD + attendee listing
│   └── ticketController.js   # Transactional booking & cancellation
├── middleware/
│   ├── auth.js               # JWT verification → attaches req.user
│   ├── checkRole.js          # RBAC guard (organizer / attendee)
│   └── rateLimiter.js        # 10 req/min booking limiter + general limiter
├── routes/
│   ├── authRoutes.js         # /api/auth/*
│   ├── eventRoutes.js        # /api/events/*
│   └── ticketRoutes.js       # /api/tickets/*
├── docs/                     # Screenshots (Swagger UI, Firestore collections)
├── serviceAccountKey.json    # ⛔ PLACEHOLDER — never commit real file
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── server.js                 # Express entry point
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js** ≥ 18
- **Firebase project** with Firestore (Native mode) enabled
- A **Firebase service account key** (JSON file from Firebase Console)

---

## 🚀 Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/your-username/assignment-12-event-management-ticketing-api.git
cd assignment-12-event-management-ticketing-api/Aryaa_Bhadane
npm install
```

### 2. Firebase Service Account

1. Open [Firebase Console](https://console.firebase.google.com/) → your project
2. **Project Settings** → **Service Accounts** → **Generate new private key**
3. Download the JSON file and rename it **`serviceAccountKey.json`**
4. Place it inside the `Aryaa_Bhadane/` folder (it is already in `.gitignore`)

### 3. Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
PORT=5000
JWT_SECRET=replace_with_a_long_random_secret_string
```

> **For Render deployment**, set `FIREBASE_SERVICE_ACCOUNT_JSON` instead of using the file — see the [Deployment section](#-deploying-to-render) below.

### 4. Run the Server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The server starts on **http://localhost:5000**.

| URL | Description |
|-----|-------------|
| `http://localhost:5000/api-docs` | 🎯 Interactive Swagger UI |
| `http://localhost:5000/health`   | Health check |
| `http://localhost:5000/api-docs.json` | Raw OpenAPI JSON spec |

---

## 📡 API Overview

### 🔐 Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register as Organizer or Attendee |
| POST | `/api/auth/login` | Public | Login and receive JWT token |
| GET  | `/api/auth/profile` | Authenticated | View your profile & role |

### 🎪 Event Management

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET    | `/api/events` | Public | Browse upcoming events (`?category=Tech&city=Mumbai`) |
| GET    | `/api/events/:id` | Public | View event + live ticket count |
| POST   | `/api/events` | Organizer | Create a new event |
| PUT    | `/api/events/:id` | Organizer (owner) | Update event details |
| DELETE | `/api/events/:id` | Organizer (owner) | Cancel & delete event |
| GET    | `/api/events/:id/attendees` | Organizer (owner) | List all confirmed attendees |

### 🎟️ Ticket Booking (Rate Limited)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/tickets/book` | Attendee | **Atomic booking** — max **10 req/min** per IP |
| GET  | `/api/tickets/my-tickets` | Attendee | View your purchased tickets |
| POST | `/api/tickets/:id/cancel` | Attendee (owner) | Cancel ticket & restore inventory |

---

## 🔒 Authentication

All protected routes require:

```
Authorization: Bearer <your_jwt_token>
```

Get the token from `/api/auth/login` or `/api/auth/register`.

---

## ⚡ Firestore ACID Transactions

The booking and cancellation endpoints use `db.runTransaction()` to atomically:

1. **Read** the event's current `availableTickets`
2. **Validate** that enough tickets exist
3. **Decrement** inventory and **create** the ticket document — all in one atomic commit

This prevents overselling even under thousands of concurrent requests racing for the last seats.

---

## 🛡️ Rate Limiting

| Route | Limit | Window | Error |
|-------|-------|--------|-------|
| `POST /api/tickets/book` | **10 requests** | 60 seconds | `429 Too Many Requests` |
| All `/api/*` routes | 200 requests | 15 minutes | `429 Too Many Requests` |

---

## 🚢 Deploying to Render

1. Push the repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo. Set **Root Directory** to `Aryaa_Bhadane`.
4. Configure:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables:
   | Key | Value |
   |-----|-------|
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON contents of `serviceAccountKey.json` (stringified) |
   | `JWT_SECRET` | A strong random secret |
6. Deploy. Your Swagger UI will be at `https://your-app.onrender.com/api-docs`.

---

## 📋 Grading Rubric Coverage

| Component | Implementation |
|-----------|---------------|
| ✅ Firestore ACID Transactions (25 pts) | `runTransaction` in `bookTicket` & `cancelTicket` with read-check-write pattern |
| ✅ RBAC — Organizer vs Attendee (20 pts) | `middleware/auth.js` + `middleware/checkRole.js` on all protected routes |
| ✅ Swagger / OpenAPI Docs (20 pts) | Full JSDoc annotations on all routes, mounted at `/api-docs` |
| ✅ Rate Limiting — Anti-bot (20 pts) | `bookingRateLimiter` (10/min) on `/api/tickets/book` only |
| ✅ Error Handling & Clean Code (15 pts) | Consistent `{ success, message, data }` shape, proper HTTP status codes |

---

## 🧪 Manual Testing Guide

### Step 1 — Register an Organizer

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Aryaa Bhadane","email":"aryaa@test.com","password":"Secret@123","role":"organizer"}'
```

### Step 2 — Create an Event (use organizer token)

```bash
curl -X POST http://localhost:5000/api/events \
  -H "Authorization: Bearer <organizer_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Concert","description":"Live music","category":"Music","eventDate":"2027-01-01T18:00:00Z","venue":"Mumbai","ticketPrice":500,"totalCapacity":5}'
```

### Step 3 — Register an Attendee & Book Tickets

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Kunal Sharma","email":"kunal@test.com","password":"Pass@456","role":"attendee"}'

curl -X POST http://localhost:5000/api/tickets/book \
  -H "Authorization: Bearer <attendee_token>" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<event_id>","quantity":2,"attendeeName":"Kunal Sharma","attendeeEmail":"kunal@test.com"}'
```

### Step 4 — Test Rate Limiter (11th request within 60s returns 429)

```bash
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:5000/api/tickets/book \
    -H "Authorization: Bearer <attendee_token>" \
    -H "Content-Type: application/json" \
    -d '{"eventId":"x","quantity":1,"attendeeName":"Test","attendeeEmail":"t@t.com"}'
done
```

---

## 📸 Screenshots

See the `/docs` folder for:
- Swagger UI screenshots
- Firestore `events` and `tickets` collection screenshots

---

## 👩‍💻 Author

**Aryaa Bhadane** — Assignment 12

DEPLOYMENT LINK: https://event-management-ticketing-api.onrender.com/
