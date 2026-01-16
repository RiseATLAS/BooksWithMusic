
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

  setupImportButton() {
    const importBtn = document.getElementById('import-book');
    const fileInput = document.getElementById('file-input');

    importBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && file.name.endsWith('.epub')) {
        await this.importBook(file);
        fileInput.value = ''; // Reset input
      }
    });
  }

  async importBook(file) {
    try {
      this.showLoading('Importing book...');
      
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await this.parser.parse(arrayBuffer);
      
      const totalWords = parsed.chapters.reduce((total, chapter) => {
        const textContent = chapter.content.replace(/<[^>]*>/g, '');
        return total + textContent.split(/\s+/).filter(word => word.length > 0).length;
      }, 0);
      
      const bookData = {
        title: parsed.metadata?.title || file.name.replace('.epub', ''),
        author: parsed.metadata?.author || 'Unknown Author',
        data: arrayBuffer, // This will be handled by FirebaseManager
        coverImage: parsed.coverImage,
        importDate: new Date(),
        progress: 0,
        currentChapter: 0,
        totalWords: totalWords
      };
      
      const bookId = await this.db.saveBook(bookData);
      
      console.log('🤖 Analyzing book with AI...');
      const bookForAnalysis = { id: bookId, title: bookData.title, chapters: parsed.chapters };
      const analysis = await this.aiProcessor.analyzeBook(bookForAnalysis);
      await this.db.saveAnalysis(bookId, analysis);
      console.log('✓ AI analysis saved to database');

      this.hideLoading();
      this.showToast('Book imported successfully!');
      await this.loadBooks();
      
    } catch (error) {
      console.error('Error importing book:', error);
      this.hideLoading();
      this.showToast('Error importing book', 'error');
    }
  }

  async loadBooks() {
    const books = await this.db.getAllBooks();
    this.renderBooks(books);
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
      const estimatedPages = Math.ceil((book.totalWords || 50000) / 250);
      const currentPage = Math.floor((book.progress || 0) / 100 * estimatedPages);
      
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
    
    const newBookList = bookList.cloneNode(true);
    bookList.parentNode.replaceChild(newBookList, bookList);
    
    newBookList.addEventListener('click', async (e) => {
      const readBtn = e.target.closest('.btn-read');
      if (readBtn) {
        e.preventDefault();
        e.stopPropagation();
        const bookId = readBtn.dataset.bookId;
        this.emit('bookSelected', bookId);
        return;
      }
      
      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const bookId = deleteBtn.dataset.bookId;
        if (confirm('Are you sure you want to delete this book?')) {
          await this.deleteBook(bookId);
        }
        return;
      }
    });
  }

  async deleteBook(bookId) {
    try {
      await this.db.deleteBook(bookId);
      this.showToast('Book deleted');
      await this.loadBooks();
    } catch (error) {
      console.error('Error deleting book:', error);
      this.showToast('Error deleting book', 'error');
    }
  }

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
