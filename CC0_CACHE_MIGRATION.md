# CC0 Cache Migration Guide

## Problem
Existing cached tracks in localStorage may contain non-CC0 licensed music from before the CC0-only filter was implemented.

## Solution
The system now automatically filters out non-CC0 tracks from cache, but you may want to manually clear the cache to force a fresh fetch of CC0-only tracks.

---

## Automatic Filtering (Already Implemented)

### When Loading from Cache
```javascript
// _loadFromCache() now filters out non-CC0 tracks
const cc0Tracks = data.tracks.filter(track => {
  const isCC0 = track.license?.type === 'CC0';
  if (!isCC0) {
    console.warn(`❌ Filtered non-CC0 track from cache: ${track.title}`);
  }
  return isCC0;
});
```

### When Saving to Cache
```javascript
// _saveToCache() now only caches CC0 tracks
const cc0Tracks = tracks.filter(track => {
  const isCC0 = track.license?.type === 'CC0';
  return isCC0;
});
```

### Fail-Safe in loadTracksFromAPI
```javascript
// Additional CC0 validation before using tracks
this.availableTracks = this.availableTracks.filter(track => {
  const isCC0 = track.license?.type === 'CC0';
  if (!isCC0) {
    console.warn(`❌ FAIL-SAFE: Filtered non-CC0 track: ${track.title}`);
  }
  return isCC0;
});
```

---

## Manual Cache Clearing

### Option 1: Via Browser Console
```javascript
// Clear music cache
localStorage.removeItem('music_tracks_cache');
console.log('✅ Music cache cleared');

// Reload the page to fetch fresh CC0 tracks
location.reload();
```

### Option 2: Via Music Manager API
```javascript
// If you have access to the musicManager instance
await musicManager.clearMusicCache();

// Reload tracks
await musicManager.loadTracksFromAPI();
```

### Option 3: Add UI Button (Recommended)
Add a button to the settings panel:

```javascript
// In settings.js or music-panel.js
const clearCacheButton = document.createElement('button');
clearCacheButton.textContent = '🗑️ Clear Music Cache';
clearCacheButton.onclick = async () => {
  if (confirm('Clear music cache and re-fetch CC0 tracks?')) {
    localStorage.removeItem('music_tracks_cache');
    alert('✅ Cache cleared! Reload the page to fetch fresh CC0 tracks.');
  }
};
```

---

## Console Output You'll See

### When Non-CC0 Tracks Are Found in Cache
```
⚠️ Filtered non-CC0 track from cache: Ambient Studies - III - Variation I (License: https://creativecommons.org/licenses/by-nc/4.0/)
⚠️ Removed 42 non-CC0 tracks from cache
⚠️ No CC0 tracks in cache, will re-fetch from API
🔍 No cached tracks found, fetching from API...
```

### When CC0 Tracks Are Loaded
```
✅ Loaded 50 CC0-licensed tracks from cache
```

### When Tracks Are Fetched from API
```
🔍 Checking license for "Peaceful Piano": Creative Commons 0
✅ CC0 confirmed: Peaceful Piano
🔍 Checking license for "Epic Orchestra": Attribution
❌ Filtered out non-CC0 sound: Epic Orchestra (License: Attribution)
...
✅ Final result: 47 CC0-licensed tracks ready for playback
✅ Final track count: 47 CC0-licensed tracks
✅ Cached 47 CC0-licensed tracks to localStorage
```

---

## Migration Steps

### For Development
1. Open browser console (F12)
2. Run: `localStorage.removeItem('music_tracks_cache')`
3. Reload the page
4. Verify all tracks are CC0 in console logs

### For Users
1. Add a "Clear Cache" button in the settings panel
2. Display a notification when non-CC0 tracks are filtered from cache
3. Automatically prompt users to reload if significant tracks are filtered

---

## Verification

### Check Current Cache
```javascript
// In browser console
const cache = JSON.parse(localStorage.getItem('music_tracks_cache'));
console.log('Total cached tracks:', cache?.tracks?.length);
console.log('CC0 tracks:', cache?.tracks?.filter(t => t.license?.type === 'CC0').length);
console.log('Non-CC0 tracks:', cache?.tracks?.filter(t => t.license?.type !== 'CC0').length);
```

### Expected Result After Migration
```
Total cached tracks: 50
CC0 tracks: 50
Non-CC0 tracks: 0
```

---

## Files Modified

1. **`js/core/music-manager.js`**
   - `_loadFromCache()` - Filters non-CC0 tracks when loading
   - `_saveToCache()` - Only caches CC0 tracks when saving
   - `loadTracksFromAPI()` - Fail-safe CC0 validation before use
   - `clearMusicCache()` - New function to manually clear cache

2. **`js/core/music-api.js`** (Already done)
   - API-level CC0 filtering
   - Runtime fail-safe filtering
   - License logging

3. **`js/ui/music-panel.js`** (Already done)
   - Track usage logging
   - No non-CC0 tracks can be played

---

## Long-Term Solution

### Cache Versioning
Consider adding version to cache:

```javascript
const CACHE_VERSION = 2; // Increment when schema changes

async _saveToCache(tracks) {
  const cacheData = {
    version: CACHE_VERSION,
    tracks: cc0Tracks,
    timestamp: Date.now()
  };
  localStorage.setItem('music_tracks_cache', JSON.stringify(cacheData));
}

async _loadFromCache() {
  const data = JSON.parse(cached);
  
  // Invalidate cache if version mismatch
  if (data.version !== CACHE_VERSION) {
    console.log('Cache version mismatch, invalidating...');
    localStorage.removeItem('music_tracks_cache');
    return null;
  }
  
  // ... rest of code
}
```

This would automatically clear the cache when you deploy CC0-only updates.

---

## Status
✅ **Automatic CC0 filtering implemented**  
✅ **Fail-safe validation in multiple layers**  
✅ **Cache clearing function added**  
⚠️ **User action required: Clear cache manually or reload page**

---

**Last Updated:** 2024
**Status:** Production-Ready with Manual Migration Required
