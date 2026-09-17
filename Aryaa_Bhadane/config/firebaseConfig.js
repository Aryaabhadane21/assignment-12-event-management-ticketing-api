/**
 * config/firebaseConfig.js
 * -----------------------
 * Initializes Firebase Admin SDK and exports the Firestore `db` instance.
 *
 * Supported Initialization Strategies:
 *   1. Option 1 (Recommended for Render):
 *      FIREBASE_SERVICE_ACCOUNT_JSON environment variable containing the stringified JSON.
 *   2. Option 2:
 *      Split environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 *   3. Option 3 (Local Development):
 *      Reads local `serviceAccountKey.json` file placed in the project root.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  let credential = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
      console.log('✔ Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT_JSON.');
    } catch (err) {
      console.error('✖ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      });
      console.log('✔ Firebase Admin initialized using split environment variables.');
    } catch (err) {
      console.error('✖ Failed to initialize Firebase from split env vars:', err.message);
    }
  } else {
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      try {
        // eslint-disable-next-line import/no-dynamic-require
        const serviceAccount = require(serviceAccountPath);
        // Only attempt to init if it's not the placeholder
        if (serviceAccount.project_id && serviceAccount.project_id !== 'YOUR_PROJECT_ID') {
          credential = admin.credential.cert(serviceAccount);
          console.log('✔ Firebase Admin initialized using serviceAccountKey.json.');
        } else {
          console.warn(
            '⚠️  serviceAccountKey.json contains placeholder values. Set real Firebase credentials in .env or serviceAccountKey.json before running database queries.',
          );
        }
      } catch (err) {
        console.warn('⚠️  Could not load serviceAccountKey.json:', err.message);
      }
    } else {
      console.warn(
        '⚠️  No Firebase credentials found. Provide FIREBASE_SERVICE_ACCOUNT_JSON or place serviceAccountKey.json in the project root.',
      );
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
  }
}

let db;
try {
  db = admin.apps.length ? admin.firestore() : null;
} catch (err) {
  console.warn('⚠️  Firestore could not be initialized:', err.message);
}

module.exports = { admin, db };
