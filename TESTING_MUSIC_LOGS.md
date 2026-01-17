# How to Test and Share Music Search Logs

## Quick Test Instructions

### 1. Clear Music Cache
Open browser console (F12 or Cmd+Option+I) and run:
```javascript
localStorage.removeItem('music_tracks_cache');
```

### 2. Reload Tracks
- Go to Settings (⚙️ icon in reader)
- Click "Reload Music Library" or just reload the page with music enabled
- Watch the console for detailed logs

### 3. Copy Relevant Logs
Look for these console groups and expand them:

#### 🎼 Music Library Loading
```
📋 Query count: 10
📋 Query terms: [['calm', 'piano', 'ambient'], ['epic', 'orchestral', 'cinematic'], ...]
```

#### 🎵 Freesound Multi-Term Query (for each mood)
```
📤 Search terms: ['epic', 'orchestral', 'cinematic']
🔎 Query string: epic OR orchestral OR cinematic
🔧 Filter: duration:[30 TO *] tag:music (tag:instrumental OR tag:soundtrack ...) -tag:fx -tag:sfx ...
🎯 Limit: 15
⚙️ Settings: {instrumentalOnly: true, maxEnergyLevel: 5}
```

#### 📥 Freesound Multi-Term Response
```
✅ Total results available: 342
📦 Results returned: 15
```

#### ✨ Multi-Term Track Results
```
📊 Total tracks after filtering: 15
[Table with columns: title, artist, duration, energy, tempo, topTags]
🏷️ Most common tags: orchestral(8), cinematic(7), soundtrack(6), music(15), ...)
```

#### 📊 Track Collection Summary (final)
```
📦 Raw tracks collected: 142
🔄 After deduplication: 127 (removed 15 duplicates)
🎚️ Energy filter: 127 tracks → 98 tracks (max energy: 4)
✅ Final library size: 98
📊 Energy distribution: {Very Calm (1): 12, Calm (2): 23, Moderate (3): 31, ...}
🏷️ Top 15 tags across library: music(98), orchestral(45), cinematic(38), ...
```

## What to Share

### Minimum Info (Quick Check)
```
Final library size: X tracks
Top 15 tags: [copy the tag list]
Energy distribution: [copy the distribution]
```

### Sample Track Names (Important!)
Right-click on the table in "Multi-Term Track Results" and copy a few track titles to verify they sound musical (not SFX).

Example of good results:
- ✅ "Epic Orchestral Theme"
- ✅ "Peaceful Piano Melody"
- ✅ "Cinematic Adventure Score"

Example of bad/weird results:
- ❌ "Door Creak Sound Effect"
- ❌ "Random Experimental Noise"
- ❌ "Toilet Flush Loop"

### Full Debug (If Issues)
Copy the entire console output, especially:
1. All query strings
2. All filter strings
3. All result counts
4. Any error messages
5. A few sample track titles from the tables

## What Good Results Look Like

### Tags Should Include:
- ✅ orchestral, cinematic, soundtrack, piano, strings
- ✅ music, instrumental, ambient, score, film, game
- ✅ epic, calm, dramatic, peaceful, adventure

### Tags Should NOT Include:
- ❌ fx, sfx, foley, effect
- ❌ noise, experimental
- ❌ specific sound effects (door, footstep, etc.)

### Energy Distribution:
Should have tracks across multiple energy levels (unless you've set a max energy filter):
- Very Calm (1): Meditation, sleep, ambient
- Calm (2): Peaceful, gentle, soft
- Moderate (3): Neutral background music
- Energetic (4): Upbeat, dynamic, dramatic
- Very Energetic (5): Intense, epic, action

### Total Tracks:
- **With instrumental filter ON**: Expect 80-120 tracks (stricter filtering)
- **With instrumental filter OFF**: Expect 120-150 tracks (broader selection)
- **With energy filter < 5**: Fewer tracks based on limit

## Settings That Affect Results

### Instrumental Only (default: ON)
- ON: Requires music genre/instrument tags, blocks vocals/speech
- OFF: More variety but may include some vocal tracks

### Max Energy Level (default: 5)
- 1-3: Only calm/moderate music
- 4: All but very intense tracks
- 5: Full range including epic/dramatic

## Troubleshooting

### "No tracks loaded from API"
- Check Freesound API key in settings
- Check console for rate limit warnings
- Verify internet connection

### "Too few tracks"
- Energy filter might be too restrictive
- Instrumental-only might be too strict
- Try adjusting settings

### "Still getting weird sounds"
- Share track titles and tags with me
- We can adjust filters further
- May need to add more exclusion tags

## Example Test Session

1. Clear cache
2. Set "Instrumental Only" = ON
3. Set "Max Energy Level" = 5
4. Reload music
5. Copy logs from console
6. Check a few track titles in the tables
7. Share results!

## Browser Console Tips

- **Expand/collapse groups**: Click the arrow next to 🎼, 🎵, etc.
- **Copy tables**: Right-click table → Copy → Copy table
- **Copy text**: Select text, Cmd+C (Mac) or Ctrl+C (Windows)
- **Clear console**: Click 🚫 icon or Cmd+K (Mac) / Ctrl+L (Windows)
- **Filter logs**: Use the filter box at top (e.g., type "Freesound" to show only music queries)

## Questions to Answer

After testing, let me know:
1. **How many tracks total?** (from Track Collection Summary)
2. **What are the top tags?** (should see orchestral, cinematic, etc.)
3. **Any weird track titles?** (check the tables)
4. **Energy distribution?** (balanced or too skewed?)
5. **Any errors?** (red text in console)

This will help me verify the improvements are working as expected!
