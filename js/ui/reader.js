
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

  async openBook(bookId) {
    try {
      console.log('📖 Opening book with ID:', bookId);
      this.showLoading('Loading book...');
      
      const book = await this.db.getBook(bookId);
      if (!book || !book.downloadUrl) {
        throw new Error('Book data or download URL not found');
      }
      console.log('✅ Book found:', book.title);

      // Fetch EPUB from URL
      const response = await fetch(book.downloadUrl);
      if (!response.ok) throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();

      // Parse EPUB
      console.log('📄 Parsing EPUB data...');
      const parsed = await this.parser.parse(arrayBuffer);
      console.log('✅ EPUB parsed, chapters:', parsed.chapters.length);
      
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
      
      const bookDataForSession = {
        id: book.id,
        title: book.title,
        author: book.author,
        currentChapter: book.currentChapter || 0,
        currentPageInChapter: book.currentPageInChapter || 1,
        chapters: parsed.chapters,
        downloadUrl: book.downloadUrl // Pass the download URL
      };
      
      console.log('💾 Storing book data in sessionStorage...');
      sessionStorage.setItem('currentBook', JSON.stringify(bookDataForSession));

      this.hideLoading();
      
      console.log('🔄 Navigating to reader page...');
      window.location.href = './reader.html';
      
    } catch (error) {
      console.error('❌ Error opening book:', error);
      this.hideLoading();
      this.showToast('Error opening book: ' + error.message, 'error');
      throw error;
    }
  }

  async initializeReader() {
    console.log('🔍 Initializing reader...');
    
    const bookData = sessionStorage.getItem('currentBook');
    console.log('📖 Book data from sessionStorage:', bookData ? 'Found' : 'Not found');
    
    if (!bookData) {
      console.warn('❌ No book data found, redirecting to library');
      alert('No book selected. Redirecting to library...');
      window.location.href = './';
      return;
    }

    try {
      const book = JSON.parse(bookData);
      console.log('📚 Parsed book data:', book.title);
      
      this.currentBook = { id: book.id, title: book.title, author: book.author };
      this.chapters = book.chapters;

      let persistedProgress = await this.db.getBook(book.id);

      this.currentChapterIndex = persistedProgress?.currentChapter ?? book.currentChapter ?? 0;
      this.currentPageInChapter = persistedProgress?.currentPageInChapter ?? book.currentPageInChapter ?? 1;

      this.pagesPerChapter = {};
      this.currentPage = 1;
      this.totalPages = 0;

      const bookTitleEl = document.getElementById('book-title');
      if (!bookTitleEl) throw new Error('book-title element not found');
      
      bookTitleEl.textContent = book.title;
      console.log('📋 Rendering chapter list...');
      this.renderChapterList();
      
      console.log('📄 Loading chapter:', this.currentChapterIndex);
      await this.loadChapter(this.currentChapterIndex, { pageInChapter: this.currentPageInChapter, preservePage: true });

      console.log('⚡ Setting up event listeners...');
      this.setupEventListeners();

      console.log('🎵 Initializing music manager (async)...');
      this._musicInitPromise = this.musicManager
        .initialize(book.id, this.chapters)
        .then(() => console.log('✓ Music manager ready'))
        .catch((e) => console.warn('Music manager init failed:', e));
      
      console.log('✅ Reader initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing reader:', error);
      alert('Failed to load book: ' + error.message);
      window.location.href = './';
    }
  }

  renderChapterList() {
    const chapterList = document.getElementById('chapter-list');
    if (!chapterList) return;

    chapterList.innerHTML = this.chapters.map((chapter, index) => {
      const analysis = this.musicManager.getChapterAnalysis(index);
      const moodEmoji = this.getMoodEmoji(analysis?.primaryMood);
      const moodLabel = analysis?.primaryMood ? `${moodEmoji} ${analysis.primaryMood}` : '';
      
      return `
        <div class="chapter-item ${index === this.currentChapterIndex ? 'active' : ''}" 
             data-chapter="${index}">
          <span class="chapter-number">${index + 1}</span>
          <div class="chapter-info">
            <span class="chapter-title">${this.escapeHtml(chapter.title)}</span>
            ${moodLabel ? `<span class="chapter-mood">${moodLabel}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    chapterList.querySelectorAll('.chapter-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chapterIndex = parseInt(e.currentTarget.dataset.chapter);
        this.loadChapter(chapterIndex);
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

  async loadChapter(index, { pageInChapter = 1, preservePage = false } = {}) {
    if (index < 0 || index >= this.chapters.length) return;

    this.currentChapterIndex = index;
    this.currentPageInChapter = preservePage ? Math.max(1, pageInChapter) : 1;
    const chapter = this.chapters[index];
    const layoutToken = ++this._chapterLayoutToken;

    const contentEl = document.getElementById('reader-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="page-container">
          <div class="page-viewport">
            <div class="chapter-text">
              <h2 class="chapter-heading">${this.escapeHtml(chapter.title)}</h2>
              ${chapter.content}
            </div>
          </div>
        </div>
      `;

      this._ensureViewportScrollHandler();

      await this._repaginateAndRender({ waitForImages: true });
      this._updateNavButtons();

      try {
        if (document.fonts?.ready) {
          document.fonts.ready.then(() => {
            if (this._chapterLayoutToken !== layoutToken) return;
            this._repaginateAndRender({ waitForImages: false }).then(() => this._updateNavButtons());
          });
        }
      } catch {
        // ignore
      }
      
      contentEl.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          
          if (href && href.startsWith('#')) {
            return;
          }
          
          if (href && !href.startsWith('http')) {
            e.preventDefault();
            const chapterIndex = this.findChapterByHref(href);
            if (chapterIndex !== -1) {
              this.loadChapter(chapterIndex);
            }
            return;
          }
          
          if (href && (href.startsWith('http') || href.startsWith('//'))) {
            e.preventDefault();
            console.log('External link blocked:', href);
          }
        });
      });
    }

    document.getElementById('current-chapter').textContent = index + 1;
    document.getElementById('total-chapters').textContent = this.chapters.length;

    document.querySelectorAll('.chapter-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });

    this._updateNavButtons();

    await this.saveProgress();

    if (this.musicManager) {
      this.musicManager.onChapterChange(index);
    }
  }

  _ensureViewportScrollHandler() {
    const viewport = document.querySelector('.page-viewport');
    if (!viewport) return;

    if (this._viewportEl === viewport && this._boundViewportScrollHandler) return;

    if (this._viewportEl && this._boundViewportScrollHandler) {
      this._viewportEl.removeEventListener('scroll', this._boundViewportScrollHandler);
    }

    if (!this._boundViewportScrollHandler) {
      this._boundViewportScrollHandler = () => {
        window.clearTimeout(this._scrollUpdateTimer);
        this._scrollUpdateTimer = window.setTimeout(() => this._syncCurrentPageFromScroll(), 60);
      };
    }

    this._viewportEl = viewport;
    viewport.addEventListener('scroll', this._boundViewportScrollHandler, { passive: true });
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
    const filename = href.split('/').pop().split('#')[0];
    
    for (let i = 0; i < this.chapters.length; i++) {
      const chapter = this.chapters[i];
      if (chapter.href && chapter.href.includes(filename)) {
        return i;
      }
      const match = filename.match(/chapter[-_]?(\d+)/i);
      if (match && parseInt(match[1]) === i + 1) {
        return i;
      }
    }
    return -1;
  }

  _getPageMetrics() {
    const desiredWidth = this.getCurrentPageWidth();
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

    if (lh > 0 && lh < 4) {
      return lh * fontSizePx;
    }

    return lh;
  }

  async _repaginateAndRender({ waitForImages } = { waitForImages: true }) {
    const chapterText = document.querySelector('.chapter-text');
    if (!chapterText) return;

    const { pageWidth, pageGap } = this._getPageMetrics();

    document.documentElement.style.setProperty('--page-width', `${pageWidth}px`);
    chapterText.style.setProperty('--page-width', `${pageWidth}px`);
    chapterText.style.setProperty('--page-gap', `${pageGap}px`);
    document.querySelectorAll('.page-viewport').forEach((el) => {
      el.style.setProperty('--page-width', `${pageWidth}px`);
    });

    await this._waitForContentLayout(chapterText, { waitForImages });

    const strideY = this._getViewportPageStridePx(chapterText);
    const totalHeight = chapterText.scrollHeight;
    const pages = Math.max(1, Math.ceil(totalHeight / strideY));

    this.pagesPerChapter[this.currentChapterIndex] = pages;
    if (this.currentPageInChapter > pages) this.currentPageInChapter = pages;

    this._applyPageOffset();
    this.currentPage = this.calculateCurrentPageNumber();
    this.totalPages = this.calculateTotalPages();
    this.updatePageIndicator();
  }

  async _waitForContentLayout(containerEl, { waitForImages } = { waitForImages: true }) {
    try {
      if (document.fonts?.ready) {
        const timeoutMs = waitForImages ? 2500 : 800;
        await Promise.race([
          document.fonts.ready,
          new Promise(resolve => setTimeout(resolve, timeoutMs))
        ]);
      }
    } catch {
      // ignore
    }

    if (waitForImages) {
      const images = Array.from(containerEl.querySelectorAll('img'));
      if (images.length) {
        await Promise.race([
          Promise.allSettled(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          })),
          new Promise(resolve => setTimeout(resolve, 700))
        ]);
      }
    }

    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  _applyPageOffset() {
    const chapterText = document.querySelector('.chapter-text');
    if (!chapterText) return;

    const viewport = chapterText.closest('.page-viewport') || document.querySelector('.page-viewport');
    if (!viewport) return;

    const strideY = this._getViewportPageStridePx(chapterText);
    const offsetY = (this.currentPageInChapter - 1) * strideY;
    viewport.scrollTo({ top: offsetY, behavior: 'auto' });
  }

  _scrollToPage(targetPage, { behavior = 'smooth' } = {}) {
    const chapterText = document.querySelector('.chapter-text');
    const viewport = chapterText?.closest('.page-viewport') || document.querySelector('.page-viewport');
    if (!viewport || !chapterText) return;

    const pagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
    const clamped = Math.max(1, Math.min(pagesInChapter, targetPage));
    const strideY = this._getViewportPageStridePx(chapterText);
    const top = (clamped - 1) * strideY;

    if (clamped !== this.currentPageInChapter) {
      this.currentPageInChapter = clamped;
      this.currentPage = this.calculateCurrentPageNumber();
      this.updatePageIndicator();
      this._updateNavButtons();
    }

    viewport.scrollTo({ top, behavior });
    window.clearTimeout(this._progressSaveTimer);
    this._progressSaveTimer = window.setTimeout(() => {
      this._syncCurrentPageFromScroll();
    }, 250);
  }

  _syncCurrentPageFromScroll() {
    const chapterText = document.querySelector('.chapter-text');
    const viewport = chapterText?.closest('.page-viewport') || document.querySelector('.page-viewport');
    if (!viewport || !chapterText) return;

    const strideY = this._getViewportPageStridePx(chapterText);
    const pagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
    const estimated = Math.floor((viewport.scrollTop + strideY * 0.5) / strideY) + 1;
    const page = Math.max(1, Math.min(pagesInChapter, estimated));

    if (page !== this.currentPageInChapter) {
      this.currentPageInChapter = page;
      this.currentPage = this.calculateCurrentPageNumber();
      this.updatePageIndicator();
      this._updateNavButtons();
    }

    window.clearTimeout(this._progressSaveTimer);
    this._progressSaveTimer = window.setTimeout(() => {
      this.saveProgress().catch(() => {});
    }, 400);
  }

  calculateCurrentPageNumber() {
    let pageNumber = 1;
    for (let i = 0; i < this.currentChapterIndex; i++) {
      pageNumber += (this.pagesPerChapter[i] || 1);
    }
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
    indicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
  }

  async saveProgress() {
    if (!this.currentBook) return;

    const progress = this.totalPages > 0 ? (this.currentPage / this.totalPages) * 100 : 0;
    await this.db.updateBook(this.currentBook.id, {
      currentChapter: this.currentChapterIndex,
      currentPageInChapter: this.currentPageInChapter,
      progress: progress
    });

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
    } catch {
      // ignore
    }
  }

  scrollPage(direction) {
    const chapterText = document.querySelector('.chapter-text');
    const viewport = chapterText?.closest('.page-viewport') || document.querySelector('.page-viewport');
    if (!viewport || !chapterText) return;

    this._ensureViewportScrollHandler();

    const strideY = this._getViewportPageStridePx(chapterText);
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const epsilon = 4;

    if (direction === 'down') {
      const atEndOfChapter = viewport.scrollTop >= maxScrollTop - epsilon;
      if (atEndOfChapter) {
        if (this.currentChapterIndex < this.chapters.length - 1) {
          this.goToNextChapter();
        }
        return;
      }
      viewport.scrollBy({ top: strideY, behavior: 'smooth' });
    } else {
      const atStartOfChapter = viewport.scrollTop <= epsilon;
      if (atStartOfChapter) {
        if (this.currentChapterIndex > 0) {
          this.goToPreviousChapter();
        }
        return;
      }
      viewport.scrollBy({ top: -strideY, behavior: 'smooth' });
    }

    window.clearTimeout(this._scrollUpdateTimer);
    this._scrollUpdateTimer = window.setTimeout(() => this._syncCurrentPageFromScroll(), 120);
  }

  goToNextPage() {
    const currentPagesInChapter = this.pagesPerChapter[this.currentChapterIndex] || 1;
    if (this.currentPageInChapter >= currentPagesInChapter) return;
    this._scrollToPage(this.currentPageInChapter + 1, { behavior: 'smooth' });
  }

  goToPreviousPage() {
    if (this.currentPageInChapter <= 1) return;
    this._scrollToPage(this.currentPageInChapter - 1, { behavior: 'smooth' });
  }

  goToNextChapter() {
    if (this.currentChapterIndex >= this.chapters.length - 1) return;
    this.currentPageInChapter = 1;
    this.loadChapter(this.currentChapterIndex + 1, { pageInChapter: 1, preservePage: true });
  }

  goToPreviousChapter() {
    if (this.currentChapterIndex <= 0) return;
    const prevChapterIndex = this.currentChapterIndex - 1;
    this.loadChapter(prevChapterIndex, { pageInChapter: Number.MAX_SAFE_INTEGER, preservePage: true });
  }

  setupEventListeners() {
    document.getElementById('prev-chapter')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.scrollPage('up');
    });

    document.getElementById('next-chapter')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.scrollPage('down');
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.scrollPage('up');
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.scrollPage('down');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });

    document.getElementById('fullscreen-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleFullscreen();
    });

    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());

    this._ensureViewportScrollHandler();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveProgress().catch(() => {});
    });
    window.addEventListener('beforeunload', () => {
      this.saveProgress().catch(() => {});
    });

    if (!this._layoutChangedHandler) {
      let pending = false;
      this._layoutChangedHandler = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(async () => {
          pending = false;
          await this._repaginateAndRender({ waitForImages: false });
          this._updateNavButtons();
        });
      };
      window.addEventListener('reader:layoutChanged', this._layoutChangedHandler);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  updateFullscreenButton() {
    const btn = document.getElementById('fullscreen-btn');
    if (btn) {
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      btn.textContent = isFullscreen ? '⛶' : '⛶';
      btn.title = isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)';
    }
  }

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

  getCurrentPageWidth() {
    try {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings'));
      return settings?.pageWidth || 650;
    } catch {
      return 650;
    }
  }
}
