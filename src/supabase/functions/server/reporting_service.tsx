import * as kv from './kv_store.tsx'

// Service imports - these services export classes as default exports
import OrderService from './order_service.tsx'
import ShiftService from './shift_service.tsx'
import InventoryService from './inventory_service.tsx'

// Type imports - let's define the types we need locally to avoid import issues
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
}

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
  specialInstructions?: string
}

export interface Shift {
  id: string
  shiftNumber: number
  cashierId: string
  cashierName: string
  status: 'active' | 'closed' | 'suspended'
  openedAt: string
  closedAt?: string
  openingFloat: number
  expectedCash: number
  actualCash?: number
  cashVariance?: number
  supervisorApprovedBy?: string
  supervisorApprovedAt?: string
}

export interface StockReceipt {
  id: string
  receiptNumber: string
  supplierId: string
  supplierName: string
  items: { inventoryId: string; quantity: number; unitCost: number; total: number }[]
  totalCost: number
  receivedAt: string
  receivedBy: string
  notes?: string
}

export interface StockIssue {
  id: string
  issueNumber: string
  items: { inventoryId: string; quantity: number; unitCost: number }[]
  issuedAt: string
  issuedBy: string
  reason: string
  notes?: string
}

export interface StockCount {
  id: string
  countNumber: string
  items: { inventoryId: string; expectedQty: number; actualQty: number; variance: number; unitCost: number }[]
  totalVarianceValue: number
  countedAt: string
  countedBy: string
  status: 'in_progress' | 'completed' | 'approved'
  supervisorApprovedBy?: string
  supervisorApprovedAt?: string
}

export interface DailyReport {
  date: string
  shifts: ShiftSummary[]
  sales: SalesSummary
  payments: PaymentSummary
  inventory: InventorySummary
  generatedAt: string
  generatedBy: string
}

export interface ShiftSummary {
  shiftNumber: number
  cashier: string
  openedAt: string
  closedAt?: string
  openingFloat: number
  expectedCash: number
  actualCash: number
  cashVariance: number
  status: string
  supervisorApproved: boolean
}

export interface SalesSummary {
  totalOrders: number
  totalSales: number
  totalTax: number
  totalVoids: number
  totalRefunds: number
  netSales: number
  averageOrderValue: number
  ordersByType: Record<string, number>
  topSellingItems: { name: string; quantity: number; revenue: number }[]
}

export interface PaymentSummary {
  cash: { count: number; amount: number }
  card: { count: number; amount: number }
  roomCharge: { count: number; amount: number }
  mobile: { count: number; amount: number }
  total: { count: number; amount: number }
}

export interface InventorySummary {
  lowStockItems: { name: string; currentStock: number; minStock: number }[]
  stockReceipts: { count: number; totalValue: number }
  stockIssues: { count: number; totalValue: number }
  variance: { count: number; totalValue: number }
}

export class ReportingService {
  
  // Generate daily report
  static async generateDailyReport(date: string, generatedBy: string): Promise<DailyReport> {
    const [shifts, sales, payments, inventory] = await Promise.all([
      this.generateShiftSummary(date),
      this.generateSalesSummary(date),
      this.generatePaymentSummary(date),
      this.generateInventorySummary(date)
    ])
    
    const report: DailyReport = {
      date,
      shifts,
      sales,
      payments,
      inventory,
      generatedAt: new Date().toISOString(),
      generatedBy
    }
    
    // Store report
    await kv.set(`daily_report:${date}`, JSON.stringify(report))
    
    return report
  }

  // Generate shift summary (simplified version)
  static async generateShiftSummary(date: string): Promise<ShiftSummary[]> {
    try {
      // Get all shifts and filter by date
      const allShifts = await kv.getByPrefix('shift:')
      const shifts = allShifts
        .map(shift => JSON.parse(shift))
        .filter(shift => {
          const shiftDate = new Date(shift.openedAt).toISOString().split('T')[0]
          return shiftDate === date
        })
      
      return shifts.map(shift => ({
        shiftNumber: shift.shiftNumber || 1,
        cashier: shift.cashierName || 'Unknown',
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingFloat: shift.openingFloat || 0,
        expectedCash: shift.expectedCash || 0,
        actualCash: shift.actualCash || 0,
        cashVariance: shift.cashVariance || 0,
        status: shift.status || 'active',
        supervisorApproved: shift.supervisorApprovedBy ? true : false
      }))
    } catch (error) {
      console.error('Error generating shift summary:', error)
      return []
    }
  }

  // Generate sales summary (simplified version)
  static async generateSalesSummary(date: string): Promise<SalesSummary> {
    try {
      // Get all orders and filter by date
      const allOrders = await kv.getByPrefix('order:')
      const ordersForDate = allOrders
        .map(order => JSON.parse(order))
        .filter(order => {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0]
          return orderDate === date
        })
      
      const completedOrders = ordersForDate.filter(o => 
        o.status !== 'void' && (o.paymentStatus === 'completed' || o.status === 'delivered')
      )
      const voidedOrders = ordersForDate.filter(o => o.status === 'void')
      const refundedOrders = ordersForDate.filter(o => o.paymentStatus === 'refunded')
      
      const totalOrders = completedOrders.length
      const totalSales = completedOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || 0), 0)
      const totalTax = completedOrders.reduce((sum, order) => sum + (order.tax || 0), 0)
      const totalVoids = voidedOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || 0), 0)
      const totalRefunds = refundedOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || 0), 0)
      const netSales = totalSales - totalVoids - totalRefunds
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
      
      // Group by order type
      const ordersByType = completedOrders.reduce((acc, order) => {
        const type = order.orderType || 'dine_in'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Calculate top selling items
      const itemSales = new Map<string, { quantity: number; revenue: number }>()
      
      for (const order of completedOrders) {
        const items = order.items || []
        for (const item of items) {
          const existing = itemSales.get(item.name) || { quantity: 0, revenue: 0 }
          existing.quantity += item.quantity || 1
          existing.revenue += item.total || (item.price * item.quantity) || 0
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
        totalTax,
        totalVoids,
        totalRefunds,
        netSales,
        averageOrderValue,
        ordersByType,
        topSellingItems
      }
    } catch (error) {
      console.error('Error generating sales summary:', error)
      return {
        totalOrders: 0,
        totalSales: 0,
        totalTax: 0,
        totalVoids: 0,
        totalRefunds: 0,
        netSales: 0,
        averageOrderValue: 0,
        ordersByType: {},
        topSellingItems: []
      }
    }
  }

  // Generate payment summary (simplified version)
  static async generatePaymentSummary(date: string): Promise<PaymentSummary> {
    try {
      // Get all orders and filter by date
      const allOrders = await kv.getByPrefix('order:')
      const ordersForDate = allOrders
        .map(order => JSON.parse(order))
        .filter(order => {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0]
          return orderDate === date && order.status !== 'void' && 
                 (order.paymentStatus === 'completed' || order.status === 'delivered')
        })
      
      const paymentSummary: PaymentSummary = {
        cash: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
        roomCharge: { count: 0, amount: 0 },
        mobile: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
      }
      
      for (const order of ordersForDate) {
        const method = order.paymentMethod || 'cash'
        const amount = order.total || order.totalAmount || 0
        
        if (method === 'cash') {
          paymentSummary.cash.count++
          paymentSummary.cash.amount += amount
        } else if (method === 'card') {
          paymentSummary.card.count++
          paymentSummary.card.amount += amount
        } else if (method === 'room_charge') {
          paymentSummary.roomCharge.count++
          paymentSummary.roomCharge.amount += amount
        } else if (method === 'mobile') {
          paymentSummary.mobile.count++
          paymentSummary.mobile.amount += amount
        }
        
        paymentSummary.total.count++
        paymentSummary.total.amount += amount
      }
      
      return paymentSummary
    } catch (error) {
      console.error('Error generating payment summary:', error)
      return {
        cash: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
        roomCharge: { count: 0, amount: 0 },
        mobile: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
      }
    }
  }

  // Generate inventory summary (simplified version)
  static async generateInventorySummary(date: string): Promise<InventorySummary> {
    try {
      // Get inventory items and check for low stock
      const inventoryItems = await kv.getByPrefix('inventory:')
      const items = inventoryItems.map(item => JSON.parse(item))
      
      const lowStockItems = items
        .filter(item => item.currentStock <= item.minStock)
        .map(item => ({
          name: item.name || 'Unknown Item',
          currentStock: item.currentStock || 0,
          minStock: item.minStock || 0
        }))
      
      // Get stock movements for the date
      const stockReceipts = await kv.getByPrefix('stock_receipt:')
      const stockIssues = await kv.getByPrefix('stock_issue:')
      const stockCounts = await kv.getByPrefix('stock_count:')
      
      const receiptsForDate = stockReceipts
        .map(r => JSON.parse(r))
        .filter(r => new Date(r.receivedAt).toISOString().split('T')[0] === date)
      
      const issuesForDate = stockIssues
        .map(i => JSON.parse(i))
        .filter(i => new Date(i.issuedAt).toISOString().split('T')[0] === date)
      
      const countsForDate = stockCounts
        .map(c => JSON.parse(c))
        .filter(c => new Date(c.countedAt).toISOString().split('T')[0] === date)
      
      const receiptsValue = receiptsForDate.reduce((sum, receipt) => sum + (receipt.totalCost || 0), 0)
      const issuesValue = issuesForDate.reduce((sum, issue) => 
        sum + (issue.items || []).reduce((itemSum, item) => 
          itemSum + ((item.quantity || 0) * (item.unitCost || 0)), 0), 0)
      const varianceValue = countsForDate.reduce((sum, count) => sum + (count.totalVarianceValue || 0), 0)
      
      return {
        lowStockItems,
        stockReceipts: { count: receiptsForDate.length, totalValue: receiptsValue },
        stockIssues: { count: issuesForDate.length, totalValue: issuesValue },
        variance: { count: countsForDate.length, totalValue: varianceValue }
      }
    } catch (error) {
      console.error('Error generating inventory summary:', error)
      return {
        lowStockItems: [],
        stockReceipts: { count: 0, totalValue: 0 },
        stockIssues: { count: 0, totalValue: 0 },
        variance: { count: 0, totalValue: 0 }
      }
    }
  }

  // Get stock receipts for date range
  static async getDateRangeStockReceipts(startDate: string, endDate: string): Promise<StockReceipt[]> {
    const receipts = await kv.getByPrefix('stock_receipt:')
    return receipts
      .map(r => JSON.parse(r))
      .filter(r => {
        const receiptDate = r.receivedAt.split('T')[0]
        return receiptDate >= startDate && receiptDate <= endDate
      })
  }

  // Get stock issues for date range
  static async getDateRangeStockIssues(startDate: string, endDate: string): Promise<StockIssue[]> {
    const issues = await kv.getByPrefix('stock_issue:')
    return issues
      .map(i => JSON.parse(i))
      .filter(i => {
        const issueDate = i.createdAt.split('T')[0]
        return issueDate >= startDate && issueDate <= endDate
      })
  }

  // Get stock counts for date range
  static async getDateRangeStockCounts(startDate: string, endDate: string): Promise<StockCount[]> {
    const counts = await kv.getByPrefix('stock_count:')
    return counts
      .map(c => JSON.parse(c))
      .filter(c => {
        const countDate = c.createdAt.split('T')[0]
        return countDate >= startDate && countDate <= endDate
      })
  }

  // Get sales analytics (simplified version)
  static async getSalesAnalytics(startDate: string, endDate: string): Promise<{
    dailySales: { date: string; sales: number; orders: number }[]
    topItems: { name: string; quantity: number; revenue: number }[]
    paymentMethods: { method: string; count: number; amount: number }[]
    orderTypes: { type: string; count: number; amount: number }[]
    hourlyTrends: { hour: number; orders: number; sales: number }[]
  }> {
    try {
      // Get all dates in range
      const dates = this.getDateRange(startDate, endDate)
      const dailySales: { date: string; sales: number; orders: number }[] = []
      
      // Get all orders and filter by date range
      const allOrderData = await kv.getByPrefix('order:')
      const allOrders = allOrderData
        .map(order => JSON.parse(order))
        .filter(order => {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0]
          return orderDate >= startDate && orderDate <= endDate &&
                 order.status !== 'void' && 
                 (order.paymentStatus === 'completed' || order.status === 'delivered')
        })
      
      // Calculate daily sales
      for (const date of dates) {
        const ordersForDate = allOrders.filter(order => {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0]
          return orderDate === date
        })
        
        const dateSales = ordersForDate.reduce((sum, order) => sum + (order.total || order.totalAmount || 0), 0)
        const dateOrders = ordersForDate.length
        
        dailySales.push({ date, sales: dateSales, orders: dateOrders })
      }
      
      // Calculate top items
      const itemSales = new Map<string, { quantity: number; revenue: number }>()
      for (const order of allOrders) {
        const items = order.items || []
        for (const item of items) {
          const existing = itemSales.get(item.name) || { quantity: 0, revenue: 0 }
          existing.quantity += item.quantity || 1
          existing.revenue += item.total || (item.price * item.quantity) || 0
          itemSales.set(item.name, existing)
        }
      }
      
      const topItems = Array.from(itemSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
      
      // Payment methods breakdown
      const paymentMethods = this.aggregateByPaymentMethod(allOrders)
      
      // Order types breakdown
      const orderTypes = this.aggregateByOrderType(allOrders)
      
      // Hourly trends
      const hourlyTrends = this.calculateHourlyTrends(allOrders)
      
      return {
        dailySales,
        topItems,
        paymentMethods,
        orderTypes,
        hourlyTrends
      }
    } catch (error) {
      console.error('Error generating sales analytics:', error)
      return {
        dailySales: [],
        topItems: [],
        paymentMethods: [],
        orderTypes: [],
        hourlyTrends: []
      }
    }
  }

  // Helper methods
  private static getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }

  private static aggregateByPaymentMethod(orders: any[]): { method: string; count: number; amount: number }[] {
    const methods = new Map<string, { count: number; amount: number }>()
    
    for (const order of orders) {
      const method = order.paymentMethod || 'cash'
      const amount = order.total || order.totalAmount || 0
      const existing = methods.get(method) || { count: 0, amount: 0 }
      existing.count++
      existing.amount += amount
      methods.set(method, existing)
    }
    
    return Array.from(methods.entries()).map(([method, data]) => ({ method, ...data }))
  }

  private static aggregateByOrderType(orders: any[]): { type: string; count: number; amount: number }[] {
    const types = new Map<string, { count: number; amount: number }>()
    
    for (const order of orders) {
      const type = order.orderType || 'dine_in'
      const amount = order.total || order.totalAmount || 0
      const existing = types.get(type) || { count: 0, amount: 0 }
      existing.count++
      existing.amount += amount
      types.set(type, existing)
    }
    
    return Array.from(types.entries()).map(([type, data]) => ({ type, ...data }))
  }

  private static calculateHourlyTrends(orders: any[]): { hour: number; orders: number; sales: number }[] {
    const hourly = new Map<number, { orders: number; sales: number }>()
    
    for (let hour = 0; hour < 24; hour++) {
      hourly.set(hour, { orders: 0, sales: 0 })
    }
    
    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours()
      const amount = order.total || order.totalAmount || 0
      const existing = hourly.get(hour)!
      existing.orders++
      existing.sales += amount
    }
    
    return Array.from(hourly.entries()).map(([hour, data]) => ({ hour, ...data }))
  }

  // Get existing daily report
  static async getDailyReport(date: string): Promise<DailyReport | null> {
    const reportData = await kv.get(`daily_report:${date}`)
    return reportData ? JSON.parse(reportData) : null
  }

  // Generate PDF report data (formatted for legacy POS compatibility)
  static async generatePDFReportData(date: string): Promise<{
    businessInfo: {
      name: string
      address: string
      phone: string
      vatNumber: string
    }
    reportData: DailyReport
    formattedTables: {
      salesSummary: string[][]
      paymentSummary: string[][]
      shiftSummary: string[][]
      topItems: string[][]
    }
  }> {
    const report = await this.getDailyReport(date) || await this.generateDailyReport(date, 'system')
    
    // Business info (this would typically come from settings)
    const businessInfo = {
      name: 'Egumeni Eats',
      address: 'University of Mpumalanga Campus',
      phone: '+27 XX XXX XXXX',
      vatNumber: 'VAT REG: XXXXXXXXX'
    }
    
    // Format tables for PDF
    const formattedTables = {
      salesSummary: [
        ['Description', 'Count', 'Amount'],
        ['Total Orders', report.sales.totalOrders.toString(), `R${report.sales.totalSales.toFixed(2)}`],
        ['Voids', '0', `R${report.sales.totalVoids.toFixed(2)}`],
        ['Refunds', '0', `R${report.sales.totalRefunds.toFixed(2)}`],
        ['Net Sales', '', `R${report.sales.netSales.toFixed(2)}`],
        ['Tax', '', `R${report.sales.totalTax.toFixed(2)}`]
      ],
      paymentSummary: [
        ['Payment Method', 'Count', 'Amount'],
        ['Cash', report.payments.cash.count.toString(), `R${report.payments.cash.amount.toFixed(2)}`],
        ['Card', report.payments.card.count.toString(), `R${report.payments.card.amount.toFixed(2)}`],
        ['Room Charge', report.payments.roomCharge.count.toString(), `R${report.payments.roomCharge.amount.toFixed(2)}`],
        ['Mobile', report.payments.mobile.count.toString(), `R${report.payments.mobile.amount.toFixed(2)}`]
      ],
      shiftSummary: [
        ['Shift', 'Cashier', 'Expected', 'Actual', 'Variance', 'Status'],
        ...report.shifts.map(shift => [
          shift.shiftNumber.toString(),
          shift.cashier,
          `R${shift.expectedCash.toFixed(2)}`,
          `R${shift.actualCash.toFixed(2)}`,
          `R${shift.cashVariance.toFixed(2)}`,
          shift.status
        ])
      ],
      topItems: [
        ['Item', 'Qty', 'Revenue'],
        ...report.sales.topSellingItems.slice(0, 5).map(item => [
          item.name,
          item.quantity.toString(),
          `R${item.revenue.toFixed(2)}`
        ])
      ]
    }
    
    return {
      businessInfo,
      reportData: report,
      formattedTables
    }
  }
}

export default ReportingService