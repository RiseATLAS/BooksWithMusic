import { BookLibrary } from './ui/library';
import { ReaderUI } from './ui/reader';
import { SettingsUI } from './ui/settings';
import { MusicPanelUI } from './ui/music-panel';
import { DatabaseManager } from './storage/indexeddb';

class BooksWithMusicApp {
  private library: BookLibrary;
  private reader: ReaderUI;
  private settings: SettingsUI;
  private musicPanel: MusicPanelUI;
  private db: DatabaseManager;

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

  private setupEventListeners() {
    // Library to Reader navigation
    this.library.on('bookSelected', (bookId: string) => {
      this.showReader(bookId);
    });

    // Reader to Library navigation
    document.getElementById('back-to-library')?.addEventListener('click', () => {
      this.showLibrary();
    });
  }

  private async showReader(bookId: string) {
    document.getElementById('library-view')?.classList.remove('active');
    document.getElementById('reader-view')?.classList.add('active');
    await this.reader.loadBook(bookId);
    await this.musicPanel.loadBookMusic(bookId);
  }

  private showLibrary() {
    document.getElementById('reader-view')?.classList.remove('active');
    document.getElementById('library-view')?.classList.add('active');
    this.reader.cleanup();
  }

  private async registerServiceWorker() {
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

// Initialize app
const app = new BooksWithMusicApp();
app.initialize().catch(console.error);
