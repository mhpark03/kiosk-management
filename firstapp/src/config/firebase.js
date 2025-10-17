import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// TODO: Replace with your Firebase project configuration
// Get this from: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIX2eKt1tA0emuUrkh-0UDqKUX84ykIRo",
  authDomain: "firstapp-95284.firebaseapp.com",
  projectId: "firstapp-95284",
  storageBucket: "firstapp-95284.firebasestorage.app",
  messagingSenderId: "357639648849",
  appId: "1:357639648849:web:195061b3e29ecd5d812a70"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
