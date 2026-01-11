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
    
    // Check if we're on reader page
    if (window.location.pathname.includes('reader.html')) {
      await this.reader.initializeReader();
      this.settings.initialize();
      this.musicPanel.initialize();
    } else {
      // We're on home page
      await this.library.initialize();
      this.settings.initialize();
      this.musicPanel.initialize();
    }
    
    this.setupEventListeners();
    this.registerServiceWorker();
  }

  setupEventListeners() {
    // Back to library button (on reader page)
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#back-to-library')) {
        e.preventDefault();
        this.showLibrary();
      }
    });
    
    // Book selection (on home page)
    if (this.library && this.library.on) {
      this.library.on('bookSelected', (bookId) => {
        this.showReader(bookId);
      });
    }
  }

  async showReader(bookId) {
    await this.reader.openBook(bookId);
  }

  showLibrary() {
    window.location.href = '/';
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
