# BooksWithMusic 📚🎵

A modern web-based EPUB reader with **AI-powered music selection** that automatically pairs instrumental music with your reading experience. The app analyzes each chapter's mood and selects appropriate background music to enhance your reading.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or on Windows, double-click:
start.bat
```

The app will open automatically at `http://localhost:5173/`

### First Steps

1. **Import a Book**: Click "Import Book" and select an EPUB file
2. **Start Reading**: The book opens with the first chapter
3. **Enjoy Music**: Music automatically plays based on chapter mood
4. **Customize**: Click ⚙️ Settings to adjust fonts, themes, page density, and music

## ✨ Features

### Reading Experience
- 📖 **Modern EPUB Reader** - Clean, distraction-free reading interface
- 📄 **Page-Based Navigation** - Smooth horizontal page flip animations
- 🎨 **Customizable Display** - Adjust font size, line height, page width, and density
- 🌓 **Multiple Themes** - Light, dark, and sepia color schemes
- 🔍 **Chapter Navigation** - Quick jump to any chapter via sidebar
- 💾 **Auto-Save Progress** - Remembers your position across sessions

### Music Integration
- 🤖 **AI Mood Analysis** - Automatically detects chapter emotions (10 mood types)
- 🎵 **Smart Music Pairing** - Matches instrumental tracks to reading atmosphere
- 🎧 **Seamless Playback** - Smooth crossfading between tracks
- 📊 **Music Panel** - View and manage track queue for current chapter
- 🔄 **Intelligent Switching** - Music adapts as you read through different moods

### Technical Features
- 💾 **Offline Support** - Works without internet via Service Worker
- 📱 **Responsive Design** - Adapts to desktop, tablet, and mobile
- 🗄️ **IndexedDB Storage** - Efficient local book library
- ⚡ **Fast Performance** - Optimized page splitting and rendering

### Cloud Features (Optional)
- 🔐 **Google Authentication** - Secure sign-in with Google account
- ☁️ **Cloud Sync** - Settings and reading progress synced across devices
- 📦 **Cloud Storage** - Store EPUBs in the cloud (Firebase Storage)
- 🔒 **Private & Secure** - Each user's data is isolated and secure

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for setup instructions.

## 🔐 Firebase Setup (Optional)

BooksWithMusic can work entirely offline with local storage, or you can enable cloud features with Firebase:

### What You Get with Firebase:
- **User Authentication** - Sign in with your Google account
- **Settings Sync** - Your preferences sync across all devices
- **Cloud Book Storage** - Access your EPUBs from any device
- **Reading Progress** - Continue where you left off on any device
- **Private & Secure** - Your data is only accessible to you

### Quick Setup:
1. Create a free Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable Google Authentication
3. Set up Firestore Database and Storage
4. Add your Firebase config to `.env` file
5. Deploy to GitHub Pages or run locally

**📖 Full instructions:** See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for complete step-by-step guide.

### Privacy & Security:
- ✅ Your books and settings are **private to your account only**
- ✅ Firebase security rules prevent access to other users' data
- ✅ No server-side code - all operations run in your browser
- ✅ You can delete your data anytime by clearing your Firebase Storage
- ✅ App works offline - cloud features are progressive enhancements

**Note:** Firebase is completely optional. The app works perfectly without it using local storage (IndexedDB).

## 🎵 Music Setup

### Option 1: Demo Tracks (Default)
The app includes 4 demo tracks that work immediately:
- Peaceful Piano (calm/peaceful moods)
- Epic Adventure (epic/adventure moods)
- Dark Ambient (dark/atmospheric moods)
- Joyful Melody (happy/uplifting moods)

### Option 2: Freesound API (Recommended)
For unlimited music variety:

1. **Sign up** at [freesound.org](https://freesound.org/home/register/)
2. **Apply for API key** at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply/) (instant approval)
3. **In the app**: Settings → Music API → Paste your key → Save
4. Reload the page to use full music library

### Option 3: Your Own Music
1. Place MP3 files in `public/music/` folder
2. Update music URLs in settings or code

## 🧠 AI Mood Detection

The app analyzes chapter text and detects **10 mood types**:

| Mood | Icon | Music Style |
|------|------|-------------|
| Dark | 🌑 | Atmospheric, suspenseful, dramatic |
| Mysterious | 🔍 | Ethereal, ambient, enigmatic |
| Romantic | ❤️ | Emotional, piano, tender |
| Sad | 😢 | Melancholic, slow, emotional |
| Epic | ⚔️ | Orchestral, cinematic, powerful |
| Peaceful | ☮️ | Calm, ambient, serene |
| Tense | ⚡ | Suspenseful, tense, dramatic |
| Joyful | 😊 | Uplifting, cheerful, happy |
| Adventure | 🏝️ | Energetic, cinematic, dynamic |
| Magical | ✨ | Fantasy, mystical, ethereal |

**How it works:**
1. Scans chapter text for mood indicators (keywords, emotional language)
2. Assigns energy level (1-5) and tempo (slow/moderate/upbeat)
3. Maps mood to music tags (e.g., "dark" → "atmospheric", "tense")
4. Selects best-matching tracks from music library
5. Updates music as you navigate between chapters

## ⚙️ Settings & Customization

### Reading Settings
- **Font Size**: 14px - 28px
- **Line Height**: 1.4 - 2.2
- **Font Family**: Georgia, Arial, Courier, Times
- **Page Width**: 600px - 900px
- **Page Density**: 800 - 2000 characters per page
- **Auto-Calibrate**: Calculate optimal page size based on font/viewport

### Display Settings
- **Color Scheme**: Light, Dark, Sepia
- **Fullscreen Mode**: F11 or ⛶ button
- **Chapter Sidebar**: Toggle visibility

### Music Settings
- **Volume Control**: 0% - 100%
- **Crossfade Duration**: Smooth transitions between tracks
- **API Configuration**: Add Freesound API key

## 🐛 Debugging

### Text Not Showing?
Open browser console (F12) and check for:
- `📖 Loading chapter X/Y` - Chapter loaded?
- `📄 Splitting chapter` - Pages created?
- `🎨 renderCurrentPage()` - Content rendered?
- Check `contentLength` and `contentPreview` in logs

### Music Not Playing?
Check console for:
- `🔍 MusicAPI: Searching tracks` - API called?
- `📚 Using fallback demo tracks` - Demo tracks loaded?
- Network tab - Are music URLs loading?
- Try refreshing or checking internet connection

### Common Issues
- **No books showing**: Check IndexedDB in DevTools → Application tab
- **Settings not saving**: Clear localStorage and reload
- **Page turns not working**: Check console for animation errors

## 🔧 Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture details and development setup.

## 📄 License

This project is open source. Music attribution required for Freesound tracks (see individual track licenses).

---

**Built with ❤️ for book lovers who enjoy atmospheric music while reading.**