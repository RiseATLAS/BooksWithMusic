# 🎵 Spotify Integration Architecture

**Document Version:** 1.0  
**Last Updated:** January 21, 2026  
**Status:** In Development

---

## 📋 Overview

BooksWithMusic supports **two music sources** for adaptive soundtrack generation:

1. **Freesound API** (Default) - Free, CC0-licensed music, embedded playback
2. **Spotify API** (Premium) - Professional catalog, external playback control

Users can toggle between sources in settings. Both sources use the same mood analysis system.

---

## 🏗️ Architecture

### Dual-Source Design Pattern

```
┌─────────────────────────────────────────────────┐
│                   User Settings                  │
│         [Toggle: Freesound / Spotify]           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│           music-api-factory.js                   │
│  (Returns FreesoundAPI or SpotifyAPI)           │
└──────────────┬──────────────┬───────────────────┘
               │              │
    ┌──────────▼─────┐   ┌───▼────────────┐
    │ freesound-api  │   │  spotify-api   │
    │      .js       │   │      .js       │
    └────────┬───────┘   └────┬───────────┘
             │                │
    ┌────────▼────────┐  ┌────▼──────────────┐
    │  audio-player   │  │ spotify-player    │
    │    .js (HTML5)  │  │ .js (Web API)     │
    └─────────────────┘  └───────────────────┘
             │                │
    ┌────────▼────────────────▼───────────────┐
    │        music-manager.js                  │
    │   (Orchestrates everything)              │
    └──────────────────┬───────────────────────┘
                       │
              ┌────────▼─────────┐
              │  mood-processor  │ ← UNCHANGED
              │      .js         │
              └──────────────────┘
```

---

## 📂 File Structure

### ✅ Unchanged Files (No modifications)
- `js/core/mood-processor.js` - Mood/theme detection (works for both APIs)
- `js/core/epub-parser.js` - EPUB parsing
- `js/core/ai-processor.js` - AI integration
- `js/ui/library.js` - Book library

### 🔄 Modified Files
- `js/core/music-manager.js` - Refactored to use factory pattern
- `js/core/music-api.js` - Renamed to `freesound-api.js`
- `js/ui/music-panel.js` - Support for dual sources
- `js/ui/settings.js` - Added Spotify authentication UI
- `js/ui/reader.js` - Pass music source preference
- `js/storage/indexeddb.js` - Store Spotify tokens
- `js/storage/firestore-storage.js` - Store music source preference

### 🆕 New Files

#### Core API Files
- `js/core/freesound-api.js` - Freesound-specific implementation (renamed)
- `js/core/spotify-api.js` - Spotify API integration
- `js/core/spotify-player.js` - Spotify playback control
- `js/core/music-api-factory.js` - Factory pattern for API selection

#### Authentication
- `js/auth/spotify-auth.js` - OAuth 2.0 flow for Spotify

#### Mappers
- `js/mappers/spotify-mapper.js` - Convert mood data to Spotify parameters

---

## 🔌 API Interfaces

### Common Music API Interface

Both `FreesoundAPI` and `SpotifyAPI` implement:

```javascript
class MusicAPI {
  // Search for tracks matching mood/keywords
  async searchTracks(keywords, limit)
  
  // Check if API is configured/authenticated
  isConfigured()
  
  // Get all available tracks for a book
  async getAllTracksForBook(bookAnalysis)
}
```

### Player Interface

Both players implement:

```javascript
class Player {
  // Playback controls
  async play(track)
  async pause()
  async stop()
  async skipToNext()
  async skipToPrevious()
  
  // State queries
  isPlaying()
  getCurrentTrack()
  
  // Volume control (Freesound only)
  setVolume(level)
}
```

---

## 🎯 Mood → Spotify Mapping

### Energy Levels (1-5 → 0.0-1.0)
```
App Energy  Spotify Energy  Description
    1          0.2          Very calm
    2          0.4          Calm
    3          0.6          Moderate
    4          0.8          Energetic
    5          1.0          Very energetic
```

### Tempo Mapping
```
App Tempo   Spotify BPM Range
slow        60-90 BPM
medium      90-120 BPM
fast        120-180 BPM
```

### Valence (Happiness/Positivity)
```
Mood         Valence    Description
dark         0.1-0.3    Very negative/dark
sad          0.2-0.4    Melancholic
mysterious   0.3-0.5    Neutral/enigmatic
tense        0.4-0.6    Anxious
peaceful     0.5-0.7    Calm/content
romantic     0.6-0.8    Warm/positive
joyful       0.7-0.9    Happy
epic         0.5-0.7    Triumphant (varies)
```

### Genre Mapping

#### Cultural Themes
```
App Theme        Spotify Genres
viking           "nordic folk", "epic", "cinematic"
celtic           "celtic", "irish folk", "scottish"
eastern          "asian", "world", "oriental"
middle-eastern   "middle eastern", "arabic", "world"
pirate           "sea shanty", "folk", "adventure"
western          "western", "americana", "country"
```

#### Musical Eras
```
App Era          Spotify Genres
baroque          "baroque", "classical", "early music"
classical        "classical", "orchestral"
romantic         "romantic classical", "piano"
jazz             "jazz", "swing", "blues"
renaissance      "renaissance", "medieval", "early music"
```

#### Time Periods
```
App Period       Spotify Genres
ancient          "epic", "world", "ancient"
medieval         "medieval", "renaissance", "folk"
victorian        "classical", "chamber music"
noir             "jazz", "blues", "film noir"
```

---

## 🔐 Spotify Authentication Flow

### OAuth 2.0 Authorization Code Flow

```
1. User clicks "Connect Spotify" in settings
   ↓
2. Redirect to Spotify authorization page
   https://accounts.spotify.com/authorize?
     client_id=YOUR_CLIENT_ID&
     response_type=code&
     redirect_uri=YOUR_REDIRECT_URI&
     scope=user-modify-playback-state user-read-playback-state
     playlist-modify-public playlist-modify-private
   ↓
3. User logs in and authorizes
   ↓
4. Spotify redirects back with auth code
   YOUR_REDIRECT_URI?code=AUTHORIZATION_CODE
   ↓
5. Exchange code for access token
   POST https://accounts.spotify.com/api/token
   ↓
6. Store access token (expires in 1 hour)
   Store refresh token (never expires)
   ↓
7. Use access token for API calls
   ↓
8. When expired, refresh automatically
   POST https://accounts.spotify.com/api/token
```

### Required Scopes
- `user-modify-playback-state` - Control playback (play/pause/skip)
- `user-read-playback-state` - Read current playback state
- `playlist-modify-public` - Create public playlists
- `playlist-modify-private` - Create private playlists
- `user-read-currently-playing` - Get currently playing track

---

## 🎮 Playback Control

### Freesound (Current)
- Direct HTML5 Audio element
- Plays audio file URLs directly
- Local volume control
- Caching supported (IndexedDB)

### Spotify (New)
- Spotify Web API (Spotify Connect)
- Controls user's active Spotify device
- Volume controlled in Spotify app
- No caching (streams from Spotify)

### Shift Point Handling

When user reaches a mood shift point while reading:

**Freesound:**
```javascript
audioPlayer.play(nextTrack.url)
```

**Spotify:**
```javascript
spotifyPlayer.playTrack(nextTrack.uri)
// or
spotifyAPI.skipToNext()
```

---

## 🔄 Track Selection Algorithm

### Common Flow (Both APIs)

1. **Book Analysis** (mood-processor.js)
   - Analyze all chapters
   - Detect dominant mood, themes, energy
   - Generate keywords

2. **Track Search**
   - Freesound: Text search with filters
   - Spotify: Recommendations API with audio features

3. **Track Scoring**
   - Match keywords/genres
   - Match energy level
   - Match tempo
   - Sort by score

4. **Track Mapping**
   - Assign 1-5 tracks per chapter based on length
   - Calculate shift points (mood changes)
   - Map tracks to shift points

### Spotify-Specific Enhancements

Spotify provides more precise matching:

```javascript
// Example: "epic" mood chapter
{
  seed_genres: ["cinematic", "orchestral", "epic"],
  target_energy: 0.85,           // High energy
  target_valence: 0.6,           // Triumphant
  target_instrumentalness: 0.8,  // Mostly instrumental
  target_tempo: 120,             // Moderate-fast tempo
  min_duration_ms: 180000,       // Min 3 minutes
  max_duration_ms: 360000        // Max 6 minutes
}
```

---

## ⚙️ Configuration

### Settings Structure

```javascript
{
  // Music source selection
  musicSource: "freesound" | "spotify",  // Default: "freesound"
  
  // Existing settings (both sources)
  musicEnabled: true,
  autoPlay: true,
  songsPerChapter: 5,
  minSongsPerPages: 1,
  instrumentalOnly: true,
  maxEnergyLevel: 3,
  
  // Spotify-specific
  spotifyConnected: false,
  spotifyAccessToken: null,     // Stored securely in IndexedDB
  spotifyRefreshToken: null,    // Stored securely in IndexedDB
  spotifyTokenExpiry: null,
  spotifyDeviceId: null         // User's preferred playback device
}
```

### Environment Variables

Create `.env` file (not in git):
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:8080/callback
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation ✅
- Create this documentation
- Update README.md
- Add responsibility comments to existing files

### Phase 2: API Abstraction
- Create `music-api-factory.js`
- Rename `music-api.js` → `freesound-api.js`
- Refactor `music-manager.js`

### Phase 3: Spotify Authentication
- Create `spotify-auth.js`
- Add OAuth flow
- Token management

### Phase 4: Spotify API
- Create `spotify-mapper.js`
- Create `spotify-api.js`
- Implement search/recommendations

### Phase 5: Spotify Playback
- Create `spotify-player.js`
- Integrate with music-manager
- Handle shift points

### Phase 6: UI Updates
- Update `music-panel.js`
- Update `settings.js`
- Add source indicators

### Phase 7: Testing & Polish
- Test both sources
- Error handling
- User feedback

---

## ⚠️ Known Limitations

### Spotify Integration
1. **Requires Spotify Premium** - Free users cannot use this feature
2. **No Offline Mode** - Requires internet connection
3. **External Playback** - Music plays in Spotify app, not embedded
4. **Device Required** - User must have active Spotify device
5. **Manual Control** - User can skip tracks in Spotify, breaking sync
6. **Rate Limits** - API calls are limited (should be fine for personal use)

### Freesound Integration
1. **Limited Catalog** - ~500K tracks vs. Spotify's 100M+
2. **Variable Quality** - Community-uploaded content
3. **Tagging Inconsistency** - User-generated tags vary in quality

---

## 🧪 Testing Checklist

### Freesound (Regression Testing)
- [ ] Music still plays with Freesound
- [ ] Shift points work correctly
- [ ] Caching works
- [ ] Offline mode works
- [ ] All moods find appropriate tracks

### Spotify Integration
- [ ] OAuth login flow works
- [ ] Token refresh works automatically
- [ ] Track search returns relevant results
- [ ] Playback control works (play/pause/skip)
- [ ] Shift points trigger track changes
- [ ] Device selection works
- [ ] Error messages are user-friendly

### Source Switching
- [ ] Can switch from Freesound to Spotify
- [ ] Can switch from Spotify to Freesound
- [ ] Settings persist across sessions
- [ ] No data loss when switching

### Edge Cases
- [ ] No Spotify Premium → Show helpful message
- [ ] No active device → Prompt user to open Spotify
- [ ] Token expired → Auto-refresh works
- [ ] Network error → Graceful fallback
- [ ] API rate limit → Show message, don't crash

---

## 📚 References

### Spotify API Documentation
- [Web API Reference](https://developer.spotify.com/documentation/web-api)
- [Authorization Guide](https://developer.spotify.com/documentation/general/guides/authorization/)
- [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/)
- [Get Recommendations](https://developer.spotify.com/documentation/web-api/reference/get-recommendations)
- [Audio Features](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)

### Related Files
- See `README.md` for general app documentation
- See individual file headers for specific responsibilities

---

## 🤝 Contributing

When modifying files related to Spotify integration:

1. **Read the file header comments** for responsibilities
2. **Reference this document** for architecture decisions
3. **Update this document** if making architectural changes
4. **Test both music sources** to avoid regressions
5. **Keep interfaces consistent** between APIs

---

*This document is the single source of truth for Spotify integration architecture.*
