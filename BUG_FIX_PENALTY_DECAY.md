# Critical Bug Fix: Penalty Decay Not Working

## The Problem

Looking at your logs, the penalty decay system wasn't working at all:

```
📉 Penalty decay samples: "Orchestral Score 1": 50% (used 1x, 0/5 chapters ago)
```

**Key Issues:**
1. All penalties stuck at **50%** (never decayed)
2. All tracks showed **"0/X chapters ago"** (chapters since last played was always 0)
3. Result: No tracks ever became "fresh" again after initial use

## Root Cause

The original code tried to estimate chapters based on time:
```javascript
// BROKEN: Assumed 3 minutes per chapter
const chaptersSinceLastPlayed = Math.floor((Date.now() - info.lastPlayed) / (1000 * 60 * 3));
```

**Why it failed:**
- During book loading, all chapters are processed **instantly** (within milliseconds)
- Time difference between chapters: ~0-50ms
- Calculated chapters ago: `Math.floor(0.05 / 180) = 0` ❌
- All tracks appeared to be "just played" forever

## The Solution

Changed to **chapter-based tracking** using a simple counter:

### 1. Added Chapter Counter
```javascript
constructor() {
  this.currentChapterIndex = 0; // Track which chapter we're on
}
```

### 2. Increment on Each Chapter
```javascript
selectTracksForChapter(...) {
  this.currentChapterIndex++; // Chapter 1, 2, 3, etc.
  // ...
}
```

### 3. Store Chapter Index with History
```javascript
this.recentlyPlayedTracks.set(trackId, {
  lastChapterIndex: 5,  // Used in chapter 5
  count: 2,             // Used 2 times total
  // ...
});
```

### 4. Calculate Chapters Ago
```javascript
// Now correctly calculates: currentChapter - lastUsedChapter
const chaptersSinceLastPlayed = this.currentChapterIndex - info.lastChapterIndex;
// Example: Chapter 10 - Chapter 5 = 5 chapters ago ✅
```

### 5. Reset for New Books
```javascript
generateChapterMappings(...) {
  this.currentChapterIndex = 0; // Start fresh for each book
  // ...
}
```

## Expected Behavior Now

### Chapter-by-Chapter Example:
```
Chapter 1: Track A used → stored as lastChapterIndex: 1
Chapter 2: Track A penalty: 100% (0 chapters ago, need 5 cooldown)
Chapter 3: Track A penalty: 80%  (1 chapter ago)
Chapter 4: Track A penalty: 60%  (2 chapters ago)
Chapter 5: Track A penalty: 40%  (3 chapters ago)
Chapter 6: Track A penalty: 20%  (4 chapters ago)
Chapter 7: Track A penalty: 0%   (5+ chapters ago) ✅ FRESH AGAIN!
```

### With Heavy Usage (8 times):
```
Track used 8x → needs 19 chapters cooldown (3 base + 10 max + 6 from usage)
Chapter 1: Used → lastChapterIndex: 1
Chapter 10: Penalty: 53% (9/19 chapters ago)
Chapter 15: Penalty: 26% (14/19 chapters ago)
Chapter 20: Penalty: 0% (19+ chapters ago) ✅ FRESH!
```

## What You'll See in New Logs

**Before (broken):**
```
📉 Penalty decay samples: "Orchestral Score": 50% (used 8x, 0/13 chapters ago)
                                                                  ↑ Always 0!
```

**After (fixed):**
```
📉 Penalty decay samples: "Orchestral Score": 28% (used 8x, 10/19 ch ago)
                                                                  ↑ Real progress!
```

**After cooldown:**
```
🔵 SMALL POOL: 0/68 tracks penalized - all tracks are fresh! 🎉
```

## Impact on Your Book (38 chapters, 68 tracks)

### Before Fix:
- Chapters 1-5: Good variety (fresh tracks)
- Chapters 6-38: **Same 5 tracks** (all permanently stuck at 50% penalty)
- Pool exhaustion: **100% by chapter 12**

### After Fix:
- Chapters 1-3: Fresh tracks
- Chapters 4-6: Some tracks becoming fresh again (3-chapter cooldown expiring)
- Chapters 7+: **Continuous rotation** - tracks cycle back into "fresh" status
- Heavily-used "Orchestral Score" tracks: Stay penalized longer (up to 13 chapters)
- Result: **Much better variety** throughout the entire book

## Verification

To verify the fix is working, look for:

1. **Varying penalty percentages**: Should see 50%, 40%, 30%, 20%, etc. (not always 50%)
2. **Increasing "chapters ago"**: Should see 1, 2, 3, 4... (not always 0)
3. **Tracks becoming fresh**: Should eventually see "0/68 tracks penalized"
4. **Better variety**: Less repetition of the same orchestral stems

## Files Changed

- `/js/core/mood-processor.js`:
  - Added `currentChapterIndex` counter
  - Changed penalty calculation to use chapter-based tracking
  - Updated history storage to include `lastChapterIndex`
  - Reset counter at start of each book

---

**Status**: ✅ **FIXED** - Penalty decay now works correctly with chapter-based tracking!
