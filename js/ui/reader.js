import { EPUBParser } from '../core/epub-parser.js';
import { MusicManager } from '../core/music-manager.js';

export class ReaderUI {
  constructor(db) {
    this.db = db;
    this.parser = new EPUBParser();
    this.musicManager = new MusicManager(db);
    this.currentBook = null;
    this.currentChapterIndex = 0;
    this.chapters = [];
  }

  async openBook(bookId) {
    try {
      this.showLoading('Loading book...');
      
      const book = await this.db.getBook(bookId);
      if (!book) {
        throw new Error('Book not found');
      }

      // Parse EPUB
      const parsed = await this.parser.parse(book.data);
      
      // Store book data in sessionStorage for reader page
      sessionStorage.setItem('currentBook', JSON.stringify({
        id: book.id,
        title: book.title,
        author: book.author,
        currentChapter: book.currentChapter || 0,
        chapters: parsed.chapters
      }));

      this.hideLoading();
      
      // Navigate to reader page
      window.location.href = '/reader.html';
      
    } catch (error) {
      console.error('Error opening book:', error);
      this.hideLoading();
      this.showToast('Error opening book', 'error');
    }
  }

  async initializeReader() {
    // Called when reader.html loads
    const bookData = sessionStorage.getItem('currentBook');
    if (!bookData) {
      window.location.href = '/';
      return;
    }

    try {
      const book = JSON.parse(bookData);
      this.currentBook = { id: book.id, title: book.title, author: book.author };
      this.chapters = book.chapters;
      this.currentChapterIndex = book.currentChapter || 0;

      // Update UI
      document.getElementById('book-title').textContent = book.title;
      this.renderChapterList();
      await this.loadChapter(this.currentChapterIndex);
      
      // Initialize music
      await this.musicManager.initialize(book.id, this.chapters);
      
      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing reader:', error);
      window.location.href = '/';
    }
  }

  renderChapterList() {
    const chapterList = document.getElementById('chapter-list');
    if (!chapterList) return;

    chapterList.innerHTML = this.chapters.map((chapter, index) => `
      <div class="chapter-item ${index === this.currentChapterIndex ? 'active' : ''}" 
           data-chapter="${index}">
        <span class="chapter-number">${index + 1}</span>
        <span class="chapter-title">${this.escapeHtml(chapter.title)}</span>
      </div>
    `).join('');

    // Add click listeners
    chapterList.querySelectorAll('.chapter-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chapterIndex = parseInt(e.currentTarget.dataset.chapter);
        this.loadChapter(chapterIndex);
      });
    });
  }

  async loadChapter(index) {
    if (index < 0 || index >= this.chapters.length) return;

    this.currentChapterIndex = index;
    const chapter = this.chapters[index];

    // Render chapter content
    const contentEl = document.getElementById('reader-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <h2 class="chapter-heading">${this.escapeHtml(chapter.title)}</h2>
        <div class="chapter-text">${chapter.content}</div>
      `;
      contentEl.scrollTop = 0;
      
      // Handle internal EPUB links intelligently
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
    }

    // Update progress indicator
    document.getElementById('current-chapter').textContent = index + 1;
    document.getElementById('total-chapters').textContent = this.chapters.length;

    // Update chapter list
    document.querySelectorAll('.chapter-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });

    // Update navigation buttons
    const prevBtn = document.getElementById('prev-chapter');
    const nextBtn = document.getElementById('next-chapter');
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === this.chapters.length - 1;

    // Save progress
    await this.saveProgress();

    // Update music for chapter
    this.musicManager.onChapterChange(index);
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

  async saveProgress() {
    if (!this.currentBook) return;

    const progress = ((this.currentChapterIndex + 1) / this.chapters.length) * 100;
    await this.db.updateBook(this.currentBook.id, {
      currentChapter: this.currentChapterIndex,
      progress: progress
    });
  }

  setupEventListeners() {
    document.getElementById('prev-chapter')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.loadChapter(this.currentChapterIndex - 1);
    });

    document.getElementById('next-chapter')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.loadChapter(this.currentChapterIndex + 1);
    });
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
}
