import { EPUBParser } from '../core/epub-parser.js';
import { MusicManager } from '../core/music-manager.js';
import { AIProcessor } from '../core/ai-processor.js';

export class ReaderUI {
  constructor(db) {
    this.db = db;
    this.parser = new EPUBParser();
    this.aiProcessor = new AIProcessor();
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
    this.charsPerPage = this.getPageDensityFromSettings(); // Get from settings or default
    this._isFlipping = false; // Prevent multiple simultaneous flips
    
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
      return settings.pageDensity || 1200; // Default to 1200 if not set
    } catch {
      return 1200;
    }
  }

  async openBook(bookId) {
    try {
      console.log('📖 Opening book with ID:', bookId);
      this.showLoading('Loading book...');
      
      const book = await this.db.getBook(bookId);
      if (!book) {
        throw new Error('Book not found in database');
      }
      console.log('✅ Book found:', book.title);

      // Parse EPUB
      console.log('📄 Parsing EPUB data...');
      const parsed = await this.parser.parse(book.data);
      console.log('✅ EPUB parsed, chapters:', parsed.chapters.length);
      
      // Check if book has been analyzed
      let analysis = await this.db.getAnalysis(bookId);
      if (!analysis) {
        console.log('⚠️ Book not analyzed yet. Running AI analysis...');
        const bookForAnalysis = { id: bookId, title: book.title, chapters: parsed.chapters };
        analysis = await this.aiProcessor.analyzeBook(bookForAnalysis);
        await this.db.saveAnalysis(bookId, analysis);
        console.log('✓ AI analysis complete and saved');
      } else {
        console.log('✓ Using cached AI analysis from database');
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
      
      console.log('💾 Storing book data in sessionStorage...');
      sessionStorage.setItem('currentBook', JSON.stringify(bookDataForSession));

      this.hideLoading();
      
      // Navigate to reader page
      console.log('🔄 Navigating to reader page...');
      window.location.href = '/reader.html';
      
    } catch (error) {
      console.error('❌ Error opening book:', error);
      this.hideLoading();
      this.showToast('Error opening book: ' + error.message, 'error');
      throw error; // Re-throw so main.js can handle it
    }
  }

  async initializeReader() {
    const bookData = sessionStorage.getItem('currentBook');
    
    if (!bookData) {
      alert('No book selected. Redirecting to library...');
      window.location.href = '/';
      return;
    }

    try {
      const book = JSON.parse(bookData);
      
      // Validate book data
      if (!book.chapters || book.chapters.length === 0) {
        throw new Error('No chapters found in book data');
      }
      
      this.currentBook = { id: book.id, title: book.title, author: book.author };
      this.chapters = book.chapters;

      // Prefer the most recently saved progress from IndexedDB
      let persistedProgress = null;
      try {
        persistedProgress = await this.db.getBook(book.id);
      } catch {
        // ignore
      }

      this.currentChapterIndex =
        persistedProgress?.currentChapter ?? book.currentChapter ?? 0;
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
      
      await this.loadChapter(this.currentChapterIndex, { pageInChapter: this.currentPageInChapter, preservePage: true });

      // Setup event listeners
      this.setupEventListeners();

      // Initialize music in the background
      this._musicInitPromise = this.musicManager
        .initialize(book.id, this.chapters)
        .catch((e) => console.warn('Music init failed:', e));
      
      console.log('✓ Reader ready');
      
    } catch (error) {
      console.error('❌ Reader init failed:', error);
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
      const sidebar = document.getElementById('chapter-nav');
      if (sidebar) {
        // Toggle hidden class for desktop, show class for mobile
        sidebar.classList.toggle('hidden');
        sidebar.classList.toggle('show');
      }
    });

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    fullscreenBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleFullscreen();
    });

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
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, { passive: true });

    this.handleSwipe = () => {
      const swipeThreshold = 50; // minimum distance for swipe
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
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
      const newDensity = e.detail.charsPerPage;
      console.log('📏 Page density changed to:', newDensity);
      
      // Update internal setting
      this.charsPerPage = newDensity;
      
      // Clear cached pages for all chapters (force re-split)
      this.chapterPages = {};
      
      // Re-split and reload current chapter
      if (this.currentChapterIndex >= 0 && this.chapters.length > 0) {
        console.log('🔄 Reloading chapter with new page density...');
        await this.loadChapter(this.currentChapterIndex, { 
          pageInChapter: this.currentPageInChapter, 
          preservePage: true 
        });
      }
    });
  }

  /**
   * Split chapter content into pages based on character count
   * Preserves HTML structure and breaks at natural boundaries
   */
  splitChapterIntoPages(chapterContent, chapterTitle) {
    try {
      const pages = [];
      const charsPerPage = this.charsPerPage;
      
      // Parse HTML to extract elements
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chapterContent;
      
      // Get all actual content elements, not containers
      // First, get paragraphs and headings (most common content)
      let elements = Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6'));
    
      // If no paragraphs/headings, look for any divs with direct text content
      if (elements.length === 0) {
        const allDivs = Array.from(tempDiv.querySelectorAll('div'));
        elements = allDivs.filter(div => {
          // Keep divs that have direct text content (not just nested elements)
          const hasDirectText = Array.from(div.childNodes).some(node => 
            node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
          );
          return hasDirectText;
        });
      }
    
      // If still nothing, try top-level children (but filter out large containers)
      if (elements.length === 0) {
        elements = Array.from(tempDiv.children).filter(el => {
          const textLength = (el.textContent || '').trim().length;
          const childCount = el.children.length;
          // Skip if it's a huge container with lots of children (wrapper div)
          return !(textLength > 10000 && childCount > 20);
        });
      }
    
      // Filter out empty elements
      elements = elements.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.length > 0;
      });
    
      // Fallback: if no elements found, treat entire content as plain text
      if (elements.length === 0) {
        const textContent = tempDiv.textContent.trim();
        if (textContent) {
          // Create a paragraph with the plain text content
          const p = document.createElement('p');
          p.textContent = textContent; // This safely handles all text
          tempDiv.innerHTML = '';
          tempDiv.appendChild(p);
          elements = Array.from(tempDiv.children);
        } else {
          elements = [];
        }
      }
      
      let currentPage = {
        html: '',
        charCount: 0
      };
      
      // Add chapter title to first page
      const titleHTML = `<h2 class="chapter-heading">${this.escapeHtml(chapterTitle)}</h2>`;
      currentPage.html += titleHTML;
      currentPage.charCount += chapterTitle.length;
      
      for (const element of elements) {
        const elementHTML = element.outerHTML;
        const elementText = element.textContent || '';
        const elementChars = elementText.length;
        
        // Check if adding this element would overflow the page
        if (currentPage.charCount + elementChars > charsPerPage && currentPage.charCount > 0) {
          // Current page is full, save it and start a new page
          pages.push(currentPage.html);
          currentPage = { html: '', charCount: 0 };
          
          // Now check if this element itself is too large for one page
          if (elementChars > charsPerPage) {
            // Split large paragraphs by sentences
            if (element.tagName === 'P') {
              const sentences = this._splitIntoSentences(elementText);
              let paragraphBuffer = '';
              
              for (const sentence of sentences) {
                if (currentPage.charCount + paragraphBuffer.length + sentence.length > charsPerPage && currentPage.charCount > 0) {
                  // Save current page with accumulated paragraph
                  if (paragraphBuffer) {
                    currentPage.html += `<p>${paragraphBuffer}</p>`;
                    currentPage.charCount += paragraphBuffer.length;
                  }
                  pages.push(currentPage.html);
                  currentPage = { html: '', charCount: 0 };
                  paragraphBuffer = sentence;
                } else {
                  paragraphBuffer += (paragraphBuffer ? ' ' : '') + sentence;
                }
              }
              
              // Add remaining paragraph content to current page
              if (paragraphBuffer) {
                currentPage.html += `<p>${paragraphBuffer}</p>`;
                currentPage.charCount += paragraphBuffer.length;
              }
            } else {
              // Non-paragraph large element - add as is on its own page
              pages.push(elementHTML);
              currentPage = { html: '', charCount: 0 };
            }
          } else {
            // Element fits on a page, add to the new page
            currentPage.html += elementHTML;
            currentPage.charCount += elementChars;
          }
        } else {
          // Element fits on current page, add it
          currentPage.html += elementHTML;
          currentPage.charCount += elementChars;
        }
      }
      
      // Add remaining content as final page
      if (currentPage.html.trim()) {
        pages.push(currentPage.html);
      }
      
      // Ensure at least one page
      const finalPages = pages.length > 0 ? pages : ['<p>Empty chapter</p>'];
      
      return finalPages;
    } catch (error) {
      console.error(`❌ Error splitting chapter "${chapterTitle}":`, error);
      console.error('Stack trace:', error.stack);
      // Return a fallback page with error message
      return [`<div class="error-page">
        <h2>Error Loading Chapter</h2>
        <p>Failed to split chapter "${this.escapeHtml(chapterTitle)}" into pages.</p>
        <p>${this.escapeHtml(error.message)}</p>
      </div>`];
    }
  }

  /**
   * Split text into sentences for better page breaks
   */
  _splitIntoSentences(text) {
    // Split on sentence boundaries (.!?) followed by space
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  async loadChapter(index, { pageInChapter = 1, preservePage = false } = {}) {
    try {
      if (index < 0 || index >= this.chapters.length) {
        console.error('❌ Invalid chapter index:', index, '(total chapters:', this.chapters.length, ')');
        return;
      }

      console.log(`📖 Loading chapter ${index + 1}/${this.chapters.length}`);
      this.currentChapterIndex = index;
      const chapter = this.chapters[index];
      
      if (!chapter) {
        throw new Error(`Chapter ${index} not found in chapters array`);
      }
      
      const layoutToken = ++this._chapterLayoutToken;
      
      // Store chapter shift points for music management
      this.currentChapterShiftPoints = null;

      // Apply page width settings
      const { pageWidth, pageGap } = this._getPageMetrics();
      document.documentElement.style.setProperty('--page-width', `${pageWidth}px`);
      document.documentElement.style.setProperty('--page-gap', `${pageGap}px`);

      // Check if we already have pages for this chapter
      if (!this.chapterPages[index]) {
        this.chapterPages[index] = this.splitChapterIntoPages(
          chapter.content,
          chapter.title
        );
        console.log(`✓ Split into ${this.chapterPages[index].length} pages`);
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

      // Update page numbers
      this.currentPage = this.calculateCurrentPageNumber();
      this.totalPages = this.calculateTotalPages();
      this.updatePageIndicator();
    } catch (error) {
      console.error(`❌ Error loading chapter ${index}:`, error);
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
        console.warn('⚠️ #reader-content not found');
        return;
      }
      
      const pages = this.chapterPages[this.currentChapterIndex];
      if (!pages || pages.length === 0) {
        console.warn('⚠️ No pages found for chapter:', this.currentChapterIndex);
        return;
      }
      
      const pageIndex = this.currentPageInChapter - 1;
      const pageContent = pages[pageIndex] || pages[0];
      
      // Safety check - if pageContent is empty/undefined, show error page
      if (!pageContent || pageContent.trim().length === 0) {
        console.error('❌ Page content is empty!');
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
            console.log('External link blocked:', href);
          }
        });
      });

      // Update progress indicator
      this.updatePageIndicator();
    } catch (error) {
      console.error('❌ Error rendering page:', error);
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
    const sectionAnalysis = this.aiProcessor.analyzeChapterSections(
      plainText,
      chapterMood,
      totalPages,
      5 // Max 5 shifts per chapter
    );
    
    // Store shift points for this chapter
    this.currentChapterShiftPoints = sectionAnalysis;
    
    // Log summary only
    if (sectionAnalysis.totalShifts > 0) {
      console.log(`📊 Ch.${chapterIndex + 1}: ${sectionAnalysis.totalShifts} mood shifts detected`);
    }
  }

  _ensureViewportScrollHandler() {
    // No longer needed in true page-based system
    // Keeping stub for compatibility
    return;
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

  // ============================================
  // DEPRECATED: Old scroll-based pagination methods
  // These are kept as stubs for compatibility
  // ============================================

  async _repaginateAndRender({ waitForImages } = { waitForImages: true }) {
    // Deprecated: Using page array system instead
    // This is now handled by splitChapterIntoPages in loadChapter
    return;
  }

  async _waitForContentLayout(containerEl, { waitForImages } = { waitForImages: true }) {
    // Deprecated: No longer needed for page array system
    return;
  }

  _applyPageOffset() {
    // Deprecated: No scroll offset needed for page array system
    return;
  }

  _scrollToPage(targetPage, { behavior = 'smooth' } = {}) {
    // Deprecated: Using _flipToPage instead
    return this._flipToPage(targetPage, targetPage > this.currentPageInChapter ? 'next' : 'prev');
  }

  _syncCurrentPageFromScroll() {
    // Deprecated: No scroll syncing needed for page array system
    return;
  }

  _notifyPageChange(oldPage, newPage) {
    // Check if page-based music switching is enabled in settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const pageBasedMusicSwitch = settings.pageBasedMusicSwitch !== false; // Default true
    
    if (!pageBasedMusicSwitch) {
      console.log(`⏭️ Page ${oldPage} → ${newPage} (music switching disabled)`);
      return; // User disabled this feature
    }
    
    // Check if this page is a shift point
    let shiftInfo = null;
    if (this.currentChapterShiftPoints && this.currentChapterShiftPoints.shiftPoints) {
      shiftInfo = this.currentChapterShiftPoints.shiftPoints.find(sp => sp.page === newPage);
      
      if (shiftInfo) {
        console.log(`🎵 Page ${newPage}: SHIFT POINT! (${shiftInfo.fromMood} → ${shiftInfo.toMood})`);
      } else {
        console.log(`📖 Page ${oldPage} → ${newPage} (no shift)`);
      }
    } else {
      console.log(`📖 Page ${oldPage} → ${newPage} (no shift points available)`);
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
      total += (this.pagesPerChapter[i] || 1);
    }
    return total;
  }

  updatePageIndicator() {
    let indicator = document.querySelector('.page-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'page-indicator';
      document.body.appendChild(indicator);
    }
    if (indicator) {
      indicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }
  }

  async saveProgress() {
    try {
      if (!this.currentBook) return;

      const progress = this.totalPages > 0 ? (this.currentPage / this.totalPages) * 100 : 0;
      await this.db.updateBook(this.currentBook.id, {
        currentChapter: this.currentChapterIndex,
        currentPageInChapter: this.currentPageInChapter,
        progress: progress
      });

      // Keep sessionStorage in sync so refresh resumes correctly even before DB reads.
      try {
        const raw = sessionStorage.getItem('currentBook');
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored?.id === this.currentBook.id) {
            stored.currentChapter = this.currentChapterIndex;
            stored.currentPageInChapter = this.currentPageInChapter;
            sessionStorage.setItem('currentBook', JSON.stringify(stored));
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync sessionStorage:', error.message);
      }
    } catch (error) {
      console.error('❌ Error saving progress:', error);
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
    if (this._isFlipping) return;
    
    const pages = this.chapterPages[this.currentChapterIndex];
    if (!pages || targetPage < 1 || targetPage > pages.length) return;
    
    this._isFlipping = true;
    const oldPage = this.currentPageInChapter;
    
    const chapterText = document.querySelector('.chapter-text');
    if (!chapterText) {
      this._isFlipping = false;
      return;
    }
    
    // Add animation class based on direction
    const animClass = direction === 'next' ? 'flipping-next' : 'flipping-prev';
    chapterText.classList.add(animClass);
    
    // Wait for animation to reach midpoint (when page is hidden)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update page number and render new content
    this.currentPageInChapter = targetPage;
    this.renderCurrentPage();
    
    // Update progress and navigation
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
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Remove animation class
    const newChapterText = document.querySelector('.chapter-text');
    if (newChapterText) {
      newChapterText.classList.remove(animClass);
    }
    
    this._isFlipping = false;
  }

  async goToNextPage() {
    try {
      // Prevent multiple simultaneous flips
      if (this._isFlipping) return;
      
      const currentPagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
      
      // If at end of chapter, go to next chapter
      if (this.currentPageInChapter >= currentPagesInChapter) {
        await this.goToNextChapter();
        return;
      }
      
      await this._flipToPage(this.currentPageInChapter + 1, 'next');
    } catch (error) {
      console.error('❌ Error navigating to next page:', error);
      console.error('Stack trace:', error.stack);
      this._isFlipping = false; // Reset flip lock
      this.showToast('Failed to navigate to next page', 'error');
    }
  }

  async goToPreviousPage() {
    try {
      // Prevent multiple simultaneous flips
      if (this._isFlipping) return;
      
      // If at start of chapter, go to previous chapter
      if (this.currentPageInChapter <= 1) {
        await this.goToPreviousChapter();
        return;
      }
      
      await this._flipToPage(this.currentPageInChapter - 1, 'prev');
    } catch (error) {
      console.error('❌ Error navigating to previous page:', error);
      console.error('Stack trace:', error.stack);
      this._isFlipping = false; // Reset flip lock
      this.showToast('Failed to navigate to previous page', 'error');
    }
  }

  async goToNextChapter() {
    try {
      if (this.currentChapterIndex >= this.chapters.length - 1) return;
      if (this._isFlipping) return;
      
      this.currentPageInChapter = 1;
      await this.loadChapter(this.currentChapterIndex + 1, { pageInChapter: 1, preservePage: false });
      
      // Update music for new chapter (only if music manager is ready)
      if (this.musicManager && this._musicInitPromise) {
        await this._musicInitPromise;
        this.musicManager.onChapterChange(this.currentChapterIndex);
      }
    } catch (error) {
      console.error('❌ Error navigating to next chapter:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to load next chapter', 'error');
    }
  }

  async goToPreviousChapter() {
    try {
      if (this.currentChapterIndex <= 0) return;
      if (this._isFlipping) return;
      
      const prevChapterIndex = this.currentChapterIndex - 1;
      // Jump to the end of the previous chapter; page is clamped after pagination.
      await this.loadChapter(prevChapterIndex, { pageInChapter: Number.MAX_SAFE_INTEGER, preservePage: true });
      
      // Update music for new chapter (only if music manager is ready)
      if (this.musicManager && this._musicInitPromise) {
        await this._musicInitPromise;
        this.musicManager.onChapterChange(this.currentChapterIndex);
      }
    } catch (error) {
      console.error('❌ Error navigating to previous chapter:', error);
      console.error('Stack trace:', error.stack);
      this.showToast('Failed to load previous chapter', 'error');
    }
  }

  // UI Control Methods

  toggleFullscreen() {
    try {
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
      console.error('❌ Error toggling fullscreen:', error);
      this.showToast('Fullscreen failed', 'error');
    }
  }

  // Utility methods for UI feedback
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
      messageEl.textContent = message;
      overlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  showToast(message, type = 'success') {
    try {
      const container = document.getElementById('toast-container');
      if (!container) {
        console.warn('Toast container not found');
        return;
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      
      container.appendChild(toast);
      
      // Trigger animation
      setTimeout(() => toast.classList.add('show'), 10);
      
      // Remove after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } catch (error) {
      console.error('❌ Error showing toast:', error);
      // Fallback to console if toast fails
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}
