# Verbose Logging Control

## Overview
BooksWithMusic now includes a **verbose logging mode** that can be toggled on/off to control how much detail appears in the browser console.

## What It Controls

### Verbose Mode (ON) - Default
Shows detailed music curation analysis:
- � Book analysis progress
- �🔍 Book vibe analysis with theme detection
- ✅ Auto-detected vs user-defined keywords
- 📄 Mood shift points within chapters
- 🎵 Track pool statistics (size, penalties, freshness)
- 📊 Score distribution breakdowns
- 🎯 Top 5 candidate tracks with scoring details
- ✅ Selected tracks with diversity grouping
- 📉 Penalty decay samples
- 🎨 Full music tag arrays

**Best for:** Developers, music curators, understanding the system

### Clean Mode (OFF)
Shows minimal essential information:
- 📖 Chapter title, mood, energy level, special attributes (time/action)
- 🎵 Track count selected
- 🔊 Logging mode confirmation
- ⚠️ Critical warnings only

**Best for:** Readers who want a clean console experience

## How to Use

### Via UI (Recommended)
1. Open the **Music Settings** panel (🎵 icon)
2. Find "Detailed Music Logs (Console)" checkbox
3. Toggle on/off
4. Setting is saved automatically

### Via Console (For Testing)
```javascript
// Disable verbose logging
window.musicManager?.setVerboseLogging(false);

// Enable verbose logging
window.musicManager?.setVerboseLogging(true);
```

## Examples

### Verbose Mode Output
```
📖 "Chapter 1" | 24p | epic | E3 | BookVibe:[epic,orchestral](AUTO) | Tags:[epic,orchestral,cinematic,powerful,heroic...]
   🎵 Track pool: 68 total tracks available
   🔵 SMALL POOL: 5/68 tracks penalized (3ch base cooldown, 50% max penalty with decay)
   📉 Penalty decay samples: "Track A": 40% (used 1x, 1/5 ch ago)
   ✅ FRESH ONLY: 63 tracks (excluded 5 recently played)
   📊 Score distribution: High(≥40):2 | Med(20-39):33 | Low(10-19):23 | Min(<10):10
   🎯 Top 5 candidates:
      1. "Uplifting Dramatic Soundtrack" | Score:46 (B36+T5+E5) | E1 | [ambient,atmosphere,battle]
      2. "Orchestral Score 1" | Score:39 (B39) | E5 | [background-music,booming,build]
   ✅ Selected 5 tracks (2 unique tag+energy groups):
      1. "Orchestral Score - Violas.wav" | background-music_E5 | [background-music,booming,build]
      2. "Uplifting Dramatic Soundtrack" | ambient_E1 | [ambient,atmosphere,battle]
```

### Clean Mode Output
```
📖 "Chapter 1" | 24p | epic | E3
   🎵 5 tracks selected
```

## Technical Details

### Implementation
- **MoodProcessor**: `verboseLogging` flag controls console output
- **MusicManager**: Exposes `setVerboseLogging(boolean)` method
- **MusicPanel**: Handles UI toggle and localStorage persistence
- **LocalStorage Key**: `booksWithMusic-settings.verboseLogging`
- **Default Value**: `true` (verbose mode on)

### Affected Logging
- Book vibe analysis (`_extractBookVibeKeywords`)
- Track selection scoring (`selectTracksForChapter`)
- Penalty statistics and decay samples
- Score distribution breakdowns
- Top candidate listings
- Selected track details with diversity info

### Not Affected
- Chapter mood/energy summaries (always shown)
- Critical warnings (always shown)
- Error messages (always shown)
- Toast notifications (always shown)

## Benefits

### For Readers
- Cleaner console without losing chapter context
- Focus on reading without debugging noise
- Still see chapter mood/energy transitions

### For Developers
- Deep insight into scoring algorithm
- Debug penalty decay system
- Verify theme detection accuracy
- Understand track selection logic
- Test quality thresholds

## Related Systems
- **Penalty Decay**: Chapter-based cooldown (see conversation summary)
- **Scoring Algorithm**: Multi-factor track evaluation (88pt book vibe + tags + energy + tempo)
- **Quality Thresholds**: Adaptive filtering based on pool size
- **Diversity Grouping**: Prevents similar tracks clustering

## Notes
- Setting persists across sessions (localStorage)
- Takes effect immediately when toggled
- Does not require page reload
- Independent of other music settings
