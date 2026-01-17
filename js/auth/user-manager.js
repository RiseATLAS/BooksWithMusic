// User Management Module
// Handles user registration cap and name verification for friends & family

import { db } from '../config/firebase-config.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection,
  query,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const MAX_USERS = 20;
const ADMIN_COLLECTION = 'admin';
const USER_COUNT_DOC = 'userCount';

/**
 * Check if user registration is allowed
 * @param {string} userId - User ID to check
 * @param {string} userName - User's display name
 * @param {string} userEmail - User's email
 * @returns {Promise<{allowed: boolean, reason?: string, isExisting?: boolean}>}
 */
export async function checkUserRegistration(userId, userName, userEmail) {
  try {
    // Check if user already exists
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log('✅ Existing user:', userName);
      return { 
        allowed: true, 
        isExisting: true,
        userData: userDoc.data()
      };
    }
    
    // New user - check if we're at capacity
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const currentUserCount = usersSnapshot.size;
    
    console.log(`📊 Current users: ${currentUserCount}/${MAX_USERS}`);
    
    if (currentUserCount >= MAX_USERS) {
      console.warn('❌ User limit reached');
      return { 
        allowed: false, 
        reason: `Registration closed: Maximum ${MAX_USERS} users allowed. This app is for friends & family only.`
      };
    }
    
    return { 
      allowed: true, 
      isExisting: false 
    };
  } catch (error) {
    console.error('Error checking user registration:', error);
    throw error;
  }
}

/**
 * Register a new user with name verification
 * @param {string} userId - User ID
 * @param {string} userName - User's display name
 * @param {string} userEmail - User's email
 * @returns {Promise<boolean>} True if registered successfully
 */
export async function registerUser(userId, userName, userEmail) {
  try {
    const check = await checkUserRegistration(userId, userName, userEmail);
    
    if (!check.allowed) {
      throw new Error(check.reason);
    }
    
    // If existing user, no need to register again
    if (check.isExisting) {
      return true;
    }
    
    // Register new user
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      name: userName,
      email: userEmail,
      registeredAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      termsAccepted: false, // Will be set to true by terms-of-service.js
      termsVersion: null
    }, { merge: true });
    
    console.log(`✅ New user registered: ${userName} (${userEmail})`);
    return true;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

/**
 * Update user's last login timestamp
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function updateLastLogin(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      lastLogin: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Could not update last login:', error);
  }
}

/**
 * Get user information
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export async function getUserInfo(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * Get current user count
 * @returns {Promise<number>} Number of registered users
 */
export async function getUserCount() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.size;
  } catch (error) {
    console.error('Error getting user count:', error);
    return 0;
  }
}

/**
 * Check if registration is open
 * @returns {Promise<boolean>} True if registration is still open
 */
export async function isRegistrationOpen() {
  try {
    const count = await getUserCount();
    return count < MAX_USERS;
  } catch (error) {
    console.error('Error checking registration status:', error);
    return false;
  }
}

/**
 * Get all registered users (admin only - for verification)
 * @returns {Promise<Array>} List of users with names and emails
 */
export async function getAllUsers() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        name: data.name,
        email: data.email,
        registeredAt: data.registeredAt,
        lastLogin: data.lastLogin
      });
    });
    
    // Sort by registration date
    users.sort((a, b) => {
      if (!a.registeredAt) return 1;
      if (!b.registeredAt) return -1;
      return b.registeredAt.toMillis() - a.registeredAt.toMillis();
    });
    
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}
