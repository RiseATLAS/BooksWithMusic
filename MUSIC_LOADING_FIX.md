# Music Loading & Rate Limiting Fixes

## Issues Resolved

### 1. Redundant Chapter Loading
**Problem:** The chapter was being loaded 3 times on startup:
1. In `initializeReader()`
2. From `loadChapter()` calling `onChapterChange()`
3. From `main.js` after music panel setup

**Solution:**
- Removed `onChapterChange()` call from `loadChapter()` method
- Music manager is now only triggered:
  - Once on initial load (from `main.js` after music panel is ready)
  - When navigating between chapters (from navigation methods)

### 2. "Missing Analysis or Chapter" Warning
**Problem:** `onChapterChange()` was being called before music manager finished initialization

**Solution:**
- Added check in `onChapterChange()` to verify `bookAnalysis` exists before proceeding
- Added `await this._musicInitPromise` before calling `onChapterChange()` in navigation methods
- Improved error messages to distinguish between "not yet initialized" vs "invalid chapter"

### 3. Freesound API Rate Limiting (429 Errors)
**Problem:** Making too many requests to Freesound API too quickly, resulting in 429 (Too Many Requests) errors

**Solution:**
- Added rate limiting with minimum 1 second between requests
- Implemented 60-second cooldown when 429 error is received
- Added intelligent fallback to demo tracks when rate limited
- Better logging to inform users why fallback tracks are being used

## Code Changes

### `/js/ui/reader.js`
```javascript
// Removed from loadChapter():
// if (this.musicManager) {
//   this.musicManager.onChapterChange(index);
// }

// Added to navigation methods:
async goToNextChapter() {
  // ... existing code ...
  if (this.musicManager && this._musicInitPromise) {
    await this._musicInitPromise;
    this.musicManager.onChapterChange(this.currentChapterIndex);
  }
}

// Same for goToPreviousChapter() and chapter click handler
```

### `/js/core/music-manager.js`
```javascript
onChapterChange(chapterIndex) {
  // Check if music manager is fully initialized
  if (!this.bookAnalysis) {
    console.log('⚠️ Music manager not yet initialized. Skipping...');
    return;
  }
  // ... rest of method ...
}
```

### `/js/core/music-api.js`
```javascript
constructor() {
  // ... existing code ...
  this.lastRequestTime = 0;
  this.minRequestInterval = 1000; // 1 second between requests
  this.rateLimitedUntil = 0;
}

async searchFreesound(tags, limit) {
  // Check if rate limited
  if (Date.now() < this.rateLimitedUntil) {
    console.warn('⏳ Rate limited. Using fallback tracks.');
    return [];
  }

  // Enforce minimum interval
  const timeSinceLastRequest = Date.now() - this.lastRequestTime;
  if (timeSinceLastRequest < this.minRequestInterval) {
    await new Promise(resolve => 
      setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
    );
  }

  // Handle 429 response
  if (response.status === 429) {
    this.rateLimitedUntil = Date.now() + 60000;
    return [];
  }
}
```

## Testing

After these changes:
1. ✅ Chapter loads only once on startup
2. ✅ No "Missing analysis or chapter" warnings during initialization
3. ✅ Music manager waits for initialization before updating
4. ✅ Freesound API requests are rate-limited (1 req/sec max)
5. ✅ Graceful fallback to demo tracks when rate limited
6. ✅ Navigation between chapters properly updates music

## User Impact

- **Faster Load Times**: Eliminating redundant chapter loads improves performance
- **Cleaner Console**: No more confusing warnings during initialization
- **Reliable Music**: Fallback tracks ensure music is always available
- **API Friendly**: Respects Freesound's rate limits to prevent account issues

## Future Improvements

1. **Cache Freesound Results**: Store successful API responses in IndexedDB to reduce API calls
2. **Batch Requests**: Load music for multiple chapters in one optimized batch
3. **User Upload**: Allow users to upload their own music files for chapters
4. **Streaming**: Consider streaming longer tracks instead of downloading entire files
5. **Background Prefetch**: Preload next chapter's music while user is reading
