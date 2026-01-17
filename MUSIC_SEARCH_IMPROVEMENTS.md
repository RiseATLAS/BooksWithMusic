# Music Search Improvements

## Problem
The music search was returning "weird" results - sound effects, experimental audio, and unconventional tracks instead of proper background music for reading.

## Root Causes
1. **Query Structure**: Single-term queries (e.g., just "dark") were too broad and matched unrelated sound effects
2. **Insufficient Filtering**: Not enough exclusion of SFX/experimental tags
3. **Missing Genre Context**: Searches didn't specify musical genres/styles
4. **No Quality Sorting**: Results weren't sorted by rating/quality
5. **Wrong Method Call**: music-manager was calling `getTracksForMood()` with array instead of using a better search method

## Solutions Implemented

### 1. Enhanced Freesound Filters (`music-api.js`)

#### Added Exclusion Tags
```javascript
filter += ' -tag:fx -tag:foley -tag:sfx -tag:effect -tag:noise -tag:experimental';
```
This explicitly blocks sound effects and experimental audio.

#### Expanded Required Tags
```javascript
if (instrumentalOnly) {
  filter += ' (tag:instrumental OR tag:soundtrack OR tag:background OR tag:ambient OR tag:cinematic OR tag:orchestral OR tag:piano OR tag:strings)';
}
```
Now requires conventional music genre/instrument tags, not just "instrumental".

#### Quality Sorting
```javascript
&sort=rating_desc
```
Results are now sorted by highest-rated first.

### 2. New Multi-Term Search Method (`searchByQuery`)

Created a new method that uses OR logic between search terms:
```javascript
// Before: "epic" (too broad)
// After: "epic OR orchestral OR cinematic" (more specific, better matches)
```

This casts a wider net while maintaining quality through the filter tags.

### 3. Improved AI Music Mapping (`ai-processor.js`)

Enhanced mood-to-music mappings with:
- **More tags per mood**: 5 descriptive tags instead of 4
- **Genre tags**: Added explicit genres (e.g., 'orchestral', 'soundtrack', 'cinematic')
- **Better tag combinations**: Includes both mood and genre in search

Example:
```javascript
epic: { 
  tags: ['epic', 'orchestral', 'cinematic', 'powerful', 'heroic'], 
  energy: 5, 
  tempo: 'upbeat',
  genres: ['orchestral', 'cinematic', 'epic', 'soundtrack']
}
```

### 4. Fixed Music Manager Integration (`music-manager.js`)

- Changed from calling non-existent `getTracksForMood()` to new `searchByQuery()`
- Uses multi-term queries for each mood category
- Better error logging with full query terms

## How It Works Now

### Query Flow
1. **AI Analysis**: Analyzes chapter mood (e.g., "epic")
2. **Tag Generation**: Creates tags like `['epic', 'orchestral', 'cinematic', 'powerful', 'heroic', 'soundtrack']`
3. **Freesound Query**: Searches for `"epic OR orchestral OR cinematic OR powerful OR heroic"`
4. **Filtering**: Applies strict filters to require music tags and exclude SFX
5. **Quality Sort**: Returns highest-rated tracks first

### Example Search

**Chapter Mood**: Epic battle scene

**Generated Tags**: 
```
['epic', 'orchestral', 'cinematic', 'powerful', 'heroic', 'soundtrack']
```

**Freesound Query**:
```
query: "epic OR orchestral OR cinematic OR powerful OR heroic"
filter: duration:[30 TO *] 
        tag:music 
        (tag:instrumental OR tag:soundtrack OR tag:orchestral OR ...) 
        (tag:soundtrack OR tag:film OR tag:game OR tag:score OR tag:production)
        -tag:fx -tag:foley -tag:sfx -tag:effect -tag:noise -tag:experimental
sort: rating_desc
```

**Result**: High-quality epic orchestral soundtracks, not battle sound effects!

## Expected Improvements

1. **Less Weird Sounds**: Explicit exclusion of SFX/experimental tags
2. **More Conventional Music**: Required tags for instruments/genres (piano, orchestral, strings, etc.)
3. **Better Quality**: Rating-based sorting prioritizes popular, well-rated tracks
4. **More Variety**: OR queries cast wider net while maintaining quality
5. **Better Mood Matching**: Genre tags help find appropriate musical styles

## Settings Impact

### Instrumental Only (default: ON)
- Requires music genre/instrument tags
- Blocks vocals, spoken word, sound effects

### Max Energy Level (default: 5)
- Filters tracks by estimated energy after search
- Works alongside query improvements

## Testing Recommendations

1. **Clear Cache**: Delete music cache to force fresh searches
   ```javascript
   localStorage.removeItem('music_tracks_cache');
   ```

2. **Open Browser Console**: F12 or Cmd+Option+I (Mac)
   - All queries and results are logged with detailed breakdowns
   
3. **Look for Log Groups**: 
   - 🎼 **Music Library Loading** - Overall loading process
   - 🎵 **Freesound Multi-Term Query** - Each individual query sent
   - 📥 **Freesound Multi-Term Response** - Raw API responses
   - ✨ **Multi-Term Track Results** - Final processed tracks with tags
   - 📊 **Track Collection Summary** - Library-wide statistics

4. **Verify Results**:
   - Check that track titles are musical (not SFX)
   - Verify tags include 'orchestral', 'cinematic', 'soundtrack', 'piano', etc.
   - Ensure no tags like 'fx', 'sfx', 'foley', 'noise', 'experimental'
   - Energy distribution should match your settings

### Example Console Output

When you load tracks, you'll see:

```
🎼 Music Library Loading
  📋 Query count: 10
  📋 Query terms: [Array of 10 mood queries]

🎵 Freesound Multi-Term Query
  📤 Search terms: ['epic', 'orchestral', 'cinematic']
  🔎 Query string: epic OR orchestral OR cinematic
  🔧 Filter: duration:[30 TO *] tag:music (tag:instrumental OR ...)
  🎯 Limit: 15
  ⚙️ Settings: {instrumentalOnly: true, maxEnergyLevel: 5}

📥 Freesound Multi-Term Response
  ✅ Total results available: 342
  📦 Results returned: 15

✨ Multi-Term Track Results
  📊 Total tracks after filtering: 15
  [Table showing: title, artist, duration, energy, tempo, topTags]
  🏷️ Most common tags: orchestral(8), cinematic(7), soundtrack(6)...

📊 Track Collection Summary
  📦 Raw tracks collected: 142
  🔄 After deduplication: 127 (removed 15 duplicates)
  🎚️ Energy filter: 127 tracks → 98 tracks (max energy: 4)
  ✅ Final library size: 98
  📊 Energy distribution: {Very Calm: 12, Calm: 23, Moderate: 31, Energetic: 32, Very Energetic: 0}
  🏷️ Top 15 tags across library: music(98), orchestral(45), cinematic(38)...
```

### What to Share for Verification

Copy and paste from your console:
1. **Query strings** - What terms are being searched
2. **Filter strings** - What filters are applied
3. **Result counts** - How many tracks returned per query
4. **Tag summaries** - Most common tags in results
5. **Energy distribution** - Breakdown of track energy levels
6. **Sample track titles** - A few track names to verify quality

This will help identify if:
- Queries are working as expected
- Filters are catching weird sounds
- Tags indicate conventional music
- Energy levels are appropriate

## Future Enhancements

1. **User Feedback**: Allow users to mark tracks as "good" or "bad"
2. **AI Genre Detection**: Use AI to detect chapter genre (fantasy, sci-fi, etc.) for even better queries
3. **Custom Freesound Filters**: Let users customize filter preferences
4. **Multiple Music Sources**: Add support for other royalty-free music APIs
5. **Track Curation**: Build a curated library of known-good tracks per mood

## Related Files

- `/js/core/music-api.js` - API queries and filtering
- `/js/core/ai-processor.js` - Mood analysis and tag generation
- `/js/core/music-manager.js` - Track loading and management
- `/js/ui/settings.js` - User settings for filtering

## Troubleshooting

**Still getting weird sounds?**
- Check that Instrumental Only is enabled in settings
- Verify Freesound API key is valid
- Clear music cache and reload
- Check console for actual queries being sent

**No results found?**
- Filters might be too strict for your API key's rate limit
- Try lowering max energy level
- Check Freesound.org directly to verify account status
- Fallback to demo tracks if API fails

**Tracks too similar?**
- Natural with strict filtering (prioritizing quality over variety)
- OR queries help but filters limit total pool
- Consider adjusting instrumental-only setting
- Freesound has limited high-quality music vs sound effects
