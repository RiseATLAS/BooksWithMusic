// Firestore Storage Module
// Handles user settings, book metadata, and reading progress in Firestore

import { db, auth } from '../config/firebase-config.js';
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
  if (!userId) {
    console.error(' saveUserSettings: No user ID provided');
    throw new Error('User ID required to save settings');
  }
  if (!settings) {
    console.error(' saveUserSettings: No settings provided');
    throw new Error('Settings required');
  }
  
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(settingsRef, settings, { merge: true });
  } catch (error) {
    console.error(' Failed to save settings to Firestore:', error);
    throw error;
  }
}

/**
 * Get user settings from Firestore
 * @param {string} userId - User's unique ID
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
export async function getUserSettings(userId) {
  try {
    const userSettingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const docSnap = await getDoc(userSettingsRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
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
  try {
    const progressRef = doc(db, 'users', userId, 'books', bookId);
    // Use setDoc with merge to create or update the document
    await setDoc(progressRef, {
      progress: progress,
      lastRead: serverTimestamp()
    }, { merge: true });
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
  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await setDoc(bookRef, {
      ...metadata,
      createdAt: serverTimestamp(),
      lastRead: serverTimestamp()
    }, { merge: true });
    
  } catch (error) {
    console.error('Error saving book metadata:', error);
    throw new Error(`Failed to save metadata: ${error.message}`);
  }
}

/**
 * Save a new book (EPUB as base64 + metadata) to Firestore, enforcing 10-book limit
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {Object} metadata - Book metadata (title, author, etc.)
 * @param {string} fileBase64 - EPUB file as base64 string (or null if using chunks)
 * @returns {Promise<string>} Book ID if saved, throws error if limit reached
 */
export async function saveBook(userId, bookId, metadata, fileBase64) {
  // Check current book count
  const books = await getUserBooks(userId);
  if (books.length >= 10) {
    throw new Error('Maximum 10 books allowed per user. Delete a book to add more.');
  }
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  
  // If fileBase64 is provided, store it directly, otherwise it's stored in chunks
  const dataToSave = {
    ...metadata,
    createdAt: serverTimestamp(),
    lastRead: serverTimestamp()
  };
  
  if (fileBase64) {
    dataToSave.fileData = fileBase64;
  }
  
  await setDoc(bookRef, dataToSave, { merge: true });
  return bookId;
}

/**
 * Save book data as chunks in Firestore
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {string} data - Base64 data to chunk
 * @param {number} chunkSize - Size of each chunk (default 500KB)
 * @returns {Promise<number>} Number of chunks saved
 */
export async function saveBookChunks(userId, bookId, data, chunkSize = 500000) {
  const totalChunks = Math.ceil(data.length / chunkSize);
  console.log(`📦 Splitting into ${totalChunks} chunks...`);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkData = data.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkRef = doc(db, 'users', userId, 'books', bookId, 'chunks', i.toString());
    await setDoc(chunkRef, {
      data: chunkData,
      index: i,
      createdAt: serverTimestamp()
    });
    console.log(`✓ Saved chunk ${i + 1}/${totalChunks}`);    
    // Small delay between chunks to avoid overwhelming Firestore write stream
    if (i < totalChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return totalChunks;
}

/**
 * Get book data from chunks
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {number} totalChunks - Total number of chunks to retrieve
 * @returns {Promise<string>} Reassembled data
 */
export async function getBookChunks(userId, bookId, totalChunks) {
  console.log(`📦 Retrieving ${totalChunks} chunks...`);
  let reassembledData = '';
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkRef = doc(db, 'users', userId, 'books', bookId, 'chunks', i.toString());
    const chunkSnap = await getDoc(chunkRef);
    
    if (!chunkSnap.exists()) {
      throw new Error(`Missing chunk ${i}`);
    }
    
    reassembledData += chunkSnap.data().data;
    console.log(`✓ Retrieved chunk ${i + 1}/${totalChunks}`);  }
  
  return reassembledData;
}

/**
 * Delete book chunks from Firestore
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {number} totalChunks - Total number of chunks to delete
 * @returns {Promise<void>}
 */
export async function deleteBookChunks(userId, bookId, totalChunks) {
  if (!totalChunks) return;
  console.log(`🗑️ Deleting ${totalChunks} chunks...`);

  for (let i = 0; i < totalChunks; i++) {
    const chunkRef = doc(db, 'users', userId, 'books', bookId, 'chunks', i.toString());
    try {
      await deleteDoc(chunkRef);
    } catch (error) {
      console.warn(`Could not delete chunk ${i}:`, error);
    }
  }
}

/**
 * Get a single book by ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<Object|null>} Book data or null if not found
 */
export async function getBook(bookId) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  const docSnap = await getDoc(bookRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Get all user's books metadata
 * @param {string} userId - User's unique ID (optional, uses current user if not provided)
 * @returns {Promise<Array>} Array of book metadata objects
 */
export async function getUserBooks(userId) {
  try {
    if (!userId) {
      userId = auth.currentUser?.uid;
    }
    if (!userId) {
      console.log('No user signed in, returning empty books array');
      return [];
    }
    const booksRef = collection(db, 'users', userId, 'books');
    const querySnapshot = await getDocs(booksRef);
    
    const books = [];
    querySnapshot.forEach((doc) => {
      books.push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log(`📚 Loaded ${books.length} books from Firestore`);

    return books;
  } catch (error) {
    console.error('Error getting user books:', error);
    throw new Error(`Failed to load books: ${error.message}`);
  }
}

/**
 * Delete book metadata from Firestore (and chunks if they exist)
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<void>}
 */
export async function deleteBookMetadata(userId, bookId) {
  try {
    // Get book metadata to check if it has chunks
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    const bookSnap = await getDoc(bookRef);
    
    if (bookSnap.exists() && bookSnap.data().chunked) {
      // Delete chunks first
      await deleteBookChunks(userId, bookId, bookSnap.data().totalChunks);
    }
    
    // Delete the book metadata
    await deleteDoc(bookRef);
    console.log(`🗑️ Metadata deleted for book ${bookId}`);

  } catch (error) {
    console.error('Error deleting book metadata:', error);
    throw new Error(`Failed to delete metadata: ${error.message}`);
  }
}

/**
 * Delete a book (alias for deleteBookMetadata, uses current auth user)
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<void>}
 */
export async function deleteBook(bookId) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  return await deleteBookMetadata(userId, bookId);
}

/**
 * Update a book's data in Firestore
 * @param {string} bookId - Book's unique ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateBook(bookId, updates) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  await setDoc(bookRef, updates, { merge: true });
  console.log(`📚 Book ${bookId} updated`);}

/**
 * Log track usage to Firestore for CC0 compliance documentation
 * Stores: freesoundId, license (CC0), source URL, timestamp, file hash (if available)
 * @param {string} userId - User's unique ID
 * @param {Object} trackInfo - Track information
 * @returns {Promise<void>}
 */
export async function logTrackUsage(userId, trackInfo) {
  if (!userId || !trackInfo) {
    console.error('logTrackUsage: Missing required parameters');
    return;
  }
  
  // Only log CC0 tracks (fail-safe)
  // Check for both text format ('CC0') and URL format ('publicdomain/zero')
  const licenseType = trackInfo.license?.type?.toString().toLowerCase() || '';
  const isCC0 = licenseType === 'cc0' || 
                licenseType.includes('publicdomain/zero') ||
                licenseType.includes('creative commons 0');
  
  if (!isCC0) {
    console.error(`❌ Attempted to log non-CC0 track: ${trackInfo.title} (${trackInfo.license?.type})`);
    return;
  }
  
  try {
    const usageRef = doc(db, 'trackUsage', `${userId}_${trackInfo.freesoundId}_${Date.now()}`);
    await setDoc(usageRef, {
      userId: userId,
      freesoundId: trackInfo.freesoundId,
      trackTitle: trackInfo.title,
      artist: trackInfo.artist,
      license: 'CC0',
      sourceUrl: trackInfo.license.sourceUrl,
      fetchedAt: trackInfo.license.fetchedAt,
      playedAt: serverTimestamp(),
      duration: trackInfo.duration,
      tags: trackInfo.tags || []
    });
    console.log(`Track usage logged: ${trackInfo.title} (Freesound ID: ${trackInfo.freesoundId})`);

  } catch (error) {
    console.error('Failed to log track usage:', error);
    // Don't throw - logging shouldn't break playback
  }
}

/**
 * FirestoreStorage class - wraps Firestore functions with auth context
 */
export class FirestoreStorage {
  constructor() {
    this.auth = null;
  }

  async getUserBooks() {
    const userId = this.getCurrentUserId();
    return await getUserBooks(userId);
  }

  async saveBook(bookId, bookData) {
    const userId = this.getCurrentUserId();
    const { fileData, ...metadata } = bookData;
    return await saveBook(userId, bookId, metadata, fileData);
  }

  async updateBook(bookId, updates) {
    const userId = this.getCurrentUserId();
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await setDoc(bookRef, updates, { merge: true });
  }

  async deleteBook(bookId) {
    const userId = this.getCurrentUserId();
    return await deleteBookMetadata(userId, bookId);
  }

  async saveProgress(bookId, progress) {
    const userId = this.getCurrentUserId();
    return await saveBookProgress(userId, bookId, progress);
  }

  async getProgress(bookId) {
    const userId = this.getCurrentUserId();
    return await getBookProgress(userId, bookId);
  }

  async saveSettings(settings) {
    const userId = this.getCurrentUserId();
    return await saveUserSettings(userId, settings);
  }

  async getSettings() {
    const userId = this.getCurrentUserId();
    return await getUserSettings(userId);
  }

  async calculateStorageUsage(userId) {
    if (!userId) {
      userId = auth.currentUser?.uid;
    }
    if (!userId) {
      return 0;
    }
    
    const books = await getUserBooks();
    let totalSize = 0;
    for (const book of books) {
        if (book.fileSize) {
            totalSize += book.fileSize;
        }
    }
    return totalSize;
  }

  getCurrentUserId() {
    if (!auth?.currentUser) {
      throw new Error('User not authenticated');
    }
    return auth.currentUser.uid;
  }
}
