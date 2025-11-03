import * as kv from './kv_store.tsx'

export interface Shift {
  id: string
  date: string // YYYY-MM-DD format
  shiftNumber: 1 | 2 // Morning/Afternoon
  cashierId: string
  cashierName: string
  openingFloat: number
  openedAt: string
  closedAt?: string
  expectedCash: number
  actualCash?: number
  cashVariance?: number
  supervisorApprovalRequired: boolean
  supervisorApprovedBy?: string
  supervisorApprovedAt?: string
  status: 'open' | 'pending_approval' | 'closed'
  notes?: string
}

export interface CashTransaction {
  id: string
  shiftId: string
  type: 'sale' | 'refund' | 'void' | 'float_adjustment' | 'cash_drop'
  amount: number
  orderId?: string
  reason?: string
  performedBy: string
  timestamp: string
}

export interface CashUp {
  id: string
  shiftId: string
  performedBy: string
  performedAt: string
  denominations: {
    '200': number
    '100': number
    '50': number
    '20': number
    '10': number
    '5': number
    '2': number
    '1': number
    '0.50': number
    '0.20': number
    '0.10': number
    '0.05': number
  }
  totalCounted: number
  expectedTotal: number
  variance: number
  type: 'mid_shift' | 'end_shift'
}

export class ShiftService {
  
  // Open new shift
  static async openShift(
    cashierId: string, 
    cashierName: string, 
    openingFloat: number,
    date?: string
  ): Promise<Shift> {
    const shiftDate = date || new Date().toISOString().split('T')[0]
    
    // Determine shift number based on time or existing shifts
    const existingShifts = await this.getShiftsByDate(shiftDate)
    const shiftNumber = existingShifts.length === 0 ? 1 : 2
    
    // Check if shift already exists
    const existingShift = existingShifts.find(s => s.shiftNumber === shiftNumber)
    if (existingShift) {
      throw new Error(`Shift ${shiftNumber} for ${shiftDate} already exists`)
    }
    
    const shift: Shift = {
      id: crypto.randomUUID(),
      date: shiftDate,
      shiftNumber: shiftNumber as 1 | 2,
      cashierId,
      cashierName,
      openingFloat,
      openedAt: new Date().toISOString(),
      expectedCash: openingFloat,
      supervisorApprovalRequired: false,
      status: 'open'
    }
    
    await kv.set(`shift:${shift.id}`, JSON.stringify(shift))
    await kv.set(`shift_date:${shiftDate}:${shiftNumber}`, shift.id)
    await kv.set('current_shift', shift.id)
    
    // Record opening float transaction
    await this.recordCashTransaction({
      shiftId: shift.id,
      type: 'float_adjustment',
      amount: openingFloat,
      reason: 'Opening float',
      performedBy: cashierId
    })
    
    return shift
  }

  // Get current active shift
  static async getCurrentShift(): Promise<Shift | null> {
    const currentShiftId = await kv.get('current_shift')
    if (!currentShiftId) return null
    
    const shiftData = await kv.get(`shift:${currentShiftId}`)
    return shiftData ? JSON.parse(shiftData) : null
  }

  // Get shift by ID
  static async getShift(shiftId: string): Promise<Shift | null> {
    const shiftData = await kv.get(`shift:${shiftId}`)
    return shiftData ? JSON.parse(shiftData) : null
  }

  // Get shifts by date
  static async getShiftsByDate(date: string): Promise<Shift[]> {
    const shifts: Shift[] = []
    
    // Try to get both shifts for the date
    for (let shiftNum of [1, 2]) {
      const shiftId = await kv.get(`shift_date:${date}:${shiftNum}`)
      if (shiftId) {
        const shift = await this.getShift(shiftId)
        if (shift) shifts.push(shift)
      }
    }
    
    return shifts.sort((a, b) => a.shiftNumber - b.shiftNumber)
  }

  // Record cash transaction
  static async recordCashTransaction(
    transaction: Omit<CashTransaction, 'id' | 'timestamp'>
  ): Promise<CashTransaction> {
    const newTransaction: CashTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    }
    
    await kv.set(`cash_transaction:${newTransaction.id}`, JSON.stringify(newTransaction))
    
    // Update shift expected cash
    const shift = await this.getShift(transaction.shiftId)
    if (shift) {
      if (transaction.type === 'sale') {
        shift.expectedCash += transaction.amount
      } else if (transaction.type === 'refund' || transaction.type === 'void') {
        shift.expectedCash -= transaction.amount
      } else if (transaction.type === 'cash_drop') {
        shift.expectedCash -= transaction.amount
      }
      
      await kv.set(`shift:${transaction.shiftId}`, JSON.stringify(shift))
    }
    
    return newTransaction
  }

  // Get cash transactions for shift
  static async getShiftTransactions(shiftId: string): Promise<CashTransaction[]> {
    const transactions = await kv.getByPrefix('cash_transaction:')
    return transactions
      .map(t => JSON.parse(t))
      .filter(t => t.shiftId === shiftId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  // Perform cash up
  static async performCashUp(
    shiftId: string,
    performedBy: string,
    denominations: CashUp['denominations'],
    type: 'mid_shift' | 'end_shift'
  ): Promise<CashUp> {
    const shift = await this.getShift(shiftId)
    if (!shift) {
      throw new Error('Shift not found')
    }
    
    // Calculate total counted
    const totalCounted = Object.entries(denominations).reduce((total, [denom, count]) => {
      return total + (parseFloat(denom) * count)
    }, 0)
    
    const cashUp: CashUp = {
      id: crypto.randomUUID(),
      shiftId,
      performedBy,
      performedAt: new Date().toISOString(),
      denominations,
      totalCounted,
      expectedTotal: shift.expectedCash,
      variance: totalCounted - shift.expectedCash,
      type
    }
    
    await kv.set(`cash_up:${cashUp.id}`, JSON.stringify(cashUp))
    
    // Update shift with actual cash and variance
    shift.actualCash = totalCounted
    shift.cashVariance = cashUp.variance
    
    // Check if supervisor approval is required (variance > threshold)
    const varianceThreshold = 20 // R20 threshold
    if (Math.abs(cashUp.variance) > varianceThreshold) {
      shift.supervisorApprovalRequired = true
    }
    
    if (type === 'end_shift') {
      shift.status = shift.supervisorApprovalRequired ? 'pending_approval' : 'closed'
      shift.closedAt = new Date().toISOString()
      
      if (!shift.supervisorApprovalRequired) {
        await kv.del('current_shift')
      }
    }
    
    await kv.set(`shift:${shiftId}`, JSON.stringify(shift))
    
    return cashUp
  }

  // Approve shift (supervisor)
  static async approveShift(
    shiftId: string,
    supervisorId: string,
    supervisorName: string,
    notes?: string
  ): Promise<boolean> {
    const shift = await this.getShift(shiftId)
    if (!shift || shift.status !== 'pending_approval') {
      return false
    }
    
    shift.status = 'closed'
    shift.supervisorApprovedBy = supervisorName
    shift.supervisorApprovedAt = new Date().toISOString()
    if (notes) shift.notes = notes
    
    await kv.set(`shift:${shiftId}`, JSON.stringify(shift))
    await kv.del('current_shift')
    
    return true
  }

  // Get shifts requiring approval
  static async getShiftsRequiringApproval(): Promise<Shift[]> {
    const shifts = await kv.getByPrefix('shift:')
    return shifts
      .map(s => JSON.parse(s))
      .filter(s => s.status === 'pending_approval')
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
  }

  // Get cash ups for shift
  static async getShiftCashUps(shiftId: string): Promise<CashUp[]> {
    const cashUps = await kv.getByPrefix('cash_up:')
    return cashUps
      .map(c => JSON.parse(c))
      .filter(c => c.shiftId === shiftId)
      .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime())
  }

  // Get daily shift summary
  static async getDailyShiftSummary(date: string): Promise<{
    shifts: Shift[]
    totalSales: number
    totalCash: number
    totalVariance: number
  }> {
    const shifts = await this.getShiftsByDate(date)
    
    let totalSales = 0
    let totalCash = 0
    let totalVariance = 0
    
    for (const shift of shifts) {
      const transactions = await this.getShiftTransactions(shift.id)
      const sales = transactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + t.amount, 0)
      
      totalSales += sales
      totalCash += shift.actualCash || 0
      totalVariance += shift.cashVariance || 0
    }
    
    return {
      shifts,
      totalSales,
      totalCash,
      totalVariance
    }
  }

  // Record sale transaction
  static async recordSale(orderId: string, amount: number, cashierId: string): Promise<void> {
    const currentShift = await this.getCurrentShift()
    if (!currentShift) {
      throw new Error('No active shift found')
    }
    
    await this.recordCashTransaction({
      shiftId: currentShift.id,
      type: 'sale',
      amount,
      orderId,
      performedBy: cashierId
    })
  }

  // Record refund transaction
  static async recordRefund(orderId: string, amount: number, cashierId: string, reason: string): Promise<void> {
    const currentShift = await this.getCurrentShift()
    if (!currentShift) {
      throw new Error('No active shift found')
    }
    
    await this.recordCashTransaction({
      shiftId: currentShift.id,
      type: 'refund',
      amount,
      orderId,
      reason,
      performedBy: cashierId
    })
  }

  // Record void transaction
  static async recordVoid(orderId: string, amount: number, cashierId: string, reason: string): Promise<void> {
    const currentShift = await this.getCurrentShift()
    if (!currentShift) {
      throw new Error('No active shift found')
    }
    
    await this.recordCashTransaction({
      shiftId: currentShift.id,
      type: 'void',
      amount,
      orderId,
      reason,
      performedBy: cashierId
    })
  }
}

export default ShiftService