import { DatabaseManager } from '../storage/indexeddb';
import { EPUBParser } from '../core/epub-parser';
import { Book } from '../types/interfaces';

export class BookLibrary {
  private db: DatabaseManager;
  private parser: EPUBParser;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(db: DatabaseManager) {
    this.db = db;
    this.parser = new EPUBParser();
  }

  async initialize() {
    this.setupFileInput();
    await this.renderLibrary();
  }

  private setupFileInput() {
    const input = document.getElementById('epub-upload') as HTMLInputElement;
    input?.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.importBook(files[0]);
      }
    });
  }

  private async importBook(file: File) {
    this.showLoading('Importing book...');

    try {
      const book = await this.parser.parseEPUB(file);
      await this.db.addBook(book);
      await this.renderLibrary();
      this.hideLoading();
    } catch (error) {
      console.error('Failed to import book:', error);
      alert('Failed to import book. Please ensure it\'s a valid EPUB file.');
      this.hideLoading();
    }
  }

  private async renderLibrary() {
    const books = await this.db.getAllBooks();
    const container = document.getElementById('book-list');
    
    if (!container) return;

    if (books.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No books yet. Import an EPUB to get started!</p>';
      return;
    }

    container.innerHTML = books
      .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime())
      .map(book => this.createBookCard(book))
      .join('');

    container.querySelectorAll('.book-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        this.emit('bookSelected', books[index].id);
      });
    });
  }

  private createBookCard(book: Book): string {
    return `
      <div class="book-card" data-book-id="${book.id}">
        <h3>${this.escapeHTML(book.title)}</h3>
        <p>${this.escapeHTML(book.author)}</p>
        <small>${book.chapters.length} chapters</small>
      </div>
    `;
  }

  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private showLoading(message: string) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
      text.textContent = message;
      overlay.classList.add('active');
    }
  }

  private hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay?.classList.remove('active');
  }

  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  private emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }
}
