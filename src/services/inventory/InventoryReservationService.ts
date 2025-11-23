import { collection, doc, setDoc, updateDoc, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase/config'
import { InventoryReservation, ReservationResult, CommitResult, OrderItem } from './types'
import { InventoryService } from './InventoryService'

export class InventoryReservationService {
  private inventoryService = new InventoryService()

  async createReservation(orderId: string, items: OrderItem[]): Promise<ReservationResult> {
    const reservations: InventoryReservation[] = []
    const reservationId = `reservation_${orderId}_${Date.now()}`

    try {
      // Create reservations for each ingredient
      for (const item of items) {
        const recipe = await this.getRecipe(item.menuItemId)

        if (recipe?.ingredients) {
          for (const ingredient of recipe.ingredients) {
            const reservation: InventoryReservation = {
              id: `res_${reservationId}_${ingredient.inventoryId}`,
              orderId,
              inventoryId: ingredient.inventoryId,
              quantity: ingredient.quantity * item.quantity,
              unit: ingredient.unit,
              reservedAt: Timestamp.now(),
              expiresAt: Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)), // 15 min expiry
              status: 'active'
            }

            // Save reservation to database
            await setDoc(doc(db, 'inventory_reservations', reservation.id), reservation)
            reservations.push(reservation)

            // Actually deduct from inventory (temporary)
            await this.inventoryService.decrementStock(ingredient.inventoryId, ingredient.quantity * item.quantity)
          }
        }
      }

      return {
        success: true,
        reservationId,
        reservations
      }

    } catch (error) {
      console.error('Reservation creation failed:', error)

      // Rollback any successful reservations
      await this.rollbackReservations(reservations)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async commitReservation(orderId: string): Promise<CommitResult> {
    try {
      // Mark reservations as committed (stock already deducted)
      const reservations = await this.getActiveReservations(orderId)

      for (const reservation of reservations) {
        await updateDoc(doc(db, 'inventory_reservations', reservation.id), {
          status: 'committed',
          committedAt: Timestamp.now()
        })
      }

      return { success: true }

    } catch (error) {
      console.error('Reservation commit failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Commit failed'
      }
    }
  }

  async rollbackReservation(orderId: string): Promise<CommitResult> {
    try {
      const reservations = await this.getActiveReservations(orderId)

      // Restore stock levels
      for (const reservation of reservations) {
        await this.inventoryService.incrementStock(reservation.inventoryId, reservation.quantity)

        // Mark reservation as rolled back
        await updateDoc(doc(db, 'inventory_reservations', reservation.id), {
          status: 'rolled_back',
          rolledBackAt: Timestamp.now()
        })
      }

      return { success: true }

    } catch (error) {
      console.error('Reservation rollback failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rollback failed'
      }
    }
  }

  private async getActiveReservations(orderId: string): Promise<InventoryReservation[]> {
    const q = query(
      collection(db, 'inventory_reservations'),
      where('orderId', '==', orderId),
      where('status', '==', 'active')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryReservation[]
  }

  private async rollbackReservations(reservations: InventoryReservation[]): Promise<void> {
    for (const reservation of reservations) {
      try {
        await this.inventoryService.incrementStock(reservation.inventoryId, reservation.quantity)
        await updateDoc(doc(db, 'inventory_reservations', reservation.id), {
          status: 'rolled_back',
          rolledBackAt: Timestamp.now()
        })
      } catch (error) {
        console.error(`Failed to rollback reservation ${reservation.id}:`, error)
      }
    }
  }

  private async getRecipe(menuItemId: string): Promise<any> {
    // Import here to avoid circular dependencies
    const { recipeOperations } = await import('../../utils/firebase/firestore')
    return recipeOperations.getRecipe(menuItemId)
  }
}