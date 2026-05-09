/**
 * firebase-config.js
 *
 * Initializes the Firebase app and exports the Firestore instance.
 *
 * HOW TO CONFIGURE:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Firestore (in Native mode)
 * 3. Register a web app and copy the firebaseConfig object below
 * 4. Replace the placeholder values with your project's actual values
 *
 * SECURITY NOTE:
 * Firebase API keys for web clients are safe to include here because access
 * is controlled by Firestore Security Rules, NOT by API-key secrecy.
 * Always configure proper Firestore Security Rules for production.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// -----------------------------------------------------------------------
// Replace with your Firebase project config.
// These values are intentionally non-secret for the web SDK.
// -----------------------------------------------------------------------
const firebaseConfig = {
  apiKey:            window.__FIREBASE_API_KEY__            || 'YOUR_API_KEY',
  authDomain:        window.__FIREBASE_AUTH_DOMAIN__        || 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         window.__FIREBASE_PROJECT_ID__         || 'YOUR_PROJECT_ID',
  storageBucket:     window.__FIREBASE_STORAGE_BUCKET__     || 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: window.__FIREBASE_MESSAGING_SENDER_ID__ || 'YOUR_SENDER_ID',
  appId:             window.__FIREBASE_APP_ID__             || 'YOUR_APP_ID'
};

const isConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

let app = null;
let db  = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db  = getFirestore(app);

  // Enable offline persistence so the app works without internet
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this browser.');
    }
  });
}

export { db, isConfigured };
