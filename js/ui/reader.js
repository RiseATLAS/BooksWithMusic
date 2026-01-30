import { EPUBParser } from '../core/epub-parser.js';
import { MusicManager } from '../core/music-manager.js';
import { MoodProcessor } from '../core/mood-processor.js';
import { saveBookProgress } from '../storage/firestore-storage.js';
import { auth } from '../config/firebase-config.js';

/**
 * ReaderUI - EPUB Reader with Layout Engine-Based Pagination
 * 
 * Uses TextLayoutEngine for deterministic, overflow-proof pagination with
 * block/line-based position tracking for robust restoration across settings changes.
 */
export class ReaderUI {
  constructor(db) {
    this.db = db;
    this.parser = new EPUBParser();
    this.moodProcessor = new MoodProcessor();
    this.musicManager = new MusicManager(db);
    this.currentBook = null;
    this.currentChapterIndex = 0;
    this.chapters = [];
    this.currentPage = 1;
    this.currentPageInChapter = 1;
    this.totalPages = 0;
    this.pagesPerChapter = {}; // Object, not array
    
    // New page-based system
    this.chapterPages = {}; // { chapterIndex: [page1HTML, page2HTML, ...] }
    this.chapterPageData = {}; // { chapterIndex: [pageData objects for position tracking] }
    this.layoutEngine = null; // Will be initialized when needed
    this.charsPerPage = this.getPageDensityFromSettings(); // Get from settings or default
    this._isFlipping = false; // Prevent multiple simultaneous flips
    this._isInitializing = false; // Flag to prevent re-pagination during initialization
    
    this._isTurningPage = false;
    this._pageGapPx = 48;
    this._musicInitPromise = null;
    this._layoutChangedHandler = null;
    this._chapterLayoutToken = 0;

    this._scrollUpdateTimer = null;
    this._progressSaveTimer = null;

    this._viewportEl = null;
    this._boundViewportScrollHandler = null;
  }

  /**
   * Get page density (chars per page) from settings
   */
  getPageDensityFromSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      if (settings && settings.pageDensity) {
        // pageDensity is now stored directly as characters per page
        return settings.pageDensity;
      }
      // Default: 5000 chars per page
      return 5000;
    } catch {
      return 1500;
    }
  }

  /**
   * Get current block position (for position restoration after re-pagination)
   */
  getBlockPosition() {
    if (!this.layoutEngine || !this.chapterPageData) {
      return { blockIndex: 0, lineInBlock: 0 };
    }
    
    const pageData = this.chapterPageData[this.currentChapterIndex];
    if (!pageData || pageData.length === 0) {
      return { blockIndex: 0, lineInBlock: 0 };
    }
    
    const pageIndex = this.currentPageInChapter - 1;
    return this.layoutEngine.getBlockPositionForPage(pageData, pageIndex);
  }

  /**
   * Find page that contains the given block position after re-pagination
   */
  findPageByBlockPosition(chapterIndex, blockPosition) {
    if (!this.layoutEngine || !this.chapterPageData) {
      return 1;
    }
    
    const pageData = this.chapterPageData[chapterIndex];
    if (!pageData || pageData.length === 0) {
      return 1;
    }
    
    const pageIndex = this.layoutEngine.findPageForBlockPosition(
      pageData,
      blockPosition.blockIndex || 0,
      blockPosition.lineInBlock || 0
    );
    
    return pageIndex + 1; // Convert to 1-indexed
  }

  async openBook(bookId) {
    try {
      this.showLoading('Loading book...');
      
      const book = await this.db.getBook(bookId);
      if (!book) {
        throw new Error('Book not found in database');
      }

      // Parse EPUB
      const parsed = await this.parser.parse(book.data);
      
      // Check if book has been analyzed
      let analysis = await this.db.getAnalysis(bookId);
      if (!analysis) {
        const bookForAnalysis = { id: bookId, title: book.title, chapters: parsed.chapters };
        analysis = await this.aiProcessor.analyzeBook(bookForAnalysis);
        await this.db.saveAnalysis(bookId, analysis);
      }
      
      // Store book data in sessionStorage for reader page
      const bookDataForSession = {
        id: book.id,
        title: book.title,
        author: book.author,
        currentChapter: book.currentChapter || 0,
        currentPageInChapter: book.currentPageInChapter || 1,
        chapters: parsed.chapters,
        images: book.images // Store images for reader
      };
      
      sessionStorage.setItem('currentBook', JSON.stringify(bookDataForSession));

      this.hideLoading();
      
      // Navigate to reader page
      window.location.href = '/reader.html';
      
    } catch (error) {
      console.error(' Error opening book:', error);
      this.hideLoading();
      this.showToast('Error opening book: ' + error.message, 'error');
      throw error; // Re-throw so main.js can handle it
    }
  }

  async initializeReader() {
    const bookId = sessionStorage.getItem('currentBookId');
    
    if (!bookId) {
      alert('No book selected. Redirecting to library...');
      window.location.href = './index.html';
      return;
    }

    try {
      // Set initialization flag
      this._isInitializing = true;
      
      // Load book data from IndexedDB
      const book = await this.db.getBook(bookId);
      
      if (!book) {
        throw new Error('Book not found in database');
      }
      
      // Validate book data
      if (!book.chapters || book.chapters.length === 0) {
        throw new Error('No chapters found in book data');
      }
      
      this.currentBook = { id: book.id, title: book.title, author: book.author };
      this.chapters = book.chapters;

      // Prefer the most recently saved progress from IndexedDB or Firestore
      let persistedProgress = null;
      try {
        persistedProgress = await this.db.getBook(book.id);
      } catch {
        // ignore
      }

      this.currentChapterIndex =
        persistedProgress?.currentChapter ?? book.currentChapter ?? 0;
      
      // Use saved page number (will be corrected after pagination if block position exists)
      this.currentPageInChapter =
        persistedProgress?.currentPageInChapter ?? book.currentPageInChapter ?? 1;

      this.pagesPerChapter = {};
      this.currentPage = 1;
      this.totalPages = 0;
      
      // Clear any cached pages to force re-split with current settings
      this.chapterPages = {};

      // Update document title with book name
      document.title = `${book.title} - BooksWithMusic`;
      
      this.renderChapterList();
      
      // Setup event listeners BEFORE loading chapter to catch settings events
      this.setupEventListeners();
      
      // Load the chapter (this will paginate it and restore position)
      await this.loadChapter(this.currentChapterIndex, { pageInChapter: this.currentPageInChapter, preservePage: true });

      // Clear initialization flag - now settings changes will trigger re-pagination
      this._isInitializing = false;

      // Initialize music in the background
      this._musicInitPromise = this.musicManager
        .initialize(book.id, this.chapters)
        .then(() => {
          // After music is initialized, trigger music for the current chapter
          if (this.musicManager && this.currentChapterIndex >= 0) {
            this.musicManager.onChapterChange(this.currentChapterIndex);
          }
        })
        .catch((e) => console.warn('Music init failed:', e));
      
    } catch (error) {
      console.error(' Reader init failed:', error);
      alert('Failed to load book: ' + error.message);
      window.location.href = '/';
    }
  }

  renderChapterList() {
    const chapterList = document.getElementById('chapter-list');
    if (!chapterList || !this.chapters) return;

    chapterList.innerHTML = this.chapters.map((chapter, index) => {
      const analysis = this.musicManager?.getChapterAnalysis(index);
      const moodEmoji = this.getMoodEmoji(analysis?.primaryMood);
      const moodLabel = analysis?.primaryMood ? `${moodEmoji} ${analysis.primaryMood}` : '';
      
      return `
        <div class="chapter-item ${index === this.currentChapterIndex ? 'active' : ''}" 
             data-chapter="${index}">
          <span class="chapter-number">${index + 1}</span>
          <div class="chapter-info">
            <span class="chapter-title">${this.escapeHtml(chapter.title || `Chapter ${index + 1}`)}</span>
            ${moodLabel ? `<span class="chapter-mood">${moodLabel}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add click listeners
    chapterList.querySelectorAll('.chapter-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chapterIndex = parseInt(e.currentTarget.dataset.chapter);
        if (!isNaN(chapterIndex)) {
          await this.loadChapter(chapterIndex);
          
          // Update music for new chapter (only if music manager is ready)
          if (this.musicManager && this._musicInitPromise) {
            await this._musicInitPromise;
            this.musicManager.onChapterChange(this.currentChapterIndex);
          }
        }
      });
    });
  }

  getMoodEmoji(mood) {
    const emojiMap = {
      dark: '🌑',
      mysterious: '🔍',
      romantic: '❤️',
      sad: '😢',
      epic: '⚔️',
      peaceful: '☮️',
      tense: '⚡',
      joyful: '😊',
      adventure: '🏝️',
      magical: '✨'
    };
    return emojiMap[mood] || '🎵';
  }

  setupEventListeners() {
    // Navigation buttons
    const prevBtn = document.getElementById('prev-chapter');
    const nextBtn = document.getElementById('next-chapter');

    prevBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.goToPreviousPage();
    });

    nextBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.goToNextPage();
    });

    // Toggle chapters sidebar
    const toggleChaptersBtn = document.getElementById('toggle-chapters');
    toggleChaptersBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sidebar = document.getElementById('chapter-nav');
      if (sidebar) {
        // Toggle hidden class for desktop, show class for mobile
        sidebar.classList.toggle('hidden');
        sidebar.classList.toggle('show');
      }
    });

    // Close chapters sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('chapter-nav');
      const toggleBtn = document.getElementById('toggle-chapters');
      
      if (sidebar && sidebar.classList.contains('show')) {
        // Check if click is outside sidebar and not on the toggle button
        if (!sidebar.contains(e.target) && !toggleBtn?.contains(e.target)) {
          sidebar.classList.remove('show');
          sidebar.classList.add('hidden');
        }
      }
    });

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    // Hide fullscreen button on iOS (not supported)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && fullscreenBtn) {
      fullscreenBtn.style.display = 'none';
    }
    
    fullscreenBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleFullscreen();
    });

    // Listen for fullscreen changes
    const handleFullscreenChange = async () => {
      const controls = document.querySelector('.reader-controls');
      const pageIndicator = document.querySelector('.page-indicator');
      
      const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement || 
                          document.msFullscreenElement;
      
      const isMobile = window.innerWidth <= 768;
      
      if (isFullscreen) {
        // Hide page indicator in fullscreen on all devices
        if (pageIndicator) {
          pageIndicator.style.display = 'none';
        }
        
        if (isMobile) {
          // On mobile, leave the toggle class alone
        } else {
          // On desktop fullscreen - add hover listeners to show/hide controls
          if (controls) {
            controls.classList.remove('mobile-controls-hidden');
            controls.classList.add('desktop-fullscreen-mode');
          }
        }
      } else {
        // Exited fullscreen - restore page indicator ONLY if we're actually out of fullscreen
        if (pageIndicator) {
          pageIndicator.style.display = '';
        }
        
        // Exited fullscreen - remove desktop fullscreen class
        if (controls) {
          controls.classList.remove('desktop-fullscreen-mode');
        }
      }
      
      // Re-paginate when fullscreen changes (available height changes)
      // Use a longer delay to ensure fullscreen transition completes
      setTimeout(async () => {
        if (this.currentChapterIndex >= 0 && this.chapters.length > 0 && !this._isInitializing) {
          // Get current position before re-pagination
          const currentPosition = this.getBlockPosition();
          
          // Clear layout engine cache for fresh measurements
          if (this.layoutEngine) {
            this.layoutEngine.clearCache();
          }
          
          // Force re-pagination by removing cached pages for this chapter
          delete this.chapterPages[this.currentChapterIndex];
          delete this.chapterPageData[this.currentChapterIndex];
          
          // Re-render empty structure to update DOM dimensions
          this._renderEmptyPageStructure();
          
          // Re-paginate the chapter
          this.chapterPages[this.currentChapterIndex] = this.splitChapterIntoPages(
            this.chapters[this.currentChapterIndex].content,
            this.chapters[this.currentChapterIndex].title
          );
          
          // Update pages count
          const totalPagesInChapter = this.chapterPages[this.currentChapterIndex].length;
          this.pagesPerChapter[this.currentChapterIndex] = totalPagesInChapter;
          
          // Restore position to the block we were reading
          const newPage = this.findPageByBlockPosition(this.currentChapterIndex, currentPosition);
          
          this.currentPageInChapter = Math.max(1, Math.min(newPage, totalPagesInChapter));
          this.renderCurrentPage();
          this.currentPage = this.calculateCurrentPageNumber();
          this.totalPages = this.calculateTotalPages();
          this.updatePageIndicator();
        }
      }, 200); // Longer delay for fullscreen transition to complete
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Keyboard navigation (combined handler)
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Fullscreen shortcuts
      if (e.key === 'F11' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      }

      // Music play/pause shortcut
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const playPauseBtn = document.getElementById('play-pause');
        if (playPauseBtn) {
          playPauseBtn.click();
        }
        return;
      }

      // Navigation shortcuts
      switch(e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          this.goToPreviousPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Spacebar
          e.preventDefault();
          this.goToNextPage();
          break;
        case 'Home':
          e.preventDefault();
          this.loadChapter(0, { pageInChapter: 1 });
          break;
        case 'End':
          e.preventDefault();
          this.loadChapter(this.chapters.length - 1, { pageInChapter: 1 });
          break;
      }
    });

    // Touch/swipe navigation for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    let ignoreTapFullscreen = false;
    let allowSwipeNavigation = false;
    let tapStartedInText = false;

    document.addEventListener('touchstart', (e) => {
      const touchTarget = e.target;
      ignoreTapFullscreen = Boolean(touchTarget?.closest('input[type="range"]'));
      allowSwipeNavigation = Boolean(touchTarget?.closest('.chapter-text'));
      tapStartedInText = Boolean(touchTarget?.closest('.chapter-text'));
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime;
      this.handleTouch(touchDuration, ignoreTapFullscreen, allowSwipeNavigation, tapStartedInText);
      ignoreTapFullscreen = false;
      allowSwipeNavigation = false;
      tapStartedInText = false;
    }, { passive: true });

    this.handleTouch = (duration, ignoreFullscreenTap = false, allowSwipe = true, startedInText = false) => {
      const swipeThreshold = 50; // minimum distance for swipe
      const tapThreshold = 10; // maximum movement for tap
      const tapTimeThreshold = 300; // maximum time for tap (ms)
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      const totalMovement = Math.sqrt(diffX * diffX + diffY * diffY);

      // Check if it's a tap (minimal movement, quick duration)
      if (totalMovement < tapThreshold && duration < tapTimeThreshold) {
        // On mobile, tap in text area toggles fullscreen or hides controls
        if (window.innerWidth <= 768) {
          if (ignoreFullscreenTap) {
            return;
          }
          // Check if tap target is the text area specifically
          const isTextArea = startedInText || this.isTapInChapterText(touchEndX, touchEndY);

          // Only act if tapping on the text area
          if (isTextArea) {
            // Check if iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            
            if (isIOS) {
              // iOS: Only toggle controls visibility (no fullscreen support)
              this.toggleControlsVisibility();
            } else {
              // Android: Toggle fullscreen AND controls visibility
              if (!document.fullscreenElement) {
                // Enter fullscreen
                document.documentElement.requestFullscreen().catch(err => {
                  console.warn('Could not enter fullscreen:', err);
                });
              } else {
                // Exit fullscreen
                document.exitFullscreen().catch(err => {
                  console.warn('Could not exit fullscreen:', err);
                });
              }
              // Also toggle controls visibility
              this.toggleControlsVisibility();
            }
            return;
          }
        }
      }

      if (!allowSwipe) {
        return;
      }

      // Check for swipe (horizontal movement dominant)
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0) {
          // Swiped left - go to next page
          this.goToNextPage();
        } else {
          // Swiped right - go to previous page
          this.goToPreviousPage();
        }
      }
    };

    // Listen for page density changes from settings
    window.addEventListener('pageDensityChanged', async (e) => {
      // Page density is now stored directly as chars per page
      const newDensity = e.detail.charsPerPage || e.detail.linesPerPage; // Support both for backward compatibility
      
      // Skip if density hasn't actually changed (e.g., during initial settings load)
      if (newDensity === this.charsPerPage) {
        return;
      }
      
      // Get current block position BEFORE re-pagination
      const blockPosition = this.getBlockPosition();
      
      // Update internal setting
      this.charsPerPage = newDensity;
      
      // Clear cached pages for all chapters (force re-split)
      this.chapterPages = {};
      this.chapterPageData = {};
      
      // Re-split and reload current chapter
      if (this.currentChapterIndex >= 0 && this.chapters.length > 0) {
        await this.loadChapter(this.currentChapterIndex, { 
          pageInChapter: this.currentPageInChapter, 
          preservePage: true 
        });
        
        // Restore position using block position
        const newPage = this.findPageByBlockPosition(this.currentChapterIndex, blockPosition);
        if (newPage !== this.currentPageInChapter) {
          this.currentPageInChapter = newPage;
          this.renderCurrentPage();
          this.currentPage = this.calculateCurrentPageNumber();
          this.totalPages = this.calculateTotalPages();
          this.updatePageIndicator();
        }
      }
    });

    // Event delegation for clickable page indicators (book page and progress)
    document.addEventListener('click', (e) => {
      // Handle book page count click
      const bookPageDisplay = e.target.closest('.book-page-display');
      if (bookPageDisplay) {
        e.preventDefault();
        e.stopPropagation();
        const currentPage = bookPageDisplay.dataset.current;
        const totalPages = bookPageDisplay.dataset.total;
        const newPage = prompt(`Jump to page (1-${totalPages}):`, currentPage);
        if (newPage !== null && newPage !== '') {
          const pageNum = parseInt(newPage, 10);
          if (pageNum >= 1 && pageNum <= totalPages) {
            const targetProgress = (pageNum / totalPages) * 100;
            this.jumpToBookProgress(targetProgress.toFixed(1));
          } else {
            this.showToast(`Please enter a page number between 1 and ${totalPages}`);
          }
        }
        return;
      }
      
      // Handle progress percentage click
      const progressDisplay = e.target.closest('.progress-display');
      if (progressDisplay) {
        e.preventDefault();
        e.stopPropagation();
        const currentProgress = progressDisplay.dataset.progress;
        const newProgress = prompt('Jump to progress % (0-100):', currentProgress);
        if (newProgress !== null && newProgress !== '') {
          this.jumpToBookProgress(newProgress);
        }
        return;
      }
    });

    // Listen for page indicator display preference changes from settings
    window.addEventListener('settings:pageNumbersChanged', () => {
      this.updatePageIndicator();
    });

    window.addEventListener('settings:pageIndicatorChanged', () => {
      this.updatePageIndicator();
    });

    // Listen for layout changes (font size, line height, etc.) that affect pagination
    window.addEventListener('reader:layoutChanged', async (e) => {
      const { reason, settings } = e.detail;
      
      // Skip during initial reader setup to avoid double pagination
      if (this._isInitializing) {
        return;
      }
      
      // Settings that affect pagination and require shift point recalculation
      const paginationAffectingChanges = ['fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'pageWidth', 'textWidth', 'pageDensity', 'calibration'];
      
      if (paginationAffectingChanges.includes(reason)) {
        // Clear layout engine cache when font settings change
        if (this.layoutEngine && ['fontSize', 'fontFamily'].includes(reason)) {
          this.layoutEngine.clearCache();
        }
        
        // Get current position using block-based tracking
        const currentPosition = this.getBlockPosition();
        
        // Now clear cached pages to force re-pagination
        this.chapterPages = {};
        this.chapterPageData = {}; // Also clear page data
        
        // Re-load current chapter with new pagination
        if (this.currentChapterIndex >= 0 && this.chapters.length > 0) {
          await this.loadChapter(this.currentChapterIndex, { 
            pageInChapter: this.currentPageInChapter, 
            preservePage: true 
          });
          
          // Restore position using block position
          const newPage = this.findPageByBlockPosition(this.currentChapterIndex, currentPosition);
          
          if (newPage !== this.currentPageInChapter) {
            this.currentPageInChapter = newPage;
            this.renderCurrentPage();
            this.currentPage = this.calculateCurrentPageNumber();
            this.totalPages = this.calculateTotalPages();
            this.updatePageIndicator();
          }
          
          // Shift points are automatically recalculated in loadChapter via _analyzeChapterSections
        }
      }
    });
  }

  /**
   * Split chapter content into pages using deterministic line-based layout
   * GUARANTEED NO OVERFLOW - lines are pre-measured to fit exactly
   */
  splitChapterIntoPages(chapterContent, chapterTitle) {
    try {
      // Initialize layout engine if not already done
      if (!this.layoutEngine) {
        if (typeof TextLayoutEngine === 'undefined') {
          console.error('TextLayoutEngine not loaded!');
          return ['<div class="page-lines"><p>Error: Text layout engine not available</p></div>'];
        }
        this.layoutEngine = new TextLayoutEngine();
      }
      
      // Get layout dimensions from DOM (page structure must exist)
      const dimensions = this._getLayoutDimensions();
      const { textWidth, maxLinesPerPage, fontSize, lineHeight } = dimensions;
      
      // Get font family from settings
      const settings = window.settingsManager?.settings || {};
      const fontFamily = settings.fontFamily || 'Georgia, "Times New Roman", serif';
      
      // Validate
      if (maxLinesPerPage < 5) {
        console.error('❌ Not enough space for content');
        return ['<div class="page-lines"><p>Error: Screen too small for proper text layout</p></div>'];
      }
      
      // Parse HTML content into structured blocks
      const contentBlocks = this._parseContentToBlocks(chapterContent, chapterTitle);
      
      // Layout blocks into pages using the engine
      const pageData = this.layoutEngine.layoutIntoPages(
        contentBlocks,
        textWidth,
        maxLinesPerPage,
        fontSize,
        fontFamily,
        lineHeight
      );
      
      // Convert page data to HTML
      const pages = pageData.map((page, index) => {
        const html = this.layoutEngine.pageToHTML(page);
        return html;
      });
      
      // Store page data for position tracking
      this.chapterPageData = this.chapterPageData || {};
      this.chapterPageData[this.currentChapterIndex] = pageData;
      
      return pages.length > 0 ? pages : ['<div class="page-lines"><p>Empty chapter</p></div>'];
      
    } catch (error) {
      console.error('❌ Error in splitChapterIntoPages:', error);
      console.error('Stack:', error.stack);
      return ['<div class="page-lines"><p>Error loading chapter. Please try again.</p></div>'];
    }
  }

  /**
   * Parse HTML content into structured content blocks
   */
  _parseContentToBlocks(chapterContent, chapterTitle) {
    const blocks = [];
    
    // Add chapter title as first block
    if (chapterTitle && chapterTitle.trim()) {
      blocks.push({
        type: 'h2',
        text: chapterTitle,
        htmlTag: 'h2'
      });
    }
    
    // Parse HTML to extract elements
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterContent;
    
    // Count all element types in the EPUB
    const elementTypeCounts = {};
    tempDiv.querySelectorAll('*').forEach(el => {
      const tag = el.tagName.toLowerCase();
      elementTypeCounts[tag] = (elementTypeCounts[tag] || 0) + 1;
    });
    
    // Get all potential text containers
    const allElements = Array.from(tempDiv.querySelectorAll('*'));
    const textElements = allElements.filter(el => {
      const text = el.textContent?.trim();
      return text && text.length > 0;
    });
    
    // Log unique element types that contain text
    const textElementTypes = new Set();
    textElements.forEach(el => textElementTypes.add(el.tagName.toLowerCase()));
    
    // Debug: Check if there are <br> tags in the content
    const brCount = (chapterContent.match(/<br\s*\/?>/gi) || []).length;
    
    // Get all content elements (extend selector based on what we find)
    const elements = Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, section, article, blockquote, pre'));
    
    for (const element of elements) {
      // Determine block type
      const tagName = element.tagName.toLowerCase();
      const type = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ? tagName : 'p';
      
      // Skip container elements that have nested paragraphs or other block elements
      const hasNestedBlocks = element.querySelector('p, h1, h2, h3, h4, h5, h6, div, section, article');
      if (hasNestedBlocks) {
        continue; // This is a container, not actual content
      }
      
      // Skip elements that don't have direct text content
      const hasDirectText = element.textContent && element.textContent.trim().length > 0;
      if (!hasDirectText) {
        continue;
      }
      
      // Handle <br> tags by splitting into multiple blocks
      // First, replace <br> tags with a unique separator
      const BREAK_MARKER = '<<<BR_BREAK>>>';
      const htmlWithMarkers = element.innerHTML
        .replace(/<br\s*\/?>/gi, BREAK_MARKER);
      
      // Create temporary element to extract text with markers
      const temp = document.createElement('div');
      temp.innerHTML = htmlWithMarkers;
      
      // Get text and split on break markers
      const textWithMarkers = temp.textContent || '';
      const segments = textWithMarkers.split(BREAK_MARKER);
      
      // Add each segment as a separate block
      for (const segment of segments) {
        // Normalize whitespace but preserve line breaks
        let text = segment
          .replace(/\s+/g, ' ')  // Collapse multiple spaces
          .trim();
        
        // Skip empty segments
        if (!text) continue;
        
        // Skip if this is a duplicate of the chapter title (case insensitive)
        if (chapterTitle && text.toLowerCase() === chapterTitle.toLowerCase()) {
          continue; // Skip duplicate chapter title
        }
        
        // Remove chapter title prefix from first paragraph if it matches
        if (type === 'p' && chapterTitle && text.toLowerCase().startsWith(chapterTitle.toLowerCase())) {
          text = text.substring(chapterTitle.length).trim();
          // Skip if paragraph becomes empty after removing title
          if (!text) continue;
        }
        
        blocks.push({
          type: type,
          text: text,
          htmlTag: tagName === 'div' ? 'p' : tagName
        });
      }
    }
    
    // Count block types
    const blockTypeCounts = {};
    blocks.forEach(block => {
      blockTypeCounts[block.htmlTag] = (blockTypeCounts[block.htmlTag] || 0) + 1;
    });
    
    // Show length distribution of blocks
    const blockLengths = blocks.map(b => b.text.length);
    const avgLength = blockLengths.reduce((a, b) => a + b, 0) / blockLengths.length;
    const maxLength = Math.max(...blockLengths);
    const minLength = Math.min(...blockLengths);
    
    return blocks;
  }

  /**
   * Render empty page structure to ensure DOM exists before pagination
   */
  _renderEmptyPageStructure() {
    const contentEl = document.getElementById('reader-content');
    if (!contentEl) return;
    
    contentEl.innerHTML = `
      <div class="page-container">
        <div class="page-viewport">
          <div class="chapter-text">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    `;
    
    // Force layout reflow so dimensions are available
    void contentEl.offsetHeight;
  }

  /**
   * Get text layout dimensions from the page structure
   * Must be called after page structure exists in DOM
   */
  _getLayoutDimensions() {
    const pageContainer = document.querySelector('.page-container');
    
    if (!pageContainer) {
      console.error('❌ .page-container not found in DOM');
      return {
        textWidth: 752,  // Fallback: 800px - 48px padding
        pageHeight: 765,
        maxLinesPerPage: 24
      };
    }
    
    // Get settings
    const settings = window.settingsManager?.settings || {};
    const fontSize = settings.fontSize || 18;
    const lineHeightMultiplier = settings.lineHeight || 1.6;
    const lineHeight = fontSize * lineHeightMultiplier;
    const textWidthPercent = (settings.textWidth || 100) / 100;
    
    // Calculate text width from container
    const containerWidth = pageContainer.clientWidth;
    // We removed horizontal padding, so use full container width
    const availableWidth = containerWidth;
    
    // Apply text width percentage - this will be the actual line width
    const targetWidth = availableWidth * textWidthPercent;
    
    // Ensure text width stays within reasonable bounds
    const textWidth = Math.max(200, Math.min(targetWidth, availableWidth));
    
    // Set CSS variable for centering offset
    // When text width is less than 100%, we center it with transform
    const offsetPercent = ((1 - textWidthPercent) / 2) * 100;
    document.documentElement.style.setProperty('--text-offset', `${offsetPercent}%`);
    document.documentElement.style.setProperty('--text-width-percent', `${textWidthPercent * 100}%`);
    
    // Calculate page height
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    let pageHeight;
    let textHeight;
    
    if (isFullscreen) {
      // Fullscreen: use full window height minus minimal padding
      pageHeight = window.innerHeight;
      textHeight = pageHeight - 60; // Minimal top + bottom padding
    } else {
      // Normal mode: use container height
      pageHeight = pageContainer.clientHeight;
      textHeight = pageHeight - 144; // Subtract vertical padding
    }
    
    // Calculate max lines per page
    const maxLinesPerPage = Math.floor(textHeight / lineHeight);
    
    return { textWidth, pageHeight, maxLinesPerPage, fontSize, lineHeight };
  }

  async loadChapter(index, { pageInChapter = 1, preservePage = false } = {}) {
    try {
      if (index < 0 || index >= this.chapters.length) {
        console.error(' Invalid chapter index:', index, '(total chapters:', this.chapters.length, ')');
        return;
      }

      this.currentChapterIndex = index;
      const chapter = this.chapters[index];
      
      if (!chapter) {
        throw new Error(`Chapter ${index} not found in chapters array`);
      }
      
      const layoutToken = ++this._chapterLayoutToken;
      
      // Store chapter shift points for music management
      this.currentChapterShiftPoints = null;

      // Apply page width settings - always use 100% of available space
      const { pageGap } = this._getPageMetrics();
      document.documentElement.style.setProperty('--page-width', '100%');
      document.documentElement.style.setProperty('--page-gap', `${pageGap}px`);

      // First, render an empty page structure to ensure DOM elements exist
      if (!this.chapterPages[index]) {
        this._renderEmptyPageStructure();
      }

      // Check if we already have pages for this chapter
      if (!this.chapterPages[index]) {
        this.chapterPages[index] = this.splitChapterIntoPages(
          chapter.content,
          chapter.title
        );
      }
      
      // Update pages count
      const totalPagesInChapter = this.chapterPages[index].length;
      this.pagesPerChapter[index] = totalPagesInChapter;
      
      // Set page number (clamp to valid range)
      this.currentPageInChapter = preservePage 
        ? Math.min(Math.max(1, pageInChapter), totalPagesInChapter)
        : 1;
      
      // Render current page
      this.renderCurrentPage();

      // Update UI
      document.title = `${this.currentBook.title} - BooksWithMusic`;
      
      // Update progress indicators
      const currentChapterEl = document.getElementById('current-chapter');
      const totalChaptersEl = document.getElementById('total-chapters');
      if (currentChapterEl) currentChapterEl.textContent = index + 1;
      if (totalChaptersEl) totalChaptersEl.textContent = this.chapters.length;

      // Update chapter list
      document.querySelectorAll('.chapter-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });

      // Update navigation buttons
      this._updateNavButtons();

      // Save progress
      await this.saveProgress();
      
      // Analyze chapter sections for intelligent music switching
      await this._analyzeChapterSections(index);

      // Update music for new chapter (only if music manager is ready)
      if (this.musicManager && this._musicInitPromise) {
        await this._musicInitPromise;
        this.musicManager.onChapterChange(
          this.currentChapterIndex, 
          this.currentPageInChapter,
          this.currentChapterShiftPoints
        );
      }

      // Update page numbers
      this.currentPage = this.calculateCurrentPageNumber();
      this.totalPages = this.calculateTotalPages();
      this.updatePageIndicator();
    } catch (error) {
      console.error(` Error loading chapter ${index}:`, error);
      console.error('Stack trace:', error.stack);
      this.showToast(`Failed to load chapter: ${error.message}`, 'error');
    }
  }

  /**
   * Render only the current page (not the whole chapter)
   */
  renderCurrentPage() {
    try {
      const contentEl = document.getElementById('reader-content');
      if (!contentEl) {
        console.warn(' #reader-content not found');
        return;
      }
      
      const pages = this.chapterPages[this.currentChapterIndex];
      if (!pages || pages.length === 0) {
        console.warn('No pages found for chapter:', this.currentChapterIndex);
        return;
      }
      
      const pageIndex = this.currentPageInChapter - 1;
      const pageContent = pages[pageIndex] || pages[0];
      
      // Safety check - if pageContent is empty/undefined, show error page
      if (!pageContent || pageContent.trim().length === 0) {
        console.error('Page content is empty!');
        contentEl.innerHTML = `
          <div class="page-container">
            <div class="page-viewport">
              <div class="chapter-text" style="color: red; padding: 50px;">
                <h2>Error: Empty Page Content</h2>
                <p>Chapter ${this.currentChapterIndex + 1}, Page ${this.currentPageInChapter}</p>
              </div>
            </div>
          </div>
        `;
        return;
      }
      
      // Render page
      contentEl.innerHTML = `
        <div class="page-container">
          <div class="page-viewport">
            <div class="chapter-text" data-page="${this.currentPageInChapter}" data-chapter="${this.currentChapterIndex}">
              ${pageContent}
            </div>
          </div>
        </div>
      `;
      
      // Debug: Log page content sample to verify line breaks
      this._logPageContentSample(pageContent);
      
      // Handle internal EPUB links
      contentEl.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          
          // If it's an anchor link (internal page navigation)
          if (href && href.startsWith('#')) {
            // Allow it to work naturally
            return;
          }
          
          // If it's a chapter reference or internal epub link
          if (href && !href.startsWith('http')) {
            e.preventDefault();
            // Try to find matching chapter
            const chapterIndex = this.findChapterByHref(href);
            if (chapterIndex !== -1) {
              this.loadChapter(chapterIndex);
            }
            return;
          }
          
          // Prevent external links from navigating away
          if (href && (href.startsWith('http') || href.startsWith('//'))) {
            e.preventDefault();
          }
        });
      });

      // Update progress indicator
      this.updatePageIndicator();
    } catch (error) {
      console.error(' Error rendering page:', error);
      console.error('Context:', {
        chapterIndex: this.currentChapterIndex,
        pageInChapter: this.currentPageInChapter,
        totalChapters: this.chapters?.length
      });
      console.error('Stack trace:', error.stack);
      
      // Show error in UI
      const contentEl = document.getElementById('reader-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="page-container">
            <div class="page-viewport">
              <div class="chapter-text" style="color: red; padding: 50px;">
                <h2>Error Rendering Page</h2>
                <p>${this.escapeHtml(error.message)}</p>
                <button onclick="location.reload()">Reload Page</button>
              </div>
            </div>
          </div>
        `;
      }
    }
  }
  
  /**
   * Debug: Log sample of page content to verify line breaks
   */
  _logPageContentSample(pageContent) {
    // Extract first 500 characters
    const sample = pageContent.substring(0, 500);
    
    // Show line breaks visually
    const visualized = sample
      .replace(/<br>/gi, '↵<br>')  // Show <br> tags
      .replace(/\n/g, '⏎')          // Show newlines
      .replace(/\r/g, '⌐');         // Show carriage returns

  }

  async _analyzeChapterSections(chapterIndex) {
    const chapter = this.chapters[chapterIndex];
    if (!chapter) return;
    
    const totalPages = this.pagesPerChapter[chapterIndex] || 1;
    
    // Get chapter mood from music manager
    const chapterAnalysis = this.musicManager?.getChapterAnalysis(chapterIndex);
    const chapterMood = chapterAnalysis?.primaryMood || 'peaceful';
    
    // Strip HTML to get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapter.content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Analyze chapter sections
    const sectionAnalysis = this.moodProcessor.analyzeChapterSections(
      plainText,
      chapterMood,
      totalPages,
      5 // Max 5 shifts per chapter
    );
    
    // Store shift points for this chapter
    this.currentChapterShiftPoints = sectionAnalysis;
    
    // Log summary only
    if (sectionAnalysis.totalShifts > 0) {
      // Mood shifts detected and stored
    }
  }

  _updateNavButtons() {
    const prevBtn = document.getElementById('prev-chapter');
    const nextBtn = document.getElementById('next-chapter');
    if (!prevBtn && !nextBtn) return;

    const pagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
    const isAtStart = this.currentChapterIndex === 0 && this.currentPageInChapter <= 1;
    const isAtEnd =
      this.currentChapterIndex === this.chapters.length - 1 &&
      this.currentPageInChapter >= pagesInChapter;

    if (prevBtn) prevBtn.disabled = isAtStart;
    if (nextBtn) nextBtn.disabled = isAtEnd;
  }

  findChapterByHref(href) {
    // Remove any leading path and get just the filename
    const filename = href.split('/').pop().split('#')[0];
    
    // Try to match against chapter content or find by index
    for (let i = 0; i < this.chapters.length; i++) {
      const chapter = this.chapters[i];
      // Simple matching - could be enhanced based on epub structure
      if (chapter.href && chapter.href.includes(filename)) {
        return i;
      }
      // Match by chapter number in the link
      const match = filename.match(/chapter[-_]?(\d+)/i);
      if (match && parseInt(match[1]) === i + 1) {
        return i;
      }
    }
    return -1;
  }

  getCurrentPageWidth() {
    // Get page width from settings, or use default
    try {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      return settings.pageWidth || 800; // Default to 800 if not set
    } catch {
      return 800;
    }
  }

  _getPageMetrics() {
    const desiredWidth = this.getCurrentPageWidth();
    // Clamp to available space so we don't clip the viewport (which causes skipped text)
    const readerContent = document.getElementById('reader-content');
    let maxWidth = 0;
    if (readerContent) {
      const cs = window.getComputedStyle(readerContent);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      maxWidth = Math.max(0, Math.floor(readerContent.clientWidth - padL - padR));
    }
    const pageWidth = maxWidth > 0 ? Math.min(desiredWidth, maxWidth) : desiredWidth;
    const pageHeight = Math.max(200, window.innerHeight - 200);
    const pageGap = this._pageGapPx;
    return { pageWidth, pageHeight, pageGap };
  }

  _getViewportPageStridePx(chapterTextEl) {
    const { pageHeight } = this._getPageMetrics();
    const viewport = chapterTextEl?.closest('.page-viewport') || document.querySelector('.page-viewport');
    const h = viewport ? viewport.clientHeight : 0;
    const base = h > 0 ? h : pageHeight;

    // Quantize stride to a whole number of lines so the bottom line isn't cut in half
    // when font-size/line-height changes.
    const lineHeightPx = this._getLineHeightPx(chapterTextEl);
    if (lineHeightPx > 4 && Number.isFinite(lineHeightPx)) {
      const lines = Math.max(1, Math.floor(base / lineHeightPx));
      return lines * lineHeightPx;
    }

    return base;
  }

  _getLineHeightPx(el) {
    if (!el) return 0;
    const cs = window.getComputedStyle(el);
    const fontSizePx = parseFloat(cs.fontSize) || 16;

    if (!cs.lineHeight || cs.lineHeight === 'normal') {
      return fontSizePx * 1.2;
    }

    const lh = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lh)) return fontSizePx * 1.2;

    // Some browsers can return unitless line-height; treat small values as multiplier.
    if (lh > 0 && lh < 4) {
      return lh * fontSizePx;
    }

    return lh;
  }

  _notifyPageChange(oldPage, newPage) {
    // Check if page-based music switching is enabled in settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const pageBasedMusicSwitch = settings.pageBasedMusicSwitch !== false; // Default true
    
    if (!pageBasedMusicSwitch) {
      return; // User disabled this feature
    }
    
    // Check if this page is a shift point
    let shiftInfo = null;
    if (this.currentChapterShiftPoints && this.currentChapterShiftPoints.shiftPoints) {
      shiftInfo = this.currentChapterShiftPoints.shiftPoints.find(sp => sp.page === newPage);
    }
    
    // Emit page change event that music panel can listen to
    if (this.musicManager) {
      const event = new CustomEvent('reader:pageChanged', {
        detail: {
          chapterIndex: this.currentChapterIndex,
          oldPage,
          newPage,
          totalPagesInChapter: this.pagesPerChapter[this.currentChapterIndex] || 1,
          shiftInfo, // Information about mood shift at this page
          allShiftPoints: this.currentChapterShiftPoints?.shiftPoints || [],
          direction: newPage > oldPage ? 'forward' : 'backward'
        }
      });
      window.dispatchEvent(event);
    }
  }

  calculateCurrentPageNumber() {
    let pageNumber = 1;
    // Add pages from previous chapters
    for (let i = 0; i < this.currentChapterIndex; i++) {
      pageNumber += (this.pagesPerChapter[i] || 1);
    }
    // Add current page within chapter (subtract 1 because we start counting from 1)
    pageNumber += (this.currentPageInChapter - 1);
    return pageNumber;
  }

  calculateTotalPages() {
    let total = 0;
    for (let i = 0; i < this.chapters.length; i++) {
      total += (this.pagesPerChapter[i] || this.getEstimatedPagesForChapter(i));
    }
    return total;
  }

  /**
   * Get estimated page count from mood analysis or calculate from word count
   * This uses the same 300 words/page calculation as mood-processor.js
   */
  getEstimatedPagesForChapter(chapterIndex) {
    // Try to get from mood analysis first
    const analysis = this.musicManager?.getChapterAnalysis(chapterIndex);
    if (analysis?.estimatedPages) {
      return analysis.estimatedPages;
    }
    
    // Fallback: calculate from chapter content
    const chapter = this.chapters[chapterIndex];
    if (chapter?.content) {
      const wordCount = chapter.content.split(/\s+/).length;
      return Math.max(1, Math.ceil(wordCount / 300));
    }
    
    return 1; // Final fallback
  }

  calculateTotalBookPages() {
    return this.chapters.reduce((total, _chapter, index) => {
      return total + (this.pagesPerChapter[index] || this.getEstimatedPagesForChapter(index));
    }, 0);
  }

  /**
   * Calculate current page number in the entire book (cumulative across chapters)
   */
  calculateCurrentBookPage() {
    let currentBookPage = 0;
    // Add pages from all previous chapters
    for (let i = 0; i < this.currentChapterIndex; i++) {
      currentBookPage += (this.pagesPerChapter[i] || this.getEstimatedPagesForChapter(i));
    }
    // Add current page in current chapter
    currentBookPage += this.currentPageInChapter;
    return currentBookPage;
  }

  /**
   * Jump to a specific page in the book (absolute page number across all chapters)
   */
  jumpToBookPage(targetBookPage) {
    let cumulativePages = 0;
    let targetChapter = 0;
    let targetPageInChapter = 1;

    // Find which chapter and page within that chapter
    for (let i = 0; i < this.chapters.length; i++) {
      const chapterPageCount = this.pagesPerChapter[i] || this.getEstimatedPagesForChapter(i);
      if (cumulativePages + chapterPageCount >= targetBookPage) {
        targetChapter = i;
        targetPageInChapter = targetBookPage - cumulativePages;
        break;
      }
      cumulativePages += chapterPageCount;
    }

    // Navigate to that location
    if (targetChapter !== this.currentChapterIndex) {
      this.loadChapter(targetChapter, { pageInChapter: targetPageInChapter });
    } else {
      this.goToPage(targetPageInChapter);
    }
  }

  /**
   * Jump to a specific percentage in the book
   */
  jumpToBookProgress(percentString) {
    const percent = parseFloat(percentString);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      this.showToast('Invalid progress value. Please enter 0-100.', 'error');
      return;
    }

    const totalPages = this.calculateTotalBookPages();
    const targetPage = Math.max(1, Math.ceil((percent / 100) * totalPages));
    this.jumpToBookPage(targetPage);
    this.showToast(`Jumped to ${percent}% (page ${targetPage}/${totalPages})`);
  }

  isTapInChapterText(x, y) {
    const tapTarget = document.elementFromPoint(x, y);
    const chapterText = tapTarget?.closest('.chapter-text');
    if (!chapterText) {
      return false;
    }
    const rect = chapterText.getBoundingClientRect();
    const styles = window.getComputedStyle(chapterText);
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const innerRect = {
      left: rect.left + paddingLeft,
      right: rect.right - paddingRight,
      top: rect.top + paddingTop,
      bottom: rect.bottom - paddingBottom
    };
    return x >= innerRect.left && x <= innerRect.right && y >= innerRect.top && y <= innerRect.bottom;
  }

  updatePageIndicator() {
    const pageContainer = document.querySelector('.page-container');
    if (!pageContainer) return;
    
    let indicator = pageContainer.querySelector('.page-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'page-indicator';
      pageContainer.appendChild(indicator);
    }
    
    // Check if we're in fullscreen - if so, keep indicator hidden
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    
    if (isFullscreen && indicator.style.display !== 'none') {
      indicator.style.display = 'none';
    }
    
    // Check settings for page number display preference
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    if (
      settings.showBookPageCount === undefined &&
      settings.showChapterPageCount === undefined &&
      settings.showBookPageNumbers === false
    ) {
      settings.showBookPageCount = true;  // Enable by default
      settings.showChapterPageCount = true;
    }

    // Book-level features are now ENABLED
    const showBookPageCount = settings.showBookPageCount !== false;
    const showBookProgress = settings.showBookProgress !== false;
    const showChapterPageCount = settings.showChapterPageCount !== false;
    const showChapterCount = settings.showChapterCount !== false;

    const lines = [];
    const totalChapters = this.chapters.length || 1;
    const chapterPages = this.pagesPerChapter[this.currentChapterIndex] || 1;

    // Book-level calculations now enabled
    const totalBookPages = this.calculateTotalBookPages();
    const currentBookPage = this.calculateCurrentBookPage();
    const progressPercent = totalBookPages > 0 ? (currentBookPage / totalBookPages) * 100 : 0;

    if (showBookPageCount) {
      lines.push(`<span class="book-page-display clickable-indicator" data-current="${currentBookPage}" data-total="${totalBookPages}" title="Click to jump to a specific page">Book Page: ${currentBookPage} / ${totalBookPages}</span>`);
    }

    if (showBookProgress) {
      // Make progress clickable/editable
      lines.push(`<span class="progress-display clickable-indicator" data-progress="${progressPercent.toFixed(1)}" title="Click to jump to a specific progress %">Progress: ${progressPercent.toFixed(1)}%</span>`);
    }

    if (showChapterPageCount) {
      lines.push(`Chapter Page: ${this.currentPageInChapter} / ${chapterPages}`);
    }

    if (showChapterCount) {
      lines.push(`Chapter: ${this.currentChapterIndex + 1} / ${totalChapters}`);
    }

    // Fallback: if no indicators are shown, show chapter page by default
    if (lines.length === 0) {
      lines.push(`Chapter Page: ${this.currentPageInChapter} / ${chapterPages}`);
    }

    indicator.innerHTML = lines.map((line) => `<span class="indicator-line">${line}</span>`).join('');
  }

  async saveProgress() {
    try {
      if (!this.currentBook) return;

      const progress = this.totalPages > 0 ? (this.currentPage / this.totalPages) * 100 : 0;
      
      const progressData = {
        currentChapter: this.currentChapterIndex,
        currentPageInChapter: this.currentPageInChapter,
        progress: progress
      };
      
      // Save to IndexedDB (always, for offline support and local caching)
      try {
        await this.db.updateBook(this.currentBook.id, progressData);
      } catch (dbError) {
        console.warn('Failed to save progress to IndexedDB:', dbError);
      }
      
      // Save to Firestore if user is signed in (for cross-device sync)
      const userId = auth.currentUser?.uid;
      if (userId) {
        await saveBookProgress(userId, this.currentBook.id, progressData);
      }

      // Progress saved to both DB and Firestore for redundancy
    } catch (error) {
      console.error(' Error saving progress:', error);
      console.error('Book ID:', this.currentBook?.id);
      console.error('Stack trace:', error.stack);
      // Don't show toast for save errors as they happen frequently
    }
  }

  async scrollPage(direction) {
    // Use page-based navigation instead of scroll
    if (direction === 'down') {
      await this.goToNextPage();
    } else {
      await this.goToPreviousPage();
    }
  }

  /**
   * Flip to a specific page within the current chapter with animation
   */
  async _flipToPage(targetPage, direction = 'next') {
    const pages = this.chapterPages[this.currentChapterIndex];
    if (!pages || targetPage < 1 || targetPage > pages.length) return;
    
    const oldPage = this.currentPageInChapter;
    
    const chapterText = document.querySelector('.chapter-text');
    if (!chapterText) {
      return;
    }
    
    // Get container
    const pageViewport = chapterText.parentElement;
    
    // Hide scrollbar during flip animation
    pageViewport.classList.add('flipping');
    
    // Create new page element that will flip in
    const newPageDiv = document.createElement('div');
    newPageDiv.className = 'chapter-text';
    newPageDiv.setAttribute('data-page', targetPage);
    newPageDiv.setAttribute('data-chapter', this.currentChapterIndex);
    
    // Set the new page content
    const pageIndex = targetPage - 1;
    const pageContent = pages[pageIndex] || pages[0];
    newPageDiv.innerHTML = pageContent;
    
    // CRITICAL: Add to DOM with pre-render class to let browser calculate text layout invisibly
    newPageDiv.classList.add('pre-render');
    pageViewport.appendChild(newPageDiv);
    
    // Force reflow to calculate all text layouts
    void newPageDiv.offsetHeight;
    
    // Remove pre-render class and add animation
    newPageDiv.classList.remove('pre-render');
    const animClass = direction === 'next' ? 'flipping-next' : 'flipping-prev';
    newPageDiv.classList.add(animClass);
    
    // Update page number immediately
    this.currentPageInChapter = targetPage;
    this.currentPage = this.calculateCurrentPageNumber();
    this.totalPages = this.calculateTotalPages();
    this.updatePageIndicator();
    this._updateNavButtons();
    
    // Notify music manager about page change
    this._notifyPageChange(oldPage, targetPage);
    
    // Save progress (debounced)
    window.clearTimeout(this._progressSaveTimer);
    this._progressSaveTimer = window.setTimeout(() => {
      this.saveProgress().catch(() => {});
    }, 400);
    
    // Wait for animation to complete (700ms)
    await new Promise(resolve => setTimeout(resolve, 700));
    
    // Remove old page and animation class
    if (chapterText && chapterText.parentElement) {
      chapterText.remove();
    }
    newPageDiv.classList.remove(animClass);
    
    // Restore scrollbar
    pageViewport.classList.remove('flipping');
     // Clean up any duplicate chapter-text elements
    const allChapterTexts = pageViewport.querySelectorAll('.chapter-text');
    if (allChapterTexts.length > 1) {
      allChapterTexts.forEach((element, index) => {
        if (index < allChapterTexts.length - 1) {
          element.remove();
        }
      });
    }
  }

  async goToNextPage() {
    try {
      const currentPagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
      
      // If at end of chapter, go to next chapter
      if (this.currentPageInChapter >= currentPagesInChapter) {
        await this.goToNextChapter();
        return;
      }
      
      await this._flipToPage(this.currentPageInChapter + 1, 'next');
    } catch (error) {
      console.error(' Error navigating to next page:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to navigate to next page', 'error');
    }
  }

  async goToPreviousPage() {
    try {
      // If at start of chapter, go to previous chapter
      if (this.currentPageInChapter <= 1) {
        await this.goToPreviousChapter();
        return;
      }
      
      await this._flipToPage(this.currentPageInChapter - 1, 'prev');
    } catch (error) {
      console.error(' Error navigating to previous page:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to navigate to previous page', 'error');
    }
  }

  async goToNextChapter() {
    try {
      if (this.currentChapterIndex >= this.chapters.length - 1) return;
      
      this.currentPageInChapter = 1;
      await this.loadChapter(this.currentChapterIndex + 1, { pageInChapter: 1, preservePage: false });
      
      // Update music for new chapter (only if music manager is ready)
      if (this.musicManager && this._musicInitPromise) {
        await this._musicInitPromise;
        this.musicManager.onChapterChange(this.currentChapterIndex);
      }
    } catch (error) {
      console.error(' Error navigating to next chapter:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to load next chapter', 'error');
    }
  }

  async goToPreviousChapter() {
    try {
      if (this.currentChapterIndex <= 0) return;
      
      const prevChapterIndex = this.currentChapterIndex - 1;
      // Jump to the end of the previous chapter; page is clamped after pagination.
      await this.loadChapter(prevChapterIndex, { pageInChapter: Number.MAX_SAFE_INTEGER, preservePage: true });
      
      // Update music for new chapter (only if music manager is ready)
      if (this.musicManager && this._musicInitPromise) {
        await this._musicInitPromise;
        this.musicManager.onChapterChange(this.currentChapterIndex);
      }
    } catch (error) {
      console.error(' Error navigating to previous chapter:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to load previous chapter', 'error');
    }
  }

  // UI Control Methods

  toggleFullscreen() {
    try {
      // Check if iOS (which doesn't support Fullscreen API)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        // iOS doesn't support Fullscreen API - silently ignore
        // Users can add to home screen for fullscreen experience
        return;
      }
      
      if (!document.fullscreenElement) {
        // Enter fullscreen
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Could not enter fullscreen:', err);
          this.showToast('Fullscreen not supported', 'error');
        });
      } else {
        // Exit fullscreen
        document.exitFullscreen().catch(err => {
          console.warn('Could not exit fullscreen:', err);
        });
      }
    } catch (error) {
      console.error(' Error toggling fullscreen:', error);
      this.showToast('Fullscreen failed', 'error');
    }
  }

  toggleControlsVisibility() {
    // Toggle visibility of all reader controls (for mobile tap-to-hide)
    const controls = document.querySelector('.reader-controls');
    const pageIndicator = document.querySelector('.page-indicator');
    
    if (!controls) return;
    
    // Use CSS class to toggle visibility
    const isHidden = controls.classList.contains('mobile-controls-hidden');
    
    if (isHidden) {
      // Show controls
      controls.classList.remove('mobile-controls-hidden');
      if (pageIndicator) {
        pageIndicator.classList.remove('mobile-controls-hidden');
      }
    } else {
      // Hide controls
      controls.classList.add('mobile-controls-hidden');
      if (pageIndicator) {
        pageIndicator.classList.add('mobile-controls-hidden');
      }
    }
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Create toast container if it doesn't exist
   */
  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }
}
