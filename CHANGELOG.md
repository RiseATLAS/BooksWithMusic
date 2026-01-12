# Changelog

All notable changes and fixes to BooksWithMusic.

## Recent Updates (January 2026)

### Added
- **Page-based navigation system** with horizontal flip animations
- **Customizable page density** slider (800-2000 chars per page)
- **Auto-calibration button** for optimal page size based on viewport/font
- **Demo music tracks** - Works without API configuration (4 fallback tracks)
- **Comprehensive diagnostic logging** for debugging text and music issues
- **Intelligent music switching** within chapters (detects mood changes)
- **Bidirectional music navigation** - Music updates when going backwards too
- **CSS computed style verification** in render logging

### Fixed
- **Text rendering issues** - Added extensive logging to diagnose blank pages
- **Track loading** - Implemented fallback demo tracks from Bensound
- **Page navigation jumping chapters** - Reduced default chars per page to 1200
- **Navigation button transparency** - Proper pointer-events and z-index
- **Header overlay** - Fixed positioning and click-through issues
- **Gap between pages** - Proper CSS gap calculation
- **HTML structure** - Better handling of plain text vs formatted content
- **Null reference** - Fixed crashes when accessing undefined chapter data
- **Color scheme compatibility** - Reader respects system/user theme preferences
- **Syntax errors** - Fixed missing parentheses and variable references

### Improved
- **Page splitting algorithm** - Better sentence boundary detection
- **Music API caching** - Tracks cached by popularity for offline use
- **Settings persistence** - All settings saved to localStorage
- **Progress tracking** - Auto-save reading position every few seconds
- **Error messages** - More user-friendly error reporting
- **Console logging** - Emoji prefixes for easy log scanning

## System Architecture Changes

### Page System
**Before:** Scroll-based chapter reading
**After:** Page-array system with pre-rendered pages and animations

**Impact:** Smoother navigation, better mobile support, more book-like experience

### Music System  
**Before:** Single track per chapter, forward-only navigation
**After:** Track queue per chapter, intelligent switching, bidirectional support

**Impact:** Better music variety, mood adaptation, seamless experience

### Settings System
**Before:** Basic font/theme settings
**After:** Comprehensive customization including page density, auto-calibration

**Impact:** Users can fine-tune reading experience to their preferences

## Technical Debt Addressed

### Removed
- Excessive documentation files (30+ markdown files)
- Duplicate bug fix documentation
- Implementation notes scattered across files
- Redundant user guides

### Consolidated
- All docs into 4 files: README, DEVELOPMENT, CHANGELOG, ARCHITECTURE
- Better code comments instead of separate documentation
- Centralized debugging guide in DEVELOPMENT.md

### Code Quality
- Added extensive inline comments
- Improved error handling throughout
- Consistent logging format
- Better separation of concerns

## Known Issues

### Text Rendering
- Some EPUBs with complex HTML may not split perfectly
- Very large images can affect page sizing
- Plain text fallback could be improved

### Music
- Demo tracks limited to 4 (need API key for more)
- Crossfading not perfect on all browsers
- Track caching could be more aggressive

### Performance
- Large EPUBs (>1MB) slow to parse
- Chapter splitting could use Web Workers
- No pagination cache persistence (resets on reload)

## Future Improvements

### High Priority
- [ ] Persist page split cache to IndexedDB
- [ ] Add Web Worker for EPUB parsing
- [ ] Improve sentence splitting algorithm
- [ ] Add more demo tracks or integrate free music service
- [ ] Better error recovery for failed music loads

### Medium Priority
- [ ] Support for more EPUB features (footnotes, tables)
- [ ] Export reading statistics
- [ ] Social features (share quotes, progress)
- [ ] Accessibility improvements (screen reader support)
- [ ] Keyboard shortcuts guide

### Low Priority
- [ ] Custom music upload interface
- [ ] Playlist creation and management
- [ ] Reading goals and achievements
- [ ] Book recommendations based on mood preferences
- [ ] Multi-language support

## Breaking Changes

None. All updates are backwards compatible with existing book libraries and settings.

## Migration Notes

### From Scroll-Based to Page-Based (Automatic)
- Old progress positions are converted to page numbers
- Books are automatically re-paginated on first load
- No user action required

### Settings Schema (v1 → v2)
Added new settings:
- `pageDensity` (default: 1200)
- `pageWidth` (default: 650)
- `pageGap` (default: 48)

Old settings remain compatible.

---

**Note:** This is a living document. Check git history for detailed commit messages.
