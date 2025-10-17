# Firebase Setup Guide

This application uses Firebase for authentication and Firestore for data storage. Follow these steps to set up your Firebase project.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "firstapp")
4. (Optional) Enable Google Analytics
5. Click "Create project"

## Step 2: Register Your App

1. In your Firebase project dashboard, click the **Web** icon (`</>`) to add a web app
2. Register your app with a nickname (e.g., "firstapp-web")
3. **Do NOT check** "Set up Firebase Hosting" (unless you want to use it)
4. Click "Register app"
5. You'll see your Firebase configuration object - **copy this**

## Step 3: Configure Your App

1. Open `src/config/firebase.js` in your project
2. Replace the placeholder values with your Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 4: Enable Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click "Get started"
3. Go to the **Sign-in method** tab
4. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (for development)
   - **Note:** For production, you'll need to set up proper security rules
4. Select a location (closest to your users)
5. Click "Enable"

## Step 6: Configure Firestore Security Rules (Important!)

By default, test mode rules expire after 30 days. Set up proper security rules:

1. Go to **Firestore Database > Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection: users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

## Step 7: Configure Password Reset Email (Optional)

Firebase automatically sends password reset emails, but you can customize them:

1. Go to **Build > Authentication > Templates**
2. Click on "Password reset"
3. Customize the email template
4. Save changes

## Step 8: Test Your Application

1. Start your development server: `npm run dev`
2. Try signing up with a new account
3. Check Firebase Console > Authentication > Users to see your new user
4. Check Firestore Database > users collection for user data
5. Try logging out and logging back in
6. Test the "Forgot Password" feature (check your email)

## Troubleshooting

### Error: "Firebase: Error (auth/configuration-not-found)"
- Make sure you've replaced the placeholder values in `firebase.js`
- Verify your Firebase configuration is correct

### Error: "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure the user is authenticated

### Password reset email not received
- Check your spam folder
- Verify Email/Password authentication is enabled
- Make sure the email is registered in your Firebase project

### CORS errors
- This shouldn't happen with Firebase, but if it does, check your Firebase project settings
- Make sure your domain is authorized in Firebase Console > Authentication > Settings > Authorized domains

## Production Considerations

Before deploying to production:

1. **Update Firestore Security Rules** - Don't use test mode rules
2. **Set up Firebase App Check** - Protect your app from abuse
3. **Enable reCAPTCHA** - Prevent bot signups (automatically enabled by Firebase)
4. **Set up proper email templates** - Customize authentication emails
5. **Monitor usage** - Check Firebase Console for usage and quota
6. **Set up billing alerts** - Firebase free tier is generous but has limits

## Free Tier Limits

Firebase offers a generous free tier:
- **Authentication**: 10,000 phone authentications/month (email is unlimited)
- **Firestore**:
  - 1 GiB storage
  - 50,000 reads/day
  - 20,000 writes/day
  - 20,000 deletes/day

For most small to medium apps, this is more than enough!

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
