# User Registration Cap - 20 Users Max

## Implementation Complete ✅

### What's Implemented:

**1. User Cap (20 users max)**
- `user-manager.js` enforces maximum 20 registered users
- New users blocked after cap is reached
- Existing users can still log in

**2. Name Storage**
- User's display name stored in Firestore
- User's email stored in Firestore
- Registration timestamp stored
- Last login timestamp stored

**3. Firebase Firestore Structure:**
```
users/
  ├── {userId1}
  │   ├── name: "John Doe"
  │   ├── email: "john@example.com"
  │   ├── registeredAt: timestamp
  │   └── lastLogin: timestamp
  ├── {userId2}
  │   ├── name: "Jane Smith"
  │   ├── email: "jane@example.com"
  │   ├── registeredAt: timestamp
  │   └── lastLogin: timestamp
  └── ...
```

### How to Verify Users in Firebase Console:

1. Go to Firebase Console (https://console.firebase.google.com)
2. Select your project
3. Click "Firestore Database" in left menu
4. Open the "users" collection
5. You'll see all registered users with their:
   - Name
   - Email
   - Registration date
   - Last login date

### What Happens:

**For New Users (under 20):**
- ✅ Sign in with Google
- ✅ Name and email stored in Firestore
- ✅ Access granted

**For New Users (at 20):**
- ❌ Sign in attempt
- ❌ Immediately signed out
- ❌ Error message: "Registration closed: Maximum 20 users allowed. This app is for friends & family only."

**For Existing Users:**
- ✅ Sign in with Google
- ✅ Last login timestamp updated
- ✅ Access granted (no cap)

### Files Modified:

1. **`js/auth/user-manager.js`** (NEW)
   - User registration cap logic
   - Name and email storage
   - User count checking

2. **`js/auth/auth.js`** (UPDATED)
   - Integrated user cap check
   - Registers new users with name
   - Updates last login for existing users

---

**Status:** Ready for production. All friends & family will have their names visible in Firebase Console for verification.
