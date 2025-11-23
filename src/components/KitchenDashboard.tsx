import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { orderOperations, recipeOperations, inventoryOperations } from '../utils/firebase/firestore'
import { submitInventoryIssue } from '../utils/firebase/inventoryIssuesOperations'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Textarea } from './ui/textarea'
import {
  ChefHat,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Timer,
  Play,
  Check,
  History,
  Search,
  Filter,
  TrendingUp,
  Calendar,
  Package,
  Plus,
  Minus,
  Send,
  AlertOctagon
} from 'lucide-react'
import egumeniLogo from '../assets/logo.png'

interface Ingredient {
  inventoryId: string
  name: string
  quantity: number
  unit: string
}

// Unit conversion definitions (same as in StoresDashboard)
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

interface Recipe {
  id: string
  ingredients: Ingredient[]
}

interface Order {
  id: string
  customerId: string
  customerInfo: any
  items: any[]
  totalAmount: number
  status: string
  estimatedTime: number
  createdAt: string
  kitchenStartedAt: string | null
  specialInstructions: string
}

export default function KitchenDashboard() {
  const { user, profile, logout } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('month')
  const [processingOrder, setProcessingOrder] = useState<string | null>(null)
  
  // Inventory request state
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [inventoryRequests, setInventoryRequests] = useState<any[]>([])
  const [showAddRequest, setShowAddRequest] = useState(false)
  const [requestForm, setRequestForm] = useState({
    selectedItems: [] as Array<{itemId: string, quantity: number}>,
    purpose: 'order',
    notes: ''
  })

  // Stock issues state
  const [stockIssues, setStockIssues] = useState<any[]>([])
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [issueItemId, setIssueItemId] = useState("")
  const [issueType, setIssueType] = useState("")
  const [issueDescription, setIssueDescription] = useState("")

  const loadOrders = async () => {
    try {
      console.log('Loading orders for kitchen dashboard...')
      const data = await orderOperations.getActiveOrders()
      console.log('Orders loaded successfully:', data?.length || 0)
      setOrders(data || [])
      return true // Success indicator
    } catch (error) {
      console.error('Failed to load orders:', error)
      setError(`Failed to load orders: ${error instanceof Error ? error.message : String(error)}`)
      return false // Failure indicator
    }
  }

  const loadOrderHistory = async () => {
    try {
      setHistoryLoading(true)
      console.log('Loading order history...')
      const data = await orderOperations.getCompletedOrders()
      console.log('Order history loaded successfully:', data?.length || 0)
      setHistoryOrders(data || [])
    } catch (error) {
      console.error('Failed to load order history:', error)
      setError(`Failed to load order history: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadInventoryItems = async () => {
    try {
      console.log('🔍 Loading inventory items with user profile:', profile)
      const data = await inventoryOperations.getAllInventory()
      setInventoryItems(data || [])
    } catch (error) {
      console.warn('Failed to load inventory items:', error)
      console.warn('User profile for context:', profile)
      setInventoryItems([])

      // Don't show error for permission issues - this is expected for some roles
      if (!(error instanceof Error) || (!error.message?.includes('permission') && !error.message?.includes('access required'))) {
        setError('Unable to load inventory data')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  // Subscribe to real-time inventory updates
  const subscribeToInventoryUpdates = () => {
    if (!profile?.role || !['kitchen', 'stores', 'supervisor', 'admin'].includes(profile.role)) {
      return
    }

    console.log('📡 Subscribing to real-time inventory updates...')
    const unsubscribe = inventoryOperations.onInventoryChange((items) => {
      console.log('🔄 Real-time inventory update received:', items.length, 'items')
      setInventoryItems(items || [])
    })

    return unsubscribe
  }

  const loadInventoryRequests = async () => {
    try {
      console.log('🔍 Loading inventory requests with user profile:', profile)
      const data = await inventoryOperations.getInventoryRequests()
      setInventoryRequests(data || [])
    } catch (error) {
      console.warn('Failed to load inventory requests:', error)
      console.warn('User profile for context:', profile)
      setInventoryRequests([])

      // Don't show error for permission issues - this is expected for some roles
      if (!(error instanceof Error) || (!error.message?.includes('permission') && !error.message?.includes('access required'))) {
        setError('Unable to load inventory requests')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  const loadStockIssues = async () => {
    try {
      console.log('🔍 Loading stock issues...')
      const data = await inventoryOperations.getStockIssues()
      setStockIssues(data || [])
    } catch (error) {
      console.warn('Failed to load stock issues:', error)
      setStockIssues([])
    }
  }



  const addItemToRequest = (itemId: string) => {
    const existingItem = requestForm.selectedItems.find(item => item.itemId === itemId)
    if (existingItem) {
      // Increase quantity if item already exists
      setRequestForm({
        ...requestForm,
        selectedItems: requestForm.selectedItems.map(item =>
          item.itemId === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      })
    } else {
      // Add new item with quantity 1
      setRequestForm({
        ...requestForm,
        selectedItems: [...requestForm.selectedItems, { itemId, quantity: 1 }]
      })
    }
  }

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item if quantity is 0 or less
      setRequestForm({
        ...requestForm,
        selectedItems: requestForm.selectedItems.filter(item => item.itemId !== itemId)
      })
    } else {
      // Update quantity
      setRequestForm({
        ...requestForm,
        selectedItems: requestForm.selectedItems.map(item =>
          item.itemId === itemId
            ? { ...item, quantity: newQuantity }
            : item
        )
      })
    }
  }

  const removeItemFromRequest = (itemId: string) => {
    setRequestForm({
      ...requestForm,
      selectedItems: requestForm.selectedItems.filter(item => item.itemId !== itemId)
    })
  }

  const createInventoryRequest = async () => {
    try {
      if (requestForm.selectedItems.length === 0) {
        setError('Please add at least one item to the request')
        setTimeout(() => setError(''), 3000)
        return
      }

      // Create separate requests for each item
      const requestPromises = requestForm.selectedItems.map(item => {
        const requestData = {
          inventoryId: item.itemId,
          quantity: item.quantity,
          purpose: requestForm.purpose,
          notes: requestForm.notes,
          requestedBy: profile?.id,
          requestedByName: profile?.name
        }
        return inventoryOperations.createInventoryRequest(requestData)
      })

      await Promise.all(requestPromises)

      setSuccess(`${requestForm.selectedItems.length} inventory request(s) submitted successfully`)
      setTimeout(() => setSuccess(''), 3000)
      setShowAddRequest(false)
      setRequestForm({ selectedItems: [], purpose: 'order', notes: '' })
      await loadInventoryRequests()
    } catch (error) {
      console.error('Failed to create inventory request:', error)
      setError('Failed to create inventory request')
      setTimeout(() => setError(''), 5000)
    }
  }

  useEffect(() => {
    // Only load data if profile is available
    if (!profile) {
      console.log('Profile not available, skipping data load')
      return
    }

    const loadData = async () => {
      console.log('Starting data load for kitchen dashboard...')

      // Add timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('Data loading timeout reached, forcing loading to false')
        setLoading(false)
        setError('Loading timeout - please refresh the page')
      }, 30000) // 30 second timeout

      try {
        await loadOrders()
        await loadOrderHistory()

        // Only load inventory data if user has appropriate role
        if (profile?.role && ['kitchen', 'stores', 'supervisor', 'admin'].includes(profile.role)) {
          try {
            await loadInventoryItems()
            await loadInventoryRequests()
            await loadStockIssues()

            // Subscribe to real-time inventory updates
            const unsubscribe = subscribeToInventoryUpdates()

            // Clear timeout once data loads successfully
            clearTimeout(timeout)
            setLoading(false)
            console.log('Data loading completed successfully')

            return () => {
              if (unsubscribe) unsubscribe()
            }
          } catch (error) {
            console.warn('Non-critical inventory data loading failed:', error)
            // Clear timeout even on inventory failure
            clearTimeout(timeout)
            setLoading(false)
          }
        } else {
          console.log('📋 Inventory features not available for role:', profile?.role)
          // Clear timeout for non-inventory users
          clearTimeout(timeout)
          setLoading(false)
        }
      } catch (error) {
        console.error('Critical data loading failed:', error)
        // Clear timeout on critical failure
        clearTimeout(timeout)
        setLoading(false)
        setError('Failed to load essential data')
      }
    }

    loadData()
  }, [profile])

  // ✅ Step 3: Fix Order Display Section (optional improvement)
  useEffect(() => {
    if (!historyOrders || historyOrders.length === 0) {
      loadOrderHistory()
    }
  }, [])

  // Auto-refresh orders every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders()
      // Refresh history less frequently (every 5th refresh = every 75 seconds)
      if (Math.random() < 0.2) {
        loadOrderHistory()
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await orderOperations.updateOrderStatus(orderId, newStatus)

      await loadOrders()
      // If marking as ready, refresh history to show the moved order
      if (newStatus === 'ready') {
        await loadOrderHistory()
      }
      setSuccess(`Order ${newStatus === 'preparing' ? 'started' : 'marked as ready'}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to update order status:', error)
      setError('Failed to update order status')
    }
  }

  const startOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'preparing')
  }

  const markReady = async (orderId: string) => {
    setProcessingOrder(orderId)
    setError('')

    try {
      // Import the new InventoryService
      const { InventoryService } = await import('../services/inventory/InventoryService')

      const inventoryService = new InventoryService()

      // Process ingredients using the new transaction-safe service
      await processOrderIngredients(orderId)

      // Only mark order as ready if inventory deduction succeeded
      await updateOrderStatus(orderId, 'ready')

      setSuccess(`Order marked as ready and inventory updated successfully`)

    } catch (error) {
      console.error('Failed to mark order ready:', error)
      setError('Failed to mark order ready. Please check inventory levels and try again.')
    } finally {
      setProcessingOrder(null)
    }
  }

  const processOrderIngredients = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    console.log(`🔄 Processing ingredients for order ${orderId} using transaction-safe service...`)

    // Import the InventoryService
    const { InventoryService } = await import('../services/inventory/InventoryService')
    const inventoryService = new InventoryService()

    // Create order items for the inventory service
    const orderItems = order.items.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
      selectedExtras: item.selectedExtras
    }))

    // Use the new inventory service to deduct stock and record usage
    await inventoryService.deductStockForOrder(orderItems)

    console.log(`✅ Ingredient processing completed for order ${orderId}`)
  }

  const getTimeSinceCreated = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes === 1) return '1 minute ago'
    return `${diffMinutes} minutes ago`
  }

  const getPreparationTime = (kitchenStartedAt: string | null) => {
    if (!kitchenStartedAt) return null

    const now = new Date()
    const started = new Date(kitchenStartedAt)
    const diffMinutes = Math.floor((now.getTime() - started.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return 'Just started'
    if (diffMinutes === 1) return '1 minute'
    return `${diffMinutes} minutes`
  }

  const getCountdownTime = (kitchenStartedAt: string | null, estimatedTime: number) => {
    if (!kitchenStartedAt) return null

    const now = new Date()
    const started = new Date(kitchenStartedAt)
    const elapsedMinutes = Math.floor((now.getTime() - started.getTime()) / (1000 * 60))
    const remainingMinutes = estimatedTime - elapsedMinutes

    if (remainingMinutes > 0) {
      return `${remainingMinutes} min left`
    } else if (remainingMinutes === 0) {
      return 'Time up!'
    } else {
      const overtime = Math.abs(remainingMinutes)
      return `${overtime} min over`
    }
  }

  const isOvertime = (kitchenStartedAt: string | null, estimatedTime: number) => {
    if (!kitchenStartedAt) return false

    const now = new Date()
    const started = new Date(kitchenStartedAt)
    const elapsedMinutes = Math.floor((now.getTime() - started.getTime()) / (1000 * 60))

    return elapsedMinutes >= estimatedTime
  }

  const getOrderPriority = (order: Order) => {
    const now = new Date()
    const created = new Date(order.createdAt)
    const ageMinutes = (now.getTime() - created.getTime()) / (1000 * 60)
    
    if (ageMinutes > 20) return 'high'
    if (ageMinutes > 10) return 'medium'
    return 'normal'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-300 bg-red-50'
      case 'medium': return 'border-yellow-300 bg-yellow-50'
      default: return 'border-gray-200 bg-white'
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge className="bg-red-100 text-red-800">Urgent</Badge>
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-800">Priority</Badge>
      default: return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = now.toDateString()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()
    
    if (date.toDateString() === today) {
      return `Today, ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })}`
    } else if (date.toDateString() === yesterday) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })}`
    } else {
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }
  }

  const pendingOrders = orders.filter((order: any) => order.status === 'pending')
  const preparingOrders = orders.filter((order: any) => order.status === 'preparing')

  // Real-time countdown updates every second for preparing orders
  const [countdownTrigger, setCountdownTrigger] = useState(0)
  useEffect(() => {
    if (preparingOrders.length > 0) {
      const countdownInterval = setInterval(() => {
        setCountdownTrigger(prev => prev + 1)
      }, 1000)
      return () => clearInterval(countdownInterval)
    }
  }, [preparingOrders.length])

  // Check if user has inventory access
  const hasInventoryAccess = profile?.role && ['kitchen', 'stores', 'supervisor', 'admin'].includes(profile.role)

  const filteredHistoryOrders = historyOrders.filter((order: any) => {
    // 🕵️ Search match
    const matchesSearch =
      searchTerm === '' ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.some((item: any) =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )

    // 🎯 Status filter
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    // 🗓️ Date filter (using Firestore timestamps)
    const orderDate = order.created_at?.seconds
      ? new Date(order.created_at.seconds * 1000)
      : new Date(order.created_at || '')
    const now = new Date()

    const matchesDate = (() => {
      if (isNaN(orderDate.getTime())) return false
      switch (dateFilter) {
        case 'today':
          return orderDate.toDateString() === now.toDateString()
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return orderDate >= weekAgo
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return orderDate >= monthAgo
        default:
          return true
      }
    })()

    return matchesSearch && matchesStatus && matchesDate
  })

  const calculateTodayStats = (orders: any[]) => {
    const todayStr = new Date().toISOString().split('T')[0]

    const parseFirestoreDate = (timestamp: any): string | null => {
      try {
        if (!timestamp) return null
        if (timestamp.seconds) {
          // Firestore Timestamp → JS Date
          return new Date(timestamp.seconds * 1000).toISOString().split('T')[0]
        }
        if (typeof timestamp === 'string') {
          // already an ISO or local string
          return new Date(timestamp).toISOString().split('T')[0]
        }
        return null
      } catch (e) {
        console.warn('⚠️ Invalid Firestore timestamp:', timestamp)
        return null
      }
    }

    // ✅ Only orders created today
    const todaysOrders = orders.filter(order => {
      const createdDateStr = parseFirestoreDate(order.created_at || order.updated_at)
      return createdDateStr === todayStr
    })

    // 💰 Total revenue
    const todaysRevenue = todaysOrders.reduce(
      (sum, order) => sum + (order.total_amount || order.totalAmount || 0),
      0
    )

    // 🕒 Average preparation time (optional)
    const completedOrders = todaysOrders.filter(
      o => o.status === 'ready' || o.status === 'completed'
    )

    const avgPrepTime =
      completedOrders.length > 0
        ? Math.round(
            completedOrders.reduce((sum, o) => {
              try {
                const start = o.created_at?.seconds
                  ? new Date(o.created_at.seconds * 1000)
                  : new Date(o.created_at || '')
                const end = o.updated_at?.seconds
                  ? new Date(o.updated_at.seconds * 1000)
                  : new Date(o.updated_at || '')
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  return sum + (end.getTime() - start.getTime()) / 60000 // ms → min
                }
              } catch {
                // skip invalid dates
              }
              return sum
            }, 0) / completedOrders.length
          )
        : 0

    return {
      totalOrders: todaysOrders.length,
      revenue: todaysRevenue,
      avgPrepTime
    }
  }

  const todayStats = calculateTodayStats(historyOrders)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading kitchen orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src={egumeniLogo}
                alt="Egumeni Eats"
                className="w-10 h-10 object-contain mr-3"
              />
              <h1 className="text-xl font-bold">Kitchen Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadOrders()
                  loadOrderHistory()
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <span className="text-sm text-gray-600">Chef {profile?.name}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription className="text-green-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className={`grid w-full ${hasInventoryAccess ? 'grid-cols-4' : 'grid-cols-2'} glass-effect rounded-modern-lg p-1 shadow-modern`}>
            <TabsTrigger value="active" className="rounded-modern data-[state=active]:bg-ump-blue data-[state=active]:text-white transition-premium">
              <Play className="w-4 h-4 mr-2" />
              Active Orders
            </TabsTrigger>
            {hasInventoryAccess && (
              <>
                <TabsTrigger value="inventory" className="rounded-modern data-[state=active]:bg-ump-purple data-[state=active]:text-white transition-premium">
                  <Package className="w-4 h-4 mr-2" />
                  Inventory Requests
                </TabsTrigger>
                <TabsTrigger value="issues" className="rounded-modern data-[state=active]:bg-ump-red data-[state=active]:text-white transition-premium">
                  <AlertOctagon className="w-4 h-4 mr-2" />
                  Stock Issues
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="history" className="rounded-modern data-[state=active]:bg-ump-green data-[state=active]:text-white transition-premium">
              <History className="w-4 h-4 mr-2" />
              Order History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Waiting to start
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Timer className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{preparingOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently cooking
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <ChefHat className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{orders.length}</div>
              <p className="text-xs text-muted-foreground">
                Orders in kitchen
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Orders */}
          <div className="animate-slide-in-right">
            <h2 className="text-xl font-bold mb-6 flex items-center text-ump-gray-800">
              <div className="p-2 rounded-modern bg-ump-orange/10 mr-3">
                <Clock className="w-5 h-5 text-ump-orange" />
              </div>
              Pending Orders
              <Badge className="ml-3 bg-ump-orange text-white rounded-modern">
                {pendingOrders.length}
              </Badge>
            </h2>
            
            {pendingOrders.length === 0 ? (
              <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
                <CardContent className="text-center py-12">
                  <div className="animate-bounce-in">
                    <CheckCircle className="w-16 h-16 text-ump-green mx-auto mb-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-ump-gray-800 mb-2">All Caught Up!</h3>
                  <p className="text-ump-gray-600">No pending orders at the moment</p>
                  <p className="text-sm text-ump-gray-500 mt-2">Great job staying on top of things! 🎉</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingOrders
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(order => {
                    const priority = getOrderPriority(order)
                    return (
                      <Card key={order.id} className={`glass-effect shadow-modern rounded-modern-lg interactive-card border-2 ${getPriorityColor(priority)} animate-scale-in`}>
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-modern bg-ump-orange/10">
                                  <span className="text-sm font-bold text-ump-orange">#{order.id.slice(-8)}</span>
                                </div>
                                {getPriorityBadge(priority)}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 text-ump-gray-600">
                                <span className="font-medium">{order.customerInfo?.name || 'Guest'}</span>
                                <span>•</span>
                                <span>{getTimeSinceCreated(order.createdAt)}</span>
                              </CardDescription>
                            </div>
                            <Button
                              onClick={() => startOrder(order.id)}
                              className="interactive-button bg-gradient-to-r from-ump-blue to-ump-indigo hover:from-ump-blue/90 hover:to-ump-indigo/90 text-white rounded-modern shadow-modern"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Cooking
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium mb-2">Order Items:</h4>
                              <div className="space-y-1">
                                {order.items.map((item: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                    <span className="font-medium">{item.quantity}x {item.name}</span>
                                    <span className="text-gray-600">{item.preparationTime || 15} min</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {order.specialInstructions && (
                              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                                <h5 className="font-medium text-yellow-800 mb-1">Special Instructions:</h5>
                                <p className="text-sm text-yellow-700">{order.specialInstructions}</p>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center pt-3 border-t">
                              <span className="text-sm text-gray-600">
                                Estimated time: {order.estimatedTime} minutes
                              </span>
                              <span className="font-bold">R{order.totalAmount?.toFixed(2) ?? '0.00'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Preparing Orders */}
          <div className="animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl font-bold mb-6 flex items-center text-ump-gray-800">
              <div className="p-2 rounded-modern bg-ump-blue/10 mr-3">
                <Timer className="w-5 h-5 text-ump-blue" />
              </div>
              In Progress
              <Badge className="ml-3 bg-ump-blue text-white rounded-modern">
                {preparingOrders.length}
              </Badge>
            </h2>
            
            {preparingOrders.length === 0 ? (
              <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
                <CardContent className="text-center py-12">
                  <div className="animate-bounce-in" style={{ animationDelay: '0.2s' }}>
                    <ChefHat className="w-16 h-16 text-ump-blue mx-auto mb-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-ump-gray-800 mb-2">Kitchen Ready</h3>
                  <p className="text-ump-gray-600">No orders currently in progress</p>
                  <p className="text-sm text-ump-gray-500 mt-2">Ready to start cooking! 👨‍🍳</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {preparingOrders
                  .sort((a, b) => new Date(b.kitchenStartedAt || b.createdAt).getTime() - new Date(a.kitchenStartedAt || a.createdAt).getTime())
                  .map(order => {
                    const overtime = isOvertime(order.kitchenStartedAt, order.estimatedTime)
                    return (
                      <Card
                        key={order.id}
                        className={`glass-effect shadow-modern rounded-modern-lg interactive-card border-2 ${
                          overtime
                            ? 'border-red-500 bg-gradient-to-br from-red-50 to-red-100 animate-pulse'
                            : 'border-ump-blue/30 bg-gradient-to-br from-ump-blue/5 to-ump-indigo/5'
                        } animate-scale-in`}
                      >
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-modern ${overtime ? 'bg-red-100' : 'bg-ump-blue/10'}`}>
                                  <span className={`text-sm font-bold ${overtime ? 'text-red-700' : 'text-ump-blue'}`}>#{order.id.slice(-8)}</span>
                                </div>
                                <Badge className={`${overtime ? 'bg-red-100 text-red-800 border-red-300' : 'bg-ump-blue/10 text-ump-blue border-ump-blue/20'}`}>
                                  {overtime ? 'OVERTIME' : 'Cooking'}
                                </Badge>
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 text-ump-gray-600">
                                <span className="font-medium">{order.customerInfo?.name || 'Guest'}</span>
                                <span>•</span>
                                <span>Cooking for {getPreparationTime(order.kitchenStartedAt)}</span>
                              </CardDescription>
                            </div>
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              onClick={() => markReady(order.id)}
                              disabled={processingOrder === order.id}
                              className="interactive-button bg-gradient-to-r from-ump-green to-ump-emerald hover:from-ump-green/90 hover:to-ump-emerald/90 text-white rounded-modern shadow-modern"
                            >
                              {processingOrder === order.id ? (
                                <>
                                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  Mark Ready
                                </>
                              )}
                            </Button>
                            {processingOrder !== order.id && (
                              <p className="text-xs text-ump-gray-500 text-right max-w-32">
                                ✨ Auto inventory deduction
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium mb-2">Order Items:</h4>
                            <div className="space-y-1">
                              {order.items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                  <span className="font-medium">{item.quantity}x {item.name}</span>
                                  <Badge variant="outline" className="text-blue-600">
                                    Cooking
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {order.specialInstructions && (
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                              <h5 className="font-medium text-yellow-800 mb-1">Special Instructions:</h5>
                              <p className="text-sm text-yellow-700">{order.specialInstructions}</p>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center pt-3 border-t">
                            <div className="flex flex-col gap-1">
                              <span className={`text-sm font-medium ${overtime ? 'text-red-600' : 'text-blue-600'}`}>
                                <Timer className="w-4 h-4 inline mr-1" />
                                {getCountdownTime(order.kitchenStartedAt, order.estimatedTime)}
                              </span>
                              <span className="text-xs text-gray-500">
                                Target: {order.estimatedTime} min
                              </span>
                            </div>
                            <span className="font-bold">R{order.totalAmount?.toFixed(2) ?? '0.00'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

            {orders.length === 0 && (
              <Card className="mt-8">
                <CardContent className="text-center py-12">
                  <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Kitchen is quiet</h3>
                  <p className="text-gray-500">No active orders at the moment. Check back soon!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* History Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
                  <Calendar className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{todayStats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Completed today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">R{todayStats.revenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    From {todayStats.totalOrders} orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Prep Time</CardTitle>
                  <Timer className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{todayStats.avgPrepTime} min</div>
                  <p className="text-xs text-muted-foreground">
                    Average preparation
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search orders, customers, or items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={loadOrderHistory}
                    disabled={historyLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Order History List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <History className="w-5 h-5 mr-2 text-gray-500" />
                  Order History ({filteredHistoryOrders.length})
                </h2>
              </div>

              {historyLoading ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p>Loading order history...</p>
                  </CardContent>
                </Card>
              ) : filteredHistoryOrders.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No orders found</p>
                    <p className="text-sm text-gray-400">Try adjusting your filters</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredHistoryOrders
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(order => (
                      <Card key={order.id} className="border-gray-200">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                Order #{order.id.slice(-8)}
                                <Badge 
                                  className={
                                    order.status === 'delivered' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }
                                >
                                  {order.status === 'delivered' ? 'Delivered' : 'Ready'}
                                </Badge>
                              </CardTitle>
                              <CardDescription>
                                {order.customerInfo?.name || 'Guest'} • {formatDate(order.createdAt)}
                              </CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg">R{order.totalAmount?.toFixed(2) ?? '0.00'}</div>
                              <div className="text-sm text-gray-500">{order.estimatedTime} min target</div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium mb-2">Items Prepared:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {order.items.map((item: any, index: number) => (
                                  <div key={index} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                    <span className="font-medium">{item.quantity}x {item.name}</span>
                                    <span className="text-gray-600">R{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {order.specialInstructions && (
                              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                                <h5 className="font-medium text-yellow-800 mb-1">Special Instructions:</h5>
                                <p className="text-sm text-yellow-700">{order.specialInstructions}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {hasInventoryAccess && (
            <TabsContent value="inventory" className="space-y-6">
            {/* Inventory Request Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Inventory Requests</h2>
                <p className="text-gray-600">Request ingredients and supplies from stores</p>
              </div>
              <Button onClick={() => setShowAddRequest(true)} className="bg-ump-orange hover:bg-ump-orange/90">
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </div>

            {/* Add Request Dialog */}
            {showAddRequest && (
              <Card className="border-2 border-ump-orange/20 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Create Inventory Request
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Available Items */}
                    <div className="space-y-2">
                      <Label>Available Inventory Items</Label>
                      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                        {inventoryItems.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                (Current: {item.currentStock.toFixed(2)} {item.unit})
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addItemToRequest(item.id)}
                              className="bg-ump-orange hover:bg-ump-orange/90"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Selected Items */}
                    {requestForm.selectedItems.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Items</Label>
                        <div className="space-y-2">
                          {requestForm.selectedItems.map((selectedItem) => {
                            const item = inventoryItems.find(i => i.id === selectedItem.itemId)
                            return (
                              <div key={selectedItem.itemId} className="flex items-center justify-between p-3 border rounded bg-white">
                                <div className="flex-1">
                                  <span className="font-medium">{item?.name}</span>
                                  <span className="text-sm text-gray-500 ml-2">({item?.unit})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateItemQuantity(selectedItem.itemId, selectedItem.quantity - 1)}
                                    disabled={selectedItem.quantity <= 1}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="w-12 text-center font-medium">{selectedItem.quantity}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateItemQuantity(selectedItem.itemId, selectedItem.quantity + 1)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeItemFromRequest(selectedItem.itemId)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Purpose and Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="purpose">Purpose</Label>
                        <Select value={requestForm.purpose} onValueChange={(value) => setRequestForm({ ...requestForm, purpose: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order">Order Preparation</SelectItem>
                            <SelectItem value="prep">Kitchen Prep</SelectItem>
                            <SelectItem value="stock">Low Stock</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Input
                          id="notes"
                          value={requestForm.notes}
                          onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                          placeholder="Additional details"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowAddRequest(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={createInventoryRequest}
                      disabled={requestForm.selectedItems.length === 0}
                      className="bg-ump-navy hover:bg-ump-navy/90"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit {requestForm.selectedItems.length} Request{requestForm.selectedItems.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Requests */}
            <Card>
              <CardHeader>
                <CardTitle>My Requests</CardTitle>
                <CardDescription>Track your inventory requests and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {inventoryRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inventory requests found</p>
                    <p className="text-sm text-gray-400">Create a request to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inventoryRequests.map((request: any) => (
                      <Card key={request.id} className="border-l-4 border-l-ump-orange">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-medium">{request.itemName}</h4>
                                <Badge
                                  className={
                                    request.status === 'approved'
                                      ? 'bg-green-100 text-green-800'
                                      : request.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }
                                >
                                  {request.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                <p>Quantity: <span className="font-medium">{request.quantity} {request.unit}</span></p>
                                <p>Purpose: <span className="capitalize">{request.purpose}</span></p>
                                <p>Requested: {new Date(request.createdAt).toLocaleDateString()}</p>
                                {request.approvedAt && (
                                  <p>Approved: {new Date(request.approvedAt).toLocaleDateString()}</p>
                                )}
                              </div>
                              {request.notes && (
                                <p className="text-sm text-gray-600 mt-2 italic">"{request.notes}"</p>
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
          </TabsContent>
          )}

          {hasInventoryAccess && (
            <TabsContent value="issues" className="space-y-6">
            {/* Stock Issues Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Stock Issues</h2>
                <p className="text-gray-600">Report and track inventory problems</p>
              </div>
              <Button onClick={() => setIsIssueModalOpen(true)} className="bg-ump-navy hover:bg-ump-navy/90">
                <AlertOctagon className="w-4 h-4 mr-2" />
                Report Stock Issue
              </Button>
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
                    <AlertOctagon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
                                <p>Reported: {new Date(issue.timestamp.seconds * 1000).toLocaleDateString()}</p>
                                <p>By: {issue.reportedByName || 'Kitchen Staff'}</p>
                                <p>Kitchen: {issue.kitchenId || 'Unknown'}</p>
                              </div>
                              <p className="text-sm text-gray-700 italic">"{issue.description}"</p>
                              {issue.resolutionNotes && (
                                <p className="text-sm text-green-700 mt-2 italic">
                                  Resolution: {issue.resolutionNotes}
                                </p>
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
                        {inventoryItems.map((item: any) => (
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
                        setError("Please fill all required fields before submitting.");
                        setTimeout(() => setError(''), 3000);
                        return;
                      }

                      try {
                        const item = inventoryItems.find((i) => i.id === issueItemId);

                        await submitInventoryIssue({
                          itemId: issueItemId,
                          itemName: item?.name || "",
                          issueType,
                          description: issueDescription,
                          reportedBy: profile?.id,
                          reportedByName: profile?.name || "Kitchen Staff",
                          kitchenId: profile?.id || "unknown",
                        });

                        setIsIssueModalOpen(false);
                        setIssueItemId("");
                        setIssueType("");
                        setIssueDescription("");
                        await loadStockIssues();
                        setSuccess("Issue submitted successfully!");
                        setTimeout(() => setSuccess(''), 3000);
                      } catch (error) {
                        console.error("Failed to submit issue:", error);
                        setError("Failed to submit issue. Please try again.");
                        setTimeout(() => setError(''), 5000);
                      }
                    }}
                  >
                    Submit Issue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </TabsContent>
          )}

          {!hasInventoryAccess && (
            <div className="mt-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900">Inventory Management</h4>
                      <p className="text-sm text-blue-700">
                        Inventory request features are available for Kitchen, Stores, and Supervisor roles.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </Tabs>
      </div>
    </div>
  )
}