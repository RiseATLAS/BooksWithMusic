import { firebaseConfig } from '../core/firebase.js';

export class FirebaseManager {
  constructor() {
    this.db = null;
    this.storage = null;
    this.auth = null;
    this.currentUser = null;
  }

  async initialize() {
    // Wait for the firebase scripts to load
    await new Promise(resolve => {
        const interval = setInterval(() => {
            if (window.firebase) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });

    // Ensure Firebase is initialized only once
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    this.auth = window.firebase.auth();
    this.db = window.firebase.firestore();
    this.storage = window.firebase.storage();

    return new Promise((resolve) => {
      this.auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = user;
          console.log('✓ Firebase: Authenticated user:', user.uid);
        } else {
          // If not on the login page, redirect to it
          const path = window.location.pathname;
          if (!path.endsWith('/login.html') && !path.endsWith('/login')) {
            // Use relative path for redirect to work with any base path
            window.location.href = 'login.html';
          }
        }
        resolve(); // Resolve to allow the app to continue
      });
    });
  }

  // --- Book Methods ---

  async saveBook(bookData) {
    if (!this.currentUser) throw new Error("User not authenticated");

    const { data: arrayBuffer, ...metadata } = bookData;
    const bookRef = this.db.collection('users').doc(this.currentUser.uid).collection('books').doc();
    
    // 1. Upload EPUB to Firebase Storage
    const storagePath = `users/${this.currentUser.uid}/epubs/${bookRef.id}.epub`;
    const storageRef = this.storage.ref(storagePath);
    await storageRef.put(arrayBuffer);
    console.log('✓ Firebase: EPUB uploaded to', storagePath);

    // 2. Save metadata to Firestore
    const finalMetadata = {
      ...metadata,
      id: bookRef.id,
      storagePath: storagePath, // Add storage path to metadata
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    await bookRef.set(finalMetadata);
    console.log('✓ Firebase: Book metadata saved to Firestore');

    return bookRef.id;
  }

  async getBook(id) {
    if (!this.currentUser) throw new Error("User not authenticated");
    const doc = await this.db.collection('users').doc(this.currentUser.uid).collection('books').doc(id).get();
    
    if (!doc.exists) return null;

    const bookData = doc.data();
    
    // Get download URL for the EPUB
    try {
        const url = await this.storage.ref(bookData.storagePath).getDownloadURL();
        bookData.downloadUrl = url; // Add it to the object
    } catch (error) {
        console.error("Failed to get download URL", error);
        bookData.downloadUrl = null;
    }

    return bookData;
  }

  async getAllBooks() {
    if (!this.currentUser) throw new Error("User not authenticated");
    const snapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('books').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
  }

  async deleteBook(id) {
    if (!this.currentUser) throw new Error("User not authenticated");
    
    const bookRef = this.db.collection('users').doc(this.currentUser.uid).collection('books').doc(id);
    
    // 1. Delete EPUB from Storage
    const doc = await bookRef.get();
    if (doc.exists && doc.data().storagePath) {
        try {
            await this.storage.ref(doc.data().storagePath).delete();
            console.log('✓ Firebase: EPUB deleted from Storage');
        } catch(error) {
            // Ignore if file doesn't exist
            if (error.code !== 'storage/object-not-found') {
                console.error("Error deleting file from storage", error);
                throw error; // re-throw if it's not a "not found" error
            }
        }
    }

    // 2. Delete Firestore record
    await bookRef.delete();
    console.log('✓ Firebase: Book metadata deleted from Firestore');

    // 3. (Optional) Delete related analysis
    await this.deleteAnalysis(id);
  }

  async updateBook(id, updates) {
    if (!this.currentUser) throw new Error("User not authenticated");
    const bookRef = this.db.collection('users').doc(this.currentUser.uid).collection('books').doc(id);
    await bookRef.update(updates);
  }

  // --- Settings Methods ---

  async saveSetting(key, value) {
    if (!this.currentUser) throw new Error("User not authenticated");
    await this.db.collection('users').doc(this.currentUser.uid).collection('settings').doc(key).set({ value });
  }

  async getSetting(key) {
    if (!this.currentUser) throw new Error("User not authenticated");
    const doc = await this.db.collection('users').doc(this.currentUser.uid).collection('settings').doc(key).get();
    return doc.exists ? doc.data().value : undefined;
  }

  async getSettings() {
    const settings = await this.getSetting('reader');
    return settings || this._getDefaultSettings();
  }

  _getDefaultSettings() {
    return {
      theme: 'light',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.6,
      contentWidth: 700,
      pageMusicSwitch: false,
      crossfadeDuration: 4,
    };
  }

  // --- Analysis Methods ---

  async saveAnalysis(bookId, analysis) {
    if (!this.currentUser) throw new Error("User not authenticated");
    const data = {
      bookId,
      ...analysis,
      analyzedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    await this.db.collection('users').doc(this.currentUser.uid).collection('analyses').doc(bookId).set(data);
  }

  async getAnalysis(bookId) {
    if (!this.currentUser) throw new Error("User not authenticated");
    const doc = await this.db.collection('users').doc(this.currentUser.uid).collection('analyses').doc(bookId).get();
    return doc.exists ? doc.data() : null;
  }
  
  async deleteAnalysis(bookId) {
      if (!this.currentUser) throw new Error("User not authenticated");
      await this.db.collection('users').doc(this.currentUser.uid).collection('analyses').doc(bookId).delete();
      console.log('✓ Firebase: Analysis deleted for book', bookId);
  }
}
