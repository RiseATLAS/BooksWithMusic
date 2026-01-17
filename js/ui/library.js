import { db, auth } from '../config/firebase-config.js';
import { 
    getUserBooks, 
    saveBook, 
    updateBook, 
    deleteBook 
} from '../storage/firestore-storage.js';

export class BookLibrary {
    constructor() {
        this.books = [];
        this.currentUser = null;
    }

    async init() {
        console.log('Initializing library...');
        await this.loadBooks();
        this.setupEventListeners();
        this.displayBooks();
    }

    async loadBooks() {
        try {
            this.books = await getUserBooks();
            console.log(`Loaded ${this.books.length} books`);
            return this.books;
        } catch (error) {
            console.error('Failed to load books:', error);
            this.books = [];
            return [];
        }
    }

    displayBooks() {
        const grid = document.getElementById('books-grid');
        
        if (!grid) {
            console.error('Books grid element not found');
            return;
        }
        
        if (!this.books || this.books.length === 0) {
            grid.innerHTML = '<p class="no-books">No books yet. Import an EPUB to get started!</p>';
            return;
        }
        
        grid.innerHTML = this.books.map(book => `
            <div class="book-card" data-book-id="${book.id}">
                ${book.cover ? `<img src="${book.cover}" alt="${book.title}" class="book-cover">` : '<div class="book-cover-placeholder">📖</div>'}
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                ${book.progress ? `<div class="book-progress">${Math.round(book.progress * 100)}% complete</div>` : ''}
            </div>
        `).join('');
        
        grid.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                this.openBook(bookId);
            });
        });
    }

    setupEventListeners() {
        const importBtn = document.getElementById('import-book-btn');
        const fileInput = document.getElementById('epub-input');
        
        if (importBtn && fileInput) {
            importBtn.onclick = (e) => {
                e.preventDefault();
                fileInput.click();
            };
            
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.importBook(file);
                    fileInput.value = '';
                }
            };
        }
    }

    async importBook(file) {
        try {
            if (!auth.currentUser) {
                alert('Please sign in first');
                return;
            }
            
            await this.loadBooks();
            if (this.books.length >= 10) {
                alert('Maximum 10 books allowed');
                return;
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    
                    if (base64Data.length > 900000) {
                        alert('File too large (max 880 KB)');
                        return;
                    }
                    
                    const epubBook = ePub(arrayBuffer);
                    await epubBook.ready;
                    
                    const metadata = epubBook.packaging?.metadata || {};
                    let cover = null;
                    try {
                        cover = await epubBook.coverUrl();
                    } catch (e) {}
                    
                    const bookData = {
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: metadata.title || 'Unknown Title',
                        author: metadata.creator || 'Unknown Author',
                        cover: cover || '',
                        addedDate: new Date().toISOString(),
                        lastOpened: null,
                        progress: 0
                    };
                    
                    await saveBook(bookData.id, {
                        ...bookData,
                        fileData: base64Data,
                        fileSize: file.size
                    });
                    
                    await this.loadBooks();
                    this.displayBooks();
                    
                    // Calculate storage usage
                    const totalSize = this.books.reduce((sum, b) => sum + (b.fileSize || 0), 0);
                    console.log(`Storage used: ${(totalSize / 1024).toFixed(2)} KB / 1,048,576 KB (${((totalSize / 1048576) * 100).toFixed(2)}%)`);
                    
                    alert(`✓ "${bookData.title}" imported!`);
                } catch (error) {
                    console.error('Import failed:', error);
                    alert(`Failed: ${error.message}`);
                }
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Import error:', error);
        }
    }

    async openBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
        
        await updateBook(bookId, {
            lastOpened: new Date().toISOString()
        });
        
        window.location.href = `reader.html?book=${bookId}`;
    }

    async deleteBook(bookId) {
        if (!confirm('Delete this book?')) return;
        
        try {
            await deleteBook(bookId);
            await this.loadBooks();
            this.displayBooks();
        } catch (error) {
            alert('Failed to delete');
        }
    }
}