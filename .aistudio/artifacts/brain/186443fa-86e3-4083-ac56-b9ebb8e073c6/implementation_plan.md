# Implementation Plan: Additional Login Methods (Email/Password & Guest Mode)

## Context & User Choices
- **Current State**: The application only supports Google Sign-In (`signInWithPopup`).
- **User Needs**:
  - Add **Email and Password** authentication without requiring an external SMTP server.
  - Send optional verification emails using Firebase's built-in mailer.
  - Add **Guest / Anonymous Mode** (`signInAnonymously`) for quick 1-click access without requiring an email address or credentials.
  - Maintain the existing **Google Sign-In** option.

---

## Technical Architecture & Firebase Auth Integration

### 1. Firebase Authentication Services (`src/firebase.ts`)
- Import and export the required Firebase Auth SDK methods:
  - `signInWithEmailAndPassword`
  - `createUserWithEmailAndPassword`
  - `sendEmailVerification`
  - `sendPasswordResetEmail`
  - `signInAnonymously`
  - `updateProfile`
- Email verification:
  - Firebase provides a built-in email service with customizable templates on Firebase Console (no custom SMTP credentials required).
  - When a user signs up with Email & Password, we will trigger `sendEmailVerification(res.user)` and notify the user with a friendly confirmation toast/badge indicating a verification link has been sent to their inbox, while still allowing them to explore and log in immediately.

### 2. Enhanced Authentication Interface (`src/components/AuthScreen.tsx`)
- Modern, clean, tabbed / segmented auth card design:
  - **Quick Sign-In Options**:
    - **Google Sign-In Button**: Retains prominent primary branding.
    - **Guest Mode Button**: 1-click instant login (`🚀 Continue as Guest` / `游客快速体验`), allowing parents or kids to start right away with cloud persistence.
  - **Divider**: *"or sign in with email"* / *"或使用邮箱登录"*
  - **Email & Password Form**:
    - Mode toggle: **Sign In** (`登录`) vs **Create Account** (`注册新账号`).
    - Input fields:
      - Display Name / Child's Name (on Sign Up mode).
      - Email address (`type="email"`).
      - Password (`type="password"`, minimum 6 characters with show/hide toggle).
    - **Sign In button** / **Create Account button** with loading state and disabled state while communicating with Firebase.
    - **Forgot Password?** (`忘记密码？`): Modal/inline prompt to send password reset email via Firebase.
    - Post-registration helper: displays prompt indicating that an optional verification link was sent, with a "Resend Verification Email" button if needed.
- Error handling with user-friendly messages in English and Chinese:
  - `auth/email-already-in-use` -> "This email is already registered. Please sign in instead."
  - `auth/invalid-email` -> "Please enter a valid email address."
  - `auth/weak-password` -> "Password must be at least 6 characters."
  - `auth/user-not-found` or `auth/wrong-password` or `auth/invalid-credential` -> "Invalid email or password."
  - `auth/too-many-requests` -> "Too many attempts. Please try again later."

### 3. User Badge & Guest Account Management (`src/App.tsx`)
- In topbar user badge:
  - If signed in as Guest: display `👤 Guest Learner` / `游客打卡` with an indicator badge.
  - If signed in with Email: display user's display name or email prefix.
- Ensure Firestore user document (`/users/{uid}`) is created with `{ email, displayName: displayName || (isAnonymous ? 'Guest Learner' : 'Learner') }` on first login for all methods.

### 4. Localization (i18n) & Styling
- Add keys in `src/constants.ts` (both `en` and `zh`):
  - `tab_signin`, `tab_signup`, `btn_guest_login`, `email_placeholder`, `password_placeholder`, `forgot_password`, `verification_email_sent`, `resend_verification`, etc.
- Add CSS styling in `src/index.css` matching the kid-friendly neo-brutalist theme (rounded corners, bold borders, pastel tints, high accessibility).

---

## Step-by-Step Implementation Steps

1. **Update Firebase Exports (`src/firebase.ts`)**:
   - Export `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendEmailVerification`, `sendPasswordResetEmail`, and `signInAnonymously`.
2. **Add I18N Strings (`src/constants.ts`)**:
   - Add English and Chinese strings for all email, password, guest mode, and error handling states.
3. **Upgrade AuthScreen (`src/components/AuthScreen.tsx`)**:
   - Implement tabs for Sign In vs Register.
   - Implement Email/Password form with validation.
   - Implement Guest Login button.
   - Implement optional Firebase email verification trigger and password reset flow.
4. **Update App Topbar Header (`src/App.tsx`)**:
   - Display appropriate avatar and name for Guest users.
5. **Styling & Verification**:
   - Add responsive styles in `src/index.css`.
   - Run `lint_applet` and `compile_applet` to verify clean build.
