import * as kv from './kv_store.tsx'
import InventoryService from './inventory_service.tsx'
import ShiftService from './shift_service.tsx'

export interface Order {
  id: string
  orderNumber: string
  customerId?: string
  customerInfo: {
    name: string
    phone?: string
    roomNumber?: string
    tableNumber?: string
  }
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  orderType: 'dine_in' | 'takeaway' | 'room_service' | 'delivery'
  paymentMethod: 'cash' | 'card' | 'room_charge' | 'mobile'
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled' | 'void'
  specialInstructions?: string
  createdAt: string
  updatedAt: string
  cashierId: string
  cashierName: string
  shiftId: string
  kitchenStartedAt?: string
  kitchenStartedBy?: string
  readyAt?: string
  readyBy?: string
  deliveredAt?: string
  deliveredBy?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
  estimatedTime: number
}

export interface OrderItem {
  id: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  total: number
  specialInstructions?: string
  status: 'pending' | 'preparing' | 'ready'
}

export interface Payment {
  id: string
  orderId: string
  amount: number
  method: 'cash' | 'card' | 'room_charge' | 'mobile'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  reference?: string
  processedAt?: string
  refundedAt?: string
  refundAmount?: number
  refundReason?: string
}

export class OrderService {
  
  // Generate order number
  static async generateOrderNumber(): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const countKey = `order_count:${today}`
    
    let count = await kv.get(countKey)
    const orderCount = count ? parseInt(count) + 1 : 1
    
    await kv.set(countKey, orderCount.toString())
    
    return `${today}-${orderCount.toString().padStart(4, '0')}`
  }

  // Create new order
  static async createOrder(
    orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'shiftId'>,
    cashierId: string
  ): Promise<{ order: Order; success: boolean; errors: string[] }> {
    const errors: string[] = []
    
    // Get current shift
    const currentShift = await ShiftService.getCurrentShift()
    if (!currentShift) {
      errors.push('No active shift found')
      return { order: {} as Order, success: false, errors }
    }
    
    // Generate order number
    const orderNumber = await this.generateOrderNumber()
    
    const order: Order = {
      ...orderData,
      id: crypto.randomUUID(),
      orderNumber,
      shiftId: currentShift.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Check inventory availability for each item
    const inventoryChecks: Promise<{itemId: string, available: boolean, missing: string[]}>[] = []
    
    for (const item of order.items) {
      const recipe = await InventoryService.getRecipe(item.menuItemId)
      if (recipe) {
        inventoryChecks.push(
          InventoryService.checkRecipeAvailability(recipe).then(result => ({
            itemId: item.id,
            available: result.available,
            missing: result.missingItems
          }))
        )
      }
    }
    
    const inventoryResults = await Promise.all(inventoryChecks)
    const unavailableItems = inventoryResults.filter(r => !r.available)
    
    if (unavailableItems.length > 0) {
      for (const unavailable of unavailableItems) {
        const item = order.items.find(i => i.id === unavailable.itemId)
        errors.push(`${item?.name}: Missing ingredients - ${unavailable.missing.join(', ')}`)
      }
      
      // Set order status to awaiting stock
      order.status = 'pending'
      order.specialInstructions = (order.specialInstructions || '') + 
        ` [AWAITING STOCK: ${unavailableItems.map(u => u.missing.join(', ')).join('; ')}]`
    }
    
    // Process inventory if no issues (and payment is not pending)
    if (errors.length === 0 && order.paymentStatus === 'completed') {
      for (const item of order.items) {
        const recipe = await InventoryService.getRecipe(item.menuItemId)
        if (recipe) {
          // Process recipe for each quantity
          for (let i = 0; i < item.quantity; i++) {
            const result = await InventoryService.processRecipe(recipe, order.id)
            if (!result.success) {
              errors.push(`Failed to process ${item.name}: ${result.failedItems.join(', ')}`)
            }
          }
        }
      }
    }
    
    // Save order
    await kv.set(`order:${order.id}`, JSON.stringify(order))
    
    // Index by cashier
    await kv.set(`cashier_order:${cashierId}:${order.id}`, order.id)
    
    // Index by shift
    await kv.set(`shift_order:${currentShift.id}:${order.id}`, order.id)
    
    // Index by status
    await kv.set(`order_status:${order.status}:${order.id}`, order.id)
    
    // Record cash transaction if cash payment
    if (order.paymentMethod === 'cash' && order.paymentStatus === 'completed') {
      await ShiftService.recordSale(order.id, order.total, cashierId)
    }
    
    return {
      order,
      success: errors.length === 0,
      errors
    }
  }

  // Get order by ID
  static async getOrder(orderId: string): Promise<Order | null> {
    const orderData = await kv.get(`order:${orderId}`)
    return orderData ? JSON.parse(orderData) : null
  }

  // Update order status
  static async updateOrderStatus(
    orderId: string,
    status: Order['status'],
    updatedBy: string,
    notes?: string
  ): Promise<Order | null> {
    const order = await this.getOrder(orderId)
    if (!order) return null
    
    const oldStatus = order.status
    order.status = status
    order.updatedAt = new Date().toISOString()
    
    // Set timestamps based on status
    switch (status) {
      case 'preparing':
        order.kitchenStartedAt = new Date().toISOString()
        order.kitchenStartedBy = updatedBy
        break
      case 'ready':
        order.readyAt = new Date().toISOString()
        order.readyBy = updatedBy
        break
      case 'delivered':
      case 'completed':
        order.deliveredAt = new Date().toISOString()
        order.deliveredBy = updatedBy
        break
      case 'void':
        order.voidedAt = new Date().toISOString()
        order.voidedBy = updatedBy
        if (notes) order.voidReason = notes
        break
    }
    
    await kv.set(`order:${orderId}`, JSON.stringify(order))
    
    // Update status indexes
    await kv.del(`order_status:${oldStatus}:${orderId}`)
    await kv.set(`order_status:${status}:${orderId}`, orderId)
    
    return order
  }

  // Get orders by status
  static async getOrdersByStatus(status: Order['status']): Promise<Order[]> {
    const orderIds = await kv.getByPrefix(`order_status:${status}:`)
    const orders: Order[] = []
    
    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId)
      if (order) orders.push(order)
    }
    
    return orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  // Get orders for kitchen dashboard
  static async getKitchenOrders(): Promise<Order[]> {
    const pendingOrders = await this.getOrdersByStatus('pending')
    const preparingOrders = await this.getOrdersByStatus('preparing')
    const readyOrders = await this.getOrdersByStatus('ready')
    
    return [...pendingOrders, ...preparingOrders, ...readyOrders]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  // Get orders for shift
  static async getShiftOrders(shiftId: string): Promise<Order[]> {
    const orderIds = await kv.getByPrefix(`shift_order:${shiftId}:`)
    const orders: Order[] = []
    
    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId)
      if (order) orders.push(order)
    }
    
    return orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  // Void order (supervisor only)
  static async voidOrder(
    orderId: string,
    voidedBy: string,
    reason: string,
    restoreStock: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    const order = await this.getOrder(orderId)
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    if (order.status === 'void' || order.status === 'completed') {
      return { success: false, error: 'Order cannot be voided' }
    }
    
    // Restore stock if requested and order was paid
    if (restoreStock && order.paymentStatus === 'completed') {
      for (const item of order.items) {
        const recipe = await InventoryService.getRecipe(item.menuItemId)
        if (recipe) {
          // Restore stock for each quantity
          for (let i = 0; i < item.quantity; i++) {
            for (const ingredient of recipe.ingredients) {
              await InventoryService.incrementStock(ingredient.inventoryId, ingredient.quantity)
            }
          }
        }
      }
    }
    
    // Update order
    await this.updateOrderStatus(orderId, 'void', voidedBy, reason)
    
    // Record void transaction if cash payment
    if (order.paymentMethod === 'cash' && order.paymentStatus === 'completed') {
      await ShiftService.recordVoid(orderId, order.total, voidedBy, reason)
    }
    
    return { success: true }
  }

  // Process refund
  static async processRefund(
    orderId: string,
    refundAmount: number,
    refundedBy: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const order = await this.getOrder(orderId)
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    if (order.paymentStatus !== 'completed') {
      return { success: false, error: 'Order payment not completed' }
    }
    
    // Create refund payment record
    const refundPayment: Payment = {
      id: crypto.randomUUID(),
      orderId,
      amount: -refundAmount,
      method: order.paymentMethod,
      status: 'completed',
      refundedAt: new Date().toISOString(),
      refundAmount,
      refundReason: reason
    }
    
    await kv.set(`payment:${refundPayment.id}`, JSON.stringify(refundPayment))
    
    // Update order payment status
    if (refundAmount >= order.total) {
      order.paymentStatus = 'refunded'
    }
    order.updatedAt = new Date().toISOString()
    await kv.set(`order:${orderId}`, JSON.stringify(order))
    
    // Record refund transaction if cash
    if (order.paymentMethod === 'cash') {
      await ShiftService.recordRefund(orderId, refundAmount, refundedBy, reason)
    }
    
    return { success: true }
  }

  // Update item status
  static async updateItemStatus(
    orderId: string,
    itemId: string,
    status: OrderItem['status']
  ): Promise<Order | null> {
    const order = await this.getOrder(orderId)
    if (!order) return null
    
    const item = order.items.find(i => i.id === itemId)
    if (!item) return null
    
    item.status = status
    order.updatedAt = new Date().toISOString()
    
    // Check if all items are ready
    const allItemsReady = order.items.every(i => i.status === 'ready')
    if (allItemsReady && order.status === 'preparing') {
      order.status = 'ready'
      order.readyAt = new Date().toISOString()
    }
    
    await kv.set(`order:${orderId}`, JSON.stringify(order))
    return order
  }

  // Get daily sales summary
  static async getDailySalesSummary(date: string): Promise<{
    totalOrders: number
    totalSales: number
    averageOrderValue: number
    ordersByType: Record<string, number>
    ordersByPayment: Record<string, number>
    topSellingItems: { name: string; quantity: number; revenue: number }[]
  }> {
    const shifts = await ShiftService.getShiftsByDate(date)
    const allOrders: Order[] = []
    
    for (const shift of shifts) {
      const shiftOrders = await this.getShiftOrders(shift.id)
      allOrders.push(...shiftOrders.filter(o => o.status !== 'void'))
    }
    
    const totalOrders = allOrders.length
    const totalSales = allOrders.reduce((sum, order) => sum + order.total, 0)
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    
    const ordersByType = allOrders.reduce((acc, order) => {
      acc[order.orderType] = (acc[order.orderType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const ordersByPayment = allOrders.reduce((acc, order) => {
      acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Calculate top selling items
    const itemSales = new Map<string, { quantity: number; revenue: number }>()
    
    for (const order of allOrders) {
      for (const item of order.items) {
        const existing = itemSales.get(item.name) || { quantity: 0, revenue: 0 }
        existing.quantity += item.quantity
        existing.revenue += item.total
        itemSales.set(item.name, existing)
      }
    }
    
    const topSellingItems = Array.from(itemSales.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
    
    return {
      totalOrders,
      totalSales,
      averageOrderValue,
      ordersByType,
      ordersByPayment,
      topSellingItems
    }
  }
}

export default OrderService