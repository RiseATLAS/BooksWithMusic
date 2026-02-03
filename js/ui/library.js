/**
 * BookLibrary - EPUB Library Management UI
 * 
 * RESPONSIBILITIES:
 * - Display user's book collection with covers and metadata
 * - Handle EPUB file uploads and parsing
 * - Manage book storage in IndexedDB (local) and Firestore (cloud)
 * - Compress/decompress large EPUBs for Firestore storage
 * - Handle book deletion and metadata updates
 * - Track last opened time and reading progress
 * - Navigate to reader when book is opened
 * - Show loading states and error messages
 * 
 * STORAGE STRATEGY:
 * - IndexedDB: Full book data (EPUB binary) for offline access
 * - Firestore: Metadata + compressed EPUB (chunked if > 1MB)
 * - Cache initialization on first load
 * - Sync between local and cloud storage
 * 
 * BOOK DATA FLOW:
 * 1. User uploads EPUB file
 * 2. Parse EPUB (EPUBParser) to extract metadata and chapters
 * 3. Store full data in IndexedDB
 * 4. Compress and chunk for Firestore (if user signed in)
 * 5. Display in library grid
 * 6. On open: Pass to ReaderUI via sessionStorage
 */

import { db, auth } from '../config/firebase-config.js';
import { 
    getUserBooks, 
    saveBook, 
    updateBook, 
    deleteBook 
} from '../storage/firestore-storage.js';
import { EPUBParser } from '../core/epub-parser.js';
import { DatabaseManager } from '../storage/indexeddb.js';
import pako from 'https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm';

export class BookLibrary {
    constructor() {
        this.books = [];
        this.currentUser = null;
        this.parser = new EPUBParser();
        this.localDb = new DatabaseManager();
        this.cacheInitialized = false;
        this.eventListenersSetup = false;
        this.shownCacheMessage = false; // Track if we've shown the cache message
    }

    async init() {
        // Initialize local IndexedDB cache
        await this.localDb.initialize();
        this.cacheInitialized = true;
        
        await this.loadBooks();
        
        // Only setup event listeners once
        if (!this.eventListenersSetup) {
            this.setupEventListeners();
            this.eventListenersSetup = true;
        }
        
        this.displayBooks();
    }

    async loadBooks() {
        try {
            // First, load from local IndexedDB cache (instant)
            if (this.cacheInitialized) {
                const cachedBooks = await this.localDb.getAllBooks();
                if (cachedBooks && cachedBooks.length > 0) {
                    this.books = cachedBooks;
                    this.displayBooks(); // Show cached books immediately
                    
                    // Show friendly message if signed out but have cached books
                    // Only show once to avoid showing during auth initialization
                    if (!auth.currentUser && cachedBooks.length > 0 && !this.shownCacheMessage) {
                        // Wait a bit to ensure auth has initialized
                        setTimeout(() => {
                            // Re-check after delay to ensure user is actually signed out
                            if (!auth.currentUser) {
                                this.showToast('📚 We stored your books so you can continue reading while not logged in, enjoy!', 'info', 5000);
                                this.shownCacheMessage = true;
                            }
                        }, 1000);
                    }
                }
            }
            
            // Then sync with Firestore if user is signed in
            const userId = auth.currentUser?.uid;
            if (userId) {
                const firestoreBooks = await getUserBooks();
                
                // Update local cache with Firestore data
                if (this.cacheInitialized) {
                    await this.syncLocalCache(firestoreBooks);
                }
                
                this.books = firestoreBooks;
            }
            
            return this.books;
        } catch (error) {
            console.error('Failed to load books:', error);
            // Fall back to cache if Firestore fails
            if (this.cacheInitialized) {
                this.books = await this.localDb.getAllBooks() || [];
            } else {
                this.books = [];
            }
            return this.books;
        }
    }

    async syncLocalCache(firestoreBooks) {
        try {
            // Get current cached book IDs
            const cachedBooks = await this.localDb.getAllBooks();
            const cachedIds = new Set(cachedBooks.map(b => b.id));
            const firestoreIds = new Set(firestoreBooks.map(b => b.id));
            
            // Add/update books from Firestore
            for (const book of firestoreBooks) {
                await this.localDb.saveBook(book);
            }
            
            // Remove books that no longer exist in Firestore
            for (const cachedBook of cachedBooks) {
                if (!firestoreIds.has(cachedBook.id)) {
                    await this.localDb.deleteBook(cachedBook.id);
                }
            }
        } catch (error) {
            console.error('Failed to sync local cache:', error);
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
        
        grid.innerHTML = this.books.map(book => {
            // Extract progress percentage (handle both nested and flat structures)
            const progressPercent = book.progress?.progress ?? book.progress ?? 0;
            const hasProgress = progressPercent > 0;
            
            return `
            <div class="book-card" data-book-id="${book.id}">
                ${book.cover ? `<img src="${book.cover}" alt="${book.title}" class="book-cover">` : '<div class="book-cover-placeholder">📖</div>'}
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                ${hasProgress ? `
                <div class="book-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">${Math.round(progressPercent)}% complete</div>
                </div>
                ` : ''}
                <button class="delete-btn" data-book-id="${book.id}" title="Delete book">🗑️</button>
            </div>
        `;
        }).join('');
        
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

    async resizeCoverImage(base64Image, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions maintaining aspect ratio
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                
                // Create canvas and resize
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to JPEG with 0.7 quality for better compression
                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(resizedBase64);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = base64Image;
        });
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
            const arrayBuffer = await file.arrayBuffer();
            const parsed = await this.parser.parse(arrayBuffer);
            
            // Convert to base64 for storage
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    
                    if (base64Data.length > 104857600) { // 100MB in bytes
                        alert('File too large (max 100 MB)');
                        return;
                    }
                    
                    // Compress the base64 data to reduce size
                    console.log(`Original size: ${(base64Data.length / 1024).toFixed(2)} KB`);
                    const compressed = pako.deflate(base64Data, { level: 9 });
                    
                    // Convert to base64 using chunked approach to avoid call stack limit
                    let compressedBase64 = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < compressed.length; i += chunkSize) {
                        const chunk = compressed.subarray(i, Math.min(i + chunkSize, compressed.length));
                        compressedBase64 += String.fromCharCode.apply(null, chunk);
                    }
                    compressedBase64 = btoa(compressedBase64);
                    
                    console.log(`Compressed size: ${(compressedBase64.length / 1024).toFixed(2)} KB`);
                    console.log(`Compression ratio: ${((1 - compressedBase64.length / base64Data.length) * 100).toFixed(1)}%`);
                    
                    // Handle cover image - downscale if too large to fit in Firestore
                    let coverImage = parsed.coverImage || '';
                    if (coverImage && coverImage.length > 100000) {
                        console.log(`📸 Cover image too large (${(coverImage.length / 1024).toFixed(0)}KB), downscaling...`);
                        try {
                            coverImage = await this.resizeCoverImage(coverImage, 300, 450);
                            console.log(`✅ Cover resized to ${(coverImage.length / 1024).toFixed(0)}KB`);
                        } catch (error) {
                            console.warn('⚠️ Failed to resize cover, storing in IndexedDB only:', error);
                            coverImage = ''; // Don't store in Firestore if resize fails
                        }
                    }
                    
                    const bookData = {
                        id: parsed.id,
                        title: parsed.title || 'Unknown Title',
                        author: parsed.author || 'Unknown Author',
                        cover: coverImage,
                        addedDate: new Date().toISOString(),
                        lastOpened: null,
                        progress: 0,
                        fileSize: file.size,
                        compressed: true // Flag to indicate data is compressed
                    };
                    
                    const userId = auth.currentUser.uid;
                    
                    // If compressed data exceeds 900KB, split into chunks
                    if (compressedBase64.length > 900000) {
                        console.log('📦 Book is large, using chunked storage...');
                        const { saveBookChunks } = await import('../storage/firestore-storage.js');
                        const totalChunks = await saveBookChunks(userId, bookData.id, compressedBase64, 500000);
                        bookData.chunked = true;
                        bookData.totalChunks = totalChunks;
                        // Save metadata without fileData
                        await saveBook(userId, bookData.id, bookData, null);
                    } else {
                        // Save normally with fileData
                        await saveBook(userId, bookData.id, bookData, compressedBase64);
                    }
                    
                    // Also save to local cache with full cover image and parsed chapters
                    if (this.cacheInitialized) {
                        const cacheData = { 
                            ...bookData, 
                            cover: parsed.coverImage || '',
                            chapters: parsed.chapters,
                            images: parsed.images ? Array.from(parsed.images.entries()) : [],
                            parsedData: true // Flag to indicate this has parsed data
                        };
                        await this.localDb.saveBook(cacheData);
                    }
                    
                    await this.loadBooks();
                    this.displayBooks();
                    this.showToast('✅ Book imported successfully!', 'success', 3000);
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
        
        // Show loading indicator
        this.showToast('📖 Loading book...', 'info', 2000);
        
        // Only update lastOpened in Firestore if user is signed in
        if (auth.currentUser) {
            try {
                await updateBook(bookId, {
                    lastOpened: new Date().toISOString()
                });
            } catch (error) {
                console.warn('Could not update book in Firestore:', error);
            }
        }
        
        // First, check if book is already parsed in local cache
        if (this.cacheInitialized) {
            const cachedBook = await this.localDb.getBook(bookId);
            if (cachedBook && cachedBook.parsedData && cachedBook.chapters && cachedBook.chapters.length > 0) {
                // Book is already parsed and ready, navigate directly
                console.log('✅ Book already parsed in cache, opening directly');
                sessionStorage.setItem('currentBookId', bookId);
                window.location.href = './reader.html';
                return;
            }
        }
        
        // Store book data in sessionStorage for reader page
        // Need to fetch the full book data including fileData to parse chapters
        const { getBook } = await import('../storage/firestore-storage.js');
        let fullBook;
        
        // Try to get from Firestore if signed in, otherwise use cached book
        if (auth.currentUser) {
            try {
                fullBook = await getBook(bookId);
            } catch (error) {
                console.warn('Could not fetch book from Firestore, using cache:', error);
                fullBook = book;
            }
        } else {
            fullBook = book;
        }
        
        if (fullBook && (fullBook.fileData || fullBook.chunked)) {
            // Decode base64 and parse EPUB to get chapters
            const { EPUBParser } = await import('../core/epub-parser.js');
            const parser = new EPUBParser();
            
            let base64Data;
            
            // If data is chunked, reassemble it
            if (fullBook.chunked) {
                const { getBookChunks } = await import('../storage/firestore-storage.js');
                const userId = auth.currentUser.uid;
                const compressedData = await getBookChunks(userId, bookId, fullBook.totalChunks);
                
                // Decompress the reassembled data
                console.log('Decompressing book data...');
                const compressedBinary = atob(compressedData);
                const compressedBytes = new Uint8Array(compressedBinary.length);
                for (let i = 0; i < compressedBinary.length; i++) {
                    compressedBytes[i] = compressedBinary.charCodeAt(i);
                }
                const decompressed = pako.inflate(compressedBytes);
                
                // Convert to string using chunked approach
                base64Data = '';
                const chunkSize = 8192;
                for (let i = 0; i < decompressed.length; i += chunkSize) {
                    const chunk = decompressed.subarray(i, Math.min(i + chunkSize, decompressed.length));
                    base64Data += String.fromCharCode.apply(null, chunk);
                }
            } else {
                // Decompress if data was compressed
                base64Data = fullBook.fileData;
                if (fullBook.compressed) {
                    console.log('Decompressing book data...');
                    const compressedBinary = atob(base64Data);
                    const compressedBytes = new Uint8Array(compressedBinary.length);
                    for (let i = 0; i < compressedBinary.length; i++) {
                        compressedBytes[i] = compressedBinary.charCodeAt(i);
                    }
                    const decompressed = pako.inflate(compressedBytes);
                    
                    // Convert to string using chunked approach to avoid call stack limit
                    base64Data = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < decompressed.length; i += chunkSize) {
                        const chunk = decompressed.subarray(i, Math.min(i + chunkSize, decompressed.length));
                        base64Data += String.fromCharCode.apply(null, chunk);
                    }
                }
            }
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            
            const parsed = await parser.parse(arrayBuffer);
            
            // Store parsed book in IndexedDB for reader to access
            if (this.cacheInitialized) {
                await this.localDb.saveBook({
                    id: bookId,
                    title: book.title || 'Unknown Title',
                    author: book.author || 'Unknown Author',
                    chapters: parsed.chapters,
                    images: parsed.images ? Array.from(parsed.images.entries()) : [],
                    parsedData: true // Flag to indicate this has parsed data
                });
            }
            
            // Store only book ID in sessionStorage (avoid quota issues)
            sessionStorage.setItem('currentBookId', bookId);
            window.location.href = './reader.html';
        } else {
            alert('Book data not found. Please re-import the book.');
        }
    }

    async deleteBook(bookId) {
        if (!confirm('Delete this book?')) return;
        
        try {
            // Delete from Firestore if signed in
            if (auth.currentUser) {
                await deleteBook(bookId);
            }
            
            // Also delete from local cache
            if (this.cacheInitialized) {
                await this.localDb.deleteBook(bookId);
            }
            
            // Reload the library
            await this.loadBooks();
            this.displayBooks();
            
            this.showToast('Book deleted successfully', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Failed to delete book: ' + error.message, 'error');
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
}