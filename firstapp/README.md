# First App - React Authentication System

A modern React application with Firebase authentication, built with Vite.

## Features

- 🔐 **User Authentication**
  - Sign up with email and password
  - Login/Logout functionality
  - Password reset via email (Firebase)
  - Session persistence

- 🎨 **Modern UI**
  - Gradient styling
  - Responsive design
  - Smooth animations and hover effects

- 🛡️ **Protected Routes**
  - Dashboard accessible only to authenticated users
  - Automatic redirect to login page

- 🔥 **Firebase Integration**
  - Firebase Authentication
  - Cloud Firestore for user data
  - Real-time authentication state

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Navigation
- **Firebase** - Authentication and database
- **CSS3** - Styling with gradients and animations

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account (free tier)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mhpark03/firstapp.git
cd firstapp
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Follow the detailed instructions in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Update `src/config/firebase.js` with your Firebase configuration

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
firstapp/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── Dashboard.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── Auth.css
│   │   └── Dashboard.css
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── config/
│   │   └── firebase.js
│   ├── App.jsx
│   └── main.jsx
├── FIREBASE_SETUP.md
└── package.json
```

## Firebase Setup

**Important:** Before running the app, you must configure Firebase.

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed setup instructions.

## Usage

1. **Sign Up**: Create a new account with email and password
2. **Login**: Access your account
3. **Forgot Password**: Reset your password via email
4. **Dashboard**: View your profile and use action buttons
5. **Logout**: Sign out of your account

## Security Notes

- Firebase Authentication handles password hashing and security
- Firestore security rules should be configured for production
- Password reset is handled via Firebase email links
- Never commit your `firebase.js` configuration with real credentials to public repositories

## License

MIT

## Author

mhpark03
