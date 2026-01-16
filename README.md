# BooksWithMusic

A web-based EPUB reader with **AI-powered music selection** that automatically pairs instrumental music with your reading experience. The app analyzes each chapter's mood and vibe, then selects appropriate background music to match the emotional tone of what you're reading.

## 🚀 Quick Start

### 1. Setup Music (Required)

**Currently, music playback requires one of these options:**

**Option A: Use Freesound.org (Recommended)**
1. Sign up at https://freesound.org/apiv2/apply/
2. Get your API key
3. In the app: Settings → Music API → Add Freesound key

**Option B: Add Your Own Music**
1. Place MP3 files in `public/music/` folder
2. Update music URLs in settings

### 2. Start the App

1. **Double-click `start.bat`** OR run `npm run dev`
2. Browser opens automatically to http://localhost:5173/
3. Click "Import Book" and select an EPUB file
4. Click ▶️ play button to start music for the current chapter mood!

## ✨ Key Features

- 📚 **EPUB Reader**: Import and read EPUB books with a beautiful, modern interface
- 🤖 **AI Mood Detection**: Analyzes each chapter to detect mood (dark, romantic, epic, peaceful, etc.)
- 🎵 **Smart Music Pairing**: Automatically selects music matching the chapter's vibe
- 🎧 **Seamless Audio**: Crossfading between tracks for uninterrupted listening
- 🌓 **Theme Options**: Light, dark, and sepia themes
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🔳 **Fullscreen Mode**: Immersive reading with auto-hiding sidebar
- 💾 **Offline Support**: Works without internet after first load

## 🧠 How The AI Works

### Mood Detection Algorithm

When you import a book, the AI processor:

1. **Analyzes Chapter Content**: Scans text for mood indicators using keyword matching
2. **Detects 10 Mood Types**:
   - 🌑 **Dark**: Horror, thriller, suspense
   - 🔍 **Mysterious**: Mystery, secrets, unknown
   - ❤️ **Romantic**: Love, passion, tenderness
   - 😢 **Sad**: Grief, loss, melancholy
   - ⚔️ **Epic**: Battles, heroism, triumph
   - ☮️ **Peaceful**: Calm, serene, tranquil
   - ⚡ **Tense**: Danger, suspense, anxiety
   - 😊 **Joyful**: Happiness, celebration, delight
   - 🏞️ **Adventure**: Exploration, quests, journeys
   - ✨ **Magical**: Fantasy, supernatural, mystical

3. **Energy & Tempo Scoring**: Assigns 1-5 energy level and slow/moderate/upbeat tempo
4. **Music Tag Matching**: Maps mood → music tags (e.g., "dark" → "atmospheric", "tense", "dramatic")
5. **Track Selection**: Chooses best-matching track from library based on tags and energy
6. **Per-Chapter Assignment**: Each chapter gets its own mood-appropriate music

### Example Analysis Output

```
🤖 AI analyzing book "The Great Gatsby" with 9 chapters...
Chapter 1 (The Party): mysterious - Energy: 3/5
Chapter 2 (The Valley): sad - Energy: 2/5
Chapter 3 (Gatsby Revealed): romantic - Energy: 4/5
✓ AI analysis complete. Book mood: romantic
```

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

## 🎵 Music Setup

### Get Free Music with Freesound API

For unlimited music variety, get a **free Freesound API key**:

1. **Sign up** at [freesound.org](https://freesound.org/home/register/)
2. **Apply for API key** at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply/)
3. **In the app**: 
   - Open reader → Click ⚙️ Settings
   - Scroll down to "Freesound API Key"
   - Paste your key and click "Save"
   - Reload the page

**Benefits:**
- ✅ 100% Free with generous rate limits
- ✅ Thousands of CC-licensed music tracks
- ✅ High-quality audio (MP3 previews)
- ✅ AI automatically picks music matching chapter moods
- ✅ Real streaming URLs (no 403 errors)

### How Music Selection Works

1. **AI analyzes** each chapter's content
2. **Detects mood** (dark, romantic, epic, peaceful, etc.)
3. **Searches music library** for matching tags
4. **Scores tracks** by tag overlap + energy level
5. **Auto-plays** best matching track per chapter

**Example:**
```
Chapter: "The Dark Forest"
AI detects: mysterious, tense, dark
Music selected: "Atmospheric Suspense" (tags: mysterious, atmospheric, tense)
```

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

1. **Run the app**: Double-click `start.bat` OR run `npm run dev`
2. **Import Books**: Click "Import Book" and select `.epub` files
3. **Start Reading**: Click any book to open reader

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

### Firebase Setup (for Authentication & Storage)

This app uses Firebase for user authentication and cloud storage. Firebase configuration is managed through **GitHub repository secrets** for security:

1. **Create a Firebase Project**: Go to [Firebase Console](https://console.firebase.google.com/)
2. **Enable Authentication**: Enable Google Sign-In in Authentication settings
3. **Create Firestore Database**: Set up a Firestore database in your project
4. **Add GitHub Secrets**: In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:
   - `VITE_API_KEY` - Your Firebase API key
   - `VITE_AUTH_DOMAIN` - Your Firebase auth domain (e.g., `project-id.firebaseapp.com`)
   - `VITE_PROJECT_ID` - Your Firebase project ID
   - `VITE_STORAGE_BUCKET` - Your Firebase storage bucket (e.g., `project-id.appspot.com`)
   - `VITE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
   - `VITE_APP_ID` - Your Firebase app ID

5. **Deploy**: Push to main branch to trigger automatic deployment to GitHub Pages

### Optional API Keys

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
│   │   ├── audio-player.js      # Web Audio with crossfade
│   │   └── music-manager.js     # Track selection & caching
│   ├── storage/
│   │   ├── indexeddb.js         # Local database wrapper
│   │   └── cache-manager.js     # Audio file caching
│   ├── ui/
│   │   ├── reader.js            # Main reading interface
│   │   ├── library.js           # Book library
│   │   ├── settings.js          # Settings & navigation
│   │   └── music-panel.js       # Track display & override
│   └── main.js                  # App entry point
├── public/
│   ├── styles.css               # Glassmorphism styling
│   └── service-worker.js        # Offline support
├── index.html                   # Library view
├── reader.html                  # Reading interface
├── package.json                 # Dependencies
├── vite.config.js               # Dev server config
└── start.bat                    # Quick start script
```

**Quick Start:**

1. Clone/download this project
2. Open terminal in project folder
3. Run `npm install` (first time only)
4. Run `npm run dev` or double-click `start.bat`
5. Browser opens automatically to http://localhost:5173/
6. Click "Import Book" and select an EPUB file

## Troubleshooting

### Books Not Loading
- Ensure EPUB file is valid (test with Calibre)
- Check browser console for errors (F12)
- Try refreshing or clearing IndexedDB

### Music Not Playing
- **No music at all**: Add Freesound API key in settings. Check console for errors.
- **API key not working**: Verify key is correct at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply/)
- **Autoplay blocked**: Click play button manually (browser policy)
- **CORS errors**: Some music URLs may be blocked - try different tracks

### AI Analysis Not Working
- Check console for errors during import
- Try re-importing the book
- Clear IndexedDB and import again: `localStorage.clear()` in console

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