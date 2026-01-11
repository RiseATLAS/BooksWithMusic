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
    this.reader.setupEventListeners();
    this.settings.initialize();
    this.musicPanel.initialize();
    this.setupEventListeners();
    this.registerServiceWorker();
  }

  setupEventListeners() {
    this.library.on('bookSelected', (bookId) => {
      this.showReader(bookId);
    });

    // Use event delegation for back button since it's created dynamically
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#back-to-library')) {
        e.preventDefault();
        this.showLibrary();
      }
    });
  }

  async showReader(bookId) {
    await this.reader.openBook(bookId);
  }

  showLibrary() {
    this.reader.destroyReaderView();
    document.getElementById('library-view')?.classList.add('active');
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
