import {
  collection,
  doc,
  getDoc,
  query,
  getDocs,
  updateDoc,
  Timestamp
} from 'firebase/firestore'
import { db } from '../../utils/firebase/config'
import {
  StockInfo,
  StockValidationResult,
  ReservationResult,
  CommitResult,
  OrderItem
} from './types'

export class InventoryService {
  private db = db

  async validateStockAvailability(orderItems: OrderItem[]): Promise<StockValidationResult> {
    const validationEngine = new StockValidationEngine()
    return validationEngine.validate(orderItems)
  }

  async reserveInventory(orderId: string, items: OrderItem[]): Promise<ReservationResult> {
    const reservationService = new InventoryReservationService()
    return reservationService.createReservation(orderId, items)
  }

  async commitReservation(orderId: string): Promise<CommitResult> {
    const reservationService = new InventoryReservationService()
    return reservationService.commitReservation(orderId)
  }

  async rollbackReservation(orderId: string): Promise<CommitResult> {
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
      quantity: data?.currentStock || 0,
      unit: data?.unit || 'each',
      minStock: data?.minStock || 0
    }
  }

  async getAllInventory(): Promise<any[]> {
    const q = query(collection(this.db, 'inventory'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  async updateStock(inventoryId: string, newQuantity: number): Promise<void> {
    const docRef = doc(this.db, 'inventory', inventoryId)
    await updateDoc(docRef, {
      currentStock: newQuantity,
      updatedAt: Timestamp.now()
    })
  }

  async decrementStock(inventoryId: string, quantity: number): Promise<void> {
    const currentStock = await this.getCurrentStock(inventoryId)
    const newQuantity = currentStock.quantity - quantity

    if (newQuantity < 0) {
      throw new Error(`Insufficient stock for ${inventoryId}`)
    }

    await this.updateStock(inventoryId, newQuantity)
  }

  async deductStockForOrder(orderItems: OrderItem[]): Promise<void> {
    const { inventoryOperations, recipeOperations } = await import('../../utils/firebase/firestore')

    // Process each item individually but with improved error handling
    for (const item of orderItems) {
      try {
        // Check if item requires cooking (has recipe) or is ready-made
        const recipe = await recipeOperations.getRecipe(item.menuItemId)

        if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
          // Cooked item: deduct ingredients based on recipe
          console.log(`Processing recipe for ${item.name}: ${recipe.ingredients.length} ingredients`)

          // Batch fetch inventory items for all ingredients in this recipe
          const inventoryIds = recipe.ingredients.map((ing: any) => ing.inventoryId)
          const inventoryItems = await this.getInventoryItemsBatch(inventoryIds)

          // Create inventory lookup map
          const inventoryMap = new Map()
          inventoryItems.forEach(inv => {
            if (inv) inventoryMap.set(inv.id, inv)
          })

          // Process each ingredient
          for (const ingredient of recipe.ingredients) {
            try {
              const totalQuantityNeeded = ingredient.quantity * item.quantity
              const inventoryItem = inventoryMap.get(ingredient.inventoryId)

              if (!inventoryItem) {
                console.error(`Inventory item not found: ${ingredient.inventoryId} (${ingredient.name})`)
                continue
              }

              // Convert quantity to inventory item's unit if needed
              let quantityToDeduct = totalQuantityNeeded
              if (ingredient.unit !== inventoryItem.unit) {
                const { UnitConversionService } = await import('./UnitConversionService')
                const converter = new UnitConversionService()
                quantityToDeduct = converter.convert(totalQuantityNeeded, ingredient.unit, inventoryItem.unit)
              }

              // Decrement stock with validation
              await this.decrementStock(ingredient.inventoryId, quantityToDeduct)

              // Record usage
              await inventoryOperations.recordInventoryUsage({
                itemId: ingredient.inventoryId,
                itemName: ingredient.name,
                quantityUsed: quantityToDeduct,
                unit: inventoryItem.unit,
                usedBy: 'system',
                purpose: 'order',
                notes: `Order ${item.name} (${item.quantity}x) - ingredient`,
                type: 'automatic'
              })

              // Check for low stock notification
              await this.checkLowStockNotification(ingredient.inventoryId)

            } catch (error) {
              console.error(`Error processing ingredient ${ingredient.name} for ${item.name}:`, error)
              // Continue with other ingredients rather than failing the whole order
            }
          }
        } else {
          // Ready-made item (beverage, snack, etc.): deduct the item unit directly
          try {
            // Try to find inventory item by name (this is a simplified approach)
            const allInventory = await this.getAllInventory()
            const inventoryItem = allInventory.find(inv =>
              inv.name.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(inv.name.toLowerCase())
            )

            if (inventoryItem) {
              // Decrement the ready-made item stock
              await this.decrementStock(inventoryItem.id, item.quantity)

              // Record usage
              await inventoryOperations.recordInventoryUsage({
                itemId: inventoryItem.id,
                itemName: inventoryItem.name,
                quantityUsed: item.quantity,
                unit: inventoryItem.unit,
                usedBy: 'system',
                purpose: 'order',
                notes: `Order ${item.name} (${item.quantity}x) - ready item`,
                type: 'automatic'
              })

              // Check for low stock notification
              await this.checkLowStockNotification(inventoryItem.id)
            } else {
              console.warn(`No inventory item found for ready-made menu item: ${item.name}`)
            }
          } catch (error) {
            console.error(`Error deducting stock for ready-made item ${item.name}:`, error)
            // Continue with other items rather than failing the whole order
          }
        }
      } catch (error) {
        console.error(`Error processing item ${item.name}:`, error)
        // Continue with other items rather than failing the whole order
      }
    }
  }

  // Batch fetch multiple inventory items for performance
  async getInventoryItemsBatch(inventoryIds: string[]): Promise<any[]> {
    if (!inventoryIds || inventoryIds.length === 0) {
      return []
    }

    // Remove duplicates and filter valid IDs
    const validIds = [...new Set(inventoryIds.filter(id => id && typeof id === 'string'))]

    if (validIds.length === 0) {
      return []
    }

    try {
      // For Firestore 'in' queries, limit is 10 items, so we need to batch
      const batchSize = 10
      const results = []

      for (let i = 0; i < validIds.length; i += batchSize) {
        const batch = validIds.slice(i, i + batchSize)
        const { query, where, getDocs, collection } = await import('firebase/firestore')
        const { db } = await import('../../utils/firebase/config')

        const q = query(collection(db, 'inventory'), where('__name__', 'in', batch))
        const snapshot = await getDocs(q)
        const batchResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        results.push(...batchResults)
      }

      return results
    } catch (error) {
      console.error('Error in batch inventory fetch:', error)
      // Fallback to individual fetches if batch fails
      const results = []
      for (const id of validIds) {
        try {
          const item = await this.getCurrentStock(id)
          if (item) results.push({ ...item, id })
        } catch (err) {
          console.error(`Error fetching inventory item ${id}:`, err)
        }
      }
      return results
    }
  }

  async incrementStock(inventoryId: string, quantity: number): Promise<void> {
    const currentStock = await this.getCurrentStock(inventoryId)
    const newQuantity = currentStock.quantity + quantity
    await this.updateStock(inventoryId, newQuantity)
  }

  async checkLowStockNotification(inventoryId: string): Promise<void> {
    try {
      const stockInfo = await this.getCurrentStock(inventoryId)

      // Check if stock is below minimum threshold
      if (stockInfo.quantity <= stockInfo.minStock) {
        const { NotificationService } = await import('../../services/notification/NotificationService')
        const notificationService = new NotificationService()

        // Get inventory item details for notification
        const allInventory = await this.getAllInventory()
        const item = allInventory.find(inv => inv.id === inventoryId)

        if (item) {
          await notificationService.notifyLowStock({
            id: inventoryId,
            name: item.name,
            currentStock: stockInfo.quantity,
            unit: stockInfo.unit,
            minStock: stockInfo.minStock
          }, stockInfo.minStock)
        }
      }
    } catch (error) {
      console.error('Error checking low stock notification:', error)
    }
  }
}

// Import here to avoid circular dependencies
import { StockValidationEngine } from './StockValidationEngine'
import { InventoryReservationService } from './InventoryReservationService'