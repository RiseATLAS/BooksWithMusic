export class DatabaseManager {
  constructor() {
    this.db = null;
    this.DB_NAME = 'BooksWithMusicDB';
    this.DB_VERSION = 2;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('books')) {
          const booksStore = db.createObjectStore('books', { keyPath: 'id' });
          booksStore.createIndex('by-date', 'addedDate');
        }

        if (!db.objectStoreNames.contains('tracks')) {
          const tracksStore = db.createObjectStore('tracks', { keyPath: 'id' });
          tracksStore.createIndex('by-source', 'source');
        }

        if (!db.objectStoreNames.contains('mappings')) {
          const mappingsStore = db.createObjectStore('mappings', { keyPath: 'chapterId' });
          mappingsStore.createIndex('by-book', 'bookId');
        }

        if (!db.objectStoreNames.contains('analyses')) {
          const analysesStore = db.createObjectStore('analyses', { keyPath: 'bookId' });
          analysesStore.createIndex('by-date', 'analyzedAt');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
    });
  }

  async addBook(book) {
    return this._performTransaction('books', 'readwrite', (store) => store.put(book));
  }

  async saveBook(book) {
    book.id = book.id || Date.now();
    await this._performTransaction('books', 'readwrite', (store) => {
      return store.put(book);
    });
    return book.id;
  }

  async getBook(id) {
    return this._performTransaction('books', 'readonly', (store) => store.get(id));
  }

  async getAllBooks() {
    return this._performTransaction('books', 'readonly', (store) => store.getAll());
  }

  async deleteBook(id) {
    return this._performTransaction('books', 'readwrite', (store) => store.delete(id));
  }

  async updateBook(id, updates) {
    const book = await this.getBook(id);
    if (!book) throw new Error('Book not found');
    Object.assign(book, updates);
    return this._performTransaction('books', 'readwrite', (store) => store.put(book));
  }

  async addTrack(track) {
    return this._performTransaction('tracks', 'readwrite', (store) => store.put(track));
  }

  async getTrack(id) {
    return this._performTransaction('tracks', 'readonly', (store) => store.get(id));
  }

  async getAllTracks() {
    return this._performTransaction('tracks', 'readonly', (store) => store.getAll());
  }

  async addMapping(mapping) {
    return this._performTransaction('mappings', 'readwrite', (store) => store.put(mapping));
  }

  async getMappingsByBook(bookId) {
    return this._performTransaction('mappings', 'readonly', (store) => {
      const index = store.index('by-book');
      return index.getAll(bookId);
    });
  }

  async saveSetting(key, value) {
    return this._performTransaction('settings', 'readwrite', (store) => store.put(value, key));
  }

  async getSetting(key) {
    return this._performTransaction('settings', 'readonly', (store) => store.get(key));
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

  // Analysis methods
  async saveAnalysis(bookId, analysis) {
    const data = {
      bookId,
      ...analysis,
      analyzedAt: new Date().toISOString()
    };
    return this._performTransaction('analyses', 'readwrite', (store) => store.put(data));
  }

  async getAnalysis(bookId) {
    return this._performTransaction('analyses', 'readonly', (store) => store.get(bookId));
  }

  async deleteAnalysis(bookId) {
    return this._performTransaction('analyses', 'readwrite', (store) => store.delete(bookId));
  }

  _performTransaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      try {
        const transaction = this.db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = callback(store);

        if (request) {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } else {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
