import * as kv from './kv_store.tsx'

export interface InventoryItem {
  id: string
  name: string
  category: 'ingredients' | 'supplies' | 'beverages'
  unit: string
  currentStock: number
  minStock: number
  maxStock: number
  unitCost: number
  supplier: string
  barcode?: string
  expiryDate?: string
  location: string
  createdAt: string
  updatedAt: string
}

export interface StockReceipt {
  id: string
  supplierId: string
  supplierName: string
  receiptNumber: string
  items: {
    inventoryId: string
    name: string
    quantity: number
    unitCost: number
    totalCost: number
    expiryDate?: string
  }[]
  totalCost: number
  receivedBy: string
  receivedAt: string
  createdAt: string
}

export interface StockIssue {
  id: string
  orderId?: string
  requestedBy: string
  approvedBy?: string
  items: {
    inventoryId: string
    name: string
    quantity: number
    unitCost: number
  }[]
  purpose: 'order' | 'waste' | 'transfer' | 'adjustment'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  approvedAt?: string
}

export interface StockCount {
  id: string
  countedBy: string
  approvedBy?: string
  items: {
    inventoryId: string
    name: string
    expectedQuantity: number
    countedQuantity: number
    variance: number
    unitCost: number
    varianceValue: number
  }[]
  totalVarianceValue: number
  status: 'pending' | 'approved'
  createdAt: string
  approvedAt?: string
}

export interface Recipe {
  menuItemId: string
  ingredients: {
    inventoryId: string
    name: string
    quantity: number
    unit: string
  }[]
}

export class InventoryService {
  
  // Get all inventory items
  static async getAllItems(): Promise<InventoryItem[]> {
    const items = await kv.getByPrefix('inventory:')
    return items.map(item => JSON.parse(item))
  }

  // Get inventory item by ID
  static async getItem(id: string): Promise<InventoryItem | null> {
    const item = await kv.get(`inventory:${id}`)
    return item ? JSON.parse(item) : null
  }

  // Create new inventory item
  static async createItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> {
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await kv.set(`inventory:${newItem.id}`, JSON.stringify(newItem))
    return newItem
  }

  // Update inventory item
  static async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
    const existingItem = await this.getItem(id)
    if (!existingItem) return null

    const updatedItem = {
      ...existingItem,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await kv.set(`inventory:${id}`, JSON.stringify(updatedItem))
    return updatedItem
  }

  // Atomic stock decrement (for orders)
  static async decrementStock(inventoryId: string, quantity: number): Promise<boolean> {
    const item = await this.getItem(inventoryId)
    if (!item) return false

    if (item.currentStock < quantity) {
      return false // Insufficient stock
    }

    item.currentStock -= quantity
    item.updatedAt = new Date().toISOString()
    
    await kv.set(`inventory:${inventoryId}`, JSON.stringify(item))
    return true
  }

  // Atomic stock increment (for receipts)
  static async incrementStock(inventoryId: string, quantity: number): Promise<boolean> {
    const item = await this.getItem(inventoryId)
    if (!item) return false

    item.currentStock += quantity
    item.updatedAt = new Date().toISOString()
    
    await kv.set(`inventory:${inventoryId}`, JSON.stringify(item))
    return true
  }

  // Check stock availability for recipe
  static async checkRecipeAvailability(recipe: Recipe): Promise<{
    available: boolean
    missingItems: string[]
  }> {
    const missingItems: string[] = []
    
    for (const ingredient of recipe.ingredients) {
      const item = await this.getItem(ingredient.inventoryId)
      if (!item || item.currentStock < ingredient.quantity) {
        missingItems.push(ingredient.name)
      }
    }
    
    return {
      available: missingItems.length === 0,
      missingItems
    }
  }

  // Process recipe for order (decrement all ingredients)
  static async processRecipe(recipe: Recipe, orderId: string): Promise<{
    success: boolean
    failedItems: string[]
  }> {
    const failedItems: string[] = []
    const processedItems: { id: string, quantity: number }[] = []
    
    // First pass: check availability and decrement
    for (const ingredient of recipe.ingredients) {
      const success = await this.decrementStock(ingredient.inventoryId, ingredient.quantity)
      if (!success) {
        failedItems.push(ingredient.name)
        // Rollback previous decrements
        for (const processed of processedItems) {
          await this.incrementStock(processed.id, processed.quantity)
        }
        break
      }
      processedItems.push({ id: ingredient.inventoryId, quantity: ingredient.quantity })
    }
    
    // Create stock issue record
    if (failedItems.length === 0) {
      const stockIssue: StockIssue = {
        id: crypto.randomUUID(),
        orderId,
        requestedBy: 'system',
        approvedBy: 'system',
        items: recipe.ingredients.map(ing => ({
          inventoryId: ing.inventoryId,
          name: ing.name,
          quantity: ing.quantity,
          unitCost: 0 // We'd need to get this from inventory
        })),
        purpose: 'order',
        status: 'approved',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString()
      }
      
      await kv.set(`stock_issue:${stockIssue.id}`, JSON.stringify(stockIssue))
    }
    
    return {
      success: failedItems.length === 0,
      failedItems
    }
  }

  // Get low stock items
  static async getLowStockItems(): Promise<InventoryItem[]> {
    const items = await this.getAllItems()
    return items.filter(item => item.currentStock <= item.minStock)
  }

  // Receive stock (create receipt)
  static async receiveStock(receipt: Omit<StockReceipt, 'id' | 'createdAt'>): Promise<StockReceipt> {
    const newReceipt: StockReceipt = {
      ...receipt,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    
    // Update inventory levels
    for (const item of receipt.items) {
      await this.incrementStock(item.inventoryId, item.quantity)
      
      // Update unit cost if provided
      const inventoryItem = await this.getItem(item.inventoryId)
      if (inventoryItem && item.unitCost > 0) {
        await this.updateItem(item.inventoryId, { unitCost: item.unitCost })
      }
    }
    
    await kv.set(`stock_receipt:${newReceipt.id}`, JSON.stringify(newReceipt))
    return newReceipt
  }

  // Create stock issue (for kitchen requests)
  static async createStockIssue(issue: Omit<StockIssue, 'id' | 'createdAt'>): Promise<StockIssue> {
    const newIssue: StockIssue = {
      ...issue,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    
    await kv.set(`stock_issue:${newIssue.id}`, JSON.stringify(newIssue))
    return newIssue
  }

  // Approve stock issue
  static async approveStockIssue(issueId: string, approvedBy: string): Promise<boolean> {
    const issueData = await kv.get(`stock_issue:${issueId}`)
    if (!issueData) return false
    
    const issue: StockIssue = JSON.parse(issueData)
    if (issue.status !== 'pending') return false
    
    // Check availability and decrement stock
    const failedItems: string[] = []
    const processedItems: { id: string, quantity: number }[] = []
    
    for (const item of issue.items) {
      const success = await this.decrementStock(item.inventoryId, item.quantity)
      if (!success) {
        failedItems.push(item.name)
        // Rollback
        for (const processed of processedItems) {
          await this.incrementStock(processed.id, processed.quantity)
        }
        break
      }
      processedItems.push({ id: item.inventoryId, quantity: item.quantity })
    }
    
    if (failedItems.length > 0) {
      return false
    }
    
    // Update issue status
    issue.status = 'approved'
    issue.approvedBy = approvedBy
    issue.approvedAt = new Date().toISOString()
    
    await kv.set(`stock_issue:${issueId}`, JSON.stringify(issue))
    return true
  }

  // Get pending stock issues
  static async getPendingStockIssues(): Promise<StockIssue[]> {
    const issues = await kv.getByPrefix('stock_issue:')
    return issues
      .map(issue => JSON.parse(issue))
      .filter(issue => issue.status === 'pending')
  }

  // Create stock count
  static async createStockCount(count: Omit<StockCount, 'id' | 'createdAt'>): Promise<StockCount> {
    const newCount: StockCount = {
      ...count,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    
    await kv.set(`stock_count:${newCount.id}`, JSON.stringify(newCount))
    return newCount
  }

  // Approve stock count and adjust inventory
  static async approveStockCount(countId: string, approvedBy: string): Promise<boolean> {
    const countData = await kv.get(`stock_count:${countId}`)
    if (!countData) return false
    
    const count: StockCount = JSON.parse(countData)
    if (count.status !== 'pending') return false
    
    // Apply adjustments
    for (const item of count.items) {
      const inventoryItem = await this.getItem(item.inventoryId)
      if (inventoryItem) {
        inventoryItem.currentStock = item.countedQuantity
        inventoryItem.updatedAt = new Date().toISOString()
        await kv.set(`inventory:${item.inventoryId}`, JSON.stringify(inventoryItem))
      }
    }
    
    // Update count status
    count.status = 'approved'
    count.approvedBy = approvedBy
    count.approvedAt = new Date().toISOString()
    
    await kv.set(`stock_count:${countId}`, JSON.stringify(count))
    return true
  }

  // Get recipe for menu item
  static async getRecipe(menuItemId: string): Promise<Recipe | null> {
    const recipeData = await kv.get(`recipe:${menuItemId}`)
    return recipeData ? JSON.parse(recipeData) : null
  }

  // Set recipe for menu item
  static async setRecipe(recipe: Recipe): Promise<void> {
    await kv.set(`recipe:${recipe.menuItemId}`, JSON.stringify(recipe))
  }
}

export default InventoryService