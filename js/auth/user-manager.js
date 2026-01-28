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
import { TEST_CONFIG } from './test-config.js';

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
    // Check test mode configuration
    if (TEST_CONFIG.SIMULATE_MAX_USERS) {
      console.log('🔍 [TEST MODE] Simulating max users reached');
      console.warn('❌ User limit reached (TEST MODE)');
      return { 
        allowed: false, 
        reason: `Registration closed: Maximum ${MAX_USERS} users allowed. This app is for friends & family only.`
      };
    }
    
    // Normal mode: Check if user already exists
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
      lastLogin: serverTimestamp()
      // Note: termsAccepted, termsVersion, and termsAcceptedAt are already set by acceptTerms()
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
 * Show max users reached modal
 * @returns {Promise<void>}
 */
export function showMaxUsersModal() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'max-users-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'max-users-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    // Modal content
    modal.innerHTML = `
      <div style="padding: 24px; border-bottom: 1px solid #e0e0e0;">
        <h2 style="margin: 0; color: #d32f2f; font-size: 24px;">❌ Registration Closed</h2>
      </div>
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0; color: #333; font-size: 16px; line-height: 1.6;">
          This app has reached its maximum capacity of <strong>${MAX_USERS} users</strong>.
        </p>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
          BooksWithMusic is a private service for friends & family only. 
          If you believe you should have access, please contact the administrator.
        </p>
      </div>
      <div style="padding: 24px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end;">
        <button class="max-users-ok" style="
          padding: 12px 32px;
          border: none;
          background: #2196F3;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        ">OK</button>
      </div>
    `;
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .max-users-ok:hover {
        background: #1976D2;
      }
      .max-users-ok:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Handle button
    const okBtn = modal.querySelector('.max-users-ok');
    
    const cleanup = () => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      document.body.style.overflow = '';
    };
    
    okBtn.addEventListener('click', () => {
      cleanup();
      resolve();
    });
    
    // Allow closing by clicking overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve();
      }
    });
    
    // Allow closing with Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', escapeHandler);
        resolve();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  });
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
