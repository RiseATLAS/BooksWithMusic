// Firebase Configuration
// This file initializes Firebase services for the BooksWithMusic app
// 
// Setup Instructions:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or select existing one)
// 3. Click "Add app" and select "Web" (</> icon)
// 4. Register your app and copy the configuration values
// 5. Enable Authentication > Sign-in method > Google
// 6. Create Firestore Database (Start in production mode)
// 7. Create Storage bucket
// 8. Update the values below
//
// 🔐 SECURITY: NEVER commit actual Firebase API keys to version control!
//
// 🚫 ANALYTICS DISABLED: Firebase Analytics is intentionally disabled
// for privacy reasons. Only Authentication, Firestore, and Storage are used.

// Import Firebase from CDN (compat version for simpler usage without bundler)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
// Replace these with your actual Firebase project values
// Or use environment variables for deployment
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
  // measurementId is intentionally omitted - Analytics is disabled for privacy
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
         firebaseConfig.authDomain !== "YOUR_PROJECT.firebaseapp.com" &&
         firebaseConfig.storageBucket !== "YOUR_PROJECT.appspot.com";
};

// Initialize Firebase only if configured
let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✓ Firebase initialized successfully (Analytics disabled for privacy)');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase not configured. Please add your Firebase configuration.');
  console.warn('See FIREBASE_SETUP.md for setup instructions.');
}

// Export Firebase services
// Note: Analytics is intentionally not initialized or exported
export { app, auth, db, storage, isFirebaseConfigured };
