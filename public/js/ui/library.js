import { EPUBParser } from '../core/epub-parser.js';
import { AIProcessor } from '../core/ai-processor.js';

export class BookLibrary {
  constructor(db) {
    this.db = db;
    this.parser = new EPUBParser();
    this.aiProcessor = new AIProcessor();
    this.eventHandlers = {};
  }

  async initialize() {
    console.log('Initializing library...');
    this.applyPageColorToLibrary(); // Apply saved page color setting
    this.setupImportButton();
    console.log('Import button setup complete');
    try {
      await this.loadBooks();
      console.log('Books loaded');
    } catch (error) {
      console.error('Error loading books:', error);
      // Continue anyway - buttons should still work
    }
  }

  applyPageColorToLibrary() {
    try {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const pageColor = settings.pageColor || 'white';
      
      const colorMap = {
        'white': { bg: '#ffffff', text: '#1c1e21' },
        'cream': { bg: '#f9f6ed', text: '#3c3022' },
        'gray': { bg: '#e8e8e8', text: '#1c1e21' },
        'black': { bg: '#000000', text: '#ffffff' }
      };
      
      const colors = colorMap[pageColor] || colorMap['white'];
      
      // Apply to body and library view
      document.body.style.backgroundColor = colors.bg;
      document.body.style.color = colors.text;
      
      const libraryView = document.getElementById('library-view');
      if (libraryView) {
        libraryView.style.backgroundColor = colors.bg;
        libraryView.style.color = colors.text;
      }
      
      // Apply to library container (center section)
      const libraryContainer = document.querySelector('.library-container');
      if (libraryContainer) {
        libraryContainer.style.backgroundColor = colors.bg;
        libraryContainer.style.color = colors.text;
      }
      
      // Apply to book cards
      document.querySelectorAll('.book-card').forEach(card => {
        card.style.backgroundColor = colors.bg;
        card.style.color = colors.text;
      });
      
      // Update CSS variables for consistency
      document.documentElement.style.setProperty('--reader-bg', colors.bg);
      document.documentElement.style.setProperty('--reader-text', colors.text);
      document.documentElement.style.setProperty('--bg-secondary', colors.bg);
      document.documentElement.style.setProperty('--text-primary', colors.text);
    } catch (error) {
      console.error('Error applying page color to library:', error);
    }
  }

  setupImportButton() {
    const importBtn = document.getElementById('import-book');
    const fileInput = document.getElementById('file-input');

    console.log('Setting up import button:', importBtn ? 'Found' : 'Not found');
    console.log('File input:', fileInput ? 'Found' : 'Not found');

    importBtn?.addEventListener('click', () => {
      console.log('Import button clicked!');
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      console.log('File selected:', file?.name);
      if (file && file.name.endsWith('.epub')) {
        await this.importBook(file);
        fileInput.value = ''; // Reset input
      }
    });
  }

  async importBook(file) {
    try {
      this.showLoading('Importing book...');
      
      // Read and parse EPUB
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await this.parser.parse(arrayBuffer);
      
      // Calculate total word count for page estimation
      const totalWords = parsed.chapters.reduce((total, chapter) => {
        const textContent = chapter.content.replace(/<[^>]*>/g, ''); // Strip HTML
        return total + textContent.split(/\s+/).filter(word => word.length > 0).length;
      }, 0);
      
      // Store book data
      const bookData = {
        title: parsed.metadata?.title || parsed.title || file.name.replace('.epub', ''),
        author: parsed.author || parsed.metadata?.author || 'Unknown Author',
        data: arrayBuffer,
        coverImage: parsed.coverImage,
        images: parsed.images ? Array.from(parsed.images.entries()) : [],
        importDate: new Date(),
        progress: 0,
        currentChapter: 0,
        totalWords: totalWords
      };
      
      const bookId = await this.db.saveBook(bookData);
      
      // Run AI analysis on import
      console.log('🤖 Analyzing book with AI...');
      const book = { id: bookId, title: bookData.title, chapters: parsed.chapters };
      const analysis = await this.aiProcessor.analyzeBook(book);
      await this.db.saveAnalysis(bookId, analysis);
      console.log('✓ AI analysis saved to database');

      this.hideLoading();
      this.showToast('Book imported successfully!');
      await this.loadBooks();
      
    } catch (error) {
      console.error('❌ Error importing book:', file?.name);
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      this.hideLoading();
      this.showToast(`Failed to import book: ${error.message}`, 'error');
    }
  }

  async loadBooks() {
    const books = await this.db.getAllBooks();
    this.renderBooks(books);
    // Background repair for old imports (blob: URLs don't survive reload)
    this.repairMissingCovers(books).catch((e) => console.warn('Cover repair failed:', e));
  }

  async repairMissingCovers(books) {
    const needsFix = (b) => !b?.coverImage || (typeof b.coverImage === 'string' && b.coverImage.startsWith('blob:'));
    const toFix = (books || []).filter(needsFix);
    if (!toFix.length) return;

    for (const book of toFix) {
      try {
        if (!book?.data) continue;
        const parsed = await this.parser.parse(book.data);
        const coverImage = parsed?.coverImage;
        if (coverImage && typeof coverImage === 'string' && coverImage.startsWith('data:')) {
          await this.db.updateBook(book.id, { coverImage });
        }
      } catch (e) {
        console.warn('Failed to repair cover for book', book?.id, e);
      }
    }

    // Reload after repairs so UI updates
    const refreshed = await this.db.getAllBooks();
    this.renderBooks(refreshed);
  }

  renderBooks(books) {
    const bookList = document.getElementById('book-list');
    if (!bookList) return;

    if (books.length === 0) {
      bookList.innerHTML = `
        <div class="empty-state">
          <p>📚 No books yet</p>
          <p class="subtitle">Import an EPUB to get started</p>
        </div>
      `;
      return;
    }

    bookList.innerHTML = books.map(book => {
      const estimatedPages = Math.ceil((book.totalWords || 50000) / 250); // 250 words per page
      const currentPage = Math.floor((book.progress || 0) / 100 * estimatedPages);
      
      // Create cover display
      const coverDisplay = book.coverImage 
        ? `<img src="${book.coverImage}" alt="Book cover" class="book-cover-image">` 
        : '<div class="book-cover-placeholder">📖</div>';
      
      return `
        <div class="book-card" data-book-id="${book.id}">
          <div class="book-cover">${coverDisplay}</div>
          <h3 class="book-title">${this.escapeHtml(book.title)}</h3>
          <p class="book-author">${this.escapeHtml(book.author)}</p>
          <div class="book-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${book.progress || 0}%"></div>
            </div>
            <span class="progress-text">Page ${currentPage} of ${estimatedPages}</span>
          </div>
          <div class="book-actions">
            <button class="btn btn-primary btn-read" data-book-id="${book.id}">Read</button>
            <button class="btn btn-secondary btn-delete" data-book-id="${book.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    // Use event delegation on book-list container
    console.log('Setting up book list event delegation');
    console.log('Books rendered:', books.length);
    
    // Remove any existing listener first
    const newBookList = bookList.cloneNode(true);
    bookList.parentNode.replaceChild(newBookList, bookList);
    
    // Add single event listener to parent
    newBookList.addEventListener('click', async (e) => {
      console.log('📍 Click detected on book list');
      console.log('   Target:', e.target.tagName, e.target.className);
      
      // Handle read button
      const readBtn = e.target.closest('.btn-read');
      if (readBtn) {
        e.preventDefault();
        e.stopPropagation();
        const bookId = parseInt(readBtn.dataset.bookId);
        console.log('✓ Read button clicked for book:', bookId);
        console.log('   Book ID type:', typeof bookId, 'Value:', bookId);
        this.emit('bookSelected', bookId);
        return;
      }
      
      // Handle delete button
      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const bookId = parseInt(deleteBtn.dataset.bookId);
        console.log('✓ Delete button clicked for book:', bookId);
        if (confirm('Are you sure you want to delete this book?')) {
          await this.deleteBook(bookId);
        }
        return;
      }
    });
    
    console.log('Event delegation setup complete');
  }

  async deleteBook(bookId) {
    try {
      await this.db.deleteBook(bookId);
      await this.db.deleteAnalysis(bookId);
      this.showToast('Book deleted');
      await this.loadBooks();
    } catch (error) {
      console.error('Error deleting book:', error);
      this.showToast('Error deleting book', 'error');
    }
  }

  // Event emitter pattern
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  // Utility methods
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
