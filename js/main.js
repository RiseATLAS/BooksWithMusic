import { BookLibrary } from './ui/library.js';
import { ReaderUI } from './ui/reader.js';
import { SettingsUI } from './ui/settings.js';
import { MusicPanelUI } from './ui/music-panel.js';
import { DatabaseManager } from './storage/indexeddb.js';

class BooksWithMusicApp {
  constructor() {
    this.db = new DatabaseManager();
    this.library = new BookLibrary(this.db);
    this.reader = new ReaderUI(this.db);
    this.settings = new SettingsUI();
    this.musicPanel = new MusicPanelUI(this.db);
  }

  async initialize() {
    await this.db.initialize();
    await this.library.initialize();
    this.settings.initialize();
    this.setupEventListeners();
    this.registerServiceWorker();
  }

  setupEventListeners() {
    this.library.on('bookSelected', (bookId) => {
      this.showReader(bookId);
    });

    document.getElementById('back-to-library')?.addEventListener('click', () => {
      this.showLibrary();
    });
  }

  async showReader(bookId) {
    document.getElementById('library-view')?.classList.remove('active');
    document.getElementById('reader-view')?.classList.add('active');
    await this.reader.loadBook(bookId);
    await this.musicPanel.loadBookMusic(bookId);
  }

  showLibrary() {
    document.getElementById('reader-view')?.classList.remove('active');
    document.getElementById('library-view')?.classList.add('active');
    this.reader.cleanup();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered');
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
  }
}

const app = new BooksWithMusicApp();
app.initialize().catch(console.error);
