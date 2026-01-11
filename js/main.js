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
    // Note: MusicPanelUI needs reader's musicManager, initialized after reader
    this.musicPanel = null;
  }

  async initialize() {
    try {
      console.log('📚 BooksWithMusic initializing...');
      await this.db.initialize();
      console.log('✓ Database initialized');
      
      // Check if we're on reader page
      if (window.location.pathname.includes('reader.html')) {
        console.log('📖 Loading reader page...');
        await this.reader.initializeReader();
        
        // Initialize music panel with reader's music manager
        this.musicPanel = new MusicPanelUI(this.db, this.reader.musicManager);
        this.musicPanel.initialize();
        console.log('✓ Music panel ready');
        
        // NOW trigger initial chapter music (after listener is registered)
        console.log('🎵 Triggering initial chapter music...');
        this.reader.musicManager.onChapterChange(this.reader.currentChapterIndex);
        
        this.settings.initialize();
        console.log('✓ Reader initialized');
      } else {
        // Home page - no music panel needed
        console.log('🏠 Loading home page...');
        await this.library.initialize();
        console.log('✓ Library initialized');
      }
      
      this.setupEventListeners();
      await this.registerServiceWorker();
      console.log('✓ App ready!');
    } catch (error) {
      console.error('❌ Initialization error:', error);
      alert('Failed to initialize app. Check console for details.');
    }
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
