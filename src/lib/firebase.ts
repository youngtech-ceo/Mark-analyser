import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

// User-provided Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCUwsvNGxWj98aMkuzFHXwBRl91xLbacwY",
  authDomain: "yt-web-58043.firebaseapp.com",
  databaseURL: "https://yt-web-58043-default-rtdb.firebaseio.com",
  projectId: "yt-web-58043",
  storageBucket: "yt-web-58043.firebasestorage.app",
  messagingSenderId: "32116509565",
  appId: "1:32116509565:web:143feab9e000dcabf81a14",
  measurementId: "G-Z6VT7XHZPD",
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db: Database = getDatabase(app);
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

