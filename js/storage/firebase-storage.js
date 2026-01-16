// Firebase Storage Module
// Handles EPUB file uploads and downloads in Firebase Storage

import { storage, isFirebaseConfigured } from '../config/firebase-config.js';
import { 
  ref, 
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

/**
 * Upload EPUB file to Firebase Storage
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @param {File|Blob} file - EPUB file to upload
 * @param {Function} progressCallback - Optional callback for upload progress (percent)
 * @returns {Promise<string>} Download URL of uploaded file
 */
export async function uploadEpub(userId, bookId, file, progressCallback = null) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    // Create reference to storage location: users/{userId}/books/{bookId}.epub
    const storageRef = ref(storage, `users/${userId}/books/${bookId}.epub`);
    
    console.log(`⬆️ Uploading EPUB: ${bookId}...`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: 'application/epub+zip',
      customMetadata: {
        uploadedAt: new Date().toISOString()
      }
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`✓ EPUB uploaded successfully: ${bookId}`);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading EPUB:', error);
    
    // Handle specific errors
    if (error.code === 'storage/unauthorized') {
      throw new Error('Unauthorized. Please sign in again.');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please free up space.');
    } else if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload timeout. Please check your connection and try again.');
    } else {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
}

/**
 * Download EPUB file from Firebase Storage
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<Blob>} EPUB file as Blob
 */
export async function downloadEpub(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    // Get download URL
    const downloadURL = await getEpubUrl(userId, bookId);
    
    console.log(`⬇️ Downloading EPUB: ${bookId}...`);
    
    // Fetch the file
    const response = await fetch(downloadURL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log(`✓ EPUB downloaded successfully: ${bookId}`);
    
    return blob;
  } catch (error) {
    console.error('Error downloading EPUB:', error);
    
    if (error.code === 'storage/object-not-found') {
      throw new Error('Book not found in storage');
    } else if (error.code === 'storage/unauthorized') {
      throw new Error('Unauthorized. Please sign in again.');
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

/**
 * Delete EPUB file from Firebase Storage
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<void>}
 */
export async function deleteEpub(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const storageRef = ref(storage, `users/${userId}/books/${bookId}.epub`);
    await deleteObject(storageRef);
    
    console.log(`✓ EPUB deleted successfully: ${bookId}`);
  } catch (error) {
    console.error('Error deleting EPUB:', error);
    
    if (error.code === 'storage/object-not-found') {
      console.warn('File already deleted or does not exist');
      // Don't throw error if file doesn't exist
      return;
    } else if (error.code === 'storage/unauthorized') {
      throw new Error('Unauthorized. Please sign in again.');
    } else {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

/**
 * Get download URL for EPUB file
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<string>} Download URL
 */
export async function getEpubUrl(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const storageRef = ref(storage, `users/${userId}/books/${bookId}.epub`);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error getting EPUB URL:', error);
    
    if (error.code === 'storage/object-not-found') {
      throw new Error('Book not found in storage');
    } else if (error.code === 'storage/unauthorized') {
      throw new Error('Unauthorized. Please sign in again.');
    } else {
      throw new Error(`Failed to get download URL: ${error.message}`);
    }
  }
}

/**
 * Check if EPUB exists in Firebase Storage
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<boolean>} True if file exists
 */
export async function epubExists(userId, bookId) {
  if (!isFirebaseConfigured()) {
    return false;
  }

  try {
    const storageRef = ref(storage, `users/${userId}/books/${bookId}.epub`);
    await getMetadata(storageRef);
    return true;
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      return false;
    }
    // For other errors, assume file doesn't exist
    return false;
  }
}

/**
 * Get EPUB metadata (size, upload date, etc.)
 * @param {string} userId - User's unique ID
 * @param {string} bookId - Book's unique ID
 * @returns {Promise<Object>} Metadata object
 */
export async function getEpubMetadata(userId, bookId) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  try {
    const storageRef = ref(storage, `users/${userId}/books/${bookId}.epub`);
    const metadata = await getMetadata(storageRef);
    
    return {
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
      customMetadata: metadata.customMetadata
    };
  } catch (error) {
    console.error('Error getting EPUB metadata:', error);
    throw new Error(`Failed to get metadata: ${error.message}`);
  }
}
