// src/utils/firebase/firestore.tsx

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  limit
} from 'firebase/firestore'
import { db } from './config'

// Define your Firestore collections here
export const collections = {
  inventory: collection(db, 'inventory'),
  menu: collection(db, 'menu'),
  users: collection(db, 'users'),
  orders: collection(db, 'orders'),
  recipes: collection(db, 'recipes'),
  inventoryRequests: collection(db, 'inventory_requests'),
  inventoryUsage: collection(db, 'inventory_usage'),
  stockIssues: collection(db, 'inventory_issues'),
}

// Main Firestore operations object
export const firestoreService = {
  // ✅ Decrement inventory stock
  decrementStock: async (inventoryId: string, quantity: number) => {
    const inventoryRef = doc(collections.inventory, inventoryId)
    const inventorySnap = await getDoc(inventoryRef)

    if (!inventorySnap.exists()) {
      throw new Error('Inventory item not found')
    }

    const currentStock = inventorySnap.data().currentStock || 0
    const newStock = Math.max(0, currentStock - quantity)

    await updateDoc(inventoryRef, {
      currentStock: newStock,
      updatedAt: Timestamp.now(),
    })

    return newStock
  },

  // ✅ Add new inventory item
  addInventoryItem: async (itemData: any) => {
    const docRef = doc(collections.inventory)
    await setDoc(docRef, {
      ...itemData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  // ✅ Update inventory item
  updateInventoryItem: async (itemId: string, updates: any) => {
    const itemRef = doc(collections.inventory, itemId)
    await updateDoc(itemRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  },

  // ✅ Delete inventory item
  deleteInventoryItem: async (itemId: string) => {
    const itemRef = doc(collections.inventory, itemId)
    await deleteDoc(itemRef)
  },

  // ✅ Get inventory item by ID
  getInventoryItem: async (itemId: string) => {
    const itemRef = doc(collections.inventory, itemId)
    const itemSnap = await getDoc(itemRef)
    return itemSnap.exists() ? { id: itemSnap.id, ...itemSnap.data() } : null
  },
}

// Inventory Operations
export const inventoryOperations = {
  // Get all inventory items
  getAllInventory: async () => {
    const q = query(collections.inventory, orderBy('name'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  // Get inventory requests
  getInventoryRequests: async () => {
    const q = query(collections.inventoryRequests, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  // Create inventory request
  createInventoryRequest: async (requestData: any) => {
    const docRef = await addDoc(collections.inventoryRequests, {
      ...requestData,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  // Approve inventory request
  approveInventoryRequest: async (requestId: string, approvedBy: string, approvedByName: string) => {
    await updateDoc(doc(collections.inventoryRequests, requestId), {
      status: 'approved',
      approvedBy,
      approvedByName,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  },

  // Reject inventory request
  rejectInventoryRequest: async (requestId: string, rejectedBy: string, rejectedByName: string) => {
    await updateDoc(doc(collections.inventoryRequests, requestId), {
      status: 'rejected',
      rejectedBy,
      rejectedByName,
      rejectedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  },

  // Real-time inventory changes
  onInventoryChange: (callback: (items: any[]) => void) => {
    const q = query(collections.inventory, orderBy('name'))
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(items)
    })
  },

  // Decrement stock (alias for firestoreService.decrementStock)
  decrementStock: firestoreService.decrementStock,

  // Inventory Usage Operations
  recordInventoryUsage: async (usageData: any) => {
    try {
      await addDoc(collection(db, "inventoryUsage"), {
        ...usageData,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recording inventory usage:", error);
      throw error;
    }
  },

  getInventoryUsageHistory: async () => {
    try {
      const usageQuery = query(collection(db, "inventoryUsage"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(usageQuery);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching usage history:", error);
      throw error;
    }
  },

  // Get usage statistics
  getUsageStatistics: async (startDate?: Date, endDate?: Date) => {
    let q = query(collections.inventoryUsage, orderBy('createdAt', 'desc'))

    if (startDate && endDate) {
      q = query(
        collections.inventoryUsage,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('createdAt', 'desc')
      )
    }

    const snapshot = await getDocs(q)
    const usageRecords = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        inventoryId: data.inventoryId || '',
        quantity: data.quantity || 0,
        reason: data.reason || '',
        recordedBy: data.recordedBy || '',
        recordedByName: data.recordedByName || '',
        notes: data.notes || '',
        type: data.type || 'manual',
        createdAt: data.createdAt
      }
    })

    // Calculate statistics
    const stats = {
      totalRecords: usageRecords.length,
      totalQuantity: usageRecords.reduce((sum, record) => sum + record.quantity, 0),
      byReason: {} as Record<string, number>,
      byItem: {} as Record<string, number>,
      recentActivity: usageRecords.slice(0, 10)
    }

    usageRecords.forEach(record => {
      // Group by reason
      stats.byReason[record.reason] = (stats.byReason[record.reason] || 0) + record.quantity

      // Group by item
      stats.byItem[record.inventoryId] = (stats.byItem[record.inventoryId] || 0) + record.quantity
    })

    return stats
  },

  // Stock Issues Operations
  reportStockIssue: async (issueData: {
    inventoryId: string
    itemName: string
    issueType: 'low_stock' | 'out_of_stock' | 'damaged' | 'expired' | 'other'
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    reportedBy: string
    reportedByName: string
    currentStock?: number
    minimumStock?: number
  }) => {
    const docRef = await addDoc(collections.stockIssues, {
      ...issueData,
      status: 'reported',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  getStockIssues: async (status?: string) => {
    let q = query(collections.stockIssues, orderBy('timestamp', 'desc'))

    if (status) {
      q = query(collections.stockIssues, where('status', '==', status), orderBy('timestamp', 'desc'))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        // Handle both timestamp formats (serverTimestamp and regular timestamp)
        timestamp: data.timestamp || data.createdAt,
        // Ensure all fields are properly mapped
        itemId: data.itemId || data.inventoryId,
        itemName: data.itemName || 'Unknown Item',
        issueType: data.issueType || 'other',
        description: data.description || '',
        reportedBy: data.reportedBy || '',
        reportedByName: data.reportedByName || 'Unknown',
        kitchenId: data.kitchenId || '',
        status: data.status || 'pending'
      }
    })
  },

  updateStockIssueStatus: async (issueId: string, status: string, updatedBy: string, updatedByName: string, notes?: string) => {
    await updateDoc(doc(collections.stockIssues, issueId), {
      status,
      updatedBy,
      updatedByName,
      updatedAt: Timestamp.now(),
      ...(notes && { resolutionNotes: notes })
    })
  },
}

// Order Operations
export const orderOperations = {
  // Create new order
  createOrder: async (orderData: any) => {
    const docRef = await addDoc(collections.orders, {
      ...orderData,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      // Ensure all required fields are present
      customer_id: orderData.customer_id,
      customer_name: orderData.customer_name || 'Customer',
      customer_email: orderData.customer_email || '',
      items: orderData.items || [],
      status: orderData.status || 'pending',
      total_amount: orderData.total_amount || 0,
      payment_status: orderData.payment_status || 'pending',
      order_type: orderData.order_type || 'dine-in',
      estimated_time: orderData.estimated_time || 15
    })
    return docRef.id
  },

  // Get active orders (pending, preparing, ready)
  getActiveOrders: async () => {
    const q = query(
      collections.orders,
      where('status', 'in', ['pending', 'preparing', 'ready']),
      orderBy('created_at', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  // Get completed orders
  getCompletedOrders: async () => {
    const q = query(
      collections.orders,
      where('status', 'in', ['delivered', 'cancelled']),
      orderBy('created_at', 'desc'),
      limit(50)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  // Get user orders
  getUserOrders: async (customerId: string) => {
    const q = query(
      collections.orders,
      where('customer_id', '==', customerId),
      orderBy('created_at', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        customer_id: data.customer_id || customerId,
        customer_name: data.customer_name || 'Customer',
        customer_email: data.customer_email || '',
        items: Array.isArray(data.items) ? data.items : [],
        status: data.status || 'pending',
        total_amount: typeof data.total_amount === 'number' ? data.total_amount : 0,
        payment_status: data.payment_status || 'pending',
        order_type: data.order_type || 'dine-in',
        table_number: data.table_number,
        delivery_address: data.delivery_address,
        special_instructions: data.special_instructions,
        created_at: data.created_at,
        estimated_time: typeof data.estimated_time === 'number' ? data.estimated_time : 15
      }
    })
  },

  // Update order status
  updateOrderStatus: async (orderId: string, newStatus: string) => {
    await updateDoc(doc(collections.orders, orderId), {
      status: newStatus,
      updated_at: Timestamp.now(),
    })
  },
}

// Recipe Operations
export const recipeOperations = {
  // Get recipe by menu item ID
  getRecipe: async (menuItemId: string) => {
    const q = query(collections.recipes, where('menuItemId', '==', menuItemId))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    }
    return null
  },
}
