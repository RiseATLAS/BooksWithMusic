import { db, auth } from '../config/firebase-config.js';
import { 
    getUserBooks, 
    saveBook, 
    updateBook, 
    deleteBook 
} from '../storage/firestore-storage.js';
import { EPUBParser } from '../core/epub-parser.js';

export class BookLibrary {
    constructor() {
        this.books = [];
        this.currentUser = null;
        this.parser = new EPUBParser();
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
        const grid = document.getElementById('book-list');
        
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
                <button class="delete-btn" data-book-id="${book.id}" title="Delete book">🗑️</button>
            </div>
        `).join('');
        
        // Add click handlers for book cards (to open book)
        grid.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open book if delete button was clicked
                if (e.target.classList.contains('delete-btn')) return;
                const bookId = card.dataset.bookId;
                this.openBook(bookId);
            });
        });
        
        // Add click handlers for delete buttons
        grid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bookId = btn.dataset.bookId;
                await this.deleteBook(bookId);
            });
        });
    }

    setupEventListeners() {
        const importBtn = document.getElementById('import-book');
        const fileInput = document.getElementById('file-input');
        
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
            
            // Parse EPUB using EPUBParser
            console.log('Parsing EPUB...');
            const arrayBuffer = await file.arrayBuffer();
            const parsed = await this.parser.parse(arrayBuffer);
            console.log('Parsed:', parsed.title, 'by', parsed.author);
            
            // Convert to base64 for storage
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    
                    if (base64Data.length > 900000) {
                        alert('File too large (max 880 KB)');
                        return;
                    }
                    
                    const bookData = {
                        id: parsed.id,
                        title: parsed.title || 'Unknown Title',
                        author: parsed.author || 'Unknown Author',
                        cover: parsed.coverImage || '',
                        addedDate: new Date().toISOString(),
                        lastOpened: null,
                        progress: 0,
                        fileSize: file.size
                    };
                    
                    const userId = auth.currentUser.uid;
                    await saveBook(userId, bookData.id, bookData, base64Data);
                    
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
            alert(`Import error: ${error.message}`);
        }
    }

    async openBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) {
            alert('Book not found');
            return;
        }
        
        await updateBook(bookId, {
            lastOpened: new Date().toISOString()
        });
        
        // Store book data in sessionStorage for reader page
        // Need to fetch the full book data including fileData to parse chapters
        const { getBook } = await import('../storage/firestore-storage.js');
        const fullBook = await getBook(bookId);
        
        if (fullBook && fullBook.fileData) {
            // Decode base64 and parse EPUB to get chapters
            const { EPUBParser } = await import('../core/epub-parser.js');
            const parser = new EPUBParser();
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(fullBook.fileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            
            const parsed = await parser.parse(arrayBuffer);
            
            const bookForReader = {
                id: bookId,
                title: book.title || 'Unknown Title',
                author: book.author || 'Unknown Author',
                chapters: parsed.chapters,
                images: parsed.images ? Array.from(parsed.images.entries()) : []
            };
            
            sessionStorage.setItem('currentBook', JSON.stringify(bookForReader));
            window.location.href = './reader.html';
        } else {
            alert('Book data not found. Please re-import the book.');
        }
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