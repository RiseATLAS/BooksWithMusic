# Quick Reference

> **📄 Documentation Policy:** This project maintains exactly 4 MD files:
> - **README.md** - User guide, features, and getting started
> - **CHANGELOG.md** - All updates and fixes
> - **DEVELOPMENT.md** - Technical architecture and dev guide
> - **QUICK_REFERENCE.md** - Keyboard shortcuts and quick tips (this file)

## Keyboard Shortcuts

### Navigation
- `←` / `PageUp` - Previous page
- `→` / `PageDown` / `Space` - Next page
- `Home` - Jump to first chapter
- `End` - Jump to last chapter

### View Controls
- `F` / `F11` - Toggle fullscreen

### Music Controls
- `P` - Play/Pause music
- Music panel accessible via 🎵 button in reader
- Hardware media keys (play/pause/next/previous) also supported

## Settings Quick Guide

### Reading Settings
- **Font Size**: 12-24px (default: 16px)
- **Line Height**: 1.2-2.0 (default: 1.6)
- **Page Width**: 400-2000px (default: 650px)
- **Page Density**: 800-3000 chars/page (default: 1200)

### Auto-Calibration
Click **"Auto-Calibrate"** button in settings to automatically:
- Set optimal page width (68% of viewport)
- Calculate ideal character density
- Both values update instantly

### Display Options
- **Theme**: Light, Dark, Sepia
- **Page Color**: White, Cream, Gray, Black
- **Brightness**: 0-100%
- **Page Warmth**: 0-100% (warm tint overlay)

### Music Settings
- **Music Enabled**: Toggle background music
- **Auto-Play**: Start music automatically when opening book
- **Background Music Only**: Filter to background/instrumental/ambient music (default: ON)
- **Crossfade Duration**: 0-10 seconds
- **Page-Based Switching**: Intelligent music changes as you read

> **Note:** Changing the Background Music filter will clear the cache and reload all music tracks with the new filter.

## UI Controls

### Reader View
- **📑 Toggle Chapters** - Show/hide chapter sidebar
- **⚙️ Settings** - Open settings panel
- **🎵 Music Panel** - View playlist and controls
- **🏠 Home** - Return to library
- **⛶ Fullscreen** - Maximize reading area

### Music Panel Layout
Two-column design (820px wide):
- **Left Column (40%)**: Music settings
- **Right Column (60%)**: Current playlist with page numbers

### Chapter Sidebar
- Click chapter name to jump instantly
- Scroll to see all chapters
- Shows current chapter highlight

## Tips & Tricks

### Best Reading Experience
1. Use **Auto-Calibrate** for your screen size
2. Enable **Page Warmth** for night reading
3. Adjust **Crossfade Duration** for smooth music transitions
4. Use **Page-Based Switching** for dynamic music
5. Keep **Background Music Only** enabled for distraction-free reading

### Performance
- Music tracks cached for 24 hours (instant reload)
- Reading position auto-saves
- Offline mode available via Service Worker

### Troubleshooting
- **Blank pages?** Reduce page density or increase page width
- **Music not loading?** Check console for API errors, demo tracks available
- **Toggle chapters not working?** Fixed in latest update
- **Settings not saving?** Check browser localStorage permissions

## Color Sync
Home page and reader page automatically match your selected page color setting for consistent theming throughout the app.