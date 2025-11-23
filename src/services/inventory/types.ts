export interface StockInfo {
  id: string
  quantity: number
  unit: string
  minStock: number
}

export interface IngredientValidation {
  itemId: string
  itemName: string
  ingredientId?: string
  ingredientName?: string
  required?: number
  available?: number
  unit?: string
  valid: boolean
  reason: string
}

export interface StockValidationResult {
  isValid: boolean
  results: IngredientValidation[]
}

export interface ReservationResult {
  success: boolean
  reservationId?: string
  reservations?: any[]
  error?: string
}

export interface CommitResult {
  success: boolean
  error?: string
}

export interface InventoryReservation {
  id: string
  orderId: string
  inventoryId: string
  quantity: number
  unit: string
  reservedAt: any
  expiresAt: any
  status: 'active' | 'committed' | 'rolled_back'
}

export interface InventoryOperation {
  inventoryId: string
  type: 'reserve' | 'commit' | 'rollback'
  quantity: number
}

export interface InventoryOperationResult {
  inventoryId: string
  operation: string
  previousStock: number
  newStock: number
  quantity: number
}

export interface TransactionResult {
  success: boolean
  results?: InventoryOperationResult[]
  error?: string
}

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  specialInstructions?: string
  selectedExtras?: any[]
}

export interface CartItem {
  menuItem: {
    id: string
    name: string
    staffPrice: number
    guestPrice: number
  }
  quantity: number
  customerType: 'staff' | 'guest'
  specialInstructions?: string
  selectedExtras?: any[]
}