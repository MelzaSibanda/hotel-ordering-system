# Egumeni Eats Implementation Plan

## Phase 1: Foundation (Week 1-2) - CRITICAL FIXES

### 1.1 Inventory Management Service Core

#### Create New Service Architecture
```
src/services/
├── inventory/
│   ├── InventoryService.ts          # Core inventory operations
│   ├── StockValidationEngine.ts     # Stock validation logic
│   ├── InventoryReservationService.ts # Reservation management
│   ├── UnitConversionService.ts     # Unit conversion utilities
│   └── types.ts                     # Type definitions
├── order/
│   ├── OrderProcessingPipeline.ts   # Order processing orchestration
│   ├── OrderValidationService.ts    # Order validation logic
│   └── types.ts
└── notification/
    ├── NotificationService.ts       # Notification management
    ├── NotificationHub.ts          # Real-time notification hub
    └── types.ts
```

#### InventoryService.ts Implementation
```typescript
export class InventoryService {
  private db = getFirestore()

  async validateStockAvailability(orderItems: OrderItem[]): Promise<StockValidationResult> {
    const validationEngine = new StockValidationEngine()
    return validationEngine.validate(orderItems)
  }

  async reserveInventory(orderId: string, items: OrderItem[]): Promise<ReservationResult> {
    const reservationService = new InventoryReservationService()
    return reservationService.createReservation(orderId, items)
  }

  async commitReservation(orderId: string): Promise<void> {
    const reservationService = new InventoryReservationService()
    return reservationService.commitReservation(orderId)
  }

  async rollbackReservation(orderId: string): Promise<void> {
    const reservationService = new InventoryReservationService()
    return reservationService.rollbackReservation(orderId)
  }

  async getCurrentStock(inventoryId: string): Promise<StockInfo> {
    const docRef = doc(this.db, 'inventory', inventoryId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      throw new Error(`Inventory item ${inventoryId} not found`)
    }

    const data = docSnap.data()
    return {
      id: inventoryId,
      quantity: data.currentStock || 0,
      unit: data.unit,
      minStock: data.minStock || 0
    }
  }
}
```

#### StockValidationEngine.ts Implementation
```typescript
export class StockValidationEngine {
  async validate(cartItems: CartItem[]): Promise<StockValidationResult> {
    const results: IngredientValidation[] = []

    for (const cartItem of cartItems) {
      const recipe = await this.getRecipe(cartItem.menuItem.id)

      if (!recipe || !recipe.ingredients?.length) {
        results.push({
          itemId: cartItem.menuItem.id,
          itemName: cartItem.menuItem.name,
          valid: false,
          reason: 'No recipe configured'
        })
        continue
      }

      for (const ingredient of recipe.ingredients) {
        const stockInfo = await this.getStockInfo(ingredient.inventoryId)
        const requiredQuantity = ingredient.quantity * cartItem.quantity

        const convertedRequired = UnitConversionService.convert(
          requiredQuantity,
          ingredient.unit,
          stockInfo.unit
        )

        if (convertedRequired > stockInfo.quantity) {
          results.push({
            itemId: cartItem.menuItem.id,
            itemName: cartItem.menuItem.name,
            ingredientId: ingredient.inventoryId,
            ingredientName: ingredient.name,
            required: convertedRequired,
            available: stockInfo.quantity,
            unit: stockInfo.unit,
            valid: false,
            reason: 'Insufficient stock'
          })
        } else {
          results.push({
            itemId: cartItem.menuItem.id,
            itemName: cartItem.menuItem.name,
            valid: true
          })
        }
      }
    }

    return {
      isValid: results.every(r => r.valid),
      results
    }
  }
}
```

### 1.2 Transaction Manager Implementation

#### TransactionManager.ts
```typescript
export class TransactionManager {
  private db = getFirestore()

  async executeTransaction<T>(
    operations: TransactionOperation[],
    executor: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    return runTransaction(this.db, async (transaction) => {
      // Execute main operation
      const result = await executor(transaction)

      // Execute post-commit operations
      for (const op of operations) {
        await op.commit(transaction)
      }

      return result
    })
  }

  async executeInventoryTransaction(
    operations: InventoryOperation[]
  ): Promise<TransactionResult> {
    return this.executeTransaction(operations, async (tx) => {
      const results: InventoryOperationResult[] = []

      for (const op of operations) {
        const result = await this.executeInventoryOperation(tx, op)
        results.push(result)
      }

      return { success: true, results }
    })
  }

  private async executeInventoryOperation(
    tx: Transaction,
    operation: InventoryOperation
  ): Promise<InventoryOperationResult> {
    const inventoryRef = doc(this.db, 'inventory', operation.inventoryId)
    const inventorySnap = await tx.get(inventoryRef)

    if (!inventorySnap.exists()) {
      throw new Error(`Inventory item ${operation.inventoryId} not found`)
    }

    const currentData = inventorySnap.data()
    const currentStock = currentData?.currentStock || 0

    let newStock: number
    switch (operation.type) {
      case 'reserve':
        newStock = currentStock - operation.quantity
        if (newStock < 0) {
          throw new Error(`Insufficient stock for ${operation.inventoryId}`)
        }
        break
      case 'commit':
        // Already deducted during reserve
        newStock = currentStock
        break
      case 'rollback':
        newStock = currentStock + operation.quantity
        break
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }

    tx.update(inventoryRef, {
      currentStock: newStock,
      updatedAt: Timestamp.now()
    })

    return {
      inventoryId: operation.inventoryId,
      operation: operation.type,
      previousStock: currentStock,
      newStock,
      quantity: operation.quantity
    }
  }
}
```

### 1.3 Order Processing Pipeline

#### OrderProcessingPipeline.ts
```typescript
export class OrderProcessingPipeline {
  constructor(
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private orderService: OrderService,
    private notificationService: NotificationService
  ) {}

  async processOrder(orderDraft: OrderDraft): Promise<OrderResult> {
    try {
      // Stage 1: Validate stock availability
      console.log('🔍 Stage 1: Validating stock availability...')
      const validation = await this.inventoryService.validateStockAvailability(orderDraft.items)

      if (!validation.isValid) {
        return {
          success: false,
          stage: 'validation',
          error: 'Stock validation failed',
          details: validation.results
        }
      }

      // Stage 2: Reserve inventory
      console.log('🔒 Stage 2: Reserving inventory...')
      const reservation = await this.inventoryService.reserveInventory(
        orderDraft.id,
        orderDraft.items
      )

      if (!reservation.success) {
        return {
          success: false,
          stage: 'reservation',
          error: 'Inventory reservation failed',
          details: reservation
        }
      }

      // Stage 3: Process payment
      console.log('💳 Stage 3: Processing payment...')
      const payment = await this.paymentService.processPayment(orderDraft)

      if (!payment.success) {
        // Rollback inventory reservation
        await this.inventoryService.rollbackReservation(orderDraft.id)
        return {
          success: false,
          stage: 'payment',
          error: 'Payment processing failed',
          details: payment
        }
      }

      // Stage 4: Create order
      console.log('📝 Stage 4: Creating order...')
      const order = await this.orderService.createOrder({
        ...orderDraft,
        paymentId: payment.paymentId,
        status: 'confirmed',
        reservationId: reservation.reservationId
      })

      // Stage 5: Commit inventory changes
      console.log('✅ Stage 5: Committing inventory changes...')
      await this.inventoryService.commitReservation(orderDraft.id)

      // Stage 6: Send notifications
      console.log('📢 Stage 6: Sending notifications...')
      await Promise.all([
        this.notificationService.notifyOrderConfirmation(order),
        this.notificationService.notifyKitchenOrder(order)
      ])

      console.log('🎉 Order processing completed successfully!')
      return {
        success: true,
        order,
        reservation,
        payment
      }

    } catch (error) {
      console.error('❌ Order processing failed:', error)

      // Attempt cleanup
      try {
        await this.inventoryService.rollbackReservation(orderDraft.id)
      } catch (cleanupError) {
        console.error('⚠️ Cleanup failed:', cleanupError)
      }

      return {
        success: false,
        stage: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    }
  }
}
```

### 1.4 Update CustomerDashboard.tsx

#### Replace placeOrder function
```typescript
// In CustomerDashboard.tsx
const placeOrder = async () => {
  if (cart.length === 0) {
    toast.error('Your cart is empty')
    return
  }

  // Validate order details
  if (orderDetails.orderType === 'dine-in' && !orderDetails.tableNumber) {
    toast.error('Please enter a table number')
    return
  }

  if (orderDetails.orderType === 'delivery' && !orderDetails.deliveryAddress) {
    toast.error('Please enter a delivery address')
    return
  }

  // Create order draft
  const orderDraft: OrderDraft = {
    id: generateId('order'),
    customerId: user?.id || 'guest',
    customerName: user?.name || 'Guest Customer',
    customerEmail: user?.email || 'guest@example.com',
    items: cart.map(item => ({
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      price: item.customerType === 'staff' ? item.menuItem.staffPrice : item.menuItem.guestPrice,
      quantity: item.quantity,
      ...(item.specialInstructions && { specialInstructions: item.specialInstructions }),
      ...(item.selectedExtras && item.selectedExtras.length > 0 && { selectedExtras: item.selectedExtras })
    })),
    totalAmount: getCartTotal(),
    orderType: orderDetails.orderType,
    ...(orderDetails.tableNumber && { tableNumber: orderDetails.tableNumber }),
    ...(orderDetails.deliveryAddress && { deliveryAddress: orderDetails.deliveryAddress }),
    ...(orderDetails.specialInstructions && { specialInstructions: orderDetails.specialInstructions }),
    orderDate: new Date().toISOString(),
    estimatedTime: Math.max(15, cart.length * 8)
  }

  try {
    // Use new order processing pipeline
    const result = await orderProcessingPipeline.processOrder(orderDraft)

    if (!result.success) {
      // Handle specific error types
      if (result.stage === 'validation') {
        const validationResults = result.details as StockValidationResult
        validationResults.results
          .filter(r => !r.valid)
          .forEach(invalidResult => {
            toast.error(`${invalidResult.itemName}: ${invalidResult.reason}`, {
              duration: 6000
            })
          })
      } else {
        toast.error(`Order failed: ${result.error}`)
      }
      return
    }

    // Success - update UI
    setCurrentOrder(result.order)
    setCart([])
    setOrderDetails({
      orderType: 'dine-in',
      tableNumber: '',
      deliveryAddress: '',
      specialInstructions: ''
    })

    // Show payment screen
    setShowPayment(true)

  } catch (error) {
    console.error('Order placement failed:', error)
    toast.error('Failed to place order. Please try again.')
  }
}
```

### 1.5 Update KitchenDashboard.tsx

#### Replace markReady function
```typescript
// In KitchenDashboard.tsx
const markReady = async (orderId: string) => {
  setProcessingOrder(orderId)
  setError('')

  try {
    console.log(`🍳 Starting order completion for ${orderId}...`)

    // Get order details
    const order = orders.find(o => o.id === orderId)
    if (!order) {
      throw new Error('Order not found')
    }

    // Use transaction manager for inventory deduction
    const inventoryOperations: InventoryOperation[] = []

    for (const item of order.items) {
      const recipe = await recipeOperations.getRecipe(item.menuItemId)

      if (recipe && recipe.ingredients) {
        for (const ingredient of recipe.ingredients) {
          const totalQuantityNeeded = ingredient.quantity * (item.quantity || 1)

          // Convert units if necessary
          const inventoryItem = inventoryItems.find(inv => inv.id === ingredient.inventoryId)
          if (!inventoryItem) continue

          let quantityToDeduct = totalQuantityNeeded
          if (ingredient.unit !== inventoryItem.unit) {
            quantityToDeduct = convertUnits(totalQuantityNeeded, ingredient.unit, inventoryItem.unit)
          }

          inventoryOperations.push({
            inventoryId: ingredient.inventoryId,
            type: 'reserve', // This will actually deduct stock
            quantity: quantityToDeduct
          })
        }
      }
    }

    // Execute inventory transaction
    if (inventoryOperations.length > 0) {
      console.log(`📦 Deducting ${inventoryOperations.length} inventory operations...`)
      await transactionManager.executeInventoryTransaction(inventoryOperations)
      console.log('✅ Inventory deduction completed')
    }

    // Update order status
    await orderOperations.updateOrderStatus(orderId, 'ready')

    // Send notifications
    await notificationService.notifyOrderReady(order)
    await notificationService.notifyDeliveryOrder(order)

    setSuccess(`Order #${orderId.slice(-6)} marked as ready!`)
    setTimeout(() => setSuccess(''), 3000)

    // Refresh data
    await loadOrders()
    await loadOrderHistory()

  } catch (error) {
    console.error('Failed to mark order ready:', error)
    setError('Failed to mark order ready. Please check inventory levels and try again.')
  } finally {
    setProcessingOrder(null)
  }
}
```

## Phase 2: Enhanced Features (Week 3-4)

### 2.1 Real-time Notifications

#### NotificationService.ts
```typescript
export class NotificationService {
  private notificationHub = new NotificationHub()

  async notifyLowStock(item: InventoryItem, threshold: number): Promise<void> {
    const notification: Notification = {
      id: generateId('notification'),
      userId: 'admin', // Or specific users
      type: 'low_stock',
      title: 'Low Stock Alert',
      message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining)`,
      data: { item, threshold },
      priority: 'high',
      read: false,
      createdAt: new Date().toISOString()
    }

    await this.notificationHub.broadcast(notification)
  }

  async notifyOrderStatus(order: Order, status: OrderStatus): Promise<void> {
    const notification: Notification = {
      id: generateId('notification'),
      userId: order.customerId,
      type: 'order_status',
      title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your order #${order.id.slice(-6)} is now ${status}`,
      data: { order, status },
      priority: 'medium',
      read: false,
      createdAt: new Date().toISOString()
    }

    await this.notificationHub.broadcast(notification)
  }

  async notifyKitchenOrder(order: Order): Promise<void> {
    // Notify all kitchen staff
    const kitchenUsers = await this.getKitchenUsers()

    for (const user of kitchenUsers) {
      const notification: Notification = {
        id: generateId('notification'),
        userId: user.id,
        type: 'kitchen_alert',
        title: 'New Order',
        message: `New order #${order.id.slice(-6)} for ${order.customerName}`,
        data: { order },
        priority: 'high',
        read: false,
        createdAt: new Date().toISOString()
      }

      await this.notificationHub.broadcast(notification)
    }
  }
}
```

### 2.2 Real-time Inventory Monitoring

#### InventoryMonitor.ts
```typescript
export class InventoryMonitor {
  private listeners = new Map<string, InventoryChangeListener>()
  private alertThresholds = new Map<string, number>()

  startMonitoring(): void {
    // Set up Firestore real-time listeners
    const inventoryQuery = query(collection(db, 'inventory'))

    onSnapshot(inventoryQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const item = { id: change.doc.id, ...change.doc.data() } as InventoryItem
          this.handleInventoryChange(item)
        }
      })
    })
  }

  private async handleInventoryChange(item: InventoryItem): Promise<void> {
    // Check low stock alerts
    const threshold = this.alertThresholds.get(item.id) || item.minStock || 0

    if (item.currentStock <= threshold && item.currentStock > 0) {
      await notificationService.notifyLowStock(item, threshold)
    }

    // Notify listeners
    const listeners = this.listeners.get(item.id) || []
    listeners.forEach(listener => {
      try {
        listener(item)
      } catch (error) {
        console.error('Inventory change listener error:', error)
      }
    })
  }

  subscribeToItem(itemId: string, listener: InventoryChangeListener): UnsubscribeFunction {
    if (!this.listeners.has(itemId)) {
      this.listeners.set(itemId, [])
    }

    this.listeners.get(itemId)!.push(listener)

    return () => {
      const listeners = this.listeners.get(itemId) || []
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  setAlertThreshold(itemId: string, threshold: number): void {
    this.alertThresholds.set(itemId, threshold)
  }
}
```

## Phase 3: Advanced Features (Week 5-6)

### 3.1 Automated Reorder System

#### ReorderService.ts
```typescript
export class ReorderService {
  async checkReorderPoints(): Promise<void> {
    const inventory = await inventoryService.getAllInventory()
    const reorderItems: InventoryItem[] = []

    for (const item of inventory) {
      if (item.currentStock <= (item.reorderPoint || item.minStock || 0)) {
        reorderItems.push(item)
      }
    }

    if (reorderItems.length > 0) {
      await this.createReorderRequests(reorderItems)
      await notificationService.notifyReorderRequired(reorderItems)
    }
  }

  async createReorderRequests(items: InventoryItem[]): Promise<void> {
    const batch = writeBatch(db)

    for (const item of items) {
      const reorderRequest = {
        inventoryId: item.id,
        itemName: item.name,
        currentStock: item.currentStock,
        reorderQuantity: item.maxStock ? item.maxStock - item.currentStock : item.minStock * 2,
        status: 'pending',
        requestedAt: Timestamp.now(),
        requestedBy: 'system'
      }

      const docRef = doc(collection(db, 'reorder_requests'))
      batch.set(docRef, reorderRequest)
    }

    await batch.commit()
  }
}
```

### 3.2 Demand Forecasting

#### DemandForecaster.ts
```typescript
export class DemandForecaster {
  async forecastDemand(itemId: string, days: number = 7): Promise<DemandForecast> {
    // Get historical order data
    const historicalOrders = await this.getHistoricalOrders(itemId, 30) // Last 30 days

    // Calculate moving averages
    const dailyDemand = this.calculateDailyDemand(historicalOrders)

    // Apply forecasting algorithm (simple exponential smoothing)
    const forecast = this.exponentialSmoothing(dailyDemand, 0.3)

    // Calculate recommended stock levels
    const recommendedStock = Math.max(
      forecast.average * days * 1.2, // 20% safety buffer
      forecast.average * 3 // Minimum 3 days coverage
    )

    return {
      itemId,
      forecastPeriod: days,
      averageDailyDemand: forecast.average,
      recommendedStock: Math.ceil(recommendedStock),
      confidence: forecast.confidence,
      trend: forecast.trend
    }
  }

  private exponentialSmoothing(data: number[], alpha: number): ForecastResult {
    let smoothed = data[0]
    let sum = data[0]

    for (let i = 1; i < data.length; i++) {
      smoothed = alpha * data[i] + (1 - alpha) * smoothed
      sum += smoothed
    }

    return {
      average: sum / data.length,
      confidence: 0.85, // Simplified confidence calculation
      trend: data[data.length - 1] > data[0] ? 'increasing' : 'decreasing'
    }
  }
}
```

## Phase 4: Testing & Quality Assurance (Week 7-8)

### 4.1 Test Suite Structure
```
src/__tests__/
├── unit/
│   ├── services/
│   │   ├── InventoryService.test.ts
│   │   ├── OrderProcessingPipeline.test.ts
│   │   └── NotificationService.test.ts
│   └── utils/
│       ├── UnitConversionService.test.ts
│       └── ValidationEngine.test.ts
├── integration/
│   ├── OrderFlow.test.ts
│   ├── InventoryManagement.test.ts
│   └── PaymentProcessing.test.ts
└── e2e/
    ├── CustomerOrderFlow.test.ts
    └── KitchenOperations.test.ts
```

### 4.2 Performance Benchmarks

#### Key Performance Indicators
- Order processing time: < 3 seconds
- Inventory validation time: < 1 second
- Concurrent order capacity: 50+ orders/minute
- Database response time: < 500ms
- Real-time notification delay: < 100ms

## Phase 5: Deployment & Monitoring (Week 9-10)

### 5.1 Deployment Strategy

#### Blue-Green Deployment Script
```bash
#!/bin/bash
# Blue-Green Deployment for Egumeni Eats

BLUE_VERSION=$(curl -s http://blue.egumenieats.com/version)
GREEN_VERSION=$(curl -s http://green.egumenieats.com/version)

echo "Current versions:"
echo "Blue: $BLUE_VERSION"
echo "Green: $GREEN_VERSION"

# Deploy to green environment
echo "Deploying to green environment..."
docker-compose -f docker-compose.green.yml up -d --build

# Wait for health check
echo "Waiting for green environment to be healthy..."
timeout 300 bash -c 'until curl -f http://green.egumenieats.com/health; do sleep 5; done'

# Switch traffic to green
echo "Switching traffic to green environment..."
kubectl patch service egumeni-eats -p '{"spec":{"selector":{"version":"green"}}}'

# Verify green environment
echo "Verifying green environment..."
if curl -f http://egumeni-eats.com/health; then
  echo "✅ Green environment is healthy"

  # Keep blue as rollback option
  echo "Blue environment available for rollback at: http://blue.egumeni-eats.com"

else
  echo "❌ Green environment failed health check"
  echo "Rolling back to blue environment..."
  kubectl patch service egumeni-eats -p '{"spec":{"selector":{"version":"blue"}}}'
  exit 1
fi
```

### 5.2 Monitoring Setup

#### Application Monitoring
```typescript
// Monitoring service
export class MonitoringService {
  async recordMetric(name: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    // Send to monitoring service (DataDog, New Relic, etc.)
    console.log(`📊 ${name}: ${value}`, tags)
  }

  async recordError(error: Error, context: Record<string, any> = {}): Promise<void> {
    // Send to error tracking service (Sentry, Rollbar, etc.)
    console.error('❌ Error:', error, context)
  }

  async startTransaction(name: string): Promise<Transaction> {
    const startTime = Date.now()
    return {
      name,
      startTime,
      end: () => {
        const duration = Date.now() - startTime
        this.recordMetric(`${name}.duration`, duration, { unit: 'ms' })
      }
    }
  }
}
```

## Success Metrics & Validation

### Technical Validation
- [ ] All critical issues from review are resolved
- [ ] Order success rate > 99.5%
- [ ] Inventory accuracy = 100%
- [ ] System response time < 2 seconds
- [ ] Zero data loss in transactions

### Business Validation
- [ ] Customer satisfaction score > 4.5/5
- [ ] Order volume increased by 20%
- [ ] Kitchen preparation time reduced by 15%
- [ ] Staff productivity improved by 25%

### Quality Assurance
- [ ] Code coverage > 85%
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Accessibility compliance achieved

## Risk Mitigation

### Rollback Strategy
1. **Immediate Rollback**: Blue-green deployment allows instant rollback
2. **Feature Flags**: All new features can be disabled instantly
3. **Data Backup**: Daily automated backups with 30-day retention
4. **Monitoring Alerts**: Automatic alerts for critical issues

### Contingency Plans
1. **Payment Failure**: Manual payment processing fallback
2. **Inventory Sync**: Manual inventory adjustment tools
3. **Order Recovery**: Admin tools for order state correction
4. **Communication**: Customer notification templates for issues

## Conclusion

This implementation plan provides a systematic approach to transforming the Egumeni Eats system from a basic ordering platform into a robust, enterprise-grade restaurant management solution. The phased approach ensures minimal disruption while systematically addressing all identified issues.

The comprehensive testing strategy, monitoring capabilities, and rollback mechanisms ensure the system remains reliable and performant throughout the transformation.