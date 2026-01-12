# Development Guide

## Project Architecture

### Overview

BooksWithMusic is a vanilla JavaScript web application with a modular architecture:

```
Core Layer (Business Logic)
├── epub-parser.js      # Parses EPUB files → chapters
├── ai-processor.js     # Analyzes text → moods
├── music-api.js        # Fetches tracks from APIs
├── music-manager.js    # Orchestrates music selection
└── audio-player.js     # Controls playback & crossfading

UI Layer (User Interface)
├── library.js          # Book management & import
├── reader.js           # Reading interface & pagination
├── settings.js         # Settings panel & persistence
└── music-panel.js      # Music controls & track display

Storage Layer (Data Persistence)
├── indexeddb.js        # Book storage & progress
└── cache-manager.js    # Track caching
```

### Key Systems

#### 1. Page-Based Reading System

**How it works:**
- Chapters are split into pages based on character count (`charsPerPage` setting)
- Each page is pre-rendered HTML stored in `chapterPages` object
- Navigation uses CSS animations for smooth page flips
- Pages are cached per chapter for performance

**Key Code:**
```javascript
// In reader.js
splitChapterIntoPages(chapterContent, chapterTitle) {
  // Parses HTML, splits at element boundaries
  // Breaks large paragraphs by sentences
  // Returns array of HTML page strings
}

renderCurrentPage() {
  // Inserts current page HTML into DOM
  // Applies CSS animations
  // Updates navigation state
}
```

**Page Navigation Flow:**
```
User clicks → goToNextPage() → _flipToPage() → Animation → renderCurrentPage() → Update UI
```

#### 2. AI Mood Analysis

**Detection Process:**
1. Extract plain text from chapter HTML
2. Scan for mood keywords (weighted scoring)
3. Calculate energy level based on language intensity
4. Determine tempo from pacing indicators
5. Select primary mood and intensity score

**Mood Mapping:**
```javascript
// In ai-processor.js
const moodKeywords = {
  dark: ['shadow', 'fear', 'horror', 'nightmare', 'death'],
  romantic: ['love', 'heart', 'kiss', 'passion', 'tender'],
  epic: ['battle', 'hero', 'triumph', 'victory', 'glory'],
  // ... etc for all 10 moods
};
```

**Output Format:**
```javascript
{
  chapterIndex: 0,
  primaryMood: 'dark',
  intensity: 0.85,
  energy: 4,
  tempo: 'slow',
  keywords: ['shadow', 'fear', 'darkness']
}
```

#### 3. Music Selection & Playback

**Selection Algorithm:**
1. **Chapter Load** → Get chapter mood from AI analysis
2. **Track Search** → Query API with mood-mapped tags
3. **Filtering** → Match tracks by energy, tempo, tags
4. **Ranking** → Score tracks by relevance
5. **Queue Building** → Select top 3-5 tracks for chapter
6. **Playback** → Start first track, queue others

**Crossfading:**
```javascript
// In audio-player.js
async fadeToTrack(track, duration = 2000) {
  // 1. Start new track at 0 volume
  // 2. Fade out current track
  // 3. Simultaneously fade in new track
  // 4. Stop old track when fully faded
}
```

**Intelligent Chapter Switching:**
- Detects mood changes within long chapters
- Can trigger music changes mid-chapter at dramatic shifts
- Uses section analysis to find optimal switch points

#### 4. Storage & Caching

**IndexedDB Structure:**
```javascript
// Database: booksWithMusic
stores: {
  books: {           // Book library
    key: id,
    value: { id, title, author, data, currentChapter, ... }
  },
  analysis: {        // AI analysis cache
    key: bookId,
    value: { bookId, moodAnalysis, timestamp }
  },
  tracks: {          // Music track cache
    key: id,
    value: { id, title, artist, blob, metadata }
  }
}
```

**Cache Strategy:**
- Books: Store EPUB file as ArrayBuffer
- Analysis: Cache AI results to avoid re-processing
- Tracks: Cache popular tracks as Blobs for offline playback
- Settings: Use localStorage for instant access

### Data Flow

#### Book Import Flow
```
User selects file
  → FileReader reads as ArrayBuffer
  → EPUBParser extracts chapters & metadata
  → AIProcessor analyzes all chapters
  → Save to IndexedDB (book + analysis)
  → Update library UI
```

#### Reading Session Flow
```
Load book from IndexedDB
  → Restore progress (chapter + page)
  → Split current chapter into pages
  → Render current page
  → Initialize music for chapter mood
  → Load track queue
  → Start playback
```

#### Navigation Flow
```
User navigates (arrow, button, chapter list)
  → Update current position
  → Trigger page animation
  → Render new page content
  → Check if chapter changed
    → If yes: Load new chapter music
    → If no: Continue current track
  → Save progress to IndexedDB
```

## Development Setup

### Prerequisites
- Node.js 16+
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
# Opens at http://localhost:5173/
```

### Building
```bash
npm run build
# Output: dist/
```

### File Structure
```
BooksWithMusic/
├── index.html              # Entry point (library)
├── reader.html             # Reader page
├── package.json
├── vite.config.js          # Build configuration
├── start.bat              # Windows quick start
├── js/
│   ├── main.js            # App initialization
│   ├── core/              # Business logic
│   ├── ui/                # User interface
│   └── storage/           # Data layer
├── public/
│   ├── styles.css         # All styles (1100+ lines)
│   └── service-worker.js  # Offline support
└── docs/
    ├── README.md
    ├── DEVELOPMENT.md     # This file
    ├── CHANGELOG.md
    └── ARCHITECTURE.md
```

## Code Style

### Conventions
- **ES6 modules** - Use import/export
- **Classes for components** - Each UI/core component is a class
- **Async/await** - For all async operations
- **Console logging** - Extensive debug logs with emoji prefixes
- **Error handling** - Try-catch with user-friendly messages

### Logging Convention
```javascript
console.log('📖 Loading chapter...');      // Info
console.warn('⚠️ No API key configured'); // Warning
console.error('❌ Failed to load');       // Error
console.log('✓ Success!');                // Success
console.log('🎵 Music playing');          // Feature-specific
```

### Common Patterns

**Component Initialization:**
```javascript
class MyComponent {
  constructor(db) {
    this.db = db;
    this.state = {};
  }
  
  async initialize() {
    // Setup code
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Bind DOM events
  }
}
```

**Error Handling:**
```javascript
try {
  const result = await riskyOperation();
  this.showToast('Success!', 'success');
} catch (error) {
  console.error('❌ Operation failed:', error);
  this.showToast(`Error: ${error.message}`, 'error');
}
```

## Testing

### Manual Testing Checklist

**Book Import:**
- [ ] Upload EPUB file
- [ ] Check console for parsing logs
- [ ] Verify book appears in library
- [ ] Confirm AI analysis completes

**Reading:**
- [ ] Open book from library
- [ ] Verify text displays correctly
- [ ] Test page navigation (arrows, keys, buttons)
- [ ] Check chapter switching
- [ ] Verify progress saves

**Music:**
- [ ] Confirm tracks load for chapter mood
- [ ] Test play/pause
- [ ] Check volume control
- [ ] Verify crossfading works
- [ ] Test track skipping

**Settings:**
- [ ] Change font size
- [ ] Switch themes
- [ ] Adjust page density
- [ ] Test auto-calibration
- [ ] Verify settings persist

**Edge Cases:**
- [ ] Empty EPUB chapters
- [ ] Very long chapters (>10k chars)
- [ ] Books without metadata
- [ ] No internet connection
- [ ] No music API key

### Browser Testing
- Chrome/Edge (Chromium)
- Firefox
- Safari (WebKit)
- Mobile browsers (responsive)

## Debugging Tips

### Enable Verbose Logging
Check browser console - extensive logging is already built-in.

### Inspect Storage
**IndexedDB:**
1. Open DevTools → Application tab
2. IndexedDB → booksWithMusic
3. Browse stores: books, analysis, tracks

**LocalStorage:**
1. Application → Local Storage
2. Check: booksWithMusic-settings, freesound_api_key

### Common Issues

**Text not rendering:**
```javascript
// Check in console:
const reader = window.readerUI;
console.log('Current chapter:', reader.currentChapterIndex);
console.log('Pages:', reader.chapterPages[reader.currentChapterIndex]);
console.log('Content:', document.querySelector('.chapter-text'));
```

**Music not loading:**
```javascript
// Check in console:
console.log('Music manager:', window.musicManager);
console.log('Audio player:', window.audioPlayer);
// Check Network tab for failed requests
```

**Settings not saving:**
```javascript
// Check in console:
console.log(localStorage.getItem('booksWithMusic-settings'));
// Should show JSON with all settings
```

## Performance Optimization

### Current Optimizations
- **Lazy chapter splitting** - Only split current chapter, not all at once
- **Page caching** - Cache split pages per chapter
- **Music prefetching** - Load next track before current ends
- **IndexedDB for books** - Faster than re-parsing EPUBs
- **Analysis caching** - Don't re-analyze books
- **Debounced saves** - Batch progress updates

### Potential Improvements
- Virtual scrolling for huge chapters
- Web Workers for EPUB parsing
- Service Worker for complete offline mode
- Streaming music instead of full downloads
- Image lazy loading in EPUBs

## Adding Features

### Add a New Mood
1. Add to `ai-processor.js` moodKeywords
2. Add emoji mapping in `reader.js` getMoodEmoji()
3. Add music tags in `music-api.js` moodTagMapping
4. Update UI icon display

### Add a New Setting
1. Add to default settings in `settings.js`
2. Add UI control in `reader.html` settings panel
3. Add event listener in `settings.js` setupEventListeners()
4. Apply setting in relevant component
5. Test persistence (localStorage)

### Add a Music Source
1. Create API wrapper in `music-api.js`
2. Add authentication if needed
3. Map response to standard track format
4. Update getFallbackTracks or add new method
5. Test with various search queries

## Contributing

### Before Submitting
- Test in multiple browsers
- Check console for errors
- Verify no breaking changes
- Update documentation if needed
- Follow existing code style

### Code Review Focus
- Error handling
- User feedback (toasts, loading states)
- Performance impact
- Mobile compatibility
- Accessibility

---

**Questions?** Check the code - it's extensively commented!
