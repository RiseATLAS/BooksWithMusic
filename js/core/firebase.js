
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Validate Firebase configuration
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
const missingConfig = requiredConfig.filter(key => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  console.error('❌ Firebase configuration incomplete. Missing:', missingConfig);
  console.error('Please set the following environment variables or GitHub secrets:', 
    missingConfig.map(key => `VITE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', '));
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
