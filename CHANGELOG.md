# Changelog

All notable changes to BooksWithMusic will be documented in this file.

## [1.3.0] - 2024 - Music Search Improvements

### Improved
- **Music Search Quality**: Major overhaul of Freesound API queries
  - Added explicit exclusion of SFX/foley/experimental tags
  - Expanded required tags to include conventional music genres (orchestral, piano, strings, etc.)
  - Added quality sorting (rating_desc) to prioritize well-rated tracks
  - Implemented new `searchByQuery()` method with OR logic for broader, better matches
  - Fixed music-manager to use correct search method with multi-term queries
  
- **AI Music Mapping**: Enhanced mood-to-music mappings
  - Added genre tags to all moods (e.g., 'orchestral', 'cinematic', 'soundtrack')
  - Increased tags per mood from 4 to 5+ descriptive terms
  - Added genres array to mapping for better search context
  - Chapter analysis now includes genre tags in music search
  
- **Better Results**: Users should see significantly fewer "weird" sound effects
  - Queries now cast wider net while maintaining quality
  - Prioritizes conventional background music over experimental audio
  - Results sorted by community rating
  
### Technical Changes
- Added `searchByQuery()` method in `music-api.js`
- Enhanced `searchFreesound()` with better filters and exclusions
- Updated `moodToMusicMapping` in `ai-processor.js` with genres
- Fixed `music-manager.js` to use `searchByQuery()` instead of incorrect method call
- Added detailed documentation in `MUSIC_SEARCH_IMPROVEMENTS.md`

## [1.2.0] - 2024 - Page Counter & Display Options

### Added
- **Page Counter Modes**: Toggle between full book page counter and chapter page counter
  - Settings toggle in Display Options section
  - Saves preference to localStorage and Firestore
  - Page indicator respects selected mode
  
- **Improved Display Options UI**: Checkboxes and calibrate button now in single row
  - Better visual layout in settings panel
  - More compact and professional appearance

### Fixed
- Auto-play persistence and initialization
- Playlist UI updates after energy level change
- Energy estimation now uses full 1-5 scale

## [1.1.0] - 2024 - Hardware Media Controls & UI Polish

### Added
- **Hardware Media Controls**: Play/pause/next/previous keys now work (Media Session API)
- **Improved Playlist UI**: 
  - More compact track items
  - Shows when each track will play (page number)
  - Displays mood shift information
  - Better visual hierarchy
  
### Fixed
- Volume slider position (moved inline with playback controls)
- Auto-play setting persistence across page reloads
- Profile button changed from Google image to "G" button
- Hardware controls now properly check isPlaying() state

## [1.0.0] - 2024 - Initial GitHub Pages Release

### Added
- **EPUB Reader**: Full-featured page-based reading experience
- **AI Mood Analysis**: Automatic chapter emotion detection (10 moods)
- **Music Integration**: Freesound API integration with mood-based selection
- **Firebase Backend**: 
  - Google Authentication
  - Cloud Storage for books
  - Firestore for settings and progress
  - Security rules for user privacy
  
- **Settings & Customization**:
  - Font size, line height, page width, density adjustments
  - Color themes (light, dark, sepia)
  - Music preferences (auto-play, crossfade, instrumental-only, max energy)
  - Calibration tool for optimal page sizing
  
- **Progress Tracking**:
  - Character offset-based progress restoration
  - Saves to Firestore when signed in
  - Works offline with localStorage cache
  - Cover images show reading progress
  
- **Music Features**:
  - Auto-play on page load and navigation
  - Crossfade between tracks
  - Energy level filtering
  - Mood shift detection
  - Playlist view with queue
  
- **Offline Support**:
  - Service Worker caching
  - IndexedDB for books and music
  - Works when signed out
  - Syncs when signing back in

### Technical
- Pure ES6 modules (no build tools)
- Firebase SDK from CDN
- JSZip for EPUB parsing
- Deployed on GitHub Pages
- No npm dependencies for runtime

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes, major features, architecture changes
- **Minor (1.X.0)**: New features, enhancements, non-breaking changes
- **Patch (1.0.X)**: Bug fixes, small improvements

## See Also

- **README.md** - User guide and getting started
- **DEVELOPMENT.md** - Technical architecture
- **FIREBASE_SETUP.md** - Firebase configuration
- **QUICK_REFERENCE.md** - Keyboard shortcuts and tips
- **MUSIC_SEARCH_IMPROVEMENTS.md** - Detailed music search documentation
