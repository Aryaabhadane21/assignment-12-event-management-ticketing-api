# Screenshots

Place the following screenshots in this folder before submitting:

## Required Screenshots

### 1. `swagger-ui.png`
- Visit http://localhost:5000/api-docs after starting the server
- Capture the full Swagger UI showing all endpoints (Auth, Events, Tickets tags)

### 2. `swagger-auth.png`
- Expand the Authentication section in Swagger UI
- Show the register and login endpoints

### 3. `swagger-book-ticket.png`
- Show the POST /api/tickets/book endpoint expanded with the request body schema

### 4. `firestore-events.png`
- Firebase Console → Firestore Database → events collection
- Show at least one event document with all fields

### 5. `firestore-tickets.png`
- Firebase Console → Firestore Database → tickets collection
- Show at least one confirmed ticket document

### 6. `rate-limit-429.png`
- Show the 429 Too Many Requests response when exceeding 10 booking requests/min

## How to take screenshots

1. Start the server: `npm run dev`
2. Open http://localhost:5000/api-docs in Chrome
3. Use the Swagger UI to register, login, create events, and book tickets
4. Check Firebase Console for the Firestore documents
5. Capture screenshots and save them here with descriptive names
