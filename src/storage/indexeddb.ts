import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Book, Track, ChapterMapping, ReaderSettings } from '../types/interfaces';

interface BooksWithMusicDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { 'by-date': string };
  };
  tracks: {
    key: string;
    value: Track;
    indexes: { 'by-source': string };
  };
  mappings: {
    key: string;
    value: ChapterMapping;
    indexes: { 'by-book': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

export class DatabaseManager {
  private db?: IDBPDatabase<BooksWithMusicDB>;
  private readonly DB_NAME = 'BooksWithMusicDB';
  private readonly DB_VERSION = 1;

  async initialize() {
    this.db = await openDB<BooksWithMusicDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Books store
        if (!db.objectStoreNames.contains('books')) {
          const booksStore = db.createObjectStore('books', { keyPath: 'id' });
          booksStore.createIndex('by-date', 'addedDate');
        }

        // Tracks store
        if (!db.objectStoreNames.contains('tracks')) {
          const tracksStore = db.createObjectStore('tracks', { keyPath: 'id' });
          tracksStore.createIndex('by-source', 'source');
        }

        // Mappings store
        if (!db.objectStoreNames.contains('mappings')) {
          const mappingsStore = db.createObjectStore('mappings', { keyPath: 'chapterId' });
          mappingsStore.createIndex('by-book', 'bookId');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }

  async addBook(book: Book): Promise<void> {
    await this.db!.put('books', book);
  }

  async getBook(id: string): Promise<Book | undefined> {
    return await this.db!.get('books', id);
  }

  async getAllBooks(): Promise<Book[]> {
    return await this.db!.getAllFromIndex('books', 'by-date');
  }

  async deleteBook(id: string): Promise<void> {
    await this.db!.delete('books', id);
  }

  async updateBook(book: Book): Promise<void> {
    await this.db!.put('books', book);
  }

  async addTrack(track: Track): Promise<void> {
    await this.db!.put('tracks', track);
  }

  async getTrack(id: string): Promise<Track | undefined> {
    return await this.db!.get('tracks', id);
  }

  async getAllTracks(): Promise<Track[]> {
    return await this.db!.getAll('tracks');
  }

  async addMapping(mapping: ChapterMapping): Promise<void> {
    await this.db!.put('mappings', mapping);
  }

  async getMappingsByBook(bookId: string): Promise<ChapterMapping[]> {
    return await this.db!.getAllFromIndex('mappings', 'by-book', bookId);
  }

  async saveSetting(key: string, value: any): Promise<void> {
    await this.db!.put('settings', value, key);
  }

  async getSetting(key: string): Promise<any> {
    return await this.db!.get('settings', key);
  }

  async getSettings(): Promise<ReaderSettings> {
    const settings = await this.db!.get('settings', 'reader');
    return settings || this.getDefaultSettings();
  }

  private getDefaultSettings(): ReaderSettings {
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
}
