import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updatePassword
} from 'firebase/auth'
import { auth, db } from '../utils/firebase/config'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore'

/**
 * Authentication Context for Egumeni Eats
 *
 * Authentication Flow:
 * 1. Admin: Uses default credentials (admin@ump.ac.za / 2025)
 * 2. Customers: Can sign up directly via the signup form
 * 3. Hotel Staff: Created by admin via User Management dashboard
 *    - Staff login with email and password assigned by admin
 *    - Staff roles: kitchen, cashier, delivery, stores, supervisor
 *
 * All user data is stored in Firebase Auth + Firestore
 */

interface User {
  id: string
  email: string
  name: string
  role: string
  phone?: string
  staffNo?: string // For UMP staff members
  roomNumber?: string // For hotel guests
  visitorNo?: string // For conference attendees
  created_at: string
  isActive?: boolean
}

interface AuthContextType {
  user: User | null
  profile: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, name: string, role: string, phone?: string, staffNo?: string, roomNumber?: string, visitorNo?: string) => Promise<{ success: boolean; error?: string }>
  createStaff: (email: string, password: string, name: string, role: string, phone?: string, staffNo?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Default admin credentials - staff accounts are created by admin
const ADMIN_CREDENTIALS = {
  email: 'admin@tfokomalahotel.ump.ac.za',
  password: 'EfGoUoMdEsNyIsEtAeTmS', // Admin PIN
  role: 'admin',
  name: 'System Administrator'
}

// Demo customer for testing
const DEMO_CUSTOMER = {
  email: 'demo@egumenieats.local',
  password: 'demo123',
  role: 'customer',
  name: 'Demo Customer'
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing Firebase Auth session on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const userProfile: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || '',
              role: userData.role || 'customer',
              phone: userData.phone || '',
              staffNo: userData.staffNo || '',
              roomNumber: userData.roomNumber || '',
              visitorNo: userData.visitorNo || '',
              created_at: userData.created_at || userData.createdAt || new Date().toISOString(),
              isActive: userData.isActive !== false
            }
            setUser(userProfile)
            setProfile(userProfile)
            console.log('✅ Firebase user loaded:', userProfile.email, '-', userProfile.role)
          } else {
            console.warn('⚠️ Firebase user authenticated but no profile found in Firestore')
            // Sign out if no profile exists
            await signOut(auth)
          }
        } catch (error) {
          console.error('❌ Error loading Firebase user profile:', error)
          await signOut(auth)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate inputs
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' }
      }

      console.log('🔐 Attempting Firebase login for:', email)

      // Special handling for admin credentials (not in Firebase Auth)
      if (email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() && password === ADMIN_CREDENTIALS.password) {
        // Check if admin exists in Firestore, create if not
        const adminQuery = query(collection(db, 'users'), where('email', '==', ADMIN_CREDENTIALS.email))
        const adminSnap = await getDocs(adminQuery)

        if (adminSnap.empty) {
          // Create admin user in Firestore
          const adminId = 'admin-' + Date.now()
          await setDoc(doc(db, 'users', adminId), {
            name: ADMIN_CREDENTIALS.name,
            email: ADMIN_CREDENTIALS.email,
            role: ADMIN_CREDENTIALS.role,
            isActive: true,
            created_at: new Date().toISOString(),
            createdAt: Timestamp.now()
          })
          console.log('✅ Admin user created in Firestore')
        }

        // For admin, we simulate login without Firebase Auth
        const userData: User = {
          id: 'admin-001',
          email: ADMIN_CREDENTIALS.email,
          name: ADMIN_CREDENTIALS.name,
          role: ADMIN_CREDENTIALS.role,
          phone: '',
          created_at: new Date().toISOString(),
          isActive: true
        }

        console.log('✅ Admin login successful (bypass Firebase Auth)')
        setUser(userData)
        setProfile(userData)

        return { success: true }
      }

      // Special handling for demo customer (not in Firebase Auth)
      if (email.toLowerCase() === DEMO_CUSTOMER.email.toLowerCase() && password === DEMO_CUSTOMER.password) {
        // Check if demo customer exists in Firestore, create if not
        const demoQuery = query(collection(db, 'users'), where('email', '==', DEMO_CUSTOMER.email))
        const demoSnap = await getDocs(demoQuery)

        if (demoSnap.empty) {
          // Create demo user in Firestore
          const demoId = 'demo-' + Date.now()
          await setDoc(doc(db, 'users', demoId), {
            name: DEMO_CUSTOMER.name,
            email: DEMO_CUSTOMER.email,
            role: DEMO_CUSTOMER.role,
            isActive: true,
            created_at: new Date().toISOString(),
            createdAt: Timestamp.now()
          })
          console.log('✅ Demo customer created in Firestore')
        }

        // For demo, we simulate login without Firebase Auth
        const userData: User = {
          id: 'customer-demo',
          email: DEMO_CUSTOMER.email,
          name: DEMO_CUSTOMER.name,
          role: DEMO_CUSTOMER.role,
          phone: '',
          created_at: new Date().toISOString(),
          isActive: true
        }

        console.log('✅ Demo customer login successful (bypass Firebase Auth)')
        setUser(userData)
        setProfile(userData)

        return { success: true }
      }

      // For all users (including staff), use Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Get user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) {
        console.warn('⚠️ Firebase user authenticated but no profile found in Firestore')
        await signOut(auth)
        return { success: false, error: 'User profile not found. Please contact administrator.' }
      }

      const userData = userDoc.data()

      // Check if account is active
      if (userData.isActive === false) {
        console.warn('⚠️ User account is deactivated:', email)
        await signOut(auth)
        return {
          success: false,
          error: 'Your account has been deactivated. Please contact the administrator.'
        }
      }

      // User profile will be set by the onAuthStateChanged listener
      console.log('✅ Firebase login successful for:', email, '-', userData.role)

      return { success: true }

    } catch (error: any) {
      console.error('❌ Firebase login error:', error)

      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          error: `No account found for ${email}. Please sign up first or use demo credentials: demo@egumenieats.local / demo123`
        }
      } else if (error.code === 'auth/wrong-password') {
        return {
          success: false,
          error: 'Incorrect password. Please try again or contact your administrator to reset your password.'
        }
      } else if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address.' }
      } else if (error.code === 'auth/user-disabled') {
        return { success: false, error: 'This account has been disabled.' }
      } else if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many failed login attempts. Please try again later.' }
      }

      return { success: false, error: 'Login failed - please try again' }
    }
  }

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: string,
    phone?: string,
    staffNo?: string,
    roomNumber?: string,
    visitorNo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔐 Starting Firebase signup process:', { email, name, role })

      // Allow admin signups but only if they provide the correct PIN (handled in Login.tsx)
      // Staff accounts must be created by admin
      if (role !== 'customer' && role !== 'admin') {
        return {
          success: false,
          error: 'Only customers and administrators can sign up directly. Staff accounts must be created by an administrator.'
        }
      }

      // Check if user already exists in Firestore (case-insensitive)
      const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()))
      const existingUsers = await getDocs(usersQuery)

      if (!existingUsers.empty) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Check against admin and demo emails
      if (email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() ||
          email.toLowerCase() === DEMO_CUSTOMER.email.toLowerCase()) {
        return { success: false, error: 'This email is reserved' }
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Create user profile in Firestore
      const userProfile = {
        name,
        email: email.toLowerCase(), // Store email in lowercase for consistency
        role: role === 'admin' ? 'admin' : 'customer', // Allow admin role for verified admin signups
        phone: phone || '',
        staffNo: staffNo || '',
        roomNumber: roomNumber || '',
        visitorNo: visitorNo || '',
        isActive: true,
        created_at: new Date().toISOString(),
        createdAt: Timestamp.now(),
        createdBy: role === 'admin' ? 'admin-signup' : 'self-signup' // Track admin vs customer signup
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), userProfile)

      console.log('💾 Created new Firebase user:', {
        email: userProfile.email,
        name: userProfile.name,
        uid: firebaseUser.uid
      })

      console.log(`✅ ${role === 'admin' ? 'Admin' : 'Customer'} signup successful - user must now log in`)

      // DO NOT auto-login - user must sign in manually
      return { success: true }

    } catch (error: any) {
      console.error('❌ Firebase signup error:', error)

      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'An account with this email already exists' }
      } else if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address' }
      } else if (error.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak. Please choose a stronger password.' }
      } else if (error.code === 'auth/operation-not-allowed') {
        return { success: false, error: 'Email/password accounts are not enabled. Please contact administrator.' }
      }

      return { success: false, error: 'Signup failed - please try again' }
    }
  }

  const createStaff = async (
    email: string,
    password: string,
    name: string,
    role: string,
    phone?: string,
    staffNo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('👷 Starting Firebase staff creation process:', { email, name, role })

      // Validate role - only staff roles allowed
      const allowedRoles = ['cashier', 'kitchen', 'delivery', 'stores', 'supervisor']
      if (!allowedRoles.includes(role)) {
        return {
          success: false,
          error: 'Invalid staff role. Must be one of: cashier, kitchen, delivery, stores, supervisor'
        }
      }

      // Check if user already exists in Firestore (case-insensitive)
      const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()))
      const existingUsers = await getDocs(usersQuery)

      if (!existingUsers.empty) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Check against admin and demo emails
      if (email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() ||
          email.toLowerCase() === DEMO_CUSTOMER.email.toLowerCase()) {
        return { success: false, error: 'This email is reserved' }
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Create staff profile in Firestore using Firebase Auth UID
      const staffProfile = {
        name,
        email: email.toLowerCase(), // Store email in lowercase for consistency
        role,
        phone: phone || '',
        staffNo: staffNo || '',
        isActive: true,
        created_at: new Date().toISOString(),
        createdAt: Timestamp.now(),
        createdBy: profile?.id || 'admin', // Track who created this staff member
        createdByName: profile?.name || 'Administrator'
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), staffProfile)

      console.log('💾 Created new Firebase Auth + Firestore staff user:', {
        email: staffProfile.email,
        name: staffProfile.name,
        role: staffProfile.role,
        uid: firebaseUser.uid
      })

      console.log(`✅ Staff creation successful: ${role} - ${name} (Firebase Auth + Firestore)`)

      return { success: true }

    } catch (error: any) {
      console.error('❌ Staff creation error:', error)

      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'An account with this email already exists' }
      } else if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address' }
      } else if (error.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak. Please choose a stronger password.' }
      } else if (error.code === 'auth/operation-not-allowed') {
        return { success: false, error: 'Email/password accounts are not enabled. Please contact administrator.' }
      } else if (error.code === 'permission-denied') {
        return { success: false, error: 'You do not have permission to create staff accounts' }
      }

      return { success: false, error: 'Failed to create staff account - please try again' }
    }
  }

  const logout = async () => {
    try {
      console.log('👋 Logging out user')

      // Sign out from Firebase Auth
      await signOut(auth)

      // Clear local state (Firebase Auth state change will handle the rest)
      setUser(null)
      setProfile(null)

      console.log('✅ Firebase logout successful')
    } catch (error) {
      console.error('❌ Firebase logout error:', error)
      // Even if Firebase logout fails, clear local state
      setUser(null)
      setProfile(null)
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
    login,
    signup,
    createStaff,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider