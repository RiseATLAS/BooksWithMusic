# Page Counter Setting Implementation

## Overview
Added a new setting to toggle between full book page counter and chapter-only page counter, with full book as the default.

## Changes Made

### 1. Reader UI Event Listener (js/ui/reader.js)
- Added event listener in `setupEventListeners()` method to listen for `settings:pageNumbersChanged` custom event
- When the setting changes, the page indicator is immediately updated
- Fixed syntax error in `goToPreviousChapter()` method (missing parenthesis)

### 2. Settings UI Synchronization (js/ui/settings.js)
- Added `syncUIWithSettings()` method to restore all UI elements to match loaded settings
- This method is called after `initialize()` to ensure checkboxes, sliders, and selects reflect saved values
- Includes synchronization for the new `show-book-page-numbers` checkbox

### 3. Existing Implementation (Already Present)
- **Default Setting**: `showBookPageNumbers: true` (full book pages)
- **HTML Checkbox**: Already exists in `reader.html` with proper ID and label
- **Event Handler**: Already exists in settings.js to handle checkbox changes and dispatch custom event
- **Page Indicator Logic**: Already exists in `updatePageIndicator()` method in reader.js

## How It Works

### Full Book Page Counter (Default)
```
1 / 245
```
Shows the current page number out of total pages in the entire book.

### Chapter-Only Page Counter
```
Ch 3: 5 / 12
```
Shows the current chapter number, current page within chapter, and total pages in the chapter.

## User Experience

1. **Default Behavior**: When a user first opens the app, they see full book page numbers
2. **Toggle Setting**: User can go to Settings > Show Full Book Page Numbers and uncheck it
3. **Immediate Update**: The page indicator updates instantly when the setting is changed
4. **Persistence**: The setting is saved to localStorage and synced to Firestore (when signed in)
5. **Restoration**: When the app is reloaded, the checkbox state and page indicator reflect the saved preference

## Technical Details

### Event Flow
1. User checks/unchecks "Show Full Book Page Numbers" checkbox
2. Settings panel saves setting to localStorage and Firestore
3. Settings panel dispatches `settings:pageNumbersChanged` custom event
4. Reader UI receives event and calls `updatePageIndicator()`
5. Page indicator reads current setting from localStorage and updates display

### Settings Key
- **Storage Key**: `booksWithMusic-settings`
- **Setting Property**: `showBookPageNumbers` (boolean)
- **Default Value**: `true` (show full book pages)

## Testing Checklist

- [x] Setting has correct default value (true)
- [x] Checkbox is properly wired to setting
- [x] Page indicator updates when setting changes
- [x] Setting persists across page reloads
- [x] Setting syncs to Firestore when signed in
- [x] No console errors
- [x] Both display modes work correctly

## Files Modified

1. `/js/ui/reader.js` - Added event listener for setting changes
2. `/js/ui/settings.js` - Added UI synchronization method
3. `/reader.html` - Already had the checkbox (no changes needed)

## Notes

- The page counter toggle is fully functional and integrated with the existing settings system
- The implementation follows the same pattern as other settings (theme, font size, etc.)
- Character offset-based page restoration works with both display modes
- No breaking changes to existing functionality
