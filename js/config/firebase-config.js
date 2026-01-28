// Firebase Configuration for BooksWithMusic
// This file is safe to commit (web config only, no secrets)
// Security is enforced by Firebase rules, not by hiding this config

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC897FLQZPGYhZ5Y40VxVFnM2O3dGcRAqA",
  authDomain: "bookswithmusic-85876084-f64fa.firebaseapp.com",
  projectId: "bookswithmusic-85876084-f64fa",
  storageBucket: "bookswithmusic-85876084-f64fa.firebasestorage.app",
  messagingSenderId: "902115268020",
  appId: "1:902115268020:web:bb2b3b75f6703cdd018ee1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, firebaseConfig };
