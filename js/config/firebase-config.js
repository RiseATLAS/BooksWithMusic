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
// 8. Update the values below or use environment variables
//
// 🔐 SECURITY: NEVER commit actual Firebase API keys to version control!
// Always use environment variables (.env file) for production deployments.
// The .env file is gitignored to prevent accidental commits.
//
// 📝 PRODUCTION: Firebase credentials are stored as GitHub repository secrets
// for secure CI/CD deployment. They are automatically injected during build.
//
// 🚫 ANALYTICS DISABLED: Firebase Analytics is intentionally disabled
// for privacy reasons. Only Authentication, Firestore, and Storage are used.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// Replace these with your actual Firebase project values
// Or use Vite environment variables (VITE_FIREBASE_*)
// ⚠️ WARNING: Do NOT hardcode real API keys here. Use environment variables!
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
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
