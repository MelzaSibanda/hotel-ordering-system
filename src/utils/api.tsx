// Firebase-based API for Egumeni Eats system
// This replaces the localStorage-based API with Firebase Firestore/Auth

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  UserCredential,
  User
} from 'firebase/auth'
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from './firebase/config'

// Firebase-based API functions

// Authentication functions
export const signupUser = async (email: string, password: string, name: string, role: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  const user = userCredential.user

  await addDoc(collection(db, 'users'), {
    name,
    email,
    role,
    isActive: true,
    createdAt: serverTimestamp()
  })

  return user
}

export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password)
}

export const logoutUser = async (): Promise<void> => {
  await signOut(auth)
}

export const resetUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  // Note: This requires admin privileges and proper user management
  // For now, we'll update the password in Firestore (in a real app, use Firebase Admin SDK)
  await updatePassword(auth.currentUser!, newPassword)
}

// Menu management functions
export const addMenuItem = async (item: any): Promise<any> => {
  const docRef = await addDoc(collection(db, 'menu'), {
    ...item,
    createdAt: serverTimestamp(),
    isAvailable: true,
  })
  return { id: docRef.id, ...item }
}

export const updateMenuItem = async (itemId: string, updatedData: any): Promise<void> => {
  await updateDoc(doc(db, 'menu', itemId), updatedData)
}

export const deleteMenuItem = async (itemId: string): Promise<void> => {
  await deleteDoc(doc(db, 'menu', itemId))
}

export const getMenuItems = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'menu'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Order management functions
export const getOrders = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'orders'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const updateOrderStatus = async (orderId: string, status: string): Promise<void> => {
  await updateDoc(doc(db, 'orders', orderId), { status })
}

// User management functions
export const getUsers = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const updateUser = async (userId: string, updatedData: any): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), updatedData)
}

export const createUser = async (userData: any): Promise<any> => {
  const docRef = await addDoc(collection(db, 'users'), {
    ...userData,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, ...userData }
}

// Shift management functions
export const getShifts = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'shifts'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const createShift = async (shiftData: any): Promise<any> => {
  const docRef = await addDoc(collection(db, 'shifts'), {
    ...shiftData,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, ...shiftData }
}

export const endShift = async (shiftId: string, endTime: string): Promise<void> => {
  await updateDoc(doc(db, 'shifts', shiftId), {
    endTime,
    status: 'completed'
  })
}

// Inventory management functions
export const getInventory = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'inventory'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const addInventoryItem = async (item: any): Promise<any> => {
  const docRef = await addDoc(collection(db, 'inventory'), {
    ...item,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, ...item }
}

export const updateInventoryItem = async (itemId: string, updatedData: any): Promise<void> => {
  await updateDoc(doc(db, 'inventory', itemId), updatedData)
}

// Logo management functions - Store base64 in Firestore to avoid CORS issues
export const uploadLogo = async (file: File): Promise<string> => {
  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // Save base64 logo to Firestore settings
  await setDoc(doc(db, 'settings', 'logo'), {
    base64: base64,
    filename: file.name,
    uploadedAt: serverTimestamp(),
    uploadedBy: auth.currentUser?.email || 'admin'
  })

  return base64
}

export const getLogo = async (): Promise<string | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'logo'))
    if (docSnap.exists()) {
      const data = docSnap.data()
      return data.base64 || null
    }
    return null
  } catch (error) {
    console.error('Failed to get logo:', error)
    return null
  }
}

// Recipe management functions
export const getRecipes = async (): Promise<any[]> => {
  const snapshot = await getDocs(collection(db, 'recipes'))
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const saveRecipe = async (recipe: any): Promise<void> => {
  const existing = await getDocs(query(collection(db, 'recipes'), where('menuItemId', '==', recipe.menuItemId)))
  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, recipe)
  } else {
    await addDoc(collection(db, 'recipes'), recipe)
  }
}

export const getRecipe = async (menuItemId: string): Promise<any> => {
  const snapshot = await getDocs(query(collection(db, 'recipes'), where('menuItemId', '==', menuItemId)))
  if (!snapshot.empty) {
    return snapshot.docs[0].data()
  }
  return null
}

// Analytics and reporting functions
export const generateDailyReport = async (date: string): Promise<any> => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const ordersSnap = await getDocs(query(
    collection(db, 'orders'),
    where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
    where('createdAt', '<=', Timestamp.fromDate(endOfDay))
  ))

  const orders = ordersSnap.docs.map(doc => doc.data())
  const totalSales = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
  const totalOrders = orders.length

  await addDoc(collection(db, 'reports'), {
    date,
    totalOrders,
    totalSales,
    generatedAt: serverTimestamp(),
    generatedBy: auth.currentUser?.email || 'system'
  })

  return { totalSales, totalOrders, orders }
}

export const generateAnalyticsReport = async (start: string, end: string): Promise<any> => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  const ordersSnap = await getDocs(query(
    collection(db, 'orders'),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  ))

  return ordersSnap.docs.map(doc => doc.data())
}

// Helper functions to match the localStorage API interface
export const getCategories = async (): Promise<any[]> => {
  const menuItems = await getMenuItems()
  const categories = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)))
  return categories.map(cat => ({ id: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1) }))
}

export const addOrder = async (order: any): Promise<any> => {
  const docRef = await addDoc(collection(db, 'orders'), {
    ...order,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, ...order }
}

export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const getOrdersByCustomer = async (customerId: string): Promise<any[]> => {
  const ordersSnap = await getDocs(query(
    collection(db, 'orders'),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  ))
  return ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Menu categories constant
export const MENU_CATEGORIES = ['appetizers', 'main-courses', 'desserts', 'beverages']

// Type definitions to match the localStorage interface
export type MenuItem = {
  id: string
  name: string
  description?: string
  price: number
  category: string
  available: boolean
  image?: string
  prepTime?: number
  ingredients?: string[]
  allergens?: string[]
}

export type Category = {
  id: string
  name: string
}

export type Order = {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  items: Array<{
    menuItemId: string
    name: string
    price: number
    quantity: number
    specialInstructions?: string
  }>
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'failed'
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  tableNumber?: string
  deliveryAddress?: string
  specialInstructions?: string
  orderDate: string
  estimatedTime: number
}

// Data verification function
export const getDataStatus = async (): Promise<any> => {
  const [menuSnap, invSnap, recipeSnap, orderSnap, userSnap, shiftSnap] = await Promise.all([
    getDocs(collection(db, 'menu')),
    getDocs(collection(db, 'inventory')),
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'shifts')),
  ])

  // Extract categories from menu
  const menuCategories = Array.from(
    new Set(menuSnap.docs.map(doc => doc.data().category).filter(Boolean))
  )

  // Fetch last 5 orders
  const recentOrdersSnap = await getDocs(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5))
  )
  const recentOrders = recentOrdersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })).map((order: any) => ({
    id: order.id,
    status: order.status || 'unknown',
    paymentStatus: order.paymentStatus || 'unpaid',
          totalAmount: order.totalAmount || order.total_amount || 0,
          itemCount: order.items ? order.items.length : 0,
    createdAt: order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : new Date().toISOString(),
    customerName: order.customerName || 'N/A',
  }))

  return {
    dataStatus: 'success',
    timestamp: new Date().toISOString(),
    counts: {
      menuItems: menuSnap.size,
      inventoryItems: invSnap.size,
      recipes: recipeSnap.size,
      orders: orderSnap.size,
      userProfiles: userSnap.size,
      shifts: shiftSnap.size,
    },
    menuCategories,
    recentOrders,
    systemInfo: {
      database: 'Firestore',
      dataType: 'persistent',
      environment: 'production',
    },
  }
}

// Simulate API request handling for backward compatibility
export const api = {
  request: async (endpoint: string, options?: RequestInit): Promise<any> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))

    const method = options?.method || 'GET'
    const body = options?.body ? JSON.parse(options.body as string) : null

    // Menu endpoints
    if (endpoint === '/menu') {
      if (method === 'GET') {
        const items = await getMenuItems()
        const categories = Array.from(new Set(items.map(item => item.category).filter(Boolean)))

        // Group by category
        const menu: any = {}
        categories.forEach(cat => {
          menu[cat.toLowerCase()] = items.filter(item => item.category === cat)
        })

        return { menu }
      }
      
      if (method === 'POST') {
        const newItem = await addMenuItem({
          name: body.name,
          description: body.description || '',
          price: body.price,
          category: body.category,
          image: body.image || '',
          available: body.isAvailable !== undefined ? body.isAvailable : true,
          prepTime: body.preparationTime || 15,
          ingredients: body.ingredients || [],
          allergens: [],
        })

        return { menuItem: newItem }
      }
    }

    // Menu item update/delete
    if (endpoint.startsWith('/menu/')) {
      const itemId = endpoint.split('/')[2]

      if (method === 'PUT') {
        await updateMenuItem(itemId, {
          ...body,
          price: body.price,
          prepTime: body.preparationTime,
          available: body.isAvailable
        })
        const updatedItem = await getMenuItems().then(items => items.find(i => i.id === itemId))
        return { menuItem: updatedItem }
      }

      if (method === 'DELETE') {
        await deleteMenuItem(itemId)
        return { success: true }
      }
    }

    // Orders endpoints
    if (endpoint === '/orders') {
      if (method === 'GET') {
        const orders = await getOrders()
        // Transform createdAt to orderDate and total_amount to totalAmount for frontend compatibility
        const transformedOrders = orders.map(order => ({
          ...order,
          orderDate: order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : order.createdAt,
          totalAmount: order.totalAmount || order.total_amount || 0
        }))
        return { orders: transformedOrders }
      }
    }

    if (endpoint === '/pos/order/create') {
      if (method === 'POST') {
        console.log('📝 Creating new order:', body)

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

        // Create order data
        const orderData = {
          ...body,
          orderNumber,
          createdAt: serverTimestamp(),
          shiftId: null, // Will be set if shift is active
          cashierId: auth.currentUser?.uid || null,
          cashierName: auth.currentUser?.email || null,
        }

        // Add order to Firestore
        const docRef = await addDoc(collection(db, 'orders'), orderData)
        const order = { id: docRef.id, ...orderData }

        console.log('✅ Order created successfully:', orderNumber)
        return { success: true, order }
      }
    }

    // Analytics endpoints
    if (endpoint === '/reports/analytics') {
      if (method === 'POST') {
        console.log('📊 Generating analytics report:', body)

        const { startDate, endDate } = body
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Include the entire end date

        // Get orders within date range
        const ordersSnap = await getDocs(query(
          collection(db, 'orders'),
          where('createdAt', '>=', Timestamp.fromDate(start)),
          where('createdAt', '<=', Timestamp.fromDate(end))
        ))

        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]

        // Calculate analytics
        const totalOrders = orders.length
        const totalSales = orders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

        // Daily breakdown
        const dailySales = []
        const currentDate = new Date(start)
        while (currentDate <= end) {
          const dayStart = new Date(currentDate)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(currentDate)
          dayEnd.setHours(23, 59, 59, 999)

          const dayOrders = orders.filter((order: any) => {
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt)
            return orderDate >= dayStart && orderDate <= dayEnd
          })

          const dayRevenue = dayOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

          dailySales.push({
            date: currentDate.toISOString().split('T')[0],
            orders: dayOrders.length,
            sales: dayRevenue
          })

          currentDate.setDate(currentDate.getDate() + 1)
        }

        // Top items analysis
        const itemSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {}
        orders.forEach((order: any) => {
          (order.items || []).forEach((item: any) => {
            const itemName = item.name || 'Unknown Item'
            if (!itemSales[itemName]) {
              itemSales[itemName] = { name: itemName, quantity: 0, revenue: 0 }
            }
            itemSales[itemName].quantity += item.quantity || 0
            itemSales[itemName].revenue += ((item.price || 0) * (item.quantity || 0))
          })
        })

        const topItems = Object.values(itemSales)
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 10)

        const analytics = {
          totalOrders,
          totalSales,
          generatedAt: new Date().toISOString(),
          generatedBy: auth.currentUser?.email || 'System',
          dailySales,
          topItems
        }

        console.log('✅ Analytics generated:', { totalOrders, totalSales })
        return { analytics }
      }
    }

    if (endpoint.match(/\/orders\/.*\/status/)) {
      const orderId = endpoint.split('/')[2]
      await updateOrderStatus(orderId, body.status)
      const orders = await getOrders()
      const order = orders.find(o => o.id === orderId)
      return { order }
    }

    // Users endpoints
    if (endpoint === '/users') {
      if (method === 'GET') {
        const users = await getUsers()
        return { users }
      }

      if (method === 'POST') {
        const users = await getUsers()

        // Check if user with this email already exists
        const existingUser = users.find(u => u.email.toLowerCase() === body.email.toLowerCase())
        if (existingUser) {
          throw new Error('A user with this email already exists')
        }

        // Create staff user profile in Firestore (staff authentication handled in AuthContext)
        const staffUserId = `staff-${body.email.replace('@', '-').replace('.', '-')}-${Date.now()}`
        const staffUserData = {
          email: body.email,
          password: body.password, // Store password for AuthContext staff login
          name: body.name,
          role: body.role,
          phone: body.phone || '',
          isActive: true,
          created_at: new Date().toISOString(), // Use snake_case to match AuthContext expectations
          createdAt: new Date().toISOString(), // Keep for backward compatibility
          createdBy: auth.currentUser?.uid || 'admin',
          createdByName: auth.currentUser?.email || 'Administrator'
        }

        await setDoc(doc(db, 'users', staffUserId), staffUserData)

        const newUser = { id: staffUserId, ...body }

        console.log('✅ Staff member profile created successfully:', {
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          id: newUser.id
        })

        return { user: newUser }
      }
    }

    if (endpoint.startsWith('/users/')) {
      const pathParts = endpoint.split('/')
      const userId = pathParts[2]

      if (endpoint.endsWith('/status')) {
        if (method === 'PUT') {
          await updateUser(userId, { isActive: body.isActive })
          const users = await getUsers()
          const user = users.find(u => u.id === userId)
          return { user }
        }
      } else if (endpoint.endsWith('/reset-password')) {
        if (method === 'POST') {
          await resetUserPassword(userId, body.newPassword)
          return { success: true }
        }
      } else {
        if (method === 'PUT') {
          await updateUser(userId, {
            ...body,
            updatedAt: serverTimestamp()
          })
          const users = await getUsers()
          const user = users.find(u => u.id === userId)
          return { user }
        }
      }
    }

    // Shifts endpoints
    if (endpoint === '/shifts') {
      if (method === 'GET') {
        const shifts = await getShifts()
        return { shifts }
      }

      if (method === 'POST') {
        const users = await getUsers()
        const user = users.find(u => u.id === body.userId)

        if (!user) {
          throw new Error('User not found')
        }

        const newShift = await createShift({
          userId: body.userId,
          userName: user.name,
          userRole: user.role,
          shiftType: body.shiftType,
          startTime: body.startTime,
          expectedEndTime: body.expectedEndTime,
          endTime: null,
          status: 'active',
          createdBy: auth.currentUser?.uid || 'admin',
          createdByName: auth.currentUser?.email || 'Administrator'
        })

        return { shift: newShift }
      }
    }

    if (endpoint === '/pos/shift/open') {
      if (method === 'POST') {
        console.log('🔄 Opening shift for user:', auth.currentUser?.uid)

        // Check if user already has an open shift
        const existingShifts = await getShifts()
        const openShift = existingShifts.find(s =>
          s.userId === auth.currentUser?.uid && s.status === 'open'
        )

        if (openShift) {
          console.log('⚠️ User already has an open shift:', openShift.id)
          return { shift: openShift }
        }

        // Create new shift
        const newShift = await createShift({
          userId: auth.currentUser?.uid,
          userName: auth.currentUser?.email || 'Unknown',
          userRole: 'cashier', // Assume cashier role for now
          shiftType: 'cashier',
          openingFloat: body.openingFloat,
          expectedCash: body.openingFloat,
          startTime: new Date().toISOString(),
          expectedEndTime: null,
          endTime: null,
          status: 'open',
          createdBy: auth.currentUser?.uid || 'admin',
          createdByName: auth.currentUser?.email || 'Administrator'
        })

        console.log('✅ Shift opened successfully:', newShift.id)
        return { shift: newShift }
      }
    }

    if (endpoint === '/pos/shift/current') {
      if (method === 'GET') {
        console.log('🔍 Getting current shift for user:', auth.currentUser?.uid)

        const shifts = await getShifts()
        const currentShift = shifts.find(s =>
          s.userId === auth.currentUser?.uid && s.status === 'open'
        )

        if (currentShift) {
          console.log('✅ Found current shift:', currentShift.id)
          return { shift: currentShift }
        } else {
          console.log('⚠️ No current shift found')
          return { shift: null }
        }
      }
    }

    if (endpoint === '/pos/shift/cash-up') {
      if (method === 'POST') {
        console.log('💰 Performing cash up for shift:', body.shiftId)

        const shifts = await getShifts()
        const shift = shifts.find(s => s.id === body.shiftId)

        if (!shift) {
          throw new Error('Shift not found')
        }

        // Calculate actual cash from denominations
        const actualCash = Object.entries(body.denominations).reduce(
          (sum, [denom, count]) => sum + (parseFloat(denom) * (count as number)),
          0
        )

        const cashVariance = actualCash - shift.expectedCash

        // Update shift with cash up data
        await updateDoc(doc(db, 'shifts', body.shiftId), {
          actualCash,
          cashVariance,
          cashUpData: body.denominations,
          cashUpTime: serverTimestamp(),
          status: body.type === 'end_shift' ? 'closed' : 'open'
        })

        console.log('✅ Cash up completed for shift:', body.shiftId)
        return { success: true }
      }
    }

    if (endpoint.match(/\/shifts\/.*\/end/)) {
      const shiftId = endpoint.split('/')[2]
      await endShift(shiftId, body.endTime)
      const shifts = await getShifts()
      const shift = shifts.find(s => s.id === shiftId)
      return { shift }
    }

    // Inventory endpoints
    if (endpoint === '/pos/inventory') {
      if (method === 'GET') {
        console.log('📦 GET /pos/inventory endpoint called')
        const inventory = await getInventory()
        console.log('📊 Retrieved inventory:', inventory.length, 'items')
        if (inventory.length > 0) {
          console.log('🔍 Sample item:', inventory[0])
        } else {
          console.log('⚠️ No inventory items found in Firestore')
        }
        return { items: inventory }
      }

      if (method === 'POST') {
        const newItem = await addInventoryItem({
          name: body.name,
          category: body.category,
          unit: body.unit,
          currentStock: body.currentStock || 0,
          minStock: body.minStock || 0,
          maxStock: body.maxStock || 0,
          unitCost: body.unitCost || 0,
          supplier: body.supplier || '',
          barcode: body.barcode || '',
          location: body.location || '',
        })

        console.log('✅ Inventory item created:', newItem)
        return { item: newItem }
      }
    }
    
    // Initialize basic inventory items
    if (endpoint === '/init-inventory') {
      if (method === 'POST') {
        console.log('🌱 init-inventory endpoint called')
        const inventory = await getInventory()
        console.log('📊 Current inventory count:', inventory.length)

        // Only create if inventory is empty
        if (inventory.length > 0) {
          console.log('⚠️ Inventory already has items, skipping creation')
          return { count: 0, message: 'Inventory already has items' }
        }

        const basicItems = [
          { name: 'Flour', category: 'ingredients', unit: 'kg', currentStock: 50, minStock: 10, maxStock: 100, unitCost: 15.50, supplier: 'Bakers Supply', location: 'Dry Goods' },
          { name: 'Sugar', category: 'ingredients', unit: 'kg', currentStock: 30, minStock: 10, maxStock: 80, unitCost: 18.00, supplier: 'Bakers Supply', location: 'Dry Goods' },
          { name: 'Salt', category: 'ingredients', unit: 'kg', currentStock: 25, minStock: 5, maxStock: 50, unitCost: 8.50, supplier: 'Bakers Supply', location: 'Dry Goods' },
          { name: 'Cooking Oil', category: 'ingredients', unit: 'L', currentStock: 40, minStock: 15, maxStock: 100, unitCost: 45.00, supplier: 'Food Distributors', location: 'Pantry' },
          { name: 'Rice', category: 'ingredients', unit: 'kg', currentStock: 60, minStock: 20, maxStock: 150, unitCost: 22.00, supplier: 'Food Distributors', location: 'Dry Goods' },
          { name: 'Pasta', category: 'ingredients', unit: 'kg', currentStock: 35, minStock: 10, maxStock: 80, unitCost: 28.50, supplier: 'Food Distributors', location: 'Dry Goods' },
          { name: 'Tomato Sauce', category: 'ingredients', unit: 'L', currentStock: 25, minStock: 10, maxStock: 60, unitCost: 35.00, supplier: 'Food Distributors', location: 'Pantry' },
          { name: 'Milk', category: 'beverages', unit: 'L', currentStock: 45, minStock: 20, maxStock: 100, unitCost: 18.00, supplier: 'Dairy Fresh', location: 'Cold Storage' },
          { name: 'Coffee', category: 'beverages', unit: 'kg', currentStock: 10, minStock: 3, maxStock: 25, unitCost: 120.00, supplier: 'Beverage Supply', location: 'Dry Goods' },
          { name: 'Tea', category: 'beverages', unit: 'kg', currentStock: 8, minStock: 2, maxStock: 20, unitCost: 85.00, supplier: 'Beverage Supply', location: 'Dry Goods' },
          { name: 'Orange Juice', category: 'beverages', unit: 'L', currentStock: 30, minStock: 15, maxStock: 80, unitCost: 28.00, supplier: 'Beverage Supply', location: 'Cold Storage' },
          { name: 'Mineral Water', category: 'beverages', unit: 'bottles', currentStock: 150, minStock: 50, maxStock: 300, unitCost: 8.50, supplier: 'Beverage Supply', location: 'Storage Room' },
          { name: 'Paper Plates', category: 'supplies', unit: 'pcs', currentStock: 500, minStock: 100, maxStock: 1000, unitCost: 2.50, supplier: 'Packaging Plus', location: 'Supply Room' },
          { name: 'Plastic Cups', category: 'supplies', unit: 'pcs', currentStock: 400, minStock: 100, maxStock: 800, unitCost: 1.80, supplier: 'Packaging Plus', location: 'Supply Room' },
          { name: 'Napkins', category: 'supplies', unit: 'packs', currentStock: 80, minStock: 20, maxStock: 150, unitCost: 25.00, supplier: 'Packaging Plus', location: 'Supply Room' },
          { name: 'Aluminum Foil', category: 'supplies', unit: 'rolls', currentStock: 15, minStock: 5, maxStock: 30, unitCost: 45.00, supplier: 'Packaging Plus', location: 'Supply Room' },
          { name: 'Dish Soap', category: 'supplies', unit: 'L', currentStock: 12, minStock: 5, maxStock: 25, unitCost: 38.00, supplier: 'Cleaning Supplies Co', location: 'Cleaning Area' },
          { name: 'Trash Bags', category: 'supplies', unit: 'rolls', currentStock: 20, minStock: 10, maxStock: 50, unitCost: 55.00, supplier: 'Cleaning Supplies Co', location: 'Supply Room' }
        ]

        console.log('🏗️ Creating', basicItems.length, 'basic inventory items')

        const newItems = await Promise.all(basicItems.map(item => addInventoryItem({
          ...item,
          barcode: '',
        })))

        console.log('✅ Created and saved', newItems.length, 'basic inventory items')
        console.log('🔍 Sample item:', newItems[0])

        return { count: newItems.length, items: newItems }
      }
    }
    
    // Receive stock endpoint
    if (endpoint === '/pos/inventory/receive') {
      if (method === 'POST') {
        console.log('📦 Receive stock endpoint called')
        console.log('📋 Receipt data:', body)

        const inventory = await getInventory()
        console.log('📊 Current inventory count:', inventory.length)

        // Update inventory quantities
        let updatedCount = 0
        for (const receivedItem of body.items) {
          const inventoryItem = inventory.find(item => item.id === receivedItem.inventoryId)
          if (inventoryItem) {
            const oldStock = inventoryItem.currentStock
            const newStock = oldStock + receivedItem.quantity
            await updateInventoryItem(inventoryItem.id, {
              currentStock: newStock,
              unitCost: receivedItem.unitCost,
              updatedAt: serverTimestamp()
            })
            console.log(`  ✅ ${inventoryItem.name}: ${oldStock} → ${newStock} ${inventoryItem.unit}`)
            updatedCount++
          } else {
            console.error(`  ❌ Inventory item not found: ${receivedItem.inventoryId}`)
          }
        }

        console.log(`✅ Stock received successfully! Updated ${updatedCount} items`)
        console.log('📊 New inventory count:', (await getInventory()).length)

        return { receipt: body, updatedCount }
      }
    }
    
    // Low stock items
    if (endpoint === '/pos/inventory/low-stock') {
      if (method === 'GET') {
        const inventory = await getInventory()
        const lowStockItems = inventory.filter(item => item.currentStock <= item.minStock)
        return { items: lowStockItems }
      }
    }
    
    // Pending issues (placeholder for now)
    if (endpoint === '/pos/inventory/issues/pending') {
      if (method === 'GET') {
        // TODO: Implement Firebase-based stock issues tracking
        return { issues: [] }
      }
    }
    
    // Stock count
    if (endpoint === '/pos/inventory/count') {
      if (method === 'POST') {
        // Update inventory with counted quantities
        const inventory = await getInventory()
        for (const countItem of body.items) {
          const inventoryItem = inventory.find(item => item.id === countItem.inventoryId)
          if (inventoryItem) {
            await updateInventoryItem(inventoryItem.id, {
              currentStock: countItem.countedQuantity,
              updatedAt: serverTimestamp()
            })
          }
        }

        console.log('✅ Stock count completed')
        return { stockCount: body }
      }
    }

    // Recipe endpoints
    if (endpoint === '/pos/recipe') {
      if (method === 'POST') {
        await saveRecipe({
          menuItemId: body.menuItemId,
          ingredients: body.ingredients,
          updatedAt: serverTimestamp()
        })
        return { recipe: body }
      }
    }

    if (endpoint.startsWith('/pos/recipe/')) {
      const menuItemId = endpoint.split('/')[3]
      const recipe = await getRecipe(menuItemId)
      return { recipe }
    }

    // Logo endpoints - Store base64 in Firestore
    if (endpoint === '/logo/upload') {
      if (method === 'POST') {
        console.log('🖼️ Logo upload endpoint called')

        // Convert base64 to blob if needed
        let file: File
        if (body.file) {
          // If file is passed directly
          file = body.file
        } else if (body.base64) {
          // Convert base64 to file
          const response = await fetch(body.base64)
          const blob = await response.blob()
          file = new File([blob], body.filename || 'logo.png', { type: 'image/png' })
        } else {
          throw new Error('No file or base64 data provided')
        }

        const logoBase64 = await uploadLogo(file)
        console.log('✅ Logo uploaded successfully to Firestore')

        return { logoUrl: logoBase64 }
      }
    }

    if (endpoint === '/logo') {
      if (method === 'GET') {
        const logoBase64 = await getLogo()
        return { logoUrl: logoBase64 }
      }
    }

    // Debug endpoints
    if (endpoint === '/debug/data-status') {
      const [menuItems, inventory, recipes, orders, users, shifts] = await Promise.all([
        getMenuItems(),
        getInventory(),
        getRecipes(),
        getOrders(),
        getUsers(),
        getShifts()
      ])

      // Extract categories from menu items
      const categories = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)))

      // Get recent orders (last 5)
      const recentOrders = orders
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(order => ({
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentMethod || 'cash',
          totalAmount: order.totalAmount || order.total_amount || 0,
          itemCount: order.items?.length || 0,
          createdAt: order.createdAt,
          customerName: order.customerInfo?.name || 'Guest'
        }))

      return {
        dataStatus: 'active',
        timestamp: new Date().toISOString(),
        counts: {
          menuItems: menuItems.length,
          inventoryItems: inventory.length,
          recipes: recipes.length,
          orders: orders.length,
          userProfiles: users.length,
          shifts: shifts.length
        },
        menuCategories: categories,
        recentOrders,
        systemInfo: {
          database: 'Firestore',
          dataType: 'persistent',
          environment: 'production'
        }
      }
    }

    // Default response
    return { success: true }
  },

  clearCache: () => {
    // No-op for localStorage-based system
  }
}
