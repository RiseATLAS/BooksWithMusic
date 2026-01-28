# Music Selection & Anti-Repetition Improvements

## Summary
Enhanced the music selection system with adaptive penalties and a **penalty decay system** to provide better variety, especially for small track pools like Freesound.

## Latest Update (v1.1.1)
**Fixed:** Penalty decay now works correctly using **chapter-based tracking** instead of time-based estimation. Previously, all penalties were stuck at 50% because the time calculation assumed 3 minutes per chapter, but chapters were processed instantly during loading. Now uses a simple chapter counter that increments as each chapter is processed.

**Result:** Tracks will now actually decay and become fresh again after the cooldown period, providing much better variety throughout the book.

## Key Problems Solved

### 1. **Permanent Penalization**
- **Before**: Once a track was used, it stayed penalized throughout the entire book
- **After**: Tracks gradually become "fresh" again as chapters pass
- **Impact**: In a 38-chapter book with 68 tracks, tracks now rotate back into circulation instead of being permanently disadvantaged

### 2. **Pool Exhaustion**
- **Before**: By chapter 5, most tracks were penalized, leaving no "fresh" options
- **After**: Penalties decay over time, so even heavily-used tracks become available again
- **Impact**: Better variety throughout the entire book, not just the first few chapters

### 3. **Heavy Usage Penalties**
- **Before**: All used tracks were treated equally
- **After**: Tracks used more frequently get longer cooldowns (up to +10 chapters)
- **Impact**: Over-used tracks (like "Orchestral Score") stay penalized longer, encouraging variety

## How It Works

### Penalty Decay Formula
```
Penalty % = Max Penalty × (1 - chapters_since_played / cooldown_period)

Examples (50% max penalty, 3-chapter cooldown):
- Just played (0 chapters ago):  50% penalty
- 1 chapter ago:                 33% penalty  
- 2 chapters ago:                 17% penalty
- 3+ chapters ago:                0% penalty (fully fresh!)
```

### Adaptive Cooldowns
Cooldowns adjust based on:
1. **Pool size** (smaller pools = shorter base cooldowns)
2. **Usage frequency** (heavily-used tracks get +2 chapters per use, max +10)

#### Examples:
- **Track used 1x** in small pool: 3-chapter cooldown
- **Track used 5x** in small pool: 13-chapter cooldown (3 base + 10 max)
- **Track used 1x** in large pool: 12-chapter cooldown
- **Track used 5x** in large pool: 22-chapter cooldown

### Pool-Adaptive Settings

| Pool Size | Type | Base Cooldown | Max Penalty | Strategy |
|-----------|------|---------------|-------------|----------|
| < 50 tracks | 🔵 Tiny | 3 chapters | 30% | Very lenient - tracks refresh quickly |
| 50-100 tracks | 🔵 Small | 3 chapters | 50% | Lenient - moderate refresh rate |
| 100-200 tracks | 🟡 Medium | 6 chapters | 65% | Moderate - balanced approach |
| 200+ tracks | 🟢 Large | 12 chapters | 85% | Strict - emphasize variety |

## What You'll See in Logs

### Penalty Information
```
🔵 SMALL POOL: 15/68 tracks penalized (3ch base cooldown, 50% max penalty with decay)
📉 Penalty decay samples: "Orchestral Score": 28% (used 8x, 1/19 ch ago); 
                          "Epic Drama": 15% (used 3x, 2/9 ch ago)
```

### Interpretation:
- **"28% (used 8x, 1/19 ch ago)"**: Track was used 8 times, last played 1 chapter ago, needs 19 chapters to be fully fresh, currently has 28% penalty
- **"ch ago"** means chapters ago (not time-based)
- **Tracks with 0% penalty**: Fully "fresh" - cooldown period has passed

### Fresh Track Indicators
```
🔵 SMALL POOL: 0/68 tracks penalized - all tracks are fresh! 🎉
```
This means enough chapters have passed that all tracks have completed their cooldown.

## Expected Behavior Changes

### Before Penalty Decay (38-chapter book, 68 tracks):
- Chapters 1-5: Good variety (fresh tracks)
- Chapters 6-20: Limited variety (most tracks penalized)
- Chapters 21-38: **Very repetitive** (all tracks permanently penalized, same high-scorers dominate)

### After Penalty Decay:
- Chapters 1-5: Good variety (fresh tracks)
- Chapters 6-10: Some tracks becoming fresh again (3-chapter cooldown expiring)
- Chapters 11-38: **Continuous rotation** - tracks cycle back into "fresh" status
- Heavily-used tracks: Stay penalized longer but eventually refresh

## Configuration

### Current Settings (in constructor):
```javascript
this.minCooldownPeriod = 3;  // Small pool base cooldown
this.maxCooldownPeriod = 12; // Large pool base cooldown
this.trackCooldownPeriod = 8; // Default (adaptive)
this.repetitionPenaltyStrength = 0.70; // Default (adaptive)
```

### Cleanup:
- History entries older than 1 hour are automatically cleaned up to prevent memory bloat
- Ensures long sessions don't accumulate stale data

## Recommendations

### For Freesound (Small Pools):
1. **Expect some repetition** - 68 tracks for 38 chapters means each track plays ~0.56 times on average
2. **Penalty decay helps** - tracks refresh every 3-13 chapters based on usage
3. **Increase pool size** - use more diverse search tags or consider Spotify

### For Spotify (Large Pools):
1. **Much better variety** - 200+ tracks provide excellent diversity
2. **Stricter penalties** - 12-22 chapter cooldowns ensure minimal repetition
3. **Optimal experience** - large pools are ideal for long books

## Technical Details

### Penalty Application Logic:
```javascript
// Calculate chapters since last played (chapter-based counter, not time-based)
const chaptersSinceLastPlayed = currentChapterIndex - lastChapterIndex;

// Usage-based cooldown extension
const usageCooldown = baseCooldown + Math.min(usageCount * 2, 10);

// Linear decay
const decayRatio = 1 - (chaptersSinceLastPlayed / usageCooldown);
const penaltyPercent = maxPenalty × decayRatio;
```

### Track History Storage:
```javascript
{
  lastPlayed: timestamp,
  lastChapterIndex: 5,  // Which chapter this track was last used
  count: 5,             // Total times used
  playCount: 5          // Redundant, kept for compatibility
}
```

## Testing Tips

1. **Monitor penalty decay** - look for the "Penalty decay samples" log line
2. **Track usage patterns** - note which tracks are "used Xx" in logs
3. **Watch for fresh cycles** - after 3+ chapters, tracks should start refreshing
4. **Check pool warnings** - system will warn if pool is too small for book length

## Future Enhancements

Potential improvements if more variety is needed:
1. **Group-based rotation** - ensure tracks from different "groups" (tag+energy combos) rotate evenly
2. **Aggressive diversity mode** - setting to force maximum variety at the cost of match quality
3. **Smart pre-fetching** - predict upcoming moods and pre-load fresh tracks
4. **User feedback** - allow manual "ban" or "favorite" to influence selection

---

**Version**: 1.1.1 (Chapter-Based Penalty Decay - Fixed!)  
**Date**: January 2026  
**Files Modified**: `js/core/mood-processor.js`

## Changelog

### v1.1.1 (Current)
- **Fixed**: Changed from time-based to chapter-based penalty decay tracking
- **Fixed**: Penalties now correctly decay over chapters instead of staying at 50%
- **Added**: `currentChapterIndex` counter to accurately track chapter progression
- **Added**: `lastChapterIndex` field to track history storage
- **Improved**: Reset chapter counter at the start of each book

### v1.1.0 (Previous)
- Implemented penalty decay system with linear decay formula
- Added usage-based cooldown extensions
- Enhanced logging with decay information
- Added automatic history cleanup
