import { BookLibrary } from './ui/library.js';
import { ReaderUI } from './ui/reader.js';
import { SettingsUI } from './ui/settings.js';
import { MusicPanelUI } from './ui/music-panel.js';
import { FirebaseManager } from './storage/firebase-manager.js';

class BooksWithMusicApp {
  constructor() {
    this.db = new FirebaseManager();
    this.library = new BookLibrary(this.db);
    this.reader = new ReaderUI(this.db);
    this.settings = new SettingsUI(this.db);
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

        // Apply settings ASAP (music init happens in the background now)
        this.settings.initialize();
        
        // Initialize music panel with reader's music manager
        this.musicPanel = new MusicPanelUI(this.db, this.reader.musicManager);
        this.musicPanel.initialize();
        console.log('✓ Music panel ready');
        
        // NOW trigger initial chapter music (after listener is registered)
        console.log('🎵 Triggering initial chapter music...');
        // Ensure async music init has finished before starting playback.
        if (this.reader._musicInitPromise) {
          await this.reader._musicInitPromise;
        }
        this.reader.musicManager.onChapterChange(this.reader.currentChapterIndex);
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
        console.log('📚 Book selected event received:', bookId);
        this.showReader(bookId);
      });
    }
  }

  async showReader(bookId) {
    console.log('📖 Opening book with ID:', bookId);
    try {
      await this.reader.openBook(bookId);
    } catch (error) {
      console.error('Error opening book:', error);
      alert('Failed to open book: ' + error.message);
    }
  }

  showLibrary() {
    window.location.href = '/';
  }

  async registerServiceWorker() {
    // Service workers frequently cause "crash on load" during development by
    // serving stale cached assets (especially styles/scripts) after code changes.
    // Vite already provides its own dev caching/reload pipeline.
    if (import.meta?.env?.DEV) {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches?.keys) {
          const keys = await window.caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith('booksWithMusic-'))
              .map((k) => window.caches.delete(k))
          );
        }
        console.log('Dev mode: service worker disabled and caches cleared');
      } catch (error) {
        console.warn('Dev mode: failed to clear service worker/caches:', error);
      }
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const swPath = import.meta.env.BASE_URL + 'service-worker.js';
        await navigator.serviceWorker.register(swPath);
        console.log('Service Worker registered');
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
  }
}

const app = new BooksWithMusicApp();
app.initialize().catch(console.error);
