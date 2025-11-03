import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { inventoryOperations } from '../utils/firebase/firestore'
import { submitInventoryIssue } from '../utils/firebase/inventoryIssuesOperations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'
import {
  Package,
  BarChart3,
  AlertTriangle,
  Plus,
  Search,
  Scan,
  FileText,
  Check,
  X,
  Edit,
  TrendingDown,
  TrendingUp,
  Calculator,
  LogOut,
  Loader2,
  RefreshCw,
  Download,
  Clock,
  CheckCircle
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import egumeniLogo from '../assets/logo.png'

interface InventoryItem {
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
  location: string
  createdAt: string
  updatedAt: string
}

// Unit conversion definitions
const UNIT_CONVERSIONS = {
  // Weight units (base: grams)
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  // Volume units (base: ml)
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
  // Count units (no conversion)
  pcs: { base: 'pcs', factor: 1 },
  each: { base: 'pcs', factor: 1 },
  units: { base: 'pcs', factor: 1 },
}

// Available units for selection
const AVAILABLE_UNITS = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'L', label: 'Litres (L)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'each', label: 'Each' },
  { value: 'units', label: 'Units' },
]

// Function to convert quantity from one unit to another
function convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity

  const fromConversion = UNIT_CONVERSIONS[fromUnit as keyof typeof UNIT_CONVERSIONS]
  const toConversion = UNIT_CONVERSIONS[toUnit as keyof typeof UNIT_CONVERSIONS]

  if (!fromConversion || !toConversion) {
    throw new Error(`Unsupported unit conversion: ${fromUnit} to ${toUnit}`)
  }

  if (fromConversion.base !== toConversion.base) {
    throw new Error(`Cannot convert between different unit types: ${fromConversion.base} to ${toConversion.base}`)
  }

  // Convert to base unit first, then to target unit
  const baseQuantity = quantity * fromConversion.factor
  return baseQuantity / toConversion.factor
}

interface StockIssue {
  id: string
  orderId?: string
  requestedBy: string
  items: {
    inventoryId: string
    name: string
    quantity: number
    unitCost: number
  }[]
  purpose: 'order' | 'waste' | 'transfer' | 'adjustment'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface StockReceipt {
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
}

interface InventoryUsage {
  id: string
  inventoryId: string
  quantity: number
  reason: string
  recordedBy: string
  recordedByName: string
  notes?: string
  type: 'manual' | 'automatic'
  createdAt: string
}

interface UsageStatistics {
  totalRecords: number
  totalQuantity: number
  byReason: Record<string, number>
  byItem: Record<string, number>
  recentActivity: InventoryUsage[]
}

export default function StoresDashboard() {
  const { user, profile, logout } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([])
  const [pendingIssues, setPendingIssues] = useState<StockIssue[]>([])
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [pendingInventoryRequests, setPendingInventoryRequests] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showReceiveStock, setShowReceiveStock] = useState(false)
  const [showStockCount, setShowStockCount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // New item form
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'ingredients' as 'ingredients' | 'supplies' | 'beverages',
    unit: '',
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    unitCost: 0,
    supplier: '',
    barcode: '',
    location: ''
  })

  // Stock receipt form
  const [stockReceipt, setStockReceipt] = useState({
    supplierName: '',
    receiptNumber: '',
    items: [
      {
        inventoryId: '',
        name: '',
        quantity: 0,
        unitCost: 0,
        totalCost: 0,
        expiryDate: ''
      }
    ]
  })

  // Stock count data
  const [stockCount, setStockCount] = useState<{
    items: {
      inventoryId: string
      name: string
      expectedQuantity: number
      countedQuantity: number
      variance: number
      unitCost: number
      varianceValue: number
    }[]
  }>({ items: [] })

  // Usage tracking state
  const [inventoryUsage, setInventoryUsage] = useState<InventoryUsage[]>([])
  const [usageStatistics, setUsageStatistics] = useState<UsageStatistics | null>(null)
  const [showRecordUsage, setShowRecordUsage] = useState(false)
  const [usageForm, setUsageForm] = useState({
    inventoryId: '',
    quantityUsed: 1,
    unit: '',
    purpose: '',
    notes: ''
  })

  // Stock issues state
  const [stockIssues, setStockIssues] = useState<any[]>([])
  const [showResolveIssue, setShowResolveIssue] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  // New inventory issue modal state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [issueItemId, setIssueItemId] = useState("")
  const [issueType, setIssueType] = useState("")
  const [issueDescription, setIssueDescription] = useState("")

  useEffect(() => {
    initializeData()

    // Subscribe to real-time inventory updates
    const unsubscribe = inventoryOperations.onInventoryChange((items: any[]) => {
      console.log('🔄 Real-time inventory update received in StoresDashboard:', items.length, 'items')
      setInventory(items || [])
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const initializeBasicInventory = async () => {
    try {
      console.log('🌱 Creating basic inventory items using Firebase...')
      setLoading(true)

      // Create basic inventory items using Firebase API
      const response = await api.request('/init-inventory', {
        method: 'POST'
      })

      console.log('✅ Basic inventory items created:', response.count)

      toast.success(`Created ${response.count} basic inventory items successfully!`)

      // Refresh inventory data
      await fetchInventory()

    } catch (error) {
      console.error('❌ Failed to create basic inventory items:', error)
      toast.error('Failed to create basic inventory items. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const initializeData = async () => {
    console.log('🚀 Initializing StoresDashboard data...')

    // Fetch all data
    console.log('📦 Fetching all data...')
    await Promise.all([
      fetchInventory(),
      fetchPendingIssues(),
      fetchLowStockItems(),
      fetchPendingInventoryRequests(),
      fetchInventoryUsage(),
      fetchUsageStatistics(),
      fetchStockIssues()
    ])
    console.log('✅ All data fetched')
  }

  useEffect(() => {
    filterInventory()
  }, [inventory, searchTerm, selectedCategory])

  const fetchInventory = async () => {
    try {
      console.log('📦 Loading inventory from Firebase...')
      setLoading(true)
      const response = await api.request('/pos/inventory')
      const items = response.items || []
      console.log('📥 Inventory loaded:', items.length, 'items')

      if (items && Array.isArray(items) && items.length > 0) {
        setInventory(items)
        console.log('✅ Inventory loaded successfully:', items.length, 'items')
        console.log('🔍 Sample item:', items[0])
        toast.success(`Loaded ${items.length} inventory items`)
      } else {
        console.warn('⚠️ No inventory items found')
        setInventory([]) // Set empty array instead of error

        // For stores users, offer to create basic inventory items
        if (profile?.role === 'stores' || profile?.role === 'admin' || profile?.role === 'supervisor') {
          toast.info('No inventory items found. Would you like to create some basic items to get started?', {
            action: {
              label: 'Create Basic Items',
              onClick: () => initializeBasicInventory()
            },
            duration: 10000
          })
        } else {
          toast.info('No inventory items found. You can add items using the "Add Item" button.')
        }
      }
    } catch (error) {
      console.error('❌ Error fetching inventory:', error)
      setError('Failed to load inventory. Please check your connection and try again.')
      setTimeout(() => setError(''), 8000)
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingIssues = async () => {
    try {
      console.log('📋 Loading pending stock issues from Firebase...')
      const response = await api.request('/pos/inventory/issues/pending')
      const pending = response.issues || []
      setPendingIssues(pending)
      console.log('✅ Pending issues loaded:', pending.length)
    } catch (error) {
      console.error('❌ Error fetching pending issues:', error)
      setPendingIssues([])
    }
  }

  const fetchLowStockItems = async () => {
    try {
      console.log('⚠️ Checking for low stock items...')
      const response = await api.request('/pos/inventory/low-stock')
      const lowStock = response.items || []
      setLowStockItems(lowStock)
      console.log('✅ Low stock items found:', lowStock.length)
    } catch (error) {
      console.error('❌ Error fetching low stock items:', error)
      setLowStockItems([])
    }
  }

  const fetchPendingInventoryRequests = async () => {
    try {
      console.log('📋 Loading pending inventory requests from Firebase...')
      const { inventoryOperations } = await import('../utils/firebase/firestore')
      const allRequests = await inventoryOperations.getInventoryRequests()
      const pendingRequests = allRequests.filter((request: any) => request.status === 'pending')
      setPendingInventoryRequests(pendingRequests)
      console.log('✅ Pending inventory requests loaded:', pendingRequests.length)
    } catch (error) {
      console.error('❌ Error fetching pending inventory requests:', error)
      setPendingInventoryRequests([])
    }
  }

  const fetchInventoryUsage = async () => {
    try {
      console.log('📊 Loading inventory usage history...')
      const { inventoryOperations } = await import('../utils/firebase/firestore')
      const usage = await inventoryOperations.getInventoryUsageHistory()
      const typedUsage: InventoryUsage[] = usage.map((record: any) => ({
        id: record.id,
        inventoryId: record.itemId || '',
        quantity: record.quantityUsed || 0,
        reason: record.purpose || '',
        recordedBy: record.usedBy || '',
        recordedByName: record.usedBy || '',
        notes: record.notes || '',
        type: 'manual',
        createdAt: record.createdAt || ''
      }))
      setInventoryUsage(typedUsage)
      console.log('✅ Inventory usage loaded:', typedUsage.length, 'records')
    } catch (error) {
      console.error('❌ Error fetching inventory usage:', error)
      setInventoryUsage([])
    }
  }

  const fetchUsageStatistics = async () => {
    try {
      console.log('📈 Loading usage statistics...')
      const { inventoryOperations } = await import('../utils/firebase/firestore')
      const stats = await inventoryOperations.getUsageStatistics()
      setUsageStatistics(stats)
      console.log('✅ Usage statistics loaded')
    } catch (error) {
      console.error('❌ Error fetching usage statistics:', error)
      setUsageStatistics(null)
    }
  }

  const fetchStockIssues = async () => {
    try {
      console.log('🔍 Loading stock issues...')
      const { inventoryOperations } = await import('../utils/firebase/firestore')
      const issues = await inventoryOperations.getStockIssues()
      setStockIssues(issues || [])
      console.log('✅ Stock issues loaded:', issues?.length || 0)
    } catch (error) {
      console.error('❌ Error fetching stock issues:', error)
      setStockIssues([])
    }
  }

  const resolveStockIssue = async (issueId: string, status: string, notes?: string) => {
    try {
      await inventoryOperations.updateStockIssueStatus(
        issueId,
        status,
        profile?.id || '',
        profile?.name || 'Stores Manager',
        notes || resolutionNotes || undefined
      )

      toast.success(`Issue ${status === 'resolved' ? 'resolved' : 'marked as in progress'}`)
      setShowResolveIssue(false)
      setSelectedIssue(null)
      setResolutionNotes('')
      await fetchStockIssues()
    } catch (error) {
      console.error('❌ Error updating stock issue:', error)
      toast.error('Failed to update issue status')
    }
  }

  const filterInventory = () => {
    let filtered = inventory

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode?.includes(searchTerm)
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    setFilteredInventory(filtered)
  }

  const createInventoryItem = async () => {
    if (!newItem.name || !newItem.unit || newItem.currentStock < 0) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      console.log('📦 StoresDashboard: Creating new inventory item...')

      // Create new inventory item using Firebase API
      const response = await api.request('/pos/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: newItem.name,
          category: newItem.category,
          unit: newItem.unit,
          currentStock: newItem.currentStock,
          minStock: newItem.minStock,
          maxStock: newItem.maxStock,
          unitCost: newItem.unitCost,
          supplier: newItem.supplier,
          barcode: newItem.barcode || '',
          location: newItem.location
        })
      })

      console.log('✅ StoresDashboard: Inventory item created:', response.item.name)

      toast.success('Inventory item created successfully')
      setNewItem({
        name: '',
        category: 'ingredients',
        unit: '',
        currentStock: 0,
        minStock: 0,
        maxStock: 0,
        unitCost: 0,
        supplier: '',
        barcode: '',
        location: ''
      })
      setShowAddItem(false)

      // Refresh inventory
      await fetchInventory()
    } catch (error) {
      console.error('❌ StoresDashboard: Error creating inventory item:', error)
      toast.error('Failed to create inventory item')
    } finally {
      setLoading(false)
    }
  }

  const receiveStock = async () => {
    console.log('🚀 Receive stock initiated')
    console.log('📋 Current stock receipt:', stockReceipt)
    
    if (!stockReceipt.supplierName || !stockReceipt.receiptNumber || stockReceipt.items.length === 0) {
      toast.error('Please fill in all required fields')
      console.log('❌ Validation failed: Missing supplier name or receipt number')
      return
    }

    // Validate items
    for (let i = 0; i < stockReceipt.items.length; i++) {
      const item = stockReceipt.items[i]
      if (!item.inventoryId) {
        toast.error(`Item ${i + 1}: Please select an inventory item`)
        console.log(`❌ Validation failed: Item ${i + 1} has no inventoryId`)
        return
      }
      if (item.quantity <= 0) {
        toast.error(`Item ${i + 1}: Quantity must be greater than 0`)
        console.log(`❌ Validation failed: Item ${i + 1} has invalid quantity:`, item.quantity)
        return
      }
      if (item.unitCost <= 0) {
        toast.error(`Item ${i + 1}: Unit cost must be greater than 0`)
        console.log(`❌ Validation failed: Item ${i + 1} has invalid unit cost:`, item.unitCost)
        return
      }
    }

    console.log('✅ All validations passed')
    setLoading(true)
    
    try {
      console.log('📦 StoresDashboard: Receiving stock using Firebase...')

      // Receive stock using Firebase API
      const response = await api.request('/pos/inventory/receive', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: stockReceipt.supplierName,
          receiptNumber: stockReceipt.receiptNumber,
          items: stockReceipt.items.map(item => ({
            inventoryId: item.inventoryId,
            name: item.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
            expiryDate: item.expiryDate || undefined
          })),
          totalCost: stockReceipt.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0),
          receivedBy: profile?.name || 'Stores Staff'
        })
      })

      console.log('✅ Stock receipt processed:', response.receipt)
      
      const itemCount = stockReceipt.items.length
      const totalValue = response.receipt.totalCost.toFixed(2)
      
      toast.success(`Stock received successfully! ${itemCount} item(s) - Total: R${totalValue}`, {
        duration: 5000
      })
      
      console.log('✅ Stock received successfully')
      
      // Reset form
      setStockReceipt({
        supplierName: '',
        receiptNumber: '',
        items: [{ inventoryId: '', name: '', quantity: 0, unitCost: 0, totalCost: 0, expiryDate: '' }]
      })
      setShowReceiveStock(false)
      
      // Refresh data
      console.log('🔄 Refreshing inventory data...')
      await fetchInventory()
      await fetchLowStockItems()
      console.log('✅ Inventory data refreshed')
      
    } catch (error) {
      console.error('❌ Error receiving stock:', error)
      toast.error(`Failed to receive stock: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const approveStockIssue = async (issueId: string) => {
    setLoading(true)
    try {
      console.log('✅ Approving stock issue:', issueId)

      // For now, stock issues are not implemented in Firebase
      // This is a placeholder until stock issues are added to Firestore
      toast.info('Stock issue approval not yet implemented in Firebase version')
      console.log('⚠️ Stock issue approval skipped - not implemented in Firebase')

      // TODO: Implement stock issue approval in Firebase
      // await api.request(`/pos/inventory/issues/${issueId}/approve`, { method: 'POST' })

      // For now, just refresh the data
      fetchPendingIssues()
      fetchInventory()
      fetchLowStockItems()
    } catch (error) {
      console.error('❌ Error approving stock issue:', error)
      toast.error('Failed to approve stock issue')
    } finally {
      setLoading(false)
    }
  }

  const approveInventoryRequest = async (requestId: string) => {
    setLoading(true)
    try {
      console.log('✅ Approving inventory request:', requestId)

      const { inventoryOperations } = await import('../utils/firebase/firestore')
      await inventoryOperations.approveInventoryRequest(requestId, profile?.id || '', profile?.name || 'Stores Staff')

      toast.success('Inventory request approved successfully')
      console.log('✅ Inventory request approved')

      // Refresh data
      fetchPendingInventoryRequests()
      fetchInventory()
      fetchLowStockItems()
    } catch (error) {
      console.error('❌ Error approving inventory request:', error)
      toast.error('Failed to approve inventory request')
    } finally {
      setLoading(false)
    }
  }

  const rejectInventoryRequest = async (requestId: string) => {
    setLoading(true)
    try {
      console.log('❌ Rejecting inventory request:', requestId)

      const { inventoryOperations } = await import('../utils/firebase/firestore')
      await inventoryOperations.rejectInventoryRequest(requestId, profile?.id || '', profile?.name || 'Stores Staff')

      toast.success('Inventory request rejected successfully')
      console.log('✅ Inventory request rejected')

      // Refresh data
      fetchPendingInventoryRequests()
      fetchInventory()
      fetchLowStockItems()
    } catch (error) {
      console.error('❌ Error rejecting inventory request:', error)
      toast.error('Failed to reject inventory request')
    } finally {
      setLoading(false)
    }
  }

  const downloadStockCount = async () => {
    if (stockCount.items.length === 0) {
      toast.error('Please add items to count')
      return
    }

    setLoading(true)
    try {
      console.log('📊 Generating stock count PDF report...')

      // Calculate variances
      const itemsWithVariance = stockCount.items.map(item => ({
        ...item,
        variance: item.countedQuantity - item.expectedQuantity,
        varianceValue: (item.countedQuantity - item.expectedQuantity) * item.unitCost
      }))

      // Fetch pending inventory requests for the report
      const { inventoryOperations } = await import('../utils/firebase/firestore')
      const allRequests = await inventoryOperations.getInventoryRequests()
      const pendingRequests = allRequests.filter((request: any) => request.status === 'pending')

      // Create PDF document
      const doc = new jsPDF()

      // Add header
      doc.setFontSize(20)
      doc.text('Stock Count Report', 20, 30)

      doc.setFontSize(12)
      doc.text(`Generated by: ${profile?.name || 'Stores Staff'}`, 20, 45)
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 55)

      // Stock Count Summary Table
      const summaryData = itemsWithVariance.map(item => [
        item.name,
        item.expectedQuantity.toString(),
        item.countedQuantity.toString(),
        item.variance.toString(),
        `R${item.varianceValue.toFixed(2)}`
      ])

      // Calculate total variance
      const totalVarianceValue = itemsWithVariance.reduce((sum, item) => sum + item.varianceValue, 0)

      autoTable(doc, {
        head: [['Item Name', 'Expected', 'Counted', 'Variance', 'Value Impact']],
        body: summaryData,
        startY: 70,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 51, 102] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      })

      // Add total variance
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total Variance Value: R${totalVarianceValue.toFixed(2)}`, 20, finalY)

      // Pending Requests Section
      if (pendingRequests.length > 0) {
        doc.addPage()
        doc.setFontSize(16)
        doc.text('Pending Inventory Requests', 20, 30)

        const requestsData = pendingRequests.map((request: any) => {
          const requestDate = request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : 'Unknown'
          return [
            request.inventoryId || 'Unknown Item',
            request.quantity.toString(),
            request.unit || 'units',
            request.requestedBy || 'Unknown',
            requestDate,
            request.notes || ''
          ]
        })

        autoTable(doc, {
          head: [['Item Requested', 'Quantity', 'Unit', 'Requester', 'Request Date', 'Notes']],
          body: requestsData,
          startY: 45,
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [0, 51, 102] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            5: { cellWidth: 40 } // Notes column wider
          }
        })
      }

      // Download the PDF
      doc.save(`stock-count-${new Date().toISOString().split('T')[0]}.pdf`)

      console.log('✅ Stock count PDF report generated and downloaded')

      toast.success('Stock count PDF report downloaded successfully')
      setStockCount({ items: [] })
      setShowStockCount(false)
    } catch (error) {
      console.error('❌ Error generating stock count PDF report:', error)
      toast.error('Failed to generate stock count PDF report')
    } finally {
      setLoading(false)
    }
  }

  const addStockReceiptItem = () => {
    setStockReceipt({
      ...stockReceipt,
      items: [...stockReceipt.items, {
        inventoryId: '',
        name: '',
        quantity: 0,
        unitCost: 0,
        totalCost: 0,
        expiryDate: ''
      }]
    })
  }

  const recordInventoryUsage = async () => {
    if (!usageForm.inventoryId || usageForm.quantityUsed <= 0 || !usageForm.purpose || !usageForm.unit) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      console.log('📊 Recording inventory usage...')

      const item = inventory.find((i: any) => i.id === usageForm.inventoryId);
      if (!item) throw new Error("Item not found");

      // Convert quantity to item's base unit for storage
      const convertedQuantity = convertUnits(usageForm.quantityUsed, usageForm.unit, item.unit);

      const { inventoryOperations } = await import('../utils/firebase/firestore')
      await inventoryOperations.recordInventoryUsage({
        itemId: item.id,
        itemName: item.name,
        quantityUsed: convertedQuantity,
        unit: item.unit,
        usedBy: profile?.name || "Unknown",
        purpose: usageForm.purpose,
        notes: usageForm.notes,
      });

      // Also decrement from inventory using converted quantity
      await inventoryOperations.decrementStock(item.id, convertedQuantity);

      toast.success(`Inventory usage recorded successfully (${usageForm.quantityUsed} ${usageForm.unit} = ${convertedQuantity.toFixed(2)} ${item.unit})`)

      // Reset form
      setUsageForm({
        inventoryId: '',
        quantityUsed: 1,
        unit: '',
        purpose: '',
        notes: ''
      })
      setShowRecordUsage(false)

      // Refresh data
      await Promise.all([
        fetchInventory(),
        fetchInventoryUsage(),
        fetchUsageStatistics()
      ])

    } catch (error) {
      console.error('❌ Error recording inventory usage:', error)
      toast.error('Failed to record inventory usage')
    } finally {
      setLoading(false)
    }
  }

  const updateStockReceiptItem = (index: number, field: string, value: any) => {
    console.log(`📝 Updating receipt item ${index}, field: ${field}, value:`, value)
    
    const updatedItems = stockReceipt.items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitCost') {
          updatedItem.totalCost = updatedItem.quantity * updatedItem.unitCost
        }
        console.log(`✅ Updated item ${index}:`, updatedItem)
        return updatedItem
      }
      return item
    })
    
    const newStockReceipt = { ...stockReceipt, items: updatedItems }
    console.log('📦 New stock receipt state:', newStockReceipt)
    setStockReceipt(newStockReceipt)
  }

  const generateStockCountItems = () => {
    const items = inventory.map(item => ({
      inventoryId: item.id,
      name: item.name,
      expectedQuantity: item.currentStock,
      countedQuantity: item.currentStock, // Default to current stock
      variance: 0,
      unitCost: item.unitCost,
      varianceValue: 0
    }))
    setStockCount({ items })
  }

  return (
    <div className="min-h-screen bg-ump-light-gray">
      <div className="bg-white shadow-sm border-b border-ump-navy/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-3">
              <img
                src={egumeniLogo}
                alt="Egumeni Eats Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ump-navy">Stores Management</h1>
              <p className="text-ump-gray">University of Mpumalanga • {profile?.name}</p>
            </div>
            {/* UMP Brand Accent */}
            <div className="hidden md:flex space-x-1">
              <div className="w-2 h-8 bg-ump-orange rounded-full"></div>
              <div className="w-2 h-8 bg-ump-green rounded-full"></div>
              <div className="w-2 h-8 bg-ump-red rounded-full"></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lowStockItems.length > 0 && (
              <Badge className="bg-ump-red/10 text-ump-red border-ump-red/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {lowStockItems.length} Low Stock
              </Badge>
            )}
            {pendingIssues.length > 0 && (
              <Badge className="bg-ump-orange/10 text-ump-orange border-ump-orange/20 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {pendingIssues.length} Pending Issues
              </Badge>
            )}
            {pendingInventoryRequests.length > 0 && (
              <Badge className="bg-ump-blue/10 text-ump-blue border-ump-blue/20 flex items-center gap-1">
                <Package className="w-3 h-3" />
                {pendingInventoryRequests.length} Pending Requests
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="text-ump-gray hover:text-ump-navy hover:bg-ump-navy/5">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-ump-red/10 border border-ump-red/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-ump-red" />
            <div>
              <h4 className="font-medium text-ump-red">Error</h4>
              <p className="text-sm text-ump-red/80">{error}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError('')}
              className="ml-auto text-ump-red hover:text-ump-red hover:bg-ump-red/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <Tabs defaultValue="inventory" className="w-full" onValueChange={(value) => {
          console.log('Tab changed to:', value, 'Current inventory items:', inventory.length)
          if (value === 'receive') {
            console.log('Receive tab opened, ensuring inventory is loaded...')
            if (inventory.length === 0) {
              console.log('No inventory loaded, fetching...')
              fetchInventory()
            } else {
              console.log('Inventory already loaded with', inventory.length, 'items')
            }
          }
        }}>
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="receive">Receive Stock</TabsTrigger>
            <TabsTrigger value="issues">Stock Issues</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="usage">Used Inventory</TabsTrigger>
            <TabsTrigger value="count">Stock Count</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="ingredients">Ingredients</SelectItem>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="beverages">Beverages</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    {inventory.length} items loaded
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      console.log('Manual refresh clicked')
                      fetchInventory()
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Inventory Item</DialogTitle>
                    <DialogDescription>
                      Create a new inventory item to track stock levels and manage supplies.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="itemName">Name *</Label>
                      <Input
                        id="itemName"
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="itemCategory">Category</Label>
                      <Select 
                        value={newItem.category} 
                        onValueChange={(value: any) => setNewItem({...newItem, category: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ingredients">Ingredients</SelectItem>
                          <SelectItem value="supplies">Supplies</SelectItem>
                          <SelectItem value="beverages">Beverages</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="itemUnit">Unit *</Label>
                        <Select
                          value={newItem.unit}
                          onValueChange={(value) => setNewItem({...newItem, unit: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_UNITS.map(unit => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="itemStock">Current Stock</Label>
                        <Input
                          id="itemStock"
                          type="number"
                          min="0"
                          value={newItem.currentStock}
                          onChange={(e) => setNewItem({...newItem, currentStock: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minStock">Min Stock</Label>
                        <Input
                          id="minStock"
                          type="number"
                          min="0"
                          value={newItem.minStock}
                          onChange={(e) => setNewItem({...newItem, minStock: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxStock">Max Stock</Label>
                        <Input
                          id="maxStock"
                          type="number"
                          min="0"
                          value={newItem.maxStock}
                          onChange={(e) => setNewItem({...newItem, maxStock: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="unitCost">Unit Cost (R)</Label>
                      <Input
                        id="unitCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.unitCost}
                        onChange={(e) => setNewItem({...newItem, unitCost: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplier">Supplier</Label>
                      <Input
                        id="supplier"
                        value={newItem.supplier}
                        onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                        placeholder="Supplier name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        value={newItem.barcode}
                        onChange={(e) => setNewItem({...newItem, barcode: e.target.value})}
                        placeholder="Barcode"
                      />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={newItem.location}
                        onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                        placeholder="Storage location"
                      />
                    </div>
                    <Button onClick={createInventoryItem} className="w-full" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Item'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <Package className="w-16 h-16 text-ump-gray mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-ump-navy mb-2">No Inventory Items</h3>
                    <p className="text-ump-gray mb-6">
                      {inventory.length === 0 
                        ? "Get started by creating some basic inventory items or adding your own."
                        : "No items match your current search or filter criteria."}
                    </p>
                    {inventory.length === 0 && (profile?.role === 'stores' || profile?.role === 'admin' || profile?.role === 'supervisor') && (
                      <div className="flex gap-3 justify-center">
                        <Button 
                          onClick={initializeBasicInventory}
                          disabled={loading}
                          className="bg-ump-orange hover:bg-ump-orange/90"
                        >
                          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
                          Create Basic Items
                        </Button>
                        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <Plus className="w-4 h-4 mr-2" />
                              Add Custom Item
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Add Inventory Item</DialogTitle>
                              <DialogDescription>
                                Create a new inventory item to track stock levels and manage supplies.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="itemName2">Name *</Label>
                                <Input
                                  id="itemName2"
                                  value={newItem.name}
                                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                  placeholder="Item name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="itemCategory2">Category</Label>
                                <Select 
                                  value={newItem.category} 
                                  onValueChange={(value: any) => setNewItem({...newItem, category: value})}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ingredients">Ingredients</SelectItem>
                                    <SelectItem value="supplies">Supplies</SelectItem>
                                    <SelectItem value="beverages">Beverages</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="itemUnit2">Unit *</Label>
                                  <Select
                                    value={newItem.unit}
                                    onValueChange={(value) => setNewItem({...newItem, unit: value})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AVAILABLE_UNITS.map(unit => (
                                        <SelectItem key={unit.value} value={unit.value}>
                                          {unit.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="itemStock2">Current Stock</Label>
                                  <Input
                                    id="itemStock2"
                                    type="number"
                                    min="0"
                                    value={newItem.currentStock}
                                    onChange={(e) => setNewItem({...newItem, currentStock: parseFloat(e.target.value) || 0})}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="minStock2">Min Stock</Label>
                                  <Input
                                    id="minStock2"
                                    type="number"
                                    min="0"
                                    value={newItem.minStock}
                                    onChange={(e) => setNewItem({...newItem, minStock: parseFloat(e.target.value) || 0})}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="maxStock2">Max Stock</Label>
                                  <Input
                                    id="maxStock2"
                                    type="number"
                                    min="0"
                                    value={newItem.maxStock}
                                    onChange={(e) => setNewItem({...newItem, maxStock: parseFloat(e.target.value) || 0})}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="unitCost2">Unit Cost (R)</Label>
                                <Input
                                  id="unitCost2"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newItem.unitCost}
                                  onChange={(e) => setNewItem({...newItem, unitCost: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="supplier2">Supplier</Label>
                                <Input
                                  id="supplier2"
                                  value={newItem.supplier}
                                  onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                                  placeholder="Supplier name"
                                />
                              </div>
                              <div>
                                <Label htmlFor="barcode2">Barcode</Label>
                                <Input
                                  id="barcode2"
                                  value={newItem.barcode}
                                  onChange={(e) => setNewItem({...newItem, barcode: e.target.value})}
                                  placeholder="Barcode"
                                />
                              </div>
                              <div>
                                <Label htmlFor="location2">Location</Label>
                                <Input
                                  id="location2"
                                  value={newItem.location}
                                  onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                                  placeholder="Storage location"
                                />
                              </div>
                              <Button onClick={createInventoryItem} className="w-full" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Item'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Min/Max</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.barcode && (
                              <p className="text-sm text-gray-500">{item.barcode}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={item.currentStock <= item.minStock ? 'text-red-600 font-semibold' : ''}>
                            {item.currentStock} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.minStock} / {item.maxStock} {item.unit}
                        </TableCell>
                        <TableCell>R{item.unitCost.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.currentStock <= item.minStock ? (
                            <Badge variant="destructive">Low Stock</Badge>
                          ) : item.currentStock >= item.maxStock ? (
                            <Badge variant="secondary">Overstocked</Badge>
                          ) : (
                            <Badge variant="default">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receive Stock</CardTitle>
                <div className="text-sm text-gray-600">
                  Debug: {inventory.length} inventory items loaded
                  {stockReceipt.items.length > 0 && (
                    <div className="mt-2">
                      Receipt items: {stockReceipt.items.map((item, idx) => 
                        `${idx}: ${item.inventoryId ? '✓' : '✗'} ${item.name || 'unnamed'}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplierName">Supplier Name *</Label>
                    <Input
                      id="supplierName"
                      value={stockReceipt.supplierName}
                      onChange={(e) => setStockReceipt({...stockReceipt, supplierName: e.target.value})}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receiptNumber">Receipt Number *</Label>
                    <Input
                      id="receiptNumber"
                      value={stockReceipt.receiptNumber}
                      onChange={(e) => setStockReceipt({...stockReceipt, receiptNumber: e.target.value})}
                      placeholder="Receipt/Invoice number"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium">Items</h4>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={() => {
                          console.log('🔄 Refreshing inventory from receive tab')
                          fetchInventory()
                          toast.info('Refreshing inventory items...')
                        }}
                        variant="outline" 
                        size="sm"
                      >
                        Refresh Items
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => {
                          console.log('🧪 Test fill clicked')
                          console.log('📦 Inventory count:', inventory.length)
                          console.log('📋 Receipt items:', stockReceipt.items.length)
                          
                          if (inventory.length === 0) {
                            toast.error('No inventory items available. Please create or refresh inventory first.')
                            return
                          }
                          
                          if (stockReceipt.items.length === 0) {
                            toast.error('No receipt items to fill. Click "Add Item" first.')
                            return
                          }
                          
                          const firstItem = inventory[0]
                          console.log('🎯 Using item:', firstItem)
                          
                          // Update using single state change for better reliability
                          const updatedItems = [...stockReceipt.items]
                          updatedItems[0] = {
                            inventoryId: firstItem.id,
                            name: firstItem.name,
                            quantity: 10,
                            unitCost: firstItem.unitCost,
                            totalCost: 10 * firstItem.unitCost,
                            expiryDate: ''
                          }
                          setStockReceipt({ ...stockReceipt, items: updatedItems })
                          
                          console.log('✅ Test data filled')
                          toast.success(`Test filled with ${firstItem.name}`, { duration: 3000 })
                        }}
                        variant="outline" 
                        size="sm"
                        disabled={inventory.length === 0}
                      >
                        Test Fill
                      </Button>
                      <Button type="button" onClick={addStockReceiptItem} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                  </div>

                  {stockReceipt.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 p-4 border rounded-lg bg-white relative">
                      {/* Delete button in top-right corner */}
                      {stockReceipt.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white"
                          onClick={() => {
                            const newItems = stockReceipt.items.filter((_, i) => i !== index)
                            setStockReceipt({ ...stockReceipt, items: newItems })
                            toast.success('Item removed from receipt')
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                      <div className="col-span-2">
                        <Label>Inventory Item *</Label>
                        <Select 
                          key={`inventory-select-${index}-${inventory.length}`}
                          value={item.inventoryId || undefined} 
                          onValueChange={(value) => {
                            console.log('🔄 Selected inventory item:', value)
                            const selectedItem = inventory.find(inv => inv.id === value)
                            console.log('🔍 Found item:', selectedItem)
                            console.log('📊 Available inventory:', inventory.length, 'items')
                            
                            if (selectedItem) {
                              console.log('✅ Updating with item:', selectedItem.name)
                              // Use a single state update for better reliability
                              const updatedItems = [...stockReceipt.items]
                              updatedItems[index] = {
                                ...updatedItems[index],
                                inventoryId: value,
                                name: selectedItem.name,
                                unitCost: selectedItem.unitCost,
                                totalCost: updatedItems[index].quantity * selectedItem.unitCost
                              }
                              setStockReceipt({ ...stockReceipt, items: updatedItems })
                              console.log('✅ Updated receipt item:', updatedItems[index])
                            } else {
                              console.error('❌ Item not found in inventory:', value)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              inventory.length === 0 
                                ? "No items available - click refresh" 
                                : item.name || `Select from ${inventory.length} items`
                            } />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {inventory.length === 0 ? (
                              <>
                                <SelectItem value="no-items" disabled>
                                  No inventory items found
                                </SelectItem>
                                <SelectItem value="refresh" disabled>
                                  Try refreshing the page
                                </SelectItem>
                              </>
                            ) : (
                              inventory.map(invItem => (
                                <SelectItem key={invItem.id} value={invItem.id}>
                                  {invItem.name} - Stock: {invItem.currentStock} {invItem.unit} • R{invItem.unitCost.toFixed(2)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-gray-500 mt-1">
                          {inventory.length === 0 ? (
                            <span className="text-red-500">0 items available</span>
                          ) : item.inventoryId ? (
                            <span className="text-blue-600">✓ {item.name} selected</span>
                          ) : (
                            <span className="text-green-600">{inventory.length} items available</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateStockReceiptItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        {item.name && (
                          <div className="text-xs text-gray-600 mt-1">
                            {item.name}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Unit Cost (R) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateStockReceiptItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Total Cost</Label>
                        <Input
                          value={`R${item.totalCost.toFixed(2)}`}
                          disabled
                        />
                      </div>
                      <div>
                        <Label>Expiry Date <span className="text-gray-400 text-xs">(optional)</span></Label>
                        <Input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => updateStockReceiptItem(index, 'expiryDate', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 border-t space-y-4">
                    {/* Summary Section */}
                    <div className="bg-ump-navy/5 p-4 rounded-lg border border-ump-navy/20">
                      <h5 className="font-medium text-ump-navy mb-3">Receipt Summary</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Supplier:</span>
                          <p className="font-medium text-ump-navy">{stockReceipt.supplierName || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Receipt #:</span>
                          <p className="font-medium text-ump-navy">{stockReceipt.receiptNumber || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Items:</span>
                          <p className="font-medium text-ump-navy">
                            {stockReceipt.items.filter(item => item.inventoryId && item.quantity > 0).length} / {stockReceipt.items.length}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Value:</span>
                          <p className="font-medium text-ump-green text-lg">
                            R{stockReceipt.items.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {stockReceipt.supplierName && stockReceipt.receiptNumber && 
                         stockReceipt.items.some(item => item.inventoryId && item.quantity > 0) ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            Ready to submit
                          </span>
                        ) : (
                          <span className="text-orange-600 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            Please complete all required fields
                          </span>
                        )}
                      </div>
                      <Button 
                        onClick={receiveStock} 
                        disabled={loading || !stockReceipt.supplierName || !stockReceipt.receiptNumber}
                        className="bg-ump-navy hover:bg-ump-navy/90"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Receive Stock
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Stock Issues</h2>
                <p className="text-gray-600">Report and track inventory problems</p>
              </div>
              <Button onClick={() => setIsIssueModalOpen(true)} className="bg-ump-navy hover:bg-ump-navy/90">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Stock Issue
              </Button>
            </div>

            {/* Issues Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-sm text-gray-600">Total Issues</p>
                      <p className="text-2xl font-bold text-red-600">{stockIssues.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">{stockIssues.filter(issue => issue.status === 'pending').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">In Progress</p>
                      <p className="text-2xl font-bold text-blue-600">{stockIssues.filter(issue => issue.status === 'in_progress').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Resolved</p>
                      <p className="text-2xl font-bold text-green-600">{stockIssues.filter(issue => issue.status === 'resolved').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issues List */}
            <Card>
              <CardHeader>
                <CardTitle>Reported Issues</CardTitle>
                <CardDescription>Track the status of reported stock issues</CardDescription>
              </CardHeader>
              <CardContent>
                {stockIssues.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No stock issues reported</p>
                    <p className="text-sm text-gray-400">Issues will appear here when reported</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stockIssues.map((issue: any) => (
                      <Card key={issue.id} className="border-l-4 border-l-red-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-medium">{issue.itemName}</h4>
                                <Badge
                                  className={
                                    issue.status === 'resolved'
                                      ? 'bg-green-100 text-green-800'
                                      : issue.status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }
                                >
                                  {issue.status || 'pending'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                                <p>Type: <span className="capitalize">{issue.issueType.replace('_', ' ')}</span></p>
                                <p>Reported: {issue.timestamp?.seconds ? new Date(issue.timestamp.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                                <p>By: {issue.reportedByName || 'Unknown'}</p>
                                <p>Kitchen: {issue.kitchenId || 'Unknown'}</p>
                              </div>
                              <p className="text-sm text-gray-700 italic">"{issue.description}"</p>
                              {issue.resolutionNotes && (
                                <p className="text-sm text-green-700 mt-2 italic">
                                  Resolution: {issue.resolutionNotes}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              {issue.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => resolveStockIssue(issue.id, 'in_progress')}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Start Working
                                </Button>
                              )}
                              {issue.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const notes = prompt('Enter resolution notes:');
                                    if (notes) resolveStockIssue(issue.id, 'resolved');
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* New Inventory Issue Modal */}
            <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Stock Issue</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select Item</label>
                    <Select value={issueItemId} onValueChange={setIssueItemId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select inventory item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Issue Type</label>
                    <Select value={issueType} onValueChange={setIssueType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Textarea
                      placeholder="Describe the issue..."
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button
                    onClick={async () => {
                      if (!issueItemId || !issueType) {
                        alert("Please fill all fields before submitting.");
                        return;
                      }

                      try {
                        const item = inventory.find((i) => i.id === issueItemId);

                        await submitInventoryIssue({
                          itemId: issueItemId,
                          itemName: item?.name || "",
                          issueType,
                          description: issueDescription,
                          reportedBy: profile?.id,
                          reportedByName: profile?.name || "Stores Staff",
                          kitchenId: profile?.id || "unknown",
                        });

                        setIsIssueModalOpen(false);
                        setIssueItemId("");
                        setIssueType("");
                        setIssueDescription("");
                        await fetchStockIssues();
                        alert("Issue submitted successfully!");
                      } catch (error) {
                        console.error("Failed to submit issue:", error);
                        alert("Failed to submit issue. Please try again.");
                      }
                    }}
                  >
                    Submit Issue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Inventory Requests ({pendingInventoryRequests.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingInventoryRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No pending inventory requests</p>
                ) : (
                  <div className="space-y-4">
                    {pendingInventoryRequests.map(request => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium">Request #{request.id.slice(-8)}</h4>
                            <p className="text-sm text-gray-600">
                              Requested by: {request.requestedBy} • {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                            <Badge variant="outline" className="mt-1 capitalize">
                              {request.type || 'inventory'}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveInventoryRequest(request.id)}
                              disabled={loading}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => rejectInventoryRequest(request.id)}
                              disabled={loading}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Requested Item:</h5>
                          <div className="flex justify-between text-sm">
                            <span>{request.inventoryId ? 'Inventory Item' : 'Unknown Item'}</span>
                            <span>{request.quantity} {request.unit || 'units'}</span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="mt-3 pt-3 border-t">
                            <h5 className="font-medium text-sm">Notes:</h5>
                            <p className="text-sm text-gray-600">{request.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ump-navy">Inventory Usage Tracking</h2>
                <p className="text-ump-gray">Monitor and record inventory usage</p>
              </div>
              <Dialog open={showRecordUsage} onOpenChange={setShowRecordUsage}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Record Usage
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Record Inventory Usage</DialogTitle>
                    <DialogDescription>
                      Record manual inventory usage for tracking purposes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="usageItem">Inventory Item *</Label>
                      <Select
                        value={usageForm.inventoryId}
                        onValueChange={(value) => setUsageForm({...usageForm, inventoryId: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select inventory item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} - Stock: {item.currentStock} {item.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="usageQuantity">Quantity Used *</Label>
                      <Input
                        id="usageQuantity"
                        type="number"
                        min="1"
                        value={usageForm.quantityUsed}
                        onChange={(e) => setUsageForm({...usageForm, quantityUsed: parseFloat(e.target.value) || 1})}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="usageUnit">Unit *</Label>
                      <Select
                        value={usageForm.unit}
                        onValueChange={(value) => setUsageForm({...usageForm, unit: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_UNITS.map(unit => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="usagePurpose">Purpose *</Label>
                      <Select
                        value={usageForm.purpose}
                        onValueChange={(value) => setUsageForm({...usageForm, purpose: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cooking">Cooking</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="wastage">Wastage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="usageNotes">Notes (optional)</Label>
                      <Input
                        id="usageNotes"
                        value={usageForm.notes}
                        onChange={(e) => setUsageForm({...usageForm, notes: e.target.value})}
                        placeholder="Additional notes"
                      />
                    </div>
                    <Button onClick={recordInventoryUsage} className="w-full" disabled={loading}>
                      {loading ? 'Recording...' : 'Record Usage'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Usage Statistics */}
            {usageStatistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-ump-blue" />
                      <div>
                        <p className="text-sm text-gray-600">Total Records</p>
                        <p className="text-2xl font-bold text-ump-navy">{usageStatistics.totalRecords}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-ump-red" />
                      <div>
                        <p className="text-sm text-gray-600">Total Used</p>
                        <p className="text-2xl font-bold text-ump-navy">{usageStatistics.totalQuantity.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-ump-orange" />
                      <div>
                        <p className="text-sm text-gray-600">Top Reason</p>
                        <p className="text-lg font-bold text-ump-navy">
                          {Object.keys(usageStatistics.byReason).length > 0
                            ? Object.entries(usageStatistics.byReason).sort(([,a], [,b]) => b - a)[0][0]
                            : 'None'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-ump-green" />
                      <div>
                        <p className="text-sm text-gray-600">Most Used Item</p>
                        <p className="text-lg font-bold text-ump-navy">
                          {Object.keys(usageStatistics.byItem).length > 0
                            ? inventory.find(item => item.id === Object.entries(usageStatistics.byItem).sort(([,a], [,b]) => b - a)[0][0])?.name || 'Unknown'
                            : 'None'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Usage History */}
            <Card>
              <CardHeader>
                <CardTitle>Usage History</CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryUsage.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No usage records found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Recorded By</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryUsage.map(usage => {
                        const item = inventory.find(inv => inv.id === usage.inventoryId)
                        return (
                          <TableRow key={usage.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item?.name || 'Unknown Item'}</p>
                                {usage.notes && (
                                  <p className="text-sm text-gray-500">{usage.notes}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{usage.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {usage.reason.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>{usage.recordedByName}</TableCell>
                            <TableCell>
                              <Badge variant={usage.type === 'automatic' ? 'default' : 'secondary'}>
                                {usage.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(usage.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="count" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Stock Count
                  {stockCount.items.length === 0 && (
                    <Button onClick={generateStockCountItems} variant="outline">
                      <Calculator className="w-4 h-4 mr-2" />
                      Generate Count Sheet
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stockCount.items.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Click "Generate Count Sheet" to start a stock count
                  </p>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Expected</TableHead>
                          <TableHead>Counted</TableHead>
                          <TableHead>Variance</TableHead>
                          <TableHead>Value Impact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockCount.items.map((item, index) => {
                          const variance = item.countedQuantity - item.expectedQuantity
                          const varianceValue = variance * item.unitCost

                          return (
                            <TableRow key={item.inventoryId}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.expectedQuantity}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.countedQuantity}
                                  onChange={(e) => {
                                    const newItems = [...stockCount.items]
                                    newItems[index].countedQuantity = parseFloat(e.target.value) || 0
                                    setStockCount({ items: newItems })
                                  }}
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <div className={`flex items-center gap-1 ${variance === 0 ? 'text-gray-500' : variance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {variance > 0 ? <TrendingUp className="w-4 h-4" /> : variance < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                                  {variance > 0 ? '+' : ''}{variance}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={varianceValue === 0 ? 'text-gray-500' : varianceValue > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {varianceValue > 0 ? '+' : ''}R{varianceValue.toFixed(2)}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-lg font-semibold">
                        Total Variance Value: R{stockCount.items.reduce((sum, item) =>
                          sum + ((item.countedQuantity - item.expectedQuantity) * item.unitCost), 0
                        ).toFixed(2)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setStockCount({ items: [] })}
                        >
                          Clear
                        </Button>
                        <Button onClick={downloadStockCount} disabled={loading}>
                          <Download className="w-4 h-4 mr-2" />
                          {loading ? 'Generating...' : 'Download PDF'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}