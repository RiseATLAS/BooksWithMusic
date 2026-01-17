# BooksWithMusic 📚🎵

A modern web-based EPUB reader with **AI-powered music selection** that automatically pairs instrumental music with your reading experience. The app analyzes each chapter's mood and selects appropriate background music to enhance your reading.

**⚖️ Music Compliance:** All music tracks are CC0-licensed (Creative Commons Zero) from Freesound. Full track usage logging and legal compliance built-in.

**🌐 Live App:** https://riseatlas.github.io/BooksWithMusic/

## 🚀 Quick Start

### Use the Live App

**🌐 https://riseatlas.github.io/BooksWithMusic/**

No installation needed! Just visit the link and start reading.

### First Steps

1. **Sign In**: Click "Sign In with Google" (top right) to enable cloud sync
2. **Import a Book**: Click "Import Book" and select an EPUB file
3. **Start Reading**: The book opens with the first chapter
4. **Enjoy Music**: Music automatically plays based on chapter mood
5. **Customize**: Click ⚙️ Settings to adjust fonts, themes, page density, and music

### Running Locally (For Development)

```bash
# Clone the repository
git clone https://github.com/RiseATLAS/BooksWithMusic.git
cd BooksWithMusic

# Start a local server (choose one):
python3 -m http.server 8080
# OR use VS Code Live Server extension

# Open http://localhost:8080
```

⚠️ **Important**: Don't open `index.html` directly - ES6 modules require a server!

## 📦 Project Structure

```
BooksWithMusic/
├── index.html          # Main library page
├── reader.html         # Book reader page
├── styles.css          # All styles
├── service-worker.js   # Offline support
├── js/
│   ├── main.js         # App entry point
│   ├── auth/           # Firebase authentication
│   ├── config/         # Firebase configuration
│   ├── core/           # Core functionality (EPUB, music, AI)
│   ├── storage/        # Firebase Storage & Firestore
│   └── ui/             # UI components
└── README.md           # This file
```

**Tech Stack:**
- Pure JavaScript (ES6 modules) - no build tools
- JSZip from CDN (for EPUB parsing)
- Firebase SDK from CDN (Auth, Firestore, Storage)
- Hosted on GitHub Pages

## ✨ Features

### Reading Experience
- 📖 **Modern EPUB Reader** - Clean, distraction-free reading interface
- 📄 **Page-Based Navigation** - Smooth horizontal page flip animations
- 🎨 **Customizable Display** - Adjust font size, line height, page width, and density
- 🌓 **Multiple Themes** - Light, dark, and sepia color schemes
- 🔍 **Chapter Navigation** - Quick jump to any chapter via sidebar
- 💾 **Progress Tracking** - Automatically saves your reading position

### Cloud Features (Firebase)
- 🔐 **Google Authentication** - Secure sign-in with your Google account
- 📋 **Terms of Service** - First-time users must accept ToS before creating account
- ☁️ **Cloud Storage** - Books stored securely in Firebase Storage
- 🔄 **Cross-Device Sync** - Access your library from any device
- ⚙️ **Settings Sync** - Preferences synced across all your devices
- 🔒 **Private & Secure** - Your data is only accessible to you
- 👥 **User Cap** - 20 user maximum for friends & family use

### Music Integration
- 🤖 **AI Mood Analysis** - Automatically detects chapter emotions (10 mood types)
- 🎵 **Smart Music Pairing** - Matches instrumental tracks to reading atmosphere
- 🎧 **Seamless Playback** - Smooth crossfading between tracks
- 📊 **Music Panel** - View and manage track queue for current chapter
- 🔄 **Dynamic Switching** - Music adapts as you read through different moods
- 🎯 **Enhanced Search** - High-quality instrumental music from Freesound
- ⚙️ **Customizable Filters** - Toggle instrumental-only mode and set max energy level
- ⚖️ **CC0 Compliance** - Only CC0-licensed music, fully logged for legal compliance
- 👥 **Private Use** - 20 user registration cap for friends & family

### Technical Features
- 🌐 **Runs on GitHub Pages** - No server required, hosted for free
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- ⚡ **Fast Performance** - Optimized page splitting and rendering
- � **No Build Step** - Pure JavaScript (ES6 modules), no npm required

## 🔐 Firebase Setup

**Required for the app to work!** BooksWithMusic uses Firebase for:
- **Authentication**: Google Sign-In (20 user cap enforced)
- **Storage**: Store your EPUB files in the cloud
- **Firestore**: Sync settings, reading progress, and track usage logs

### Quick Setup:
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable Google Authentication
3. Set up Firestore Database (create `users` and `trackUsage` collections)
4. Set up Storage with security rules
5. Add your Firebase config to `js/config/firebase-config.js`
6. Push to GitHub - your changes go live automatically!

### Security Rules (Firestore):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /trackUsage/{usageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Privacy & Security:
- ✅ Your books and settings are **private to your account only**
- ✅ Terms of Service acceptance required on first login
- ✅ Firebase security rules prevent access to other users' data
- ✅ Track usage logged for legal compliance
- ✅ 20 user registration cap for friends & family use
- ✅ User confirms they own or are legally entitled to upload content

## 🌐 Deployment

**Currently deployed at:** https://riseatlas.github.io/BooksWithMusic/

The app runs on GitHub Pages and updates automatically when you push to the `main` branch.

### Update the Live Site

```bash
# Make your changes to the code
git add .
git commit -m "Your commit message"
git push origin main

# GitHub Pages rebuilds automatically (takes 1-2 minutes)
```

**Check deployment status:**
- Actions: https://github.com/RiseATLAS/BooksWithMusic/actions
- Settings: https://github.com/RiseATLAS/BooksWithMusic/settings/pages

### Deploy Your Own Copy

1. **Fork this repository** on GitHub
2. **Go to Settings → Pages**
3. **Set source:** Branch `main`, Folder `/ (root)`
4. **Save** and wait 1-2 minutes
5. **Access at:** `https://YOUR-USERNAME.github.io/BooksWithMusic/`
6. **Configure Firebase** with your own project (see FIREBASE_SETUP.md)

### Other Hosting Options

**Netlify / Vercel / Cloudflare Pages:**
- Connect your GitHub repo
- Build command: (none - no build needed!)
- Publish directory: `/`
- Deploy!

**Any static file hosting works** - just upload the files!


## 🎵 Music Setup

### Freesound API (Required)
The app uses CC0-licensed music from Freesound:

1. **Sign up** at [freesound.org](https://freesound.org/home/register/)
2. **Apply for API key** at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply/) (instant approval)
3. **In the app**: Settings → Music API → Paste your key → Save
4. Music will automatically load CC0-licensed tracks

### Legal Compliance
- ✅ Only CC0 (Creative Commons Zero) tracks are used
- ✅ All track usage is logged to Firebase (Freesound ID, license, source URL, timestamp)
- ✅ No attribution required for CC0, but full documentation maintained
- ✅ 20 user cap for friends & family use (names stored for verification)

## 📋 Terms of Service

### First-Time Login
When you sign in for the first time, you'll be asked to accept the Terms of Use:

1. **Automatic Prompt**: A modal appears before account creation
2. **Must Accept**: You must click "Accept & Continue" to proceed
3. **Stored in Firestore**: Your acceptance is recorded with timestamp
4. **One-Time Only**: Existing users won't see this again (unless terms are updated)

### What You're Agreeing To

**User-Provided Content**: You confirm you own or are legally entitled to upload the ebooks you use.

**Limited License**: You grant the Service permission to store and process your content only for providing the Service to you.

**No Redistribution**: Your content is private and never shared with other users.

**Your Rights**: You remain the owner. The Service doesn't claim ownership of your content.

**Content Removal**: Content can be removed at your request or if there are legal concerns.

**"As Is" Service**: This is an experimental service provided without guarantees.

### Testing the ToS & User Cap

Edit `/js/auth/test-config.js` to toggle test modes:

```javascript
export const TEST_CONFIG = {
  // Show ToS modal to all users (even if already accepted)
  ALWAYS_SHOW_TOS: true,      // true = test ToS, false = normal
  
  // Simulate max users reached (blocks all registrations)
  SIMULATE_MAX_USERS: false,  // true = test user cap, false = normal
  
  // Allow existing users to bypass max users check
  ALLOW_EXISTING_USERS: true
};
```

**Test Scenarios:**
- `ALWAYS_SHOW_TOS: true, SIMULATE_MAX_USERS: false` → Test ToS modal
- `ALWAYS_SHOW_TOS: false, SIMULATE_MAX_USERS: true` → Test user cap message
- Both `false` → Production mode

### For Developers
- Terms acceptance is handled by `/js/auth/terms-of-service.js`
- User acceptance is stored in Firestore `users/{userId}` with fields:
  - `termsAccepted`: boolean
  - `termsVersion`: string (e.g., "1.0")
  - `termsAcceptedAt`: timestamp
- Update `TERMS_VERSION` in the module when terms change to re-prompt users
- ToS check happens BEFORE registration check in the flow

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
- **Fullscreen Mode**: F11, 'f' key, or ⛶ button
- **Chapter Sidebar**: Toggle visibility with ☰ button

### Music Settings
- **Enable/Disable Background Music**: Toggle music on/off
- **Auto-play Music**: Start playing automatically when opening a chapter
- **Dynamic Page-Based Music Switching**: Automatically change tracks as you read based on mood shifts (can be disabled for chapter-only changes)
- **Maximum Energy Level**: Limit music intensity (1=Very Calm to 5=All tracks)
- **Volume Control**: 0% - 100%
- **Crossfade Duration**: Smooth transitions between tracks (1-10 seconds)
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

This project is open source. All music tracks are CC0-licensed (Creative Commons Zero) from Freesound - no attribution required, but full usage logging maintained for legal compliance.

---

## ✅ Deployment & Functionality Checklist (Updated 18 January 2026)

### 1. GitHub Pages Hosting ✅ COMPLETE
- [x] Repository is public and accessible on GitHub
- [x] GitHub Pages is enabled (Settings → Pages → Source: `main` branch, root folder)
- [x] All app files in root directory (not in `/public`)
- [x] No build step or npm required (pure static files)
- [x] Site loads at: https://riseatlas.github.io/BooksWithMusic/
- [x] Empty `public/` folder removed (migration cleanup)

### 2. Firebase Configuration ✅ COMPLETE
- [x] Firebase project created and configured
- [x] Web app registered in Firebase project
- [x] Firebase config set in `js/config/firebase-config.js`
- [x] Google Authentication enabled
- [x] Firestore Database created (production mode)
- [x] Firebase Storage enabled (production mode)
- [x] Security rules configured (user-only access)
- [x] Authorized domain (`github.io`) added

### 3. Application Functionality ✅ COMPLETE
- [x] App loads without errors (all syntax errors fixed)
- [x] Google Sign-In with 20 user cap (names stored for verification)
- [x] Terms of Service acceptance required on first login
- [x] EPUB import works (upload and storage)
- [x] Books stored in Firebase Storage + cached in IndexedDB
- [x] Books load instantly from cache, sync with Firestore
- [x] Reading progress saved to Firestore (cloud sync)
- [x] Settings sync to Firestore on change (1-sec debounce)
- [x] Settings sync between devices (localStorage + Firestore)
- [x] Music panel controls working (API key, crossfade, max energy)
- [x] User profile menu with sign-out (reader page)
- [x] Service worker registered for offline support
- [x] CC0-only music filtering (all non-CC0 tracks blocked)
- [x] Track usage logging to Firebase (legal compliance)
- [x] Redundant console logging removed (clean UI feedback)

### 4. Recent Updates (18 January 2026) ✅
- [x] Terms of Service modal on first login (user must accept to create account)
- [x] ToS acceptance stored in Firestore with version tracking
- [x] CC0-only music compliance (strict filtering at API layer)
- [x] Track usage logging to Firebase (Freesound ID, license, source URL, timestamp)
- [x] 20 user registration cap with name storage
- [x] Removed all fallback/demo tracks
- [x] Removed redundant playlist console logging
- [x] Cache validation (only CC0 tracks cached)
- [x] Fail-safe: music only plays if CC0-licensed
- [x] Improved mood shift scoring (more nuanced, not all 100)

### 5. Privacy & Security ✅ COMPLETE
- [x] No secrets in public git history
- [x] User-only data access (security rules verified)
- [x] No analytics/tracking without consent

### 6. Documentation ✅ COMPLETE
- [x] README.md up to date
- [x] FIREBASE_SETUP.md complete
- [x] SECURITY.md documented
- [x] DEVELOPMENT.md has architecture
- [x] QUICK_REFERENCE.md has shortcuts

### 🔍 Testing Recommendations

1. **Music Compliance**: Verify all tracks are CC0 (check Firebase logs)
2. **User Cap**: Test 20 user registration limit
3. **Track Logging**: Check `trackUsage` collection in Firestore
4. **Cross-Device Sync**: Test on multiple devices
5. **Mobile**: Test iOS Safari, Android Chrome

### 📝 Deployment

1. Push changes: `git push origin main`
2. Wait for GitHub Pages deployment (1-2 min)
3. Test at https://riseatlas.github.io/BooksWithMusic/
