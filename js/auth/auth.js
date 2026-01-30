// Firebase Authenication Module
// Handles user authentication with Google Sign-In

import { auth } from '../config/firebase-config.js';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { checkUserRegistration, registerUser, updateLastLogin, showMaxUsersModal } from './user-manager.js';
import { checkAndPromptTerms } from './terms-of-service.js';

/**
 * Initialize Firebase Authentication
 * Sets up authentication listeners and handlers
 */
export function initAuth() {

}

function getDevAuthUser() {
  return {
    uid: 'dev-user',
    email: 'dev@local.test',
    displayName: 'Dev User',
    photoURL: ''
  };
}

function isDevAuthEnabled() {
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalhost) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const enabled = params.has('devAuth') || localStorage.getItem('bwm-dev-auth') === 'true';
  if (enabled) {
    localStorage.setItem('bwm-dev-auth', 'true');
  }
  return enabled;
}

/**
 * Sign in with Google using popup
 * @returns {Promise<Object>} User object with uid, email, displayName, photoURL
 * @throws {Error} If sign-in fails
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    // Request additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // PRODUCTION FLOW:
    // 1. Check max users / registration capacity first
    // 2. Check/prompt for Terms of Service
    // 3. Register new user or update existing user
    
    // Step 1: Check if user registration is allowed
    const registrationCheck = await checkUserRegistration(
      user.uid, 
      user.displayName || 'Unknown User', 
      user.email
    );
    
    if (!registrationCheck.allowed) {
      // Show max users modal
      await showMaxUsersModal();
      // Sign out immediately
      await firebaseSignOut(auth);
      throw new Error(registrationCheck.reason);
    }
    
    // Step 2: Check terms acceptance
    const termsAccepted = await checkAndPromptTerms(user.uid);
    
    if (!termsAccepted) {
      // User declined terms - sign them out
      await firebaseSignOut(auth);
      throw new Error('You must accept the Terms of Use to continue.');
    }
    
    // Step 3: Register or update user
    if (!registrationCheck.isExisting) {
      await registerUser(user.uid, user.displayName || 'Unknown User', user.email);

    } else {
      await updateLastLogin(user.uid);

    }
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  } catch (error) {
    console.error('Sign-in error:', error);
    
    // Handle specific error codes
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup blocked by browser. Please allow popups for this site.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in popup is already open');
    } else {
      throw error; // Re-throw as-is to preserve custom messages
    }
  }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 * @throws {Error} If sign-out fails
 */
export async function signOut() {
  if (isDevAuthEnabled()) {
    localStorage.removeItem('bwm-dev-auth');
    return;
  }

  if (!auth.currentUser) {
    return;
  }

  try {
    await firebaseSignOut(auth);
    console.log(' User signed out');
  } catch (error) {
    console.error('Sign-out error:', error);
    throw new Error(`Sign-out failed: ${error.message}`);
  }
}

/**
 * Listen for authentication state changes
 * @param {Function} callback - Called with user object when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
  if (isDevAuthEnabled()) {
    callback(getDevAuthUser());
    return () => {};
  }

  return firebaseOnAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Get the currently signed-in user
 * @returns {Object|null} User object or null if not signed in
 */
export function getCurrentUser() {
  if (isDevAuthEnabled()) {
    return getDevAuthUser();
  }

  if (!auth.currentUser) {
    return null;
  }

  const user = auth.currentUser;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL
  };
}

/**
 * Check if user is currently authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return auth.currentUser !== null;
}
