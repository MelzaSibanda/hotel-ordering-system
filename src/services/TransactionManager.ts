import { runTransaction, Transaction } from 'firebase/firestore'
import { db } from '../utils/firebase/config'
import { InventoryOperation, InventoryOperationResult, TransactionResult } from './inventory/types'

export class TransactionManager {
  async executeInventoryTransaction(
    operations: InventoryOperation[]
  ): Promise<TransactionResult> {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const results: InventoryOperationResult[] = []

        for (const op of operations) {
          const result = await this.executeInventoryOperation(transaction, op)
          results.push(result)
        }

        return { success: true, results }
      })

      return result

    } catch (error) {
      console.error('Inventory transaction failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }
    }
  }

  private async executeInventoryOperation(
    tx: Transaction,
    operation: InventoryOperation
  ): Promise<InventoryOperationResult> {
    const { doc, getDoc, updateDoc, Timestamp } = await import('firebase/firestore')

    const inventoryRef = doc(db, 'inventory', operation.inventoryId)
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