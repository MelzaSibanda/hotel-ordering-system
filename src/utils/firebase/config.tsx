// Firebase configuration and initialization
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAit5yUFIDwNEWgyZKAmpaLj1-8iVSFhyY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "egumeni-eats-e2a32.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "egumeni-eats-e2a32",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "egumeni-eats-e2a32.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "318471281511",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:318471281511:web:06b1bf9a0a5947cd746dc2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6N8MQ3XC6R"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

export default app
