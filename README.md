# BooksWithMusic

A web-based EPUB reader that automatically pairs instrumental music with your reading experience. The app analyzes your book once, selects chapter-appropriate background music, and plays it deterministically as you read.

## 🚀 Super Simple Usage

### Just Open It (No Installation Required!)

1. **Double-click `index.html`** in the project folder
2. That's it! The app opens in your browser
3. Click "Import EPUB" and start reading

*No Node.js, no npm, no build step, no terminal - just open the HTML file!*

## How It Works

1. **EPUB Parsing**: Reads and analyzes EPUB files to extract text and metadata
2. **AI Music Selection**: Chooses background music tracks based on book content
3. **Audio Playback**: Plays music seamlessly as you read, with crossfading between tracks
4. **Offline Support**: Works without internet after initial load, using Service Worker

## Features

- 📚 **Read EPUB Files**: Import and read your favorite EPUB books
- 🎶 **Auto-generated Soundtracks**: Enjoy instrumental music that matches your book's mood
- 🎧 **Custom Audio Controls**: Play, pause, skip tracks, or change volume
- ⚙️ **Adjustable Settings**: Customize theme, font size, spacing, and music options
- 📱 **Mobile Friendly**: Read and listen on your phone or tablet

## Production Build

### Build for Deployment

```bash
npm run build
```

Output will be in `dist/` folder. Serve with any static file server:

```bash
# Using Python
python -m http.server --directory dist 8000

# Using Node.js 'serve'
npx serve dist

# Using any web server (nginx, Apache, etc.)
```

### Deploy to Web

The `dist/` folder can be deployed to:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag `dist/` folder to Netlify drop zone
- **GitHub Pages**: Push `dist/` to `gh-pages` branch
- **Your own server**: Upload `dist/` contents to web root

## How to Use

### First Time Setup

1. **Open the app**: Double-click `start.html` OR visit the deployed URL
2. **Import Books**: Click "Import EPUB" and select `.epub` files
3. **Wait for Analysis**: First import triggers AI analysis (30-60 seconds)
4. **Start Reading**: Click any book to open reader

*No configuration needed - everything works out of the box!*

### Reading Interface

- **Navigation**: Click arrows or use keyboard (←/→ or Page Up/Down)
- **Settings**: Click ⚙️ to adjust theme, font, size, spacing
- **Music Panel**: Click 🎵 to view current soundtrack and chapter tracks
- **Table of Contents**: Click book title to jump to chapters
- **Progress**: Bottom bar shows reading progress

### Music Controls

- **Auto-play**: Music starts automatically when entering chapters
- **Manual Control**: Click ⏸ to pause, ⏭ to skip tracks
- **Override Tracks**: Click any track in chapter pool to switch immediately
- **Rebuild**: Click "Rebuild" in music panel to regenerate AI soundtrack
- **Page-based Switching**: Enable in settings for more frequent changes

### Keyboard Shortcuts

- `←` / `→` - Previous/Next page
- `Space` - Next page
- `Shift+Space` - Previous page
- `Esc` - Close panels/overlays
- `M` - Toggle music panel
- `S` - Open settings
- `T` - Table of contents

### Offline Usage

After first load, the app works offline:
- Books are cached in IndexedDB
- Music files cached in browser Cache Storage
- Service Worker enables offline reading
- Sync happens automatically when online

## Configuration (Optional)

The app works perfectly without configuration. Only add these if you want external AI/music APIs:

```env
# Optional: For AI-powered music selection (otherwise uses smart defaults)
VITE_AI_API_KEY=your-anthropic-api-key

# Optional: For external music sources (otherwise uses bundled library)
VITE_MUSIC_API_KEY=your-music-api-key
```

**Default Behavior**: Uses local AI logic + bundled instrumental tracks. No API keys needed!

## Architecture

- **Frontend**: Vanilla JavaScript (ES6 modules) + Web Audio API + Service Worker
- **Storage**: IndexedDB (metadata, mappings) + Cache Storage (audio files)
- **AI Processing**: One-time per book, cached forever (unless rebuilt)
- **Music Sources**: Downloadable instrumental tracks from licensed APIs

## Project Structure

```
BooksWithMusic/
├── js/
│   ├── core/
│   │   ├── epub-parser.js       # EPUB → chapters/pages
│   │   ├── pagination.js        # Deterministic page calculation
│   │   ├── audio-player.js      # Web Audio with crossfade
│   │   ├── music-manager.js     # Track selection & caching
│   │   └── ai-processor.js      # One-time book/chapter analysis
│   ├── storage/
│   │   ├── indexeddb.js         # Local database wrapper
│   │   └── cache-manager.js     # Audio file caching
│   ├── ui/
│   │   ├── reader.js            # Main reading interface
│   │   ├── library.js           # Book library
│   │   ├── settings.js          # Settings & navigation
│   │   └── music-panel.js       # Track display & override
│   └── main.js                  # App entry point
├── index.html                   # Main app (just open this!)
├── styles.css
└── service-worker.js
```

**No build required!** Just pure JavaScript that runs in the browser.

## Troubleshooting

### Books Not Loading
- Ensure EPUB file is valid (test with Calibre)
- Check browser console for errors (F12)
- Try refreshing or clearing IndexedDB

### Music Not Playing
- Check browser autoplay policy (user interaction required)
- Verify audio files are downloaded (check Network tab)
- Try different browser (Chrome/Edge recommended)

### Slow Performance
- Clear browser cache if too many books
- Reduce crossfade duration in settings
- Disable page-based music switching

### Can't Access from Phone
- Ensure devices on same WiFi network
- Use `--host` flag when running dev server
- Check firewall isn't blocking port 5173

## Browser Support

- ✅ Chrome/Edge 90+ (Recommended - just double-click `index.html`)
- ✅ Firefox 88+ 
- ✅ Safari 14+
- ⚠️ Mobile browsers (autoplay restrictions may apply)

**Zero dependencies!** Pure vanilla JavaScript.

## Data Storage

All data stored locally in your browser:
- **IndexedDB**: Book content, chapter mappings, AI analysis, user settings
- **Cache Storage**: Audio files (managed by Service Worker)
- **LocalStorage**: UI preferences

**Privacy**: Nothing sent to external servers (except AI analysis if configured)

## Key Implementation Details

### Music Selection (AI)
- **Book-level vibe**: Mood tags, energy (1-5), genre/instrument constraints
- **Chapter pools**: 1-5 tracks per chapter (default 3)
- **Page switching**: Optional, rate-limited, minimum 60-120s intervals

### Playback Logic
- **On chapter entry**: Crossfade to chapter's track #0
- **On track end**: Rotate to next in chapter pool
- **Manual override**: User-pinned tracks take precedence

### Performance
- **No runtime AI**: All analysis cached after initial run
- **Preloading**: Next track always ready
- **Lazy loading**: Only load visible chapter + adjacent

### Storage Strategy
- **Metadata**: IndexedDB (book profiles, chapter mappings, user overrides)
- **Audio**: Cache Storage (current + next + chapter pool)
- **Library**: Object storage (S3/R2/B2) with signed URLs

## License

MIT License - Personal use project

## Music Sources

Ensure compliance with licensing terms:
- Store license metadata per track
- Maintain attribution when required
- Only use download-allowed sources

## Contributing

This is a personal project, but suggestions welcome via Issues!

## Roadmap

- [ ] Cloud sync (optional backend)
- [ ] Audiobook integration
- [ ] Social reading (share highlights)
- [ ] More music sources
- [ ] Mobile app (PWA)