// Temporary types and Firebase implementations for CustomerDashboard migration
// This file provides the interface that CustomerDashboard expects during migration

import { getMenuItems } from './api'
import { orderOperations } from './firebase/firestore'
import { auth } from './firebase/config'

// Re-export getMenuItems for CustomerDashboard compatibility
export { getMenuItems }

// Full structure for orders saved in localStorage
export interface LocalOrder {
  id: string
  customer_id: string
  customer_name: string
  customer_email: string
  items: any[]
  status: string
  total_amount: number
  payment_status: string
  order_type: string
  table_number?: string
  delivery_address?: string
  special_instructions?: string
  created_at?: string | Date
  estimated_time?: number
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  staffPrice: number
  guestPrice: number
  category: string
  available: boolean
  image?: string
  prepTime?: number
  ingredients?: string[]
  extras?: string[]
  allergens?: string[]
}

export interface Category {
  id: string
  name: string
  description?: string
  image?: string
}

export interface Order {
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
    selectedExtras?: string[]
  }>
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'failed'
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  tableNumber?: string
  deliveryAddress?: string
  specialInstructions?: string
  orderDate: string
  estimatedTime?: number
}

// Firebase-based implementations
export const getCategories = async (): Promise<Category[]> => {
  try {
    const menuItems = await getMenuItems()
    const categoryIds = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)))
    return categoryIds.map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace('-', ' ')
    }))
  } catch (error) {
    console.error('Error getting categories:', error)
    return []
  }
}

export const addOrder = async (order: Order): Promise<void> => {
  try {
    // Filter out undefined values to prevent Firestore errors
    const orderData = {
      customer_id: order.customerId,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      items: order.items,
      status: order.status,
      total_amount: order.totalAmount,
      payment_status: order.paymentStatus,
      order_type: order.orderType,
      ...(order.tableNumber && { table_number: order.tableNumber }),
      ...(order.deliveryAddress && { delivery_address: order.deliveryAddress }),
      ...(order.specialInstructions && { special_instructions: order.specialInstructions }),
      ...(order.estimatedTime && { estimated_time: order.estimatedTime })
    }

    await orderOperations.createOrder(orderData)
  } catch (error) {
    console.error('Error adding order:', error)
    throw error
  }
}

export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const getOrdersByCustomer = async (customerId: string): Promise<Order[]> => {
  try {
    // Use a simpler query that doesn't require composite indexes
    const orders = await orderOperations.getUserOrders(customerId)
    return orders.map((order: any) => ({
      id: order.id,
      customerId: order.customer_id || customerId,
      customerName: order.customer_name || 'Customer',
      customerEmail: order.customer_email || '',
      items: order.items || [],
      status: order.status || 'pending',
      totalAmount: order.total_amount || 0,
      paymentStatus: order.payment_status || 'pending',
      orderType: order.order_type || 'dine-in',
      tableNumber: order.table_number,
      deliveryAddress: order.delivery_address,
      specialInstructions: order.special_instructions,
      orderDate: order.created_at?.toDate?.()?.toISOString() || order.created_at || new Date().toISOString(),
      estimatedTime: order.estimated_time || 15
    }))
  } catch (error) {
    console.error('Error getting orders by customer:', error)
    // Return empty array on error to prevent UI crashes
    return []
  }
}

export const MENU_CATEGORIES = [
  'appetizers',
  'main-courses',
  'desserts',
  'beverages'
]
