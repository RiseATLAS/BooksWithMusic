export class BookLibrary {
  constructor(db) {
    this.db = db;
    this.eventHandlers = {};
  }

  async initialize() {
    this.setupImportButton();
    await this.loadBooks();
  }

  setupImportButton() {
    const importBtn = document.getElementById('import-book');
    const fileInput = document.getElementById('file-input');

    importBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

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
      
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Store book data
      const bookId = await this.db.saveBook({
        title: file.name.replace('.epub', ''),
        author: 'Unknown',
        data: arrayBuffer,
        importDate: new Date(),
        progress: 0,
        currentChapter: 0
      });

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

    bookList.innerHTML = books.map(book => `
      <div class="book-card" data-book-id="${book.id}">
        <div class="book-cover">📖</div>
        <h3 class="book-title">${this.escapeHtml(book.title)}</h3>
        <p class="book-author">${this.escapeHtml(book.author)}</p>
        <div class="book-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${book.progress || 0}%"></div>
          </div>
          <span class="progress-text">${Math.round(book.progress || 0)}%</span>
        </div>
        <div class="book-actions">
          <button class="btn btn-primary btn-read" data-book-id="${book.id}">Read</button>
          <button class="btn btn-secondary btn-delete" data-book-id="${book.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    bookList.querySelectorAll('.btn-read').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const bookId = parseInt(e.target.dataset.bookId);
        this.emit('bookSelected', bookId);
      });
    });

    bookList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const bookId = parseInt(e.target.dataset.bookId);
        if (confirm('Are you sure you want to delete this book?')) {
          await this.deleteBook(bookId);
        }
      });
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
