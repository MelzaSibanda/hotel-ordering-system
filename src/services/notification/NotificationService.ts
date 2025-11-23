import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase/config'
import { Order } from '../order/types'

export interface Notification {
  id: string
  userId: string
  type: 'order_status' | 'low_stock' | 'payment_failed' | 'kitchen_alert'
  title: string
  message: string
  data?: any
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

export class NotificationService {
  async notifyLowStock(item: any, threshold: number): Promise<void> {
    // Get all store and admin users to notify
    const storeUsers = await this.getStoreUsers()

    for (const user of storeUsers) {
      const notification: Notification = {
        id: this.generateId('notification'),
        userId: user.id,
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining, min: ${threshold} ${item.unit})`,
        data: { item, threshold },
        read: false,
        priority: item.currentStock <= 0 ? 'critical' : 'high',
        createdAt: new Date().toISOString()
      }

      await this.saveAndBroadcast(notification)
    }
  }

  async notifyOrderConfirmation(order: Order): Promise<void> {
    const notification: Notification = {
      id: this.generateId('notification'),
      userId: order.customerId,
      type: 'order_status',
      title: 'Order Confirmed',
      message: `Your order #${order.id.slice(-6)} has been confirmed`,
      data: { order },
      read: false,
      priority: 'medium',
      createdAt: new Date().toISOString()
    }

    await this.saveAndBroadcast(notification)
  }

  async notifyKitchenOrder(order: Order): Promise<void> {
    // Check if order has cooking items
    const hasCookingItems = order.items.some(item => item.requiresCooking !== false)

    if (!hasCookingItems) {
      console.log('🥤 Skipping kitchen notification - order contains only ready items')
      return
    }

    // Notify all kitchen staff
    const kitchenUsers = await this.getKitchenUsers()

    for (const user of kitchenUsers) {
      const notification: Notification = {
        id: this.generateId('notification'),
        userId: user.id,
        type: 'kitchen_alert',
        title: 'New Order',
        message: `New order #${order.id.slice(-6)} for ${order.customerName}`,
        data: { order },
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      }

      await this.saveAndBroadcast(notification)
    }
  }

  async notifyOrderReady(order: Order): Promise<void> {
    const notification: Notification = {
      id: this.generateId('notification'),
      userId: order.customerId,
      type: 'order_status',
      title: 'Order Ready',
      message: `Your order #${order.id.slice(-6)} is ready for pickup/delivery`,
      data: { order },
      read: false,
      priority: 'high',
      createdAt: new Date().toISOString()
    }

    await this.saveAndBroadcast(notification)
  }

  async notifyPaymentFailure(order: Order, reason: string): Promise<void> {
    const notification: Notification = {
      id: this.generateId('notification'),
      userId: order.customerId,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Payment for order #${order.id.slice(-6)} failed: ${reason}`,
      data: { order, reason },
      read: false,
      priority: 'critical',
      createdAt: new Date().toISOString()
    }

    await this.saveAndBroadcast(notification)
  }

  private async saveAndBroadcast(notification: Notification): Promise<void> {
    // Save to database
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: Timestamp.fromDate(new Date(notification.createdAt))
    })

    // Broadcast to real-time subscribers (WebSocket, etc.)
    // This would integrate with a real-time system like Socket.io or Firebase Cloud Messaging
    console.log('📢 Notification sent:', notification)
  }

  private async getKitchenUsers(): Promise<any[]> {
    // Get all users with kitchen role
    const usersSnap = await getDocs(collection(db, 'users'))
    return usersSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((user: any) => user.role === 'kitchen' || user.role === 'admin')
  }

  private async getStoreUsers(): Promise<any[]> {
    // Get all users with store, admin, or supervisor roles
    const usersSnap = await getDocs(collection(db, 'users'))
    return usersSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((user: any) => ['stores', 'admin', 'supervisor'].includes(user.role))
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}