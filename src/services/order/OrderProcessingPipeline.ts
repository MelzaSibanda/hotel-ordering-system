import { InventoryService } from '../inventory/InventoryService'
import { PaymentService } from '../payment/PaymentService'
import { OrderService } from './OrderService'
import { NotificationService } from '../notification/NotificationService'
import { OrderDraft, OrderResult } from './types'

export class OrderProcessingPipeline {
  constructor(
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private orderService: OrderService,
    private notificationService: NotificationService
  ) {}

  async processOrder(orderDraft: OrderDraft): Promise<OrderResult> {
    try {
      console.log('🔍 Stage 1: Validating stock availability...')
      // Stage 1: Validate stock availability
      const validation = await this.inventoryService.validateStockAvailability(orderDraft.items)

      if (!validation.isValid) {
        console.log('❌ Stock validation failed')
        return {
          success: false,
          stage: 'validation',
          error: 'Stock validation failed',
          details: validation.results
        }
      }

      console.log('🔒 Stage 2: Reserving inventory...')
      // Stage 2: Reserve inventory
      const reservation = await this.inventoryService.reserveInventory(
        orderDraft.id,
        orderDraft.items
      )

      if (!reservation.success) {
        console.log('❌ Inventory reservation failed')
        return {
          success: false,
          stage: 'reservation',
          error: 'Inventory reservation failed',
          details: reservation
        }
      }

      console.log('💳 Stage 3: Processing payment...')
      // Stage 3: Process payment
      const payment = await this.paymentService.processPayment(orderDraft)

      if (!payment.success) {
        console.log('❌ Payment processing failed, rolling back inventory...')
        // Rollback inventory reservation
        await this.inventoryService.rollbackReservation(orderDraft.id)
        return {
          success: false,
          stage: 'payment',
          error: 'Payment processing failed',
          details: payment
        }
      }

      // Check if order contains cooking items
      const hasCookingItems = orderDraft.items.some(item => item.requiresCooking !== false)

      // Determine initial status based on cooking requirements
      const initialStatus = hasCookingItems ? 'pending' : 'ready'

      console.log('📝 Stage 4: Creating order...')
      // Stage 4: Create order
      const order = await this.orderService.createOrder({
        ...orderDraft,
        paymentId: payment.paymentId,
        paymentStatus: 'paid',
        status: initialStatus,
        reservationId: reservation.reservationId
      })

      console.log('✅ Stage 5: Committing inventory changes...')
      // Stage 5: Commit inventory changes
      await this.inventoryService.commitReservation(orderDraft.id)

      console.log('📢 Stage 6: Sending notifications...')
      // Stage 6: Send notifications
      const notifications = [this.notificationService.notifyOrderConfirmation(order)]

      // Only notify kitchen if order has cooking items
      if (hasCookingItems) {
        console.log('👨‍🍳 Notifying kitchen for cooking items')
        notifications.push(this.notificationService.notifyKitchenOrder(order))
      } else {
        console.log('🥤 Skipping kitchen notification - order contains only ready items')
      }

      await Promise.all(notifications)

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