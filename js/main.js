import { BookLibrary } from "./ui/library.js";
import { ReaderUI } from "./ui/reader.js";
import { SettingsUI } from "./ui/settings.js";
import { MusicPanelUI } from "./ui/music-panel.js";
import { DatabaseManager } from "./storage/indexeddb.js";
import {
  initAuth,
  onAuthStateChanged,
  signInWithGoogle,
  signOut,
} from "./auth/auth.js";
import {
  getUserSettings,
  saveUserSettings,
} from "./storage/firestore-storage.js";
import { auth, db, storage } from "./config/firebase-config.js";

class BooksWithMusicApp {
  constructor() {
    this.db = new DatabaseManager();
    this.library = new BookLibrary(this.db);
    this.reader = new ReaderUI(this.db);
    this.settings = new SettingsUI();
    // Expose settingsManager globally for overflow detection in reader
    window.settingsManager = this.settings;
    // Note: MusicPanelUI needs reader's musicManager, initialized after reader
    this.musicPanel = null;
    this.currentUser = null;
  }

  async initialize() {
    try {
      await this.db.initialize();

      // Initialize Firebase Authentication
      initAuth();
      this.setupAuthStateListener();

      // Check if we're on reader page
      if (window.location.pathname.includes("reader.html")) {
        document.body.classList.add("reader-page");
        
        // Load and apply settings BEFORE rendering to avoid visual shifts
        this.settings.loadSettings();
        this.settings.applySettings();
        
        // Now initialize reader with settings already applied
        await this.reader.initializeReader();

        // Complete settings initialization (UI sync, event listeners)
        this.settings.setupEventListeners();
        this.settings.syncUIWithSettings();
        this.settings.showIOSTipIfNeeded();

        // Initialize music panel with reader's music manager and reader reference
        this.musicPanel = new MusicPanelUI(this.db, this.reader.musicManager, this.reader);
        this.musicPanel.initialize();

        // Wait for music initialization to complete (already triggers onChapterChange in reader.js)
        if (this.reader._musicInitPromise) {
          await this.reader._musicInitPromise;
        }

        // NOTE: Auto-calibration disabled - layout engine handles pagination deterministically
        // No need for character-based calibration when using TextLayoutEngine
        // setTimeout(() => {
        //   if (this.settings && typeof this.settings.calibratePageDensity === 'function') {
        //     this.settings.calibratePageDensity();
        //   }
        // }, 500);

        // Setup auth UI for reader page
        this.setupAuthUI(true);
      } else {
        // Home page
        await this.library.init();

        // Setup auth UI for home page
        this.setupAuthUI(false);
      }

      this.setupEventListeners();
      await this.registerServiceWorker();
    } catch (error) {
      console.error("Init error:", error);
      alert("Failed to initialize app. Check console for details.");
    }
  }

  setupAuthStateListener() {
    onAuthStateChanged(async (user) => {
      this.currentUser = user;

      if (user) {
        // Load user settings from Firestore
        try {
          const cloudSettings = await getUserSettings(user.uid);
          if (cloudSettings) {
            // Merge cloud settings with local settings (use correct key)
            const localSettings = JSON.parse(
              localStorage.getItem("booksWithMusic-settings") || "{}",
            );
            const mergedSettings = { ...localSettings, ...cloudSettings };
            localStorage.setItem("booksWithMusic-settings", JSON.stringify(mergedSettings));

            // Apply settings if settings UI is initialized
            if (this.settings && this.settings.applySettings) {
              this.settings.loadSettings(); // Reload settings from storage
              this.settings.applySettings();
            }
          } else {
            // No cloud settings, save local settings to cloud
            const localSettings = localStorage.getItem('booksWithMusic-settings');
            if (localSettings) {
                const payload = this.buildSettingsPayload(JSON.parse(localSettings), user);
                await saveUserSettings(user.uid, payload);
            }
          }
        } catch (error) {
          console.error("Error loading user settings:", error);
        }

        // Refresh library if on home page (only sync, don't fully reinitialize)
        if (this.library && !window.location.pathname.includes("reader.html")) {
          await this.library.loadBooks();
          this.library.displayBooks();
        }
      }

      // Update UI
      this.updateAuthUI(user);
    });
  }

  buildSettingsPayload(settings, user) {
    if (!user) {
      return { ...settings };
    }

    return {
      ...settings,
      userEmail: user.email || null,
    };
  }

  setupAuthUI(isReaderPage) {
    const signInBtn = document.getElementById(
      isReaderPage ? "sign-in-btn-reader" : "sign-in-btn",
    );
    const userProfile = document.getElementById(
      isReaderPage ? "user-profile-reader" : "user-profile",
    );

    if (!signInBtn || !userProfile) return;

    // Sign in button click handler
    signInBtn.addEventListener("click", async () => {
      try {
        this.showLoading(isReaderPage);
        await signInWithGoogle();
        // Auth state listener will handle the rest
      } catch (error) {
        console.error("Sign-in error:", error);
        this.showToast("Sign-in failed: " + error.message, "error");
      } finally {
        this.hideLoading(isReaderPage);
      }
    });

    // Sign out button (only on home page)
    if (!isReaderPage) {
      const signOutBtn = document.getElementById("sign-out-btn");
      if (signOutBtn) {
        signOutBtn.addEventListener("click", async () => {
          try {
            // Save current settings to Firestore before signing out
            if (this.currentUser) {
              const settings = JSON.parse(
                localStorage.getItem("booksWithMusic-settings") || "{}",
              );
              const payload = this.buildSettingsPayload(settings, this.currentUser);
              await saveUserSettings(this.currentUser.uid, payload);
            }

            await signOut();
            this.showToast("Signed out successfully", "success");

            // Refresh library to show only local books
            if (this.library) {
              await this.library.loadBooks();
              this.library.displayBooks();
            }
          } catch (error) {
            console.error("Sign-out error:", error);
            this.showToast("Sign-out failed: " + error.message, "error");
          }
        });
      }
    }

    // Reader page - clicking user photo shows user menu
    if (isReaderPage && userProfile) {
      userProfile.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleUserMenu();
      });
      
      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        const menu = document.getElementById("user-menu");
        if (menu && !userProfile.contains(e.target) && !menu.contains(e.target)) {
          menu?.classList.remove("show");
        }
      });
    }
  }

  toggleUserMenu() {
    const menu = document.getElementById("user-menu");
    if (menu) {
      menu.classList.toggle("show");
    }
  }

  updateAuthUI(user) {
    const isReaderPage = window.location.pathname.includes("reader.html");
    const signInBtn = document.getElementById(
      isReaderPage ? "sign-in-btn-reader" : "sign-in-btn",
    );
    const userProfile = document.getElementById(
      isReaderPage ? "user-profile-reader" : "user-profile",
    );

    if (!signInBtn || !userProfile) return;

    if (user) {
      // Show user profile, hide sign in button
      signInBtn.style.display = "none";
      userProfile.style.display = isReaderPage ? "inline-flex" : "flex";

      // Update user info (for home page only - reader uses G button)
      if (!isReaderPage) {
        const userPhoto = document.getElementById("user-photo");
        const userName = document.getElementById("user-name");

        if (userPhoto) {
          userPhoto.src = user.photoURL || "https://via.placeholder.com/40";
          userPhoto.alt = user.displayName || user.email;
        }

        if (userName) {
          userName.textContent = user.displayName || user.email;
        }
      }
      
      // Update user menu (reader page only)
      if (isReaderPage) {
        const menuName = document.getElementById("user-menu-name");
        const menuEmail = document.getElementById("user-menu-email");
        
        // Set title for G button
        if (userProfile) {
          userProfile.title = user.displayName || user.email;
        }
        
        if (menuName) {
          menuName.textContent = user.displayName || "User";
        }
        if (menuEmail) {
          menuEmail.textContent = user.email;
        }

        // Setup sign out handler for reader page
        const signOutBtnReader = document.getElementById("sign-out-btn-reader");
        if (signOutBtnReader && !signOutBtnReader.dataset.handlerAdded) {
          signOutBtnReader.dataset.handlerAdded = "true";
          signOutBtnReader.addEventListener("click", async () => {
            try {
              // Save settings before signing out
              if (this.currentUser) {
                const settings = JSON.parse(
                  localStorage.getItem("booksWithMusic-settings") || "{}",
                );
                const payload = this.buildSettingsPayload(settings, this.currentUser);
                await saveUserSettings(this.currentUser.uid, payload);
              }
              
              await signOut();
              this.showToast("Signed out successfully", "success");
              
              // Close user menu
              document.getElementById("user-menu")?.classList.remove("show");
              
              // Redirect to home page after sign out from reader
              setTimeout(() => {
                window.location.href = "/BooksWithMusic/";
              }, 500);
            } catch (error) {
              console.error("Sign-out error:", error);
              this.showToast("Sign-out failed: " + error.message, "error");
            }
          });
        }
      }
    } else {
      // Show sign in button, hide user profile
      signInBtn.style.display = isReaderPage ? "inline-flex" : "inline-flex";
      userProfile.style.display = "none";
    }
  }

  showLoading(isReaderPage) {
    const signInBtn = document.getElementById(
      isReaderPage ? "sign-in-btn-reader" : "sign-in-btn",
    );
    if (signInBtn) {
      signInBtn.disabled = true;
      signInBtn.style.opacity = "0.5";
    }
  }

  hideLoading(isReaderPage) {
    const signInBtn = document.getElementById(
      isReaderPage ? "sign-in-btn-reader" : "sign-in-btn",
    );
    if (signInBtn) {
      signInBtn.disabled = false;
      signInBtn.style.opacity = "1";
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  setupEventListeners() {
    // Back to library button (on reader page)
    document.body.addEventListener("click", (e) => {
      if (e.target.closest("#back-to-library")) {
        e.preventDefault();
        this.showLibrary();
      }
    });

    // Book selection (on home page)
    if (this.library && this.library.on) {
      this.library.on("bookSelected", (bookId) => {
        this.showReader(bookId);
      });
    }
  }

  async showReader(bookId) {
    try {
      await this.reader.openBook(bookId);
    } catch (error) {
      console.error("Error opening book:", error);
      alert("Failed to open book: " + error.message);
    }
  }

  showLibrary() {
    // Use correct path for GitHub Pages
    window.location.href = "/BooksWithMusic/";
  }

  async registerServiceWorker() {
    // Register service worker for offline support
    if ("serviceWorker" in navigator) {
      try {
        // Use correct path for GitHub Pages (with repo name in URL)
        const swPath = "/BooksWithMusic/service-worker.js";
        const registration = await navigator.serviceWorker.register(swPath);
      } catch (error) {
        console.warn("Service Worker registration failed:", error);
      }
    }
  }
}

const booksWithMusicApp = new BooksWithMusicApp();
window.app = booksWithMusicApp; // Expose globally for music panel access
booksWithMusicApp.initialize().catch(console.error);
