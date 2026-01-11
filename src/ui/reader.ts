import { DatabaseManager } from '../storage/indexeddb';
import { Book } from '../types/interfaces';

export class ReaderUI {
  private db: DatabaseManager;
  private currentBook?: Book;
  private currentChapterIndex: number = 0;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.setupControls();
  }

  private setupControls() {
    document.getElementById('prev-page')?.addEventListener('click', () => this.previousChapter());
    document.getElementById('next-page')?.addEventListener('click', () => this.nextChapter());
    
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('reader-view')?.classList.contains('active')) {
        if (e.key === 'ArrowLeft') this.previousChapter();
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          this.nextChapter();
        }
      }
    });
  }

  async loadBook(bookId: string) {
    const book = await this.db.getBook(bookId);
    if (!book) return;

    this.currentBook = book;
    this.currentChapterIndex = book.currentChapter || 0;

    this.updateHeader();
    this.renderChapter();
  }

  private updateHeader() {
    if (!this.currentBook) return;

    const titleEl = document.getElementById('book-title');
    const chapterEl = document.getElementById('chapter-title');

    if (titleEl) titleEl.textContent = this.currentBook.title;
    if (chapterEl) {
      const chapter = this.currentBook.chapters[this.currentChapterIndex];
      chapterEl.textContent = chapter?.title || '';
    }
  }

  private renderChapter() {
    if (!this.currentBook) return;

    const chapter = this.currentBook.chapters[this.currentChapterIndex];
    const contentEl = document.getElementById('reader-content');

    if (contentEl && chapter) {
      contentEl.innerHTML = chapter.content;
      contentEl.scrollTop = 0;
    }

    this.updateProgress();
    this.updateNavButtons();
    this.saveProgress();
  }

  private previousChapter() {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
      this.renderChapter();
    }
  }

  private nextChapter() {
    if (this.currentBook && this.currentChapterIndex < this.currentBook.chapters.length - 1) {
      this.currentChapterIndex++;
      this.renderChapter();
    }
  }

  private updateProgress() {
    if (!this.currentBook) return;

    const progress = ((this.currentChapterIndex + 1) / this.currentBook.chapters.length) * 100;
    const fillEl = document.getElementById('progress-fill');
    const textEl = document.getElementById('progress-text');

    if (fillEl) fillEl.style.width = `${progress}%`;
    if (textEl) textEl.textContent = `${Math.round(progress)}%`;
  }

  private updateNavButtons() {
    const prevBtn = document.getElementById('prev-page') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-page') as HTMLButtonElement;

    if (prevBtn) prevBtn.disabled = this.currentChapterIndex === 0;
    if (nextBtn && this.currentBook) {
      nextBtn.disabled = this.currentChapterIndex >= this.currentBook.chapters.length - 1;
    }
  }

  private async saveProgress() {
    if (!this.currentBook) return;

    this.currentBook.currentChapter = this.currentChapterIndex;
    this.currentBook.lastOpened = new Date().toISOString();
    await this.db.updateBook(this.currentBook);
  }

  cleanup() {
    this.currentBook = undefined;
    this.currentChapterIndex = 0;
  }
}
