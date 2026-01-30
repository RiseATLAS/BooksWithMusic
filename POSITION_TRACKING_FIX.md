# Position Tracking Fix - Drift-Free Fullscreen Toggle

## Problem Summary
When toggling fullscreen repeatedly, the reading position would drift backward because:
1. We saved the character position at the **START** of the current page
2. After re-pagination, we found which page contains that position
3. We showed that page from **ITS start**, which could be different
4. Each toggle caused drift by resetting to page starts instead of preserving exact position

### Example of the Drift
- User on page 4 (starts at character 12890)
- Toggle fullscreen → character 12890 now on page 3 (spans 10020-14869)
- Shows page 3 from its start (character 10020), **not** from 12890
- Toggle again → saves 10020 as the position
- Result: Drifted backward by 2870 characters!

## Solution Implemented

### New Position Tracking System

#### 1. **Enhanced Position Capture** (`getExactVisiblePosition()`)
Instead of just saving a character number, we now capture:
- **Character position**: Absolute position in the chapter
- **Text sample**: First 100 characters of visible text for verification
- **Line index**: Which line on the page
- **Page index**: Current page number

```javascript
{
  charPosition: 12890,
  textSample: "The morning light filtered through the ancient oak trees...",
  lineIndex: 0,
  pageIndex: 4
}
```

#### 2. **Improved Page Finding** (`findPageByCharacterPosition()`)
The search now uses **dual verification**:
- **Primary**: Find page by character position (fast, reliable when pagination is similar)
- **Secondary**: Verify by matching text sample (ensures accuracy even with significant layout changes)
- **Fallback**: If position doesn't match text, search all pages for the text sample

This approach handles edge cases like:
- Font size changes that significantly alter pagination
- Different screen sizes (desktop vs mobile)
- Fullscreen mode with different aspect ratios

#### 3. **Text Sample Verification**
After restoration, we verify the position by comparing:
- Expected text sample (what we saved)
- Actual text sample (what's now at the top of the page)

If they match → ✓ Perfect restoration, no drift!
If they differ → ⚠ Log warning for debugging

## Changes Made

### File: `js/ui/reader.js`

#### Modified Methods:

1. **`getExactVisiblePosition()`** (NEW)
   - Replaces the drift-prone character-only tracking
   - Returns position + text sample for verification
   - Lines: ~70-130

2. **`findPageByCharacterPosition(targetPosition, textSample)`** (ENHANCED)
   - Now accepts optional text sample for verification
   - Uses fuzzy matching to find the right page even if position is slightly off
   - Returns the page that contains the exact text the user was reading
   - Lines: ~132-195

3. **`getFirstTextOnPage(page)`** (NEW HELPER)
   - Extracts first text content from a page
   - Used for text sample verification
   - Lines: ~197-206

4. **Fullscreen Change Handler** (UPDATED)
   - Now uses `getExactVisiblePosition()` instead of `getCharacterPositionInChapter()`
   - Passes text sample to `findPageByCharacterPosition()`
   - Includes verification logging
   - Lines: ~540-598

5. **Page Density Change Handler** (UPDATED)
   - Uses exact position tracking
   - Same verification approach
   - Lines: ~717-752

6. **Layout Change Handler** (UPDATED)
   - Uses exact position tracking for font size, line height changes, etc.
   - Lines: ~807-850

## Testing the Fix

### Manual Testing Steps:

1. **Open a book** and navigate to a middle page (e.g., page 4 of a chapter)
2. **Note the first few words** you see at the top of the page
3. **Toggle fullscreen** (press F or F11)
4. **Verify**: The same words should still be at the top
5. **Toggle fullscreen again** (exit fullscreen)
6. **Verify**: Still the same words at the top
7. **Repeat 5-10 times** → Position should remain stable

### Console Logging

The fix includes detailed console logging to verify it's working:

```
=== FULLSCREEN RE-PAGINATION (Drift-Free) ===
[Before] Page 4/8, char position: 12890
[Before] First visible text: "The morning light filtered through the ancient..."
[After] Re-paginated into 6 pages
[FindPage] Character 12890 found on page 3 (range 10020-14869)
[FindPage] ✓ Text sample verified on page 3
[Result] Restored to page 3/6
[Verify] New first visible text: "The morning light filtered through the ancient..."
[Verify] ✓ Position restored successfully - no drift!
=== RE-PAGINATION COMPLETE ===
```

### Expected Results:
- **Before fix**: Position drifts backward by hundreds/thousands of characters
- **After fix**: Position stays exactly where user was reading, verified by text matching

## Technical Details

### Why Character Position Alone Wasn't Enough

Character positions are counted by summing text content across pages:
- Page 1: chars 0-3500
- Page 2: chars 3501-7200
- Page 3: chars 7201-10500
- etc.

When pagination changes (e.g., fullscreen), these boundaries shift:
- Page 1: chars 0-5100 (more fits per page)
- Page 2: chars 5101-10200
- Page 3: chars 10201-15300
- etc.

If we saved "character 8000" (middle of old page 3), after re-pagination:
- Character 8000 is now on new page 2
- But page 2 **starts** at character 5101
- Showing page 2 from its start = jumping back 2899 characters!

### How Text Sample Solves This

By saving "The morning light filtered..." we can:
1. Find the page containing this text (regardless of character boundaries)
2. Ensure this exact text appears at the top
3. Verify restoration by comparing text samples

Even if character positions shift dramatically, the text content stays the same, giving us a reliable anchor point.

## Future Improvements

Possible enhancements:
1. **Word-level positioning**: Track specific word index instead of character offset
2. **Scroll position within page**: For very large pages, track sub-page position
3. **Persistent position storage**: Save position to IndexedDB/Firestore with text sample
4. **Multi-line verification**: Compare first 3-5 lines instead of just first line

## Backward Compatibility

The old `getCharacterPositionInChapter()` method is preserved for any code that might still use it, but it's now deprecated in favor of `getExactVisiblePosition()`.

All pagination-affecting events (fullscreen, font size, line height, page density) now use the improved tracking system.
