# Firebase Setup Guide for BooksWithMusic

This guide will walk you through setting up Firebase for the BooksWithMusic application to enable cloud features like user authentication, settings sync, and cloud storage for EPUBs.

## Overview

BooksWithMusic uses Firebase to provide:
- **Google Authentication** - Secure user sign-in with Google accounts
- **Firestore Database** - Cloud storage for user settings, reading progress, and book metadata
- **Firebase Storage** - Cloud storage for EPUB files

**Privacy Note:** Firebase Analytics is intentionally disabled in this application to protect user privacy. We only use Firebase for essential features: authentication, data storage, and file storage.

## Prerequisites

- A Google account
- Access to [Firebase Console](https://console.firebase.google.com/)

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "BooksWithMusic")
4. **Disable Google Analytics** when prompted (we don't use it for privacy reasons)
5. Click **"Create project"** and wait for it to be provisioned

## Step 2: Register Your Web App

1. In your Firebase project dashboard, click the **Web icon** (`</>`) to add a web app
2. Register your app with a nickname (e.g., "BooksWithMusic Web")
3. Check **"Also set up Firebase Hosting"** if you want to host on Firebase (optional)
4. Click **"Register app"**
5. **Copy the Firebase configuration object** - you'll need this later
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
     // Note: measurementId is not needed - we don't use Analytics
   };
   ```
6. Click **"Continue to console"**

## Step 3: Enable Google Authentication

1. In the Firebase Console, go to **Build > Authentication**
2. Click **"Get started"** if this is your first time
3. Go to the **"Sign-in method"** tab
4. Find **"Google"** in the list of providers
5. Click on **"Google"** to configure it
6. Toggle the **"Enable"** switch to ON
7. Select a **"Project support email"** (your email)
8. Click **"Save"**

### Optional: Configure Authorized Domains

- For local development: `localhost` is already authorized by default
- For GitHub Pages: Add your GitHub Pages domain (e.g., `username.github.io`)
  1. Go to **Authentication > Settings > Authorized domains**
  2. Click **"Add domain"**
  3. Enter your domain (e.g., `username.github.io`)
  4. Click **"Add"**

## Step 4: Create Firestore Database

1. In the Firebase Console, go to **Build > Firestore Database**
2. Click **"Create database"**
3. Choose a location for your database (pick the closest to your users)
4. Start in **"Production mode"** (we'll set up security rules next)
5. Click **"Enable"**

### Set Up Firestore Security Rules

After creating the database:

1. Go to the **"Rules"** tab in Firestore Database
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **"Publish"**

**What these rules do:**
- Users must be authenticated to access data
- Users can only access their own data (matched by user ID)
- Prevents unauthorized access to other users' data

## Step 5: Set Up Firebase Storage

1. In the Firebase Console, go to **Build > Storage**
2. Click **"Get started"**
3. Choose to start in **"Production mode"**
4. Select the same location as your Firestore database
5. Click **"Done"**

### Set Up Storage Security Rules

After creating storage:

1. Go to the **"Rules"** tab in Firebase Storage
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User can only read/write their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **"Publish"**

**What these rules do:**
- Users must be authenticated to access files
- Users can only access files in their own user folder
- Prevents unauthorized access to other users' EPUBs

## Step 6: Add Firebase Configuration to Your App

You have two options for adding your Firebase configuration:

### Option A: Using Environment Variables (Recommended)

**For this repository, Firebase variables are already configured as GitHub repository secrets** for secure deployment. 

For local development, create a `.env` file:

1. Create a `.env` file in your project root (this file is already gitignored)
2. Add your Firebase configuration values:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
# Note: VITE_FIREBASE_MEASUREMENT_ID is not needed - Analytics is disabled
```

**📝 Note:** For GitHub Pages/Actions deployment, Firebase credentials are already stored as repository secrets:
   - Location: **Repository Settings > Secrets and variables > Actions**
   - The CI/CD pipeline automatically uses these secrets during build
   - Variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.

**🔐 SECURITY REMINDER:** Never commit the `.env` file to version control. It's already in `.gitignore` for your protection.

### Option B: Direct Configuration (For Local Development)

1. Open `js/config/firebase-config.js`
2. Replace the placeholder values with your actual Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",  // Replace with your actual API key
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
  // measurementId is intentionally omitted - Analytics is disabled
};
```

**⚠️ CRITICAL WARNING:** 
- **NEVER** commit actual API keys to public repositories
- **ALWAYS** use environment variables for production deployments
- The `.env` file is gitignored to prevent accidental commits
- If you accidentally commit keys, immediately regenerate them in Firebase Console

## Step 7: Test Your Setup

1. Install Firebase dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the app in your browser (usually `http://localhost:5173`)

4. Look for the Firebase initialization message in the browser console:
   ```
   ✓ Firebase initialized successfully (Analytics disabled for privacy)
   ✓ Firebase Auth initialized
   ```

5. Try signing in:
   - Click the **"Sign In with Google"** button
   - Complete the Google sign-in flow
   - Your user profile should appear in the header

6. Test cloud features:
   - Change a setting (theme, font size, etc.)
   - Sign out and sign back in
   - Your settings should be restored from the cloud

## Troubleshooting

### "Firebase not configured" message

**Problem:** You see a warning about Firebase not being configured.

**Solution:** 
- Check that your `.env` file has the correct Firebase configuration values
- Make sure the environment variable names start with `VITE_`
- Restart the development server after changing `.env`

### "Unauthorized domain" error during sign-in

**Problem:** Google sign-in fails with an "unauthorized domain" error.

**Solution:**
- Go to Firebase Console > Authentication > Settings > Authorized domains
- Add your domain (e.g., `localhost:5173` for local dev, or your GitHub Pages domain)
- Wait a few minutes for changes to propagate

### "Permission denied" errors in Firestore or Storage

**Problem:** You can't save or load data from Firestore/Storage.

**Solution:**
- Check that you've published the security rules exactly as shown above
- Make sure you're signed in (check the browser console for auth status)
- Verify the user ID in the error matches your signed-in user

### Build fails with Firebase errors

**Problem:** Build command fails with Firebase-related errors.

**Solution:**
- Make sure Firebase SDK is installed: `npm install firebase`
- Check that all imports in the code use the correct module paths
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

## Data Structure

### Firestore Collections

```
/users/{userId}/
  ├── settings/
  │   └── preferences    (theme, fontSize, musicEnabled, etc.)
  └── books/{bookId}
      ├── title
      ├── author
      ├── cover
      ├── progress (chapterIndex, position)
      ├── createdAt
      └── lastRead
```

### Storage Structure

```
/users/{userId}/
  └── books/
      ├── {bookId}.epub
      ├── {bookId}.epub
      └── ...
```

## Privacy and Data Management

- **User data isolation**: Each user can only access their own data
- **Data deletion**: Users can delete their books and settings
- **No server-side code**: All operations run in the browser using Firebase client SDK
- **Offline support**: The app works offline with cached data

## Cost and Quotas

Firebase Free Tier (Spark Plan) includes:
- **Authentication**: Unlimited
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day
- **Storage**: 5 GB storage, 1 GB downloads/day

This is sufficient for personal use. Monitor your usage in the Firebase Console.

## Production Deployment Checklist

Before deploying to production:

- [ ] Firebase project created and configured
- [ ] Google Authentication enabled
- [ ] Firestore security rules published
- [ ] Storage security rules published
- [ ] Environment variables set up (for GitHub Pages)
- [ ] Authorized domains configured (including production domain)
- [ ] Firebase configuration NOT committed to repository
- [ ] App tested with real Firebase backend

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all configuration steps were completed
3. Review Firebase documentation: https://firebase.google.com/docs
4. Check Firebase Console for service status

---

**Security Best Practices:**
- Firebase configuration values (API keys, project IDs) identify your Firebase project but are not secret in the traditional sense
- Security is enforced through Firebase Security Rules (properly configured above), not by hiding configuration values
- However, it's **strongly recommended** to:
  - Use environment variables to avoid committing configuration to version control
  - Keep your `.env` file in `.gitignore` (already configured)
  - Never commit real API keys to public repositories
  - Regenerate keys immediately if they are accidentally exposed

**Privacy Note:** This application does not use Firebase Analytics. Only Authentication, Firestore, and Storage are enabled to protect user privacy.
