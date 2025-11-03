// Firebase configuration and initialization
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAit5yUFIDwNEWgyZKAmpaLj1-8iVSFhyY",
  authDomain: "egumeni-eats-e2a32.firebaseapp.com",
  projectId: "egumeni-eats-e2a32",
  storageBucket: "egumeni-eats-e2a32.firebasestorage.app",
  messagingSenderId: "318471281511",
  appId: "1:318471281511:web:06b1bf9a0a5947cd746dc2",
  measurementId: "G-6N8MQ3XC6R"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

export default app
