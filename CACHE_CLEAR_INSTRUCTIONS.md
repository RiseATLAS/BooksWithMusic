# Cache Clear Instructions

## Issue
Console logs still show `ai-processor.js` instead of `mood-processor.js` because the browser has cached the old JavaScript files.

## Solution: Clear Browser Cache

### Option 1: Hard Refresh (Fastest)
1. **Chrome/Edge**: Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows/Linux)
2. **Safari**: Press `Cmd + Option + R` (Mac)
3. **Firefox**: Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows/Linux)

### Option 2: Clear Cache in DevTools
1. Open DevTools (`F12` or `Cmd/Ctrl + Shift + I`)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Option 3: Clear Cache Manually
1. Open browser settings
2. Go to Privacy/Security settings
3. Select "Clear browsing data"
4. Check "Cached images and files"
5. Click "Clear data"

### Option 4: Use Incognito/Private Window
- Open the app in an incognito/private browsing window
- This bypasses the cache entirely

## Verification
After clearing cache, the console logs should show:
- ✅ `mood-processor.js` (new file name)
- ❌ NOT `ai-processor.js` (old file name)

## Why This Happens
- Browsers cache JavaScript files for performance
- When files are renamed, the browser may still use cached versions
- A hard refresh forces the browser to download fresh copies

## Alternative: Add Cache Busting
To prevent this in production, consider adding version query parameters to script tags:
```html
<script src="js/core/mood-processor.js?v=2.0.0"></script>
```

Or use a build tool that automatically adds content hashes to filenames.
