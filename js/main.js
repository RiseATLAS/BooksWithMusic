import { BookLibrary } from './ui/library.js';
import { ReaderUI } from './ui/reader.js';
import { SettingsUI } from './ui/settings.js';
import { MusicPanelUI } from './ui/music-panel.js';
import { DatabaseManager } from './storage/indexeddb.js';
import { initAuth, onAuthStateChanged, signInWithGoogle, signOut } from './auth/auth.js';
import { getUserSettings, saveUserSettings } from './storage/firestore-storage.js';
import { isFirebaseConfigured } from './config/firebase-config.js';

class BooksWithMusicApp {
  constructor() {
    this.db = new DatabaseManager();
    this.library = new BookLibrary(this.db);
    this.reader = new ReaderUI(this.db);
    this.settings = new SettingsUI();
    // Note: MusicPanelUI needs reader's musicManager, initialized after reader
    this.musicPanel = null;
    this.currentUser = null;
  }

  async initialize() {
    try {
      console.log('📚 BooksWithMusic initializing...');
      await this.db.initialize();
      console.log('✓ Database initialized');
      
      // Initialize Firebase Authentication
      if (isFirebaseConfigured()) {
        initAuth();
        this.setupAuthStateListener();
        console.log('✓ Firebase Auth initialized');
      }
      
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
        
        // Setup auth UI for reader page
        this.setupAuthUI(true);
      } else {
        // Home page - no music panel needed
        console.log('🏠 Loading home page...');
        await this.library.initialize();
        console.log('✓ Library initialized');
        
        // Setup auth UI for home page
        this.setupAuthUI(false);
      }
      
      this.setupEventListeners();
      await this.registerServiceWorker();
      console.log('✓ App ready!');
    } catch (error) {
      console.error('❌ Initialization error:', error);
      alert('Failed to initialize app. Check console for details.');
    }
  }

  setupAuthStateListener() {
    onAuthStateChanged(async (user) => {
      this.currentUser = user;
      
      if (user) {
        console.log('✓ User signed in:', user.email);
        
        // Load user settings from Firestore
        try {
          const cloudSettings = await getUserSettings(user.uid);
          if (cloudSettings) {
            // Merge cloud settings with local settings
            const localSettings = JSON.parse(localStorage.getItem('settings') || '{}');
            const mergedSettings = { ...localSettings, ...cloudSettings };
            localStorage.setItem('settings', JSON.stringify(mergedSettings));
            
            // Apply settings if settings UI is initialized
            if (this.settings && this.settings.applySettings) {
              this.settings.applySettings(mergedSettings);
            }
            
            console.log('✓ User settings loaded from Firestore');
          }
        } catch (error) {
          console.error('Error loading user settings:', error);
        }
        
        // Refresh library if on home page
        if (this.library && !window.location.pathname.includes('reader.html')) {
          await this.library.initialize();
        }
      } else {
        console.log('User signed out');
      }
      
      // Update UI
      this.updateAuthUI(user);
    });
  }

  setupAuthUI(isReaderPage) {
    const signInBtn = document.getElementById(isReaderPage ? 'sign-in-btn-reader' : 'sign-in-btn');
    const userProfile = document.getElementById(isReaderPage ? 'user-profile-reader' : 'user-profile');
    
    if (!signInBtn || !userProfile) return;
    
    // Sign in button click handler
    signInBtn.addEventListener('click', async () => {
      try {
        this.showLoading(isReaderPage);
        await signInWithGoogle();
        // Auth state listener will handle the rest
      } catch (error) {
        console.error('Sign-in error:', error);
        this.showToast('Sign-in failed: ' + error.message, 'error');
      } finally {
        this.hideLoading(isReaderPage);
      }
    });
    
    // Sign out button (only on home page)
    if (!isReaderPage) {
      const signOutBtn = document.getElementById('sign-out-btn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
          try {
            // Save current settings to Firestore before signing out
            if (this.currentUser) {
              const settings = JSON.parse(localStorage.getItem('settings') || '{}');
              await saveUserSettings(this.currentUser.uid, settings);
            }
            
            await signOut();
            this.showToast('Signed out successfully', 'success');
            
            // Refresh library to show only local books
            if (this.library) {
              await this.library.initialize();
            }
          } catch (error) {
            console.error('Sign-out error:', error);
            this.showToast('Sign-out failed: ' + error.message, 'error');
          }
        });
      }
    }
    
    // Reader page - clicking user photo shows a tooltip or opens settings
    if (isReaderPage && userProfile) {
      userProfile.addEventListener('click', () => {
        // Show user info or open settings panel
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
          settingsBtn.click();
        }
      });
    }
  }

  updateAuthUI(user) {
    const isReaderPage = window.location.pathname.includes('reader.html');
    const signInBtn = document.getElementById(isReaderPage ? 'sign-in-btn-reader' : 'sign-in-btn');
    const userProfile = document.getElementById(isReaderPage ? 'user-profile-reader' : 'user-profile');
    
    if (!signInBtn || !userProfile) return;
    
    if (user) {
      // Show user profile, hide sign in button
      signInBtn.style.display = 'none';
      userProfile.style.display = isReaderPage ? 'inline-flex' : 'flex';
      
      // Update user info
      const userPhoto = document.getElementById(isReaderPage ? 'user-photo-reader' : 'user-photo');
      const userName = document.getElementById('user-name');
      
      if (userPhoto) {
        userPhoto.src = user.photoURL || 'https://via.placeholder.com/40';
        userPhoto.alt = user.displayName || user.email;
        if (isReaderPage) {
          userPhoto.title = user.displayName || user.email;
        }
      }
      
      if (userName && !isReaderPage) {
        userName.textContent = user.displayName || user.email;
      }
    } else {
      // Show sign in button, hide user profile
      signInBtn.style.display = isReaderPage ? 'inline-flex' : 'inline-flex';
      userProfile.style.display = 'none';
    }
  }

  showLoading(isReaderPage) {
    const signInBtn = document.getElementById(isReaderPage ? 'sign-in-btn-reader' : 'sign-in-btn');
    if (signInBtn) {
      signInBtn.disabled = true;
      signInBtn.style.opacity = '0.5';
    }
  }

  hideLoading(isReaderPage) {
    const signInBtn = document.getElementById(isReaderPage ? 'sign-in-btn-reader' : 'sign-in-btn');
    if (signInBtn) {
      signInBtn.disabled = false;
      signInBtn.style.opacity = '1';
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
