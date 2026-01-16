# Security Policy

## Overview

BooksWithMusic takes security and privacy seriously. This document outlines our security practices and how to report vulnerabilities.

## Privacy & Data Protection

### Firebase Analytics - DISABLED

**Firebase Analytics is intentionally disabled** in this application to protect user privacy. We do not collect, track, or analyze user behavior beyond what's necessary for core functionality.

### What Data We Collect

Only when Firebase is configured (optional):
- **Authentication**: Email, display name, and profile photo (from Google Sign-In)
- **User Settings**: Theme preferences, font settings, reading preferences
- **Reading Progress**: Current chapter and position in books you're reading
- **Book Metadata**: Titles, authors, and covers of books you import

### What We DON'T Collect

- ❌ Analytics or tracking data
- ❌ Reading habits or behavior patterns
- ❌ Book content (EPUBs are stored locally by default)
- ❌ Personal information beyond what Google provides
- ❌ Usage statistics or telemetry

### Data Storage

- **Local First**: All data is stored locally in your browser by default (IndexedDB)
- **Cloud Storage (Optional)**: If Firebase is configured, you can optionally sync:
  - User settings
  - Reading progress
  - Book library (if you choose to upload EPUBs)
- **User Control**: Each user can only access their own data (enforced by Firebase Security Rules)

## API Key Management

### Environment Variables

**🔐 CRITICAL: Never commit API keys to version control**

We use environment variables to protect sensitive configuration:

1. **Local Development**: Use `.env` file (gitignored)
2. **Production/CI/CD**: Firebase credentials are stored as **GitHub repository secrets**
   - Location: Repository Settings > Secrets and variables > Actions
   - Automatically injected during GitHub Actions builds
   - Never exposed in logs or public outputs
3. **Example Configuration**: See `.env.example` for template (contains no real keys)

### Repository Secrets (Production)

For this repository, Firebase variables are securely stored as GitHub repository secrets:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

This ensures production deployments are secure without exposing credentials.

### Firebase Configuration

Firebase configuration values (`apiKey`, `projectId`, etc.) are:
- **Client-side identifiers** - they identify your Firebase project
- **Not traditional secrets** - they can be safely included in client-side code
- **Protected by Security Rules** - actual security comes from properly configured Firestore/Storage rules

**However**, we still recommend using environment variables to:
- Avoid accidental commits
- Make configuration easier to manage
- Follow security best practices

### Key Rotation

If API keys are accidentally exposed:
1. **Immediately** regenerate them in the respective service (Firebase Console, Anthropic, etc.)
2. Update environment variables with new keys
3. Deploy the updated configuration
4. Monitor for unauthorized usage

## Firebase Security Rules

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

These rules ensure:
- ✅ Users must be authenticated
- ✅ Users can only access their own data
- ✅ Cross-user data access is prevented

## Security Best Practices

### For Users

1. **Use Strong Google Account**: Your Google account security protects your data
2. **Review Authorized Apps**: Periodically review apps authorized to access your Google account
3. **Sign Out on Shared Devices**: Always sign out when using public or shared computers
4. **Report Issues**: Report any security concerns via GitHub Issues (see below)

### For Developers/Contributors

1. **Never Commit Secrets**: Check files before committing
2. **Use .gitignore**: Ensure `.env` is gitignored
3. **Review PRs**: Look for accidentally committed keys in pull requests
4. **Follow Principle of Least Privilege**: Only request necessary permissions
5. **Keep Dependencies Updated**: Regularly update npm packages for security patches
6. **Validate Input**: Sanitize all user input to prevent injection attacks
7. **Use HTTPS**: Always serve the app over HTTPS in production

## Authentication Security

### Google Sign-In

- Uses OAuth 2.0 protocol
- Tokens are managed by Firebase Authentication SDK
- No passwords are stored in this application
- Session management handled securely by Firebase

### Authorization

- User identity verified through Firebase Auth
- Firestore/Storage access controlled by Security Rules
- Each request includes authenticated user token
- Backend validates token before allowing access

## Vulnerability Reporting

If you discover a security vulnerability:

### DO:
1. **Report privately** via GitHub Security Advisories or email (if provided)
2. **Provide details**: Steps to reproduce, impact assessment, suggested fix
3. **Allow time**: Give maintainers time to fix before public disclosure

### DON'T:
1. **Don't publicly disclose** until a fix is available
2. **Don't exploit** the vulnerability beyond proof-of-concept
3. **Don't test** on production systems without permission

## Incident Response

In case of a security incident:

1. **Assess Impact**: Determine what data/systems are affected
2. **Contain**: Limit further exposure (rotate keys, disable features)
3. **Notify**: Inform affected users if personal data is compromised
4. **Fix**: Patch the vulnerability
5. **Document**: Record what happened and how it was resolved
6. **Improve**: Update practices to prevent similar issues

## Compliance

### GDPR Considerations

For EU users:
- Data processing is optional (Firebase can be disabled)
- Users control their data
- Data can be deleted by user
- No unnecessary data collection
- Clear privacy notice provided

### Data Deletion

Users can delete their data:
1. **Local Data**: Clear browser data or use app's delete function
2. **Cloud Data**: Delete account data from Firebase Console
3. **Google Connection**: Revoke app access from Google Account settings

## Security Updates

- Security patches will be applied promptly
- Major security issues will be documented in CHANGELOG.md
- Users will be notified of critical security updates

## Contact

For security concerns:
- **GitHub Issues**: For non-sensitive security discussions
- **GitHub Security Advisories**: For private vulnerability disclosure

---

**Last Updated**: January 2026

This security policy is subject to change. Check this document regularly for updates.
