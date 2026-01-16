// Firestore Storage Module
// Handles user settings, book metadata, and reading progress in Firestore

import { db, isFirebaseConfigured } from '../config/firebase-config.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Save user settings to Firestore
 * @param {string} userId - User's unique ID
 * @param {Object} settings - Settings object containing theme, fontSize, etc.
 * @returns {Promise<void>}
 */
export async function saveUserSettings(userId, settings) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const userSettingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(userSettingsRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✓ User settings saved to Firestore');
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

/**
 * Get user settings from Firestore
 * @param {string} userId - User's unique ID
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
export async function getUserSettings(userId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const userSettingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const docSnap = await getDoc(userSettingsRef);
    
    if (docSnap.exists()) {
      console.log('✓ User settings loaded from Firestore');
      return docSnap.data();
    } else {
      console.log('No settings found in Firestore');
      return null;
    }
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw new Error(`Failed to load settings: ${error.message}`);
  }
}

/**
 * Save book reading progress
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {Object} progress - Progress data (chapterIndex, position, etc.)
 * @returns {Promise<void>}
 */
export async function saveBookProgress(userId, bookId, progress) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const progressRef = doc(db, 'users', userId, 'books', bookId);
    // Use setDoc with merge to create or update the document
    await setDoc(progressRef, {
      progress: progress,
      lastRead: serverTimestamp()
    }, { merge: true });
    
    console.log(`✓ Progress saved for book ${bookId}`);
  } catch (error) {
    console.error('Error saving book progress:', error);
    throw new Error(`Failed to save progress: ${error.message}`);
  }
}

/**
 * Get book reading progress
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<Object|null>} Progress object or null if not found
 */
export async function getBookProgress(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const progressRef = doc(db, 'users', userId, 'books', bookId);
    const docSnap = await getDoc(progressRef);
    
    if (docSnap.exists()) {
      return docSnap.data().progress;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting book progress:', error);
    throw new Error(`Failed to load progress: ${error.message}`);
  }
}

/**
 * Save book metadata to Firestore
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {Object} metadata - Book metadata (title, author, cover, etc.)
 * @returns {Promise<void>}
 */
export async function saveBookMetadata(userId, bookId, metadata) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await setDoc(bookRef, {
      ...metadata,
      createdAt: serverTimestamp(),
      lastRead: serverTimestamp()
    }, { merge: true });
    
    console.log(`✓ Metadata saved for book ${bookId}`);
  } catch (error) {
    console.error('Error saving book metadata:', error);
    throw new Error(`Failed to save metadata: ${error.message}`);
  }
}

/**
 * Get all user's books metadata
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of book metadata objects
 */
export async function getUserBooks(userId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const booksRef = collection(db, 'users', userId, 'books');
    const querySnapshot = await getDocs(booksRef);
    
    const books = [];
    querySnapshot.forEach((doc) => {
      books.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✓ Loaded ${books.length} books from Firestore`);
    return books;
  } catch (error) {
    console.error('Error getting user books:', error);
    throw new Error(`Failed to load books: ${error.message}`);
  }
}

/**
 * Delete book metadata from Firestore
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<void>}
 */
export async function deleteBookMetadata(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await deleteDoc(bookRef);
    
    console.log(`✓ Metadata deleted for book ${bookId}`);
  } catch (error) {
    console.error('Error deleting book metadata:', error);
    throw new Error(`Failed to delete metadata: ${error.message}`);
  }
}
