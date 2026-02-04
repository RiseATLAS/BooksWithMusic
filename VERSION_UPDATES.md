# Version Update System

## How It Works

The app automatically checks GitHub for new versions and notifies users when an update is available.

### For Users
- The app checks for updates on startup
- Checks again every hour while the app is open
- When a new version is detected, you'll see: **🎉 A new version is available (vX.X.X)!**
- Click **Reload** to get the latest version
- Or dismiss the notification and reload later

### For Developers

When you want to release a new version:

1. **Update the version number** in `version.json`:
   ```json
   {
     "version": "1.0.1",
     "buildDate": "2026-02-03",
     "notes": "Bug fixes and improvements"
   }
   ```

2. **Commit and push to GitHub**:
   ```bash
   git add version.json
   git commit -m "🚀 Release v1.0.1"
   git push
   ```

3. **That's it!** Users will automatically be notified within:
   - Immediately on next app load
   - Within 1 hour if they have the app open

### Version Numbering

Use [Semantic Versioning](https://semver.org/):
- `1.0.0` → `1.0.1` - Bug fixes
- `1.0.0` → `1.1.0` - New features (backwards compatible)
- `1.0.0` → `2.0.0` - Breaking changes

### Testing

To test the update notification locally:

1. Change `version.json` to a lower version (e.g., `"0.9.0"`)
2. Open the app
3. It will detect the GitHub version is higher and show the notification

### Technical Details

- Compares local `version.json` with `https://raw.githubusercontent.com/RiseATLAS/BooksWithMusic/main/version.json`
- Uses `cache: 'no-cache'` to ensure fresh version from GitHub
- Checks every hour while app is running
- Notification persists until user reloads or dismisses
