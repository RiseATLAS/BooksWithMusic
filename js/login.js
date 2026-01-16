import { FirebaseManager } from './storage/firebase-manager.js';

document.addEventListener('DOMContentLoaded', () => {
  const googleSignInButton = document.getElementById('google-signin-btn');
  const errorMessage = document.getElementById('error-message');
  const firebaseManager = new FirebaseManager();
  firebaseManager.initialize();

  googleSignInButton.addEventListener('click', async () => {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    try {
      await firebaseManager.auth.signInWithPopup(provider);
      // Use relative path for redirect to work with any base path
      window.location.href = './';
    } catch (error) {
      console.error('❌ Google Sign-In failed', error);
      errorMessage.textContent = 'Google Sign-In failed. Please try again.';
    }
  });
});