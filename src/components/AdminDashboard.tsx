// AdminDashboard - Payment integrations removed v2.0
// Email service removed v2.1 - Resend API integration removed to eliminate API key issues
// Inventory loading v3.1 - Direct Firestore access for real-time inventory management
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { Order } from '../utils/localStorage'
import { collection, getDocs } from "firebase/firestore"
import { db } from "../utils/firebase/config"
import { inventoryOperations } from '../utils/firebase/firestore'

// Helper function to get all orders from Firebase
const getAllOrdersFromFirebase = async (): Promise<Order[]> => {
  const ordersSnapshot = await getDocs(collection(db, 'orders'))
  return ordersSnapshot.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      customerId: data.customerId || data.customer_id || '',
      customerName: data.customerName || data.customer_name || '',
      customerEmail: data.customerEmail || data.customer_email || '',
      items: data.items || [],
      totalAmount: data.totalAmount || data.total_amount || data.total || 0,
      status: data.status || 'pending',
      orderDate: data.orderDate || data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      estimatedTime: data.estimatedTime || data.estimated_time || data.estimated_time || 15, // Default to 15 minutes if not set
      specialInstructions: data.specialInstructions || data.special_instructions || '',
      paymentMethod: data.paymentMethod || data.payment_method || '',
      paymentStatus: data.paymentStatus || data.payment_status || 'pending',
      orderType: data.orderType || data.order_type || 'dine-in',
      tableNumber: data.tableNumber || data.table_number,
      deliveryAddress: data.deliveryAddress || data.delivery_address
    } as Order
  })
}

import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Alert, AlertDescription } from './ui/alert'
import ConfirmDialog from './ConfirmDialog'
import DataVerificationPanel from './DataVerificationPanel'
import UserDebugPanel from './UserDebugPanel'
import { InventoryStatusBanner } from './InventoryStatusBanner'
import { IngredientsPicker } from './IngredientsPicker'
import { 
  Shield,
  ShoppingBag,
  Users,
  TrendingUp,
  Plus,
  Edit,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Package,
  LogOut,
  RefreshCw,
  Camera,
  Upload,
  X,
  Trash2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  UserPlus,
  UserCheck,
  UserX,
  Key,
  Search,
  Filter,
  Settings,
  Activity,
  Minus,
  FileText,
  Download,
  Calendar as CalendarIcon
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
const defaultLogo = "/src/assets/logo.png"

// Helper function to get display name for category
const getCategoryDisplayName = (categoryValue: string): string => {
  const categoryMap: { [key: string]: string } = {
    // Breakfast
    'breakfast-meals-on-the-go': 'Breakfast - Meals on the Go',
    'breakfast-light-meal': 'Breakfast - Light Meal Menu',
    'breakfast-sandwiches': 'Breakfast - Sandwiches Selection',
    'breakfast-burgers': 'Breakfast - Burger Selection',
    
    // Beverages - Wines
    'beverages-white-wine': 'White Wine',
    'beverages-red-wine': 'Red Wine',
    'beverages-champagne': 'Champagne',
    'beverages-sherries': 'Sherries',
    'beverages-aperitifs': 'Aperitifs',
    
    // Beverages - Spirits
    'beverages-single-malt-whiskey': 'Single Malt Whiskey',
    'beverages-blended-malt-whiskey': 'Blended Malt Whiskey',
    'beverages-cognac': 'Cognac',
    'beverages-brandy': 'Brandy',
    'beverages-gin': 'Gin',
    'beverages-vodka': 'Vodka',
    'beverages-rum': 'Rum',
    'beverages-tequila': 'Tequila',
    'beverages-liqueurs': 'Liqueurs',
    
    // Beverages - Beers
    'beverages-beers-local': 'Beers (Local)',
    'beverages-beers-imported': 'Beers (Imported)',
    'beverages-ciders': 'Ciders',
    'beverages-cocktails': 'Cocktails',
    
    // Beverages - Non-Alcoholic
    'beverages-minerals': 'Minerals',
    'beverages-milkshakes': 'Milk Shakes',
    'beverages-cordials': 'Cordials',
    'beverages-mineral-water': 'Mineral Water',
    'beverages-soft-drinks': 'Selected Soft Drinks',
    'beverages-tea': 'Tea Selection',
    'beverages-coffee': 'Coffee & Hot Beverages',
    'beverages-bar-snacks': 'Bar Snacks',
    
    // Main Course
    'main-salads-starters': 'Salads and Starters',
    'main-selection': 'Main Selection',
    'main-desserts': 'Desserts Selection'
  }
  
  return categoryMap[categoryValue] || categoryValue.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

interface MenuItem {
  id: string
  name: string
  description: string
  staffPrice: number
  guestPrice: number
  category: string
  image: string
  ingredients: string[]
  extras?: string[]
  preparationTime: number
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

// Order interface imported from localStorage.tsx

interface User {
  id: string
  email: string
  name: string
  role: string
  phone: string
  staffNo?: string
  createdAt: string
  isActive: boolean
  createdBy?: string
  createdByName?: string
  updatedAt?: string
  updatedBy?: string
  updatedByName?: string
  passwordResetAt?: string
}

interface Shift {
  id: string
  userId: string
  userName: string
  userRole: string
  shiftType: string
  startTime: string
  expectedEndTime?: string
  endTime?: string
  status: string
  createdAt: string
  createdBy: string
  createdByName: string
}

interface TopItem {
  name: string
  quantity: number
  revenue: number
}

interface InventoryItem {
  id: string
  name?: string
  category?: string
  currentStock?: number
  unit?: string
  [key: string]: any
}

// Unit conversion utilities
const UNIT_CONVERSIONS = {
  // Volume conversions (base unit: ml)
  volume: {
    ml: 1,
    l: 1000,
    litre: 1000,
    liters: 1000,
    cup: 250,
    cups: 250,
    tbsp: 15,
    tablespoon: 15,
    tablespoons: 15,
    tsp: 5,
    teaspoon: 5,
    teaspoons: 5,
    fl_oz: 29.5735,
    fluid_ounce: 29.5735,
    pint: 473.176,
    quart: 946.353,
    gallon: 3785.41
  },
  // Weight conversions (base unit: g)
  weight: {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    lb: 453.592,
    pound: 453.592,
    pounds: 453.592,
    oz: 28.3495,
    ounce: 28.3495,
    ounces: 28.3495
  },
  // Count conversions (base unit: each)
  count: {
    each: 1,
    piece: 1,
    pieces: 1,
    item: 1,
    items: 1,
    unit: 1,
    units: 1,
    pack: 1,
    packs: 1,
    box: 1,
    boxes: 1,
    bottle: 1,
    bottles: 1,
    can: 1,
    cans: 1,
    bag: 1,
    bags: 1
  }
}

// Get unit type (volume, weight, or count)
const getUnitType = (unit: string): 'volume' | 'weight' | 'count' => {
  const lowerUnit = unit.toLowerCase()
  if (UNIT_CONVERSIONS.volume[lowerUnit as keyof typeof UNIT_CONVERSIONS.volume] !== undefined) {
    return 'volume'
  }
  if (UNIT_CONVERSIONS.weight[lowerUnit as keyof typeof UNIT_CONVERSIONS.weight] !== undefined) {
    return 'weight'
  }
  return 'count'
}

// Convert quantity between units
const convertUnits = (quantity: number, fromUnit: string, toUnit: string): number => {
  const fromType = getUnitType(fromUnit)
  const toType = getUnitType(toUnit)

  // Can't convert between different types
  if (fromType !== toType) {
    return quantity // Return original quantity if conversion not possible
  }

  const conversions = UNIT_CONVERSIONS[fromType]
  const fromFactor = conversions[fromUnit.toLowerCase() as keyof typeof conversions] || 1
  const toFactor = conversions[toUnit.toLowerCase() as keyof typeof conversions] || 1

  // Convert to base unit, then to target unit
  const baseQuantity = quantity * fromFactor
  return baseQuantity / toFactor
}

// Get all available units for a category
const getUnitsForCategory = (category: string): string[] => {
  switch (category?.toLowerCase()) {
    case 'beverages':
    case 'liquids':
      return ['ml', 'l', 'litre', 'cup', 'tbsp', 'tsp', 'fl_oz', 'pint', 'quart', 'gallon']
    case 'ingredients':
    case 'spices':
    case 'dry_goods':
      return ['g', 'kg', 'lb', 'oz', 'each', 'pack', 'bag']
    case 'supplies':
    case 'equipment':
      return ['each', 'pack', 'box', 'bottle', 'can', 'bag']
    default:
      return ['each', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle']
  }
}

interface ReportData {
  date: string
  totalOrders: number
  totalSales: number
  averageOrderValue: number
  generatedAt: string
  generatedBy: string
}

interface SalesAnalytics {
  totalOrders: number
  totalSales: number
  generatedAt: string
  generatedBy: string
  dailySales: any[]
  topItems: TopItem[]
}

export default function AdminDashboard() {
  console.log('🔧 AdminDashboard component rendering...')
  const { profile, logout, createStaff } = useAuth()
  console.log('🔧 AdminDashboard received profile:', profile)
  
  // Early return if profile is not loaded yet or is missing required properties
  if (!profile || !profile.role || typeof profile.role !== 'string') {
    console.log('🔄 AdminDashboard: Profile not ready or missing role:', profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-ump-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ump-gray">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }
  
  console.log('✅ AdminDashboard: Profile validation passed, role:', profile.role)
  
  // Role check - only admin and supervisor should access this dashboard
  if (profile && profile.role && !['admin', 'supervisor'].includes(profile.role)) {
    console.warn(`⚠️ User with role '${profile.role}' attempted to access AdminDashboard`)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p>You do not have permission to access the Admin Dashboard.</p>
            <p className="text-sm text-gray-600">
              Your role: <Badge variant="outline">{profile.role || 'Unknown'}</Badge>
            </p>
            <p className="text-sm text-gray-600">
              Required roles: Admin, Supervisor
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Application
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  const [menu, setMenu] = useState<{ [category: string]: MenuItem[] }>({})
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Inventory state for ingredient selection
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedIngredients, setSelectedIngredients] = useState<{
    inventoryId: string
    name: string
    quantity: number
    unit: string
  }[]>([])
  const [selectedExtras, setSelectedExtras] = useState<{
    inventoryId: string
    name: string
    quantity: number
    unit: string
  }[]>([])
  const [ingredientSelectKey, setIngredientSelectKey] = useState(0)
  const [extrasSelectKey, setExtrasSelectKey] = useState(0)

  // Unit conversion state
  const [showUnitConverter, setShowUnitConverter] = useState(false)
  const [convertFrom, setConvertFrom] = useState('')
  const [convertTo, setConvertTo] = useState('')
  const [convertQuantity, setConvertQuantity] = useState('')
  const [convertedResult, setConvertedResult] = useState<number | null>(null)
  
  // Modal states
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    item: MenuItem | null
  }>({ open: false, item: null })

  // User deletion state
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{
    open: boolean
    user: User | null
  }>({ open: false, user: null })
  
  // Form data
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    staffPrice: '',
    guestPrice: '',
    category: '',
    image: '',
    ingredients: '',
    extras: '',
    preparationTime: '15',
    isAvailable: true
  })
  
  // Image upload states
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)

  // Analytics state
  const [analyticsView, setAnalyticsView] = useState<'overview' | 'charts' | 'items' | 'reports'>('overview')
  const [revenueAnalytics, setRevenueAnalytics] = useState({
    daily: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
    weekly: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
    monthly: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
    yearly: { revenue: 0, orders: 0, growth: 0, comparison: 0 }
  })

  // User Management state
  const [users, setUsers] = useState<User[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddUser, setShowAddUser] = useState(false)
  const [showShiftManagement, setShowShiftManagement] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'cashier',
    phone: '',
    staffNo: ''
  })
  
  // Password reset state
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  
  // Shift creation form state
  const [shiftForm, setShiftForm] = useState({
    staffId: '',
    shiftType: ''
  })
  
  // Reports state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportDateRange, setReportDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null)

  // Stock Issues state
  const [stockIssues, setStockIssues] = useState<any[]>([])

  // Logo state
  const [currentLogo, setCurrentLogo] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const loadMenu = async () => {
    try {
      console.log('📋 Loading menu data...')
      const data = await api.request('/menu')
      console.log('📋 Raw menu data received:', data)

      // Ensure menu is an object, not undefined
      const menuData = data.menu || {}
      console.log('📋 Processed menu data:', {
        categories: Object.keys(menuData),
        totalItems: Object.values(menuData).flat().length,
        menuStructure: menuData
      })

      setMenu(menuData)
      console.log('✅ Menu state updated successfully')
    } catch (error) {
      console.error('Failed to load menu:', error)
      setError('Failed to load menu: ' + (error instanceof Error ? error.message : 'Unknown error'))
      // Set empty menu on error to prevent UI issues
      setMenu({})
    }
  }

  const loadOrders = async () => {
    try {
      const orders = await getAllOrdersFromFirebase()
      setOrders(orders || [])
    } catch (error: any) {
      console.error('Failed to load orders:', error)
      setOrders([]) // Ensure orders is always an array
    }
  }

  const loadInventoryItems = async () => {
    try {
      console.log("📦 AdminDashboard: Loading inventory items from Firestore...")

      // Get all docs from the "inventory" collection
      const querySnapshot = await getDocs(collection(db, "inventory"))
      if (querySnapshot.empty) {
        console.warn("⚠️ AdminDashboard: No inventory items found in Firestore.")
        console.log("💡 Tip: Use Stores Dashboard to create inventory items.")
        setInventoryItems([])
        return
      }

      // Map Firestore docs to array
      const items: InventoryItem[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem))

      console.log(`✅ AdminDashboard: Loaded ${items.length} inventory items.`)

      // Save items in state
      setInventoryItems(items)

      // Log category breakdown
      const ingredients = items.filter((i) => i?.category === "ingredients")
      const supplies = items.filter((i) => i?.category === "supplies")
      const beverages = items.filter((i) => i?.category === "beverages")

      console.log("📦 AdminDashboard: Inventory breakdown:")
      console.log(`   • ${ingredients.length} ingredients`)
      console.log(`   • ${supplies.length} supplies`)
      console.log(`   • ${beverages.length} beverages`)

      if (items.length > 0) {
        console.log(
          "📋 Sample items:",
          items.slice(0, 3).map((i) => `${i?.name || "Unnamed"} (${i?.category || "unknown"})`)
        )
      }
    } catch (error) {
      console.error("❌ AdminDashboard: Failed to load inventory from Firestore.")
      if (error instanceof Error) {
        console.error("Error details:", error.message)
      }
      setInventoryItems([])
    }
  }

  useEffect(() => {
    const loadData = async () => {
      // Load core data first
      await Promise.all([loadMenu(), loadOrders(), loadUsers(), loadShifts()])
      setLoading(false)

      // Load inventory items separately (non-blocking)
      loadInventoryItems()

      // Load stock issues
      loadStockIssues()

      // Load current logo
      loadCurrentLogo()
    }
    loadData()
  }, [])

  // Auto-refresh orders every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  const resetForm = () => {
    setItemForm({
      name: '',
      description: '',
      staffPrice: '',
      guestPrice: '',
      category: '',
      image: '',
      ingredients: '',
      extras: '',
      preparationTime: '15',
      isAvailable: true
    })
    setSelectedIngredients([])
    setSelectedExtras([])
    setEditingItem(null)
    setSelectedImage(null)
    setImagePreview('')
    setIngredientSelectKey(prev => prev + 1)
    setExtrasSelectKey(prev => prev + 1)
  }
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 51200 * 51200) { // 5MB limit
        setError('Image size should be less than 5MB')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file')
        return
      }
      
      setSelectedImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview('')
    setItemForm({ ...itemForm, image: '' })
  }

  const addIngredient = (inventoryId: string, name: string, unit: string) => {
    try {
      if (!inventoryId || inventoryId === '' || inventoryId === 'no-items') return

      // Check if ingredient already added
      if (selectedIngredients.find(ing => ing.inventoryId === inventoryId)) {
        setError('Ingredient already added')
        setTimeout(() => setError(''), 3000)
        return
      }

      const newIngredient = {
        inventoryId,
        name: name || 'Unknown Item',
        quantity: 1,
        unit: unit || 'each'
      }

      setSelectedIngredients(prev => [...prev, newIngredient])
    } catch (error) {
      console.warn('Error adding ingredient:', error)
    }
  }

  const addExtra = (inventoryId: string, name: string, unit: string) => {
    try {
      if (!inventoryId || inventoryId === '' || inventoryId === 'no-items') return

      // Check if extra already added
      if (selectedExtras.find(extra => extra.inventoryId === inventoryId)) {
        setError('Extra already added')
        setTimeout(() => setError(''), 3000)
        return
      }

      const newExtra = {
        inventoryId,
        name: name || 'Unknown Item',
        quantity: 1,
        unit: unit || 'each'
      }

      setSelectedExtras(prev => [...prev, newExtra])
    } catch (error) {
      console.warn('Error adding extra:', error)
    }
  }

  const updateIngredientQuantity = (inventoryId: string, quantity: number) => {
    if (quantity <= 0) {
      removeIngredient(inventoryId)
      return
    }

    setSelectedIngredients(prev =>
      prev.map(ing =>
        ing.inventoryId === inventoryId
          ? { ...ing, quantity }
          : ing
      )
    )
  }

  const updateExtraQuantity = (inventoryId: string, quantity: number) => {
    if (quantity <= 0) {
      removeExtra(inventoryId)
      return
    }

    setSelectedExtras(prev =>
      prev.map(extra =>
        extra.inventoryId === inventoryId
          ? { ...extra, quantity }
          : extra
      )
    )
  }

  const removeIngredient = (inventoryId: string) => {
    setSelectedIngredients(prev => (prev || []).filter(ing => ing.inventoryId !== inventoryId))
  }

  const removeExtra = (inventoryId: string) => {
    setSelectedExtras(prev => (prev || []).filter(extra => extra.inventoryId !== inventoryId))
  }
  
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

 const handleAddItem = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  setSuccess('')
  setUploadingImage(true)

  try {
    console.log('🍽️ Starting menu item creation process...')
    console.log('📝 Form data:', {
      name: itemForm.name,
      staffPrice: itemForm.staffPrice,
      guestPrice: itemForm.guestPrice,
      category: itemForm.category,
      preparationTime: itemForm.preparationTime,
      isAvailable: itemForm.isAvailable
    })

    // ✅ Enhanced validation
    if (!itemForm.name?.trim()) throw new Error('Item name is required')
    if (!itemForm.staffPrice || parseFloat(itemForm.staffPrice) <= 0)
      throw new Error('Valid staff price is required (must be greater than 0)')
    if (!itemForm.guestPrice || parseFloat(itemForm.guestPrice) <= 0)
      throw new Error('Valid guest price is required (must be greater than 0)')
    if (!itemForm.category?.trim()) throw new Error('Category is required')
    if (!itemForm.preparationTime || parseInt(itemForm.preparationTime) <= 0)
      throw new Error('Valid preparation time is required (must be greater than 0)')

    let imageUrl = itemForm.image || ''

    // ✅ Convert uploaded image to base64
    if (selectedImage) {
      console.log('🖼️ Converting uploaded image to base64...')
      try {
        imageUrl = await convertImageToBase64(selectedImage)
        console.log('✅ Image converted successfully')
      } catch (imageError) {
        console.error('Image conversion failed:', imageError)
        throw new Error('Failed to process image. Please try a different image.')
      }
    }

    const itemData = {
      name: itemForm.name.trim(),
      description: itemForm.description?.trim() || '',
      price: parseFloat(itemForm.guestPrice), // Default price for backward compatibility
      staffPrice: parseFloat(itemForm.staffPrice),
      guestPrice: parseFloat(itemForm.guestPrice),
      category: itemForm.category.trim().toLowerCase(),
      image: imageUrl,
      ingredients: selectedIngredients.map(ing => ing.name),
      extras: selectedExtras.map(extra => extra.name),
      preparationTime: parseInt(itemForm.preparationTime),
      isAvailable: itemForm.isAvailable
    }

    console.log('📤 Sending menu item data to server:', {
      name: itemData.name,
      staffPrice: itemData.staffPrice,
      guestPrice: itemData.guestPrice,
      category: itemData.category,
      preparationTime: itemData.preparationTime,
      hasImage: !!itemData.image,
      ingredientCount: itemData.ingredients.length
    })

    const response = await api.request('/menu', {
      method: 'POST',
      body: JSON.stringify(itemData)
    })

    console.log('✅ Menu item created successfully:', response.menuItem?.id)

    // ✅ Save recipe in background
    if (selectedIngredients.length > 0) {
      console.log(`🧾 Saving recipe with ${selectedIngredients.length} ingredients...`)

      api
        .request('/pos/recipe', {
          method: 'POST',
          body: JSON.stringify({
            menuItemId: response.menuItem.id,
            ingredients: selectedIngredients
          })
        })
        .then(() => {
          console.log('✅ Recipe saved successfully')
        })
        .catch((recipeError: unknown) => {
          const message =
            recipeError instanceof Error
              ? recipeError.message
              : 'Unknown recipe error'
          console.warn(
            '⚠️ Recipe save failed, but menu item was created successfully:',
            message
          )
          setTimeout(() => {
            setError(
              'Menu item created but recipe save failed. You can edit the item to add ingredients.'
            )
          }, 2000)
        })
    }

    setSuccess('Menu item added successfully!')

    // ✅ Reset form and reload data
    setShowAddItem(false)
    resetForm()
    console.log('🔄 Reloading menu data...')
    api.clearCache()
    await loadMenu()
    console.log('✅ Menu data reloaded')

    setTimeout(() => setSuccess(''), 3000)
  } catch (error: unknown) {
    console.error('❌ Failed to add menu item:', error)

    let errorMessage = 'Failed to add menu item'

    if (error instanceof Error) {
      if (
        error.message.includes('permission') ||
        error.message.includes('access') ||
        error.message.includes('Admin') ||
        error.message.includes('Supervisor')
      ) {
        errorMessage =
          'You do not have permission to add menu items. Only Admin and Supervisor roles can add menu items.'
      } else if (
        error.message.includes('network') ||
        error.message.includes('fetch')
      ) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.'
      } else if (
        error.message.includes('validation') ||
        error.message.includes('required')
      ) {
        errorMessage = error.message
      } else {
        errorMessage = `Error: ${error.message}`
      }
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    setError(errorMessage)
    setTimeout(() => setError(''), 10000)
  } finally {
    setUploadingImage(false)
  }
}


  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setError('')
    setSuccess('')
    setUploadingImage(true)

    try {
      let imageUrl = itemForm.image

      // Convert uploaded image to base64 if present
      if (selectedImage) {
        imageUrl = await convertImageToBase64(selectedImage)
      }

      const itemData = {
        ...itemForm,
        image: imageUrl,
        price: parseFloat(itemForm.guestPrice), // Default price for backward compatibility
        staffPrice: parseFloat(itemForm.staffPrice),
        guestPrice: parseFloat(itemForm.guestPrice),
        preparationTime: parseInt(itemForm.preparationTime),
        ingredients: selectedIngredients.map(ing => ing.name),
        extras: selectedExtras.map(extra => extra.name)
      }

      await api.request(`/menu/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(itemData)
      })

      // Update recipe if ingredients are selected (non-blocking)
      if (selectedIngredients.length > 0) {
        // Save recipe in background, don't wait for it
        api.request('/pos/recipe', {
          method: 'POST',
          body: JSON.stringify({
            menuItemId: editingItem.id,
            ingredients: selectedIngredients
          })
        }).catch(recipeError => {
          console.warn('Recipe update failed, but menu item was updated successfully:', recipeError.message)
        })
      }

      setSuccess('Menu item updated successfully')
      setEditingItem(null)
      resetForm()
      await loadMenu()
    } catch (error) {
      console.error('Failed to update menu item:', error)
      setError('Failed to update menu item')
    } finally {
      setUploadingImage(false)
    }
  }

  const startEdit = (item: MenuItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      description: item.description,
      staffPrice: item.staffPrice.toString(),
      guestPrice: item.guestPrice.toString(),
      category: item.category,
      image: item.image,
      ingredients: item.ingredients.join(', '),
      extras: item.extras?.join(', ') || '',
      preparationTime: item.preparationTime.toString(),
      isAvailable: item.isAvailable
    })
    // Set current image as preview for editing
    if (item.image) {
      setImagePreview(item.image)
    }
    setSelectedImage(null)

    // Load existing recipe asynchronously
    loadRecipeForItem(item.id)

    // Load existing extras into IngredientsPicker
    if (item.extras && item.extras.length > 0) {
      const extrasFromInventory = inventoryItems
        .filter(inv => item.extras?.includes(inv.name || ''))
        .map(inv => ({
          inventoryId: inv.id,
          name: inv.name || '',
          quantity: 1,
          unit: inv.unit || 'unit'
        }))
      setSelectedExtras(extrasFromInventory)
    } else {
      setSelectedExtras([])
    }
  }

  const loadRecipeForItem = async (itemId: string) => {
  try {
    // Add timeout for recipe loading
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    const recipeData = await api.request(`/pos/recipe/${itemId}`)
    clearTimeout(timeoutId)

    if (recipeData.recipe && recipeData.recipe.ingredients) {
      setSelectedIngredients(recipeData.recipe.ingredients)
    } else {
      setSelectedIngredients([])
    }
  } catch (error: unknown) {
    let message = 'Unknown error'
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }

    console.warn(`Failed to load recipe for item ${itemId}:`, message)
    setSelectedIngredients([])
  }
}


  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeleteConfirm({ open: false, item: null })
      await api.request(`/menu/${itemId}`, {
        method: 'DELETE'
      })

      setSuccess('Menu item deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
      await loadMenu()
    } catch (error) {
      console.error('Failed to delete menu item:', error)
      setError('Failed to delete menu item')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      setDeleteUserConfirm({ open: false, user: null })
      await api.request(`/users/${userId}`, {
        method: 'DELETE'
      })

      setSuccess('User deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
      await loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      setError('Failed to delete user')
    }
  }

  const confirmDelete = (item: MenuItem) => {
    setDeleteConfirm({ open: true, item })
  }

  const confirmDeleteUser = (user: User) => {
    setDeleteUserConfirm({ open: true, user })
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.request(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })
      
      await loadOrders()
      setSuccess(`Order status updated to ${newStatus}`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to update order status:', error)
      setError('Failed to update order status')
    }
  }

  // User Management Functions
  const loadUsers = async () => {
    try {
      const data = await api.request('/users')
      setUsers(data.users || [])
    } catch (error: any) {
      console.error('Failed to load users:', error)
      setError('Failed to load users')
      setUsers([]) // Ensure users is always an array
    }
  }

  const loadShifts = async () => {
    try {
      const data = await api.request('/shifts')
      setShifts(data.shifts || [])
    } catch (error: any) {
      console.error('Failed to load shifts:', error)
      setShifts([]) // Ensure shifts is always an array
    }
  }

  const resetUserForm = () => {
    setUserForm({
      email: '',
      password: '',
      name: '',
      role: 'cashier',
      phone: '',
      staffNo: ''
    })
    setEditingUser(null)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const result = await createStaff(
        userForm.email,
        userForm.password,
        userForm.name,
        userForm.role,
        userForm.phone,
        userForm.staffNo
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to create staff member')
      }

      setSuccess(`Staff member ${userForm.name} added successfully! They can now login with their email and password.`)
      setTimeout(() => setSuccess(''), 5000)
      setShowAddUser(false)
      resetUserForm()
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to add staff member:', error)
      setError(error.message || 'Failed to add staff member')
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError('')
    setSuccess('')

    try {
      await api.request(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(userForm)
      })

      setSuccess('Staff member updated successfully')
      setEditingUser(null)
      resetUserForm()
      await loadUsers()
    } catch (error) {
      console.error('Failed to update staff member:', error)
      setError('Failed to update staff member')
    }
  }

  const startEditUser = (user: User) => {
    setEditingUser(user)
    setUserForm({
      email: user.email,
      password: '', // Don't populate password
      name: user.name,
      role: user.role,
      phone: user.phone,
      staffNo: user.staffNo || ''
    })
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await api.request(`/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive })
      })

      setSuccess(`Staff member ${isActive ? 'activated' : 'deactivated'} successfully`)
      setTimeout(() => setSuccess(''), 3000)
      await loadUsers()
    } catch (error) {
      console.error('Failed to update user status:', error)
      setError('Failed to update user status')
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordResetUser || !newPassword) return

    setError('')
    setSuccess('')

    try {
      await api.request(`/users/${passwordResetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      })

      setSuccess('Password reset successfully')
      setPasswordResetUser(null)
      setNewPassword('')
    } catch (error) {
      console.error('Failed to reset password:', error)
      setError('Failed to reset password')
    }
  }

  const createShift = async (userId: string, shiftType: string) => {
    try {
      setError('')
      setSuccess('')
      
      // Calculate expected end time based on shift type
      const startTime = new Date()
      let expectedEndTime = null
      
      if (shiftType === 'morning') {
        expectedEndTime = new Date()
        expectedEndTime.setHours(15, 0, 0, 0) // 3 PM
      } else if (shiftType === 'evening') {
        expectedEndTime = new Date()
        expectedEndTime.setHours(23, 0, 0, 0) // 11 PM
      } else if (shiftType === 'full-day') {
        expectedEndTime = new Date()
        expectedEndTime.setHours(23, 0, 0, 0) // 11 PM
      }

      await api.request('/shifts', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          shiftType,
          startTime: startTime.toISOString(),
          expectedEndTime: expectedEndTime?.toISOString()
        })
      })

      setSuccess('Shift started successfully')
      setTimeout(() => setSuccess(''), 3000)
      setShiftForm({ staffId: '', shiftType: '' }) // Reset form
      await loadShifts()
    } catch (error) {
      console.error('Failed to create shift:', error)
      setError('Failed to create shift')
      setTimeout(() => setError(''), 5000)
    }
  }

  const endShift = async (shiftId: string) => {
    try {
      setError('')
      setSuccess('')
      
      await api.request(`/shifts/${shiftId}/end`, {
        method: 'PUT',
        body: JSON.stringify({ endTime: new Date().toISOString() })
      })

      setSuccess('Shift ended successfully')
      setTimeout(() => setSuccess(''), 3000)
      await loadShifts()
    } catch (error) {
      console.error('Failed to end shift:', error)
      setError('Failed to end shift')
      setTimeout(() => setError(''), 5000)
    }
  }

  // Filter users based on search and filters
  const filteredUsers = (users || []).filter(user => {
    const matchesSearch = (user.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         (user.email || '').toLowerCase().includes(userSearchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive)
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const getUserStats = () => {
    const safeUsers = users || []
    const safeShifts = shifts || []
    
    const totalUsers = safeUsers.length || 0
    const activeUsers = safeUsers.filter(u => u.isActive).length || 0
    const roleCount = safeUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const activeShifts = safeShifts.filter(s => s.status === 'active').length || 0
    
    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      roleCount,
      activeShifts
    }
  }

  // Report Generation Functions
  const generateDailyReport = async (startDate: string, endDate: string) => {
    try {
      setGeneratingReport(true)
      setError('')

      console.log(`📈 Generating daily report for ${startDate}`)

      const allOrders = await getAllOrdersFromFirebase()
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate).toISOString().split('T')[0]
        return orderDate === startDate
      })

      const totalOrders = filteredOrders.length
      const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0)
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

      const reportData = {
        date: startDate,
        startDate,
        endDate: startDate,
        totalOrders,
        totalSales,
        averageOrderValue,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.name || 'System'
      }

      setReportData(reportData)
      setSuccess('Daily report generated successfully!')
      setTimeout(() => setSuccess(''), 3000)

      return reportData
    } catch (error: unknown) {
      let message = 'An unknown error occurred while generating the daily report.'
      if (error instanceof Error) {
        message = error.message
      } else if (typeof error === 'string') {
        message = error
      }

      console.error('Failed to generate daily report:', message)
      setError('Failed to generate daily report: ' + message)
      setTimeout(() => setError(''), 5000)
      throw error
    } finally {
      setGeneratingReport(false)
    }
  }

  const generateAnalyticsReport = async (startDate: string, endDate: string) => {
    try {
      setGeneratingReport(true)
      setError('')

      console.log(`📈 Generating analytics report from ${startDate} to ${endDate}`)

      const allOrders = await getAllOrdersFromFirebase()
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate).toISOString().split('T')[0]
        return orderDate >= startDate && orderDate <= endDate
      })

      const totalOrders = filteredOrders.length
      const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0)

      // Group orders by date for daily breakdown
      const dailySales = []
      const start = new Date(startDate)
      const end = new Date(endDate)

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const dayOrders = filteredOrders.filter(order =>
          new Date(order.orderDate).toISOString().split('T')[0] === dateStr
        )
        const daySales = dayOrders.reduce((sum, order) => sum + order.totalAmount, 0)

        dailySales.push({
          date: dateStr,
          orders: dayOrders.length,
          sales: daySales
        })
      }

      // Calculate top items
      const itemSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {}
      filteredOrders.forEach(order => {
        order.items.forEach(item => {
          const itemName = item.name
          if (!itemSales[itemName]) {
            itemSales[itemName] = { name: itemName, quantity: 0, revenue: 0 }
          }
          itemSales[itemName].quantity += item.quantity
          itemSales[itemName].revenue += item.price * item.quantity
        })
      })

      const topItems = Object.values(itemSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const analyticsData = {
        totalOrders,
        totalSales,
        generatedAt: new Date().toISOString(),
        generatedBy: profile?.name || 'System',
        dailySales,
        topItems
      }

      setSalesAnalytics(analyticsData)
      setSuccess('Analytics report generated successfully!')
      setTimeout(() => setSuccess(''), 3000)

      return analyticsData
    } catch (error) {
      console.error('Failed to generate analytics report:', error)
      setError('Failed to generate analytics report: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setTimeout(() => setError(''), 5000)
      throw error
    } finally {
      setGeneratingReport(false)
    }
  }

  const downloadReportAsPDF = async (reportData: any, reportType: 'daily' | 'analytics') => {
    try {
      console.log(`📄 Generating ${reportType} report PDF...`)

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      // Header section
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('EGUMENI EATS', 105, 20, { align: 'center' })

      doc.setFontSize(12)
      doc.text('University of Mpumalanga - ', 105, 27, { align: 'center' })
      doc.text(`${reportType.toUpperCase()} REPORT`, 105, 35, { align: 'center' })

      // Metadata
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated by: ${profile?.name || 'System'}`, 14, 45)
      doc.text(`Date: ${new Date().toLocaleString()}`, 14, 51)
      if (reportData.startDate) {
        doc.text(`Period: ${reportData.startDate} → ${reportData.endDate}`, 14, 57)
      }

      // Divider line
      doc.setDrawColor(150)
      doc.line(10, 60, 200, 60)

      // Report summary
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, 68)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)

      if (reportType === 'daily') {
        doc.text(`Total Orders: ${reportData.totalOrders}`, 14, 76)
        doc.text(`Total Sales: R${reportData.totalSales?.toFixed(2) || '0.00'}`, 14, 82)
        doc.text(`Average Order Value: R${reportData.averageOrderValue?.toFixed(2) || '0.00'}`, 14, 88)
      } else if (reportType === 'analytics') {
        doc.text(`Total Orders: ${reportData.totalOrders}`, 14, 76)
        doc.text(`Total Sales: R${reportData.totalSales?.toFixed(2) || '0.00'}`, 14, 82)
        doc.text(`Daily Average: R${reportData.dailyAverage?.toFixed(2) || '0.00'}`, 14, 88)
      }

      // Add daily breakdown table for analytics
      if (reportType === 'analytics' && reportData.dailySales?.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Daily Breakdown', 14, 100)
        doc.setFont('helvetica', 'normal')

        const dailyTable = reportData.dailySales.map((day: any) => [
          day.date,
          day.orders.toString(),
          `R${day.sales.toFixed(2)}`
        ])

        autoTable(doc, {
          startY: 104,
          head: [['Date', 'Orders', 'Sales']],
          body: dailyTable,
          theme: 'grid',
          headStyles: { fillColor: [66, 139, 202] },
          styles: { fontSize: 10, cellPadding: 3 }
        })
      }

      // Add top items table
      if (reportData.topItems?.length > 0) {
        const y = (doc as any).lastAutoTable?.finalY || 120
        doc.setFont('helvetica', 'bold')
        doc.text('Top Selling Items', 14, y + 10)
        doc.setFont('helvetica', 'normal')

        const topItemsTable = reportData.topItems.map((item: any, index: number) => [
          index + 1,
          item.name,
          item.quantity,
          `R${item.revenue.toFixed(2)}`
        ])

        autoTable(doc, {
          startY: y + 14,
          head: [['#', 'Item', 'Qty Sold', 'Revenue']],
          body: topItemsTable,
          theme: 'grid',
          headStyles: { fillColor: [46, 204, 113] },
          styles: { fontSize: 10, cellPadding: 3 }
        })
      }

      // Footer
      const finalY = (doc as any).lastAutoTable?.finalY || 270
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text(
        'Generated by Egumeni Eats Management System - University of Mpumalanga',
        105,
        finalY + 10,
        { align: 'center' }
      )

      // Save the PDF
      const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)

      setSuccess(`✅ ${reportType.toUpperCase()} PDF report downloaded!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('❌ Failed to generate PDF:', error)
      setError('Failed to generate PDF report: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }



  const getOrderStats = () => {
    const safeOrders = orders || []
    const today = new Date().toDateString()
    const todayOrders = safeOrders.filter(order =>
      new Date(order.orderDate).toDateString() === today
    )

    const totalRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    const pendingOrders = safeOrders.filter(order => order.status === 'pending').length
    const preparingOrders = safeOrders.filter(order => order.status === 'preparing').length

    return {
      todayOrders: todayOrders.length,
      totalRevenue,
      pendingOrders,
      preparingOrders
    }
  }

  // Enhanced analytics functions for comprehensive revenue tracking
  const getRevenueAnalytics = async (): Promise<{
    daily: { revenue: number; orders: number; growth: number; comparison: number };
    weekly: { revenue: number; orders: number; growth: number; comparison: number };
    monthly: { revenue: number; orders: number; growth: number; comparison: number };
    yearly: { revenue: number; orders: number; growth: number; comparison: number };
  }> => {
    try {
      const now = new Date()
      const safeOrders = await getAllOrdersFromFirebase()

      // Daily Revenue (Today)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dailyOrders = safeOrders.filter((order: any) =>
        new Date(order.orderDate) >= startOfToday
      )
      const dailyRevenue = dailyOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      // Weekly Revenue (Last 7 days)
      const startOfWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      const weeklyOrders = safeOrders.filter((order: any) =>
        new Date(order.orderDate) >= startOfWeek
      )
      const weeklyRevenue = weeklyOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      // Monthly Revenue (This month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyOrders = safeOrders.filter((order: any) =>
        new Date(order.orderDate) >= startOfMonth
      )
      const monthlyRevenue = monthlyOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      // Yearly Revenue (This year)
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      const yearlyOrders = safeOrders.filter((order: any) =>
        new Date(order.orderDate) >= startOfYear
      )
      const yearlyRevenue = yearlyOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      // Previous periods for comparison
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterdayOrders = safeOrders.filter((order: any) => {
        const orderDate = new Date(order.orderDate)
        return orderDate >= startOfYesterday && orderDate < endOfYesterday
      })
      const yesterdayRevenue = yesterdayOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      const startOfLastWeek = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000))
      const endOfLastWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      const lastWeekOrders = safeOrders.filter((order: any) => {
        const orderDate = new Date(order.orderDate)
        return orderDate >= startOfLastWeek && orderDate < endOfLastWeek
      })
      const lastWeekRevenue = lastWeekOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthOrders = safeOrders.filter((order: any) => {
        const orderDate = new Date(order.orderDate)
        return orderDate >= startOfLastMonth && orderDate < endOfLastMonth
      })
      const lastMonthRevenue = lastMonthOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || order.total_amount || 0), 0)

      // Calculate growth percentages
      const dailyGrowth = yesterdayRevenue > 0 ? ((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0
      const weeklyGrowth = lastWeekRevenue > 0 ? ((weeklyRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0
      const monthlyGrowth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

      return {
        daily: {
          revenue: dailyRevenue,
          orders: dailyOrders.length,
          growth: dailyGrowth,
          comparison: yesterdayRevenue
        },
        weekly: {
          revenue: weeklyRevenue,
          orders: weeklyOrders.length,
          growth: weeklyGrowth,
          comparison: lastWeekRevenue
        },
        monthly: {
          revenue: monthlyRevenue,
          orders: monthlyOrders.length,
          growth: monthlyGrowth,
          comparison: lastMonthRevenue
        },
        yearly: {
          revenue: yearlyRevenue,
          orders: yearlyOrders.length,
          growth: 0, // Can't calculate yearly growth without previous year data
          comparison: 0
        }
      }
    } catch (error) {
      console.error('Failed to fetch revenue analytics from Firebase:', error)
      // Return default values on error
      return {
        daily: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
        weekly: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
        monthly: { revenue: 0, orders: 0, growth: 0, comparison: 0 },
        yearly: { revenue: 0, orders: 0, growth: 0, comparison: 0 }
      }
    }
  }

  // Chart data for revenue trends
  const getRevenueChartData = async (): Promise<Array<{ date: string; revenue: number; orders: number }>> => {
    try {
      const safeOrders = await getAllOrdersFromFirebase()
      const last7Days: Array<{ date: string; revenue: number; orders: number }> = []
      const now = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

        const dayOrders = safeOrders.filter((order) => {
          const orderDate = new Date(order.orderDate)
          return orderDate >= startOfDay && orderDate < endOfDay
        })

        const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)

        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          revenue: dayRevenue,
          orders: dayOrders.length
        })
      }

      return last7Days
    } catch (error) {
      console.error('Failed to fetch chart data from Firebase:', error)
      return []
    }
  }

interface ItemSales {
  [key: string]: {
    name: string
    quantity: number
    revenue: number
  }
}

const getTopPerformingItems = () => {
  const safeOrders = orders || []
  const itemSales: ItemSales = {}  // <-- add type here

  safeOrders.forEach(order => {
    (order.items || []).forEach(item => {
      const itemName = item?.name || 'Unknown Item'
      if (!itemSales[itemName]) {
        itemSales[itemName] = {
          name: itemName,
          quantity: 0,
          revenue: 0
        }
      }
      itemSales[itemName].quantity += (item?.quantity || 0)
      itemSales[itemName].revenue += ((item?.price || 0) * (item?.quantity || 0))
    })
  })

  return Object.values(itemSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

  const getAllMenuItems = () => {
    const safeMenu = menu || {}
    return Object.values(safeMenu).flat()
  }

  const getMenuStats = () => {
    const safeMenu = menu || {}
    const allItems = getAllMenuItems()
    return {
      totalItems: allItems.length,
      availableItems: allItems.filter(item => item?.isAvailable).length,
      categories: Object.keys(safeMenu).length
    }
  }

  // Stock Issues Functions
  const loadStockIssues = async () => {
    try {
      console.log('🔍 Loading stock issues...')
      const data = await inventoryOperations.getStockIssues()
      setStockIssues(data || [])
      console.log('✅ Stock issues loaded:', data?.length || 0)
    } catch (error) {
      console.error('Failed to load stock issues:', error)
      setStockIssues([])
    }
  }

  const updateIssueStatus = async (issueId: string, status: string, notes?: string) => {
    try {
      await inventoryOperations.updateStockIssueStatus(issueId, status, profile?.id || '', profile?.name || '', notes)
      await loadStockIssues() // Refresh the list
      setSuccess(`Issue ${status === 'resolved' ? 'resolved' : 'updated'} successfully`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to update issue status:', error)
      setError('Failed to update issue status')
      setTimeout(() => setError(''), 5000)
    }
  }

  // Logo functions
  const loadCurrentLogo = async () => {
    try {
      const response = await api.request('/logo')
      setCurrentLogo(response.logoUrl || '')
    } catch (error) {
      console.error('Failed to load current logo:', error)
      setCurrentLogo('')
    }
  }

  const handleLogoUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logoFile) return

    setError('')
    setSuccess('')
    setUploadingLogo(true)

    try {
      // Convert file to base64 for API
      const base64 = await convertImageToBase64(logoFile)

      const response = await api.request('/logo/upload', {
        method: 'POST',
        body: JSON.stringify({
          base64,
          filename: logoFile.name
        })
      })

      setSuccess('Logo uploaded successfully!')
      setCurrentLogo(response.logoUrl)
      setLogoFile(null)
      setLogoPreview('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to upload logo:', error)
      setError('Failed to upload logo')
      setTimeout(() => setError(''), 5000)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('Logo file size should be less than 2MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file')
        return
      }

      setLogoFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogoPreview = () => {
    setLogoFile(null)
    setLogoPreview('')
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800' },
      ready: { label: 'Ready', color: 'bg-blue-900 text-white' },
      out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800' },
      delivered: { label: 'Delivered', color: 'bg-gray-100 text-gray-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return <Badge className={config.color}>{config.label}</Badge>
  }

  const stats = getOrderStats()
  const menuStats = getMenuStats()
  const topItems = getTopPerformingItems()

  // Chart data state
  const [chartData, setChartData] = useState<any[]>([])

  // Load revenue analytics and chart data on component mount and when orders change
  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        const [analytics, chart] = await Promise.all([
          getRevenueAnalytics(),
          getRevenueChartData()
        ])
        setRevenueAnalytics(analytics)
        setChartData(chart)
      } catch (error) {
        console.error('Failed to load analytics data:', error)
      }
    }
    loadAnalyticsData()
  }, [orders])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
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
                src={currentLogo || defaultLogo}
                alt="Egumeni Eats"
                className="w-10 h-10 object-contain mr-3"
              />
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadMenu(); loadOrders(); loadUsers(); loadShifts(); }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <span className="text-sm text-gray-600">Welcome, {profile?.name}</span>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-ump-gray-800">Today's Orders</CardTitle>
              <div className="p-2 rounded-modern bg-ump-blue/10">
                <ShoppingBag className="h-4 w-4 text-ump-blue" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-ump-blue">{stats.todayOrders}</div>
              <p className="text-xs text-ump-gray-600 mt-1">Orders processed today</p>
            </CardContent>
          </Card>

          <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-ump-gray-800">Today's Revenue</CardTitle>
              <div className="p-2 rounded-modern bg-ump-green/10">
                <DollarSign className="h-4 w-4 text-ump-green" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-ump-green">R{stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-ump-gray-600 mt-1">Revenue generated</p>
            </CardContent>
          </Card>

          <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-ump-gray-800">Pending Orders</CardTitle>
              <div className="p-2 rounded-modern bg-ump-orange/10">
                <Clock className="h-4 w-4 text-ump-orange" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-ump-orange">{stats.pendingOrders}</div>
              <p className="text-xs text-ump-gray-600 mt-1">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card className="glass-effect shadow-modern rounded-modern-lg interactive-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-ump-gray-800">Menu Items</CardTitle>
              <div className="p-2 rounded-modern bg-ump-purple/10">
                <Package className="h-4 w-4 text-ump-purple" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-ump-purple">{menuStats.totalItems}</div>
              <p className="text-xs text-ump-gray-600 mt-1">
                {menuStats.availableItems} available
              </p>
            </CardContent>
          </Card>
        </div>



        <Tabs defaultValue="orders" className="w-full">
          <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-modern-lg shadow-modern">
            <TabsList className="flex w-full h-auto p-0 bg-transparent">
              <TabsTrigger value="orders" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-blue data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Orders</span>
                <span className="sm:hidden">Orders</span>
              </TabsTrigger>
              <TabsTrigger value="menu" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-green data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Menu</span>
                <span className="sm:hidden">Menu</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-purple data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Users</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-orange data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="issues" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-red data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Stock Issues</span>
                <span className="sm:hidden">Issues</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-gray data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Reports</span>
                <span className="sm:hidden">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex-1 min-w-0 rounded-modern data-[state=active]:bg-ump-navy data-[state=active]:text-white transition-premium text-xs sm:text-sm px-2 py-2">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">System</span>
                <span className="sm:hidden">System</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="orders" className="mt-6">
            <Card className="glass-effect shadow-modern rounded-modern-lg">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-modern bg-ump-blue/10">
                    <ShoppingBag className="w-6 h-6 text-ump-blue" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-ump-gray-800">Recent Orders</CardTitle>
                    <CardDescription className="text-ump-gray-600">Manage customer orders and status updates</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="animate-bounce-in">
                      <ShoppingBag className="w-16 h-16 text-ump-blue/40 mx-auto mb-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-ump-gray-800 mb-2">No Orders Yet</h3>
                    <p className="text-ump-gray-600">Orders will appear here when customers place them</p>
                    <p className="text-sm text-ump-gray-500 mt-2">📦 Ready to serve your first order!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).map(order => (
                      <Card key={order.id} className="glass-effect shadow-modern rounded-modern-lg interactive-card animate-scale-in">
                        <CardHeader className="pb-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-modern bg-ump-blue/10">
                                  <span className="text-sm font-bold text-ump-blue">#{order.id.slice(-8)}</span>
                                </div>
                                <span className="text-ump-gray-800">Order Details</span>
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 text-ump-gray-600">
                                <span className="font-medium">{order.customerName || 'Guest'}</span>
                                <span>•</span>
                                <span>{new Date(order.orderDate).toLocaleString()}</span>
                              </CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                              {getStatusBadge(order.status)}
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatus(order.id, value)}
                              >
                                <SelectTrigger className="w-full sm:w-36 rounded-modern border-ump-gray-200 focus:border-ump-blue">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">⏳ Pending</SelectItem>
                                  <SelectItem value="preparing">👨‍🍳 Preparing</SelectItem>
                                  <SelectItem value="ready">✅ Ready</SelectItem>
                                  <SelectItem value="out_for_delivery">🚚 Out for Delivery</SelectItem>
                                  <SelectItem value="delivered">📦 Delivered</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
  <CardContent className="pt-0">
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-ump-blue" />
            <h4 className="font-semibold text-ump-gray-800">Order Items</h4>
          </div>
          <div className="space-y-2">
            {(order.items || []).map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-ump-gray-50 rounded-modern border border-ump-gray-100">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-ump-blue/10 text-ump-blue rounded text-sm font-medium">
                    {item?.quantity ?? 0}x
                  </span>
                  <span className="font-medium text-ump-gray-800">{item?.name ?? 'Unknown Item'}</span>
                </div>
                <span className="font-bold text-ump-green">
                  R{(((item?.price ?? 0) * (item?.quantity ?? 0)) || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-ump-green/5 to-ump-green/10 rounded-modern border border-ump-green/20">
              <p className="text-sm text-ump-gray-600 mb-1">Total Amount</p>
              <p className="text-xl font-bold text-ump-green">R{(order?.totalAmount ?? 0).toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-ump-orange/5 to-ump-orange/10 rounded-modern border border-ump-orange/20">
              <p className="text-sm text-ump-gray-600 mb-1">Est. Time</p>
              <p className="text-xl font-bold text-ump-orange">{order?.estimatedTime ?? 'N/A'} min</p>
            </div>
          </div>
          {order?.specialInstructions && (
            <div className="p-4 bg-gradient-to-br from-ump-yellow/5 to-ump-yellow/10 rounded-modern border border-ump-yellow/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-ump-orange" />
                <h5 className="font-semibold text-ump-gray-800">Special Instructions</h5>
              </div>
              <p className="text-sm text-ump-gray-700">{order.specialInstructions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </CardContent>
</CardContent>

                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu" className="mt-6">
            <Card className="glass-effect shadow-modern rounded-modern-lg">
              <CardHeader className="pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-modern bg-ump-green/10">
                      <Package className="w-6 h-6 text-ump-green" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-ump-gray-800">Menu Management</CardTitle>
                      <CardDescription className="text-ump-gray-600">Add, edit, and manage your restaurant menu items</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => { api.clearCache(); loadMenu(); }} variant="outline" size="sm">
                      🔄 Reload Menu
                    </Button>
                    <Button 
                      onClick={async () => {
                        try {
                          const debugData = await api.request('/debug/kv')
                          console.log('🔍 KV Store Debug Data:', debugData)
                          setSuccess(`Found ${debugData.menuItemsCount} items in database. Check console for details.`)
                          setTimeout(() => setSuccess(''), 5000)
                        } catch (error) {
                          console.error('Debug failed:', error)
                          setError('Debug failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
                        }
                      }} 
                      variant="outline" 
                      size="sm"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      🔍 Debug DB
                    </Button>
                    <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setShowAddItem(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Menu Item
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Menu Item</DialogTitle>
                        <DialogDescription>
                          Create a new menu item for your restaurant.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddItem} className="space-y-4">
                        {/* Show error message at top of form */}
                        {error && (
                          <Alert className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                              {error}
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* Show success message */}
                        {success && (
                          <Alert className="border-green-200 bg-green-50">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                              {success}
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* Inventory Status Banner */}
                        <InventoryStatusBanner />
                        
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            value={itemForm.name}
                            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                            placeholder="Enter item name"
                            required
                            minLength={2}
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={itemForm.description}
                            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                            placeholder="Describe your menu item (optional)"
                            maxLength={500}
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="staff-price">Staff Price (R) *</Label>
                              <Input
                                id="staff-price"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="9999.99"
                                value={itemForm.staffPrice}
                                onChange={(e) => setItemForm({ ...itemForm, staffPrice: e.target.value })}
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="guest-price">Guest Price (R) *</Label>
                              <Input
                                id="guest-price"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="9999.99"
                                value={itemForm.guestPrice}
                                onChange={(e) => setItemForm({ ...itemForm, guestPrice: e.target.value })}
                                placeholder="0.00"
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="prep-time">Prep Time (min) *</Label>
                            <Input
                              id="prep-time"
                              type="number"
                              min="1"
                              max="180"
                              value={itemForm.preparationTime}
                              onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                              placeholder="15"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Category *</Label>
                          <Select
                            value={itemForm.category || undefined}
                            onValueChange={(value) => setItemForm({ ...itemForm, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {/* Breakfast Categories */}
                              <SelectItem value="breakfast-meals-on-the-go">Breakfast - Meals on the Go</SelectItem>
                              <SelectItem value="breakfast-light-meal">Breakfast - Light Meal Menu</SelectItem>
                              <SelectItem value="breakfast-sandwiches">Breakfast - Sandwiches Selection</SelectItem>
                              <SelectItem value="breakfast-burgers">Breakfast - Burger Selection</SelectItem>
                              
                              {/* Beverages - Wines & Champagne */}
                              <SelectItem value="beverages-white-wine">Beverages - White Wine</SelectItem>
                              <SelectItem value="beverages-red-wine">Beverages - Red Wine</SelectItem>
                              <SelectItem value="beverages-champagne">Beverages - Champagne</SelectItem>
                              <SelectItem value="beverages-sherries">Beverages - Sherries</SelectItem>
                              <SelectItem value="beverages-aperitifs">Beverages - Aperitifs</SelectItem>
                              
                              {/* Beverages - Whiskey & Spirits */}
                              <SelectItem value="beverages-single-malt-whiskey">Beverages - Single Malt Whiskey</SelectItem>
                              <SelectItem value="beverages-blended-malt-whiskey">Beverages - Blended Malt Whiskey</SelectItem>
                              <SelectItem value="beverages-cognac">Beverages - Cognac</SelectItem>
                              <SelectItem value="beverages-brandy">Beverages - Brandy</SelectItem>
                              <SelectItem value="beverages-gin">Beverages - Gin</SelectItem>
                              <SelectItem value="beverages-vodka">Beverages - Vodka</SelectItem>
                              <SelectItem value="beverages-rum">Beverages - Rum</SelectItem>
                              <SelectItem value="beverages-tequila">Beverages - Tequila</SelectItem>
                              <SelectItem value="beverages-liqueurs">Beverages - Liqueurs</SelectItem>
                              
                              {/* Beverages - Beers & Ciders */}
                              <SelectItem value="beverages-beers-local">Beverages - Beers (Local)</SelectItem>
                              <SelectItem value="beverages-beers-imported">Beverages - Beers (Imported)</SelectItem>
                              <SelectItem value="beverages-ciders">Beverages - Ciders</SelectItem>
                              <SelectItem value="beverages-cocktails">Beverages - Cocktails</SelectItem>
                              
                              {/* Beverages - Non-Alcoholic */}
                              <SelectItem value="beverages-minerals">Beverages - Minerals</SelectItem>
                              <SelectItem value="beverages-milkshakes">Beverages - Milk Shakes</SelectItem>
                              <SelectItem value="beverages-cordials">Beverages - Cordials</SelectItem>
                              <SelectItem value="beverages-mineral-water">Beverages - Mineral Water</SelectItem>
                              <SelectItem value="beverages-soft-drinks">Beverages - Selected Soft Drinks</SelectItem>
                              <SelectItem value="beverages-tea">Beverages - Tea Selection</SelectItem>
                              <SelectItem value="beverages-coffee">Beverages - Coffee & Hot Beverages</SelectItem>
                              <SelectItem value="beverages-bar-snacks">Beverages - Bar Snacks</SelectItem>
                              
                              {/* Main Course Categories */}
                              <SelectItem value="main-salads-starters">Main Course - Salads and Starters</SelectItem>
                              <SelectItem value="main-selection">Main Course - Main Selection</SelectItem>
                              <SelectItem value="main-desserts">Main Course - Desserts Selection</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={itemForm.category}
                            onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                            placeholder="Or type custom category"
                            className="mt-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Recipe Ingredients</Label>
                              <p className="text-xs text-gray-500 mt-0.5">Select items from inventory (all categories available)</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log('🔄 Refreshing inventory items...')
                                loadInventoryItems()
                              }}
                              className="h-8"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Refresh
                            </Button>
                          </div>
                        {/* INGREDIENT SELECTION */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ingredients
                          </label>

                          <IngredientsPicker
                            inventoryItems={(inventoryItems || []).filter(item => item.name).map(item => ({
                              id: item.id,
                              name: item.name!,
                              unit: item.unit,
                              category: item.category
                            }))}
                            selectedIngredients={selectedIngredients}
                            addIngredient={addIngredient}
                            updateIngredientQuantity={updateIngredientQuantity}
                            removeIngredient={removeIngredient}
                            ingredientSelectKey={ingredientSelectKey}
                            setIngredientSelectKey={setIngredientSelectKey}
                          />
                        </div>

                        {/* EXTRAS SELECTION */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Extras <span className="text-gray-400 font-normal">(Optional)</span>
                          </label>
                          <p className="text-xs text-gray-500 mb-2">Select available extras from inventory to offer customers additional options</p>

                        <IngredientsPicker
                          inventoryItems={(inventoryItems || []).filter(item => item.name).map(item => ({
                            id: item.id,
                            name: item.name!,
                            unit: item.unit,
                            category: item.category
                          }))}
                          selectedIngredients={selectedExtras}
                          addIngredient={addExtra}
                          updateIngredientQuantity={updateExtraQuantity}
                          removeIngredient={removeExtra}
                          ingredientSelectKey={extrasSelectKey}
                          setIngredientSelectKey={setExtrasSelectKey}
                        />
                        </div>
                        </div>
                        
                        {/* Image Upload Section */}
                        <div className="space-y-2">
                          <Label>Item Image</Label>
                          <div className="space-y-3">
                            {imagePreview ? (
                              <div className="relative">
                                <img
                                  src={imagePreview}
                                  alt="Preview"
                                  className="w-full h-32 object-cover rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={removeImage}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                                <div className="text-center">
                                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-600 mb-2">Upload an image of your menu item</p>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                    id="image-upload"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Choose Image
                                  </Button>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-gray-500">Supported formats: JPG, PNG, GIF (max 5MB)</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
  <input
    type="checkbox"
    id="available"
    checked={itemForm.isAvailable}
    onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
  />
  <label htmlFor="available">Available</label>
</div>

                        
                        {/* Menu Structure Info */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                          <p className="font-medium text-blue-900">📋 Menu Categories Available:</p>
                          <p className="text-blue-700">• <strong>Breakfast:</strong> Meals on the go, Light meals, Sandwiches, Burgers</p>
                          <p className="text-blue-700">• <strong>Beverages:</strong> Wines, Spirits, Beers, Non-alcoholic drinks, Bar snacks</p>
                          <p className="text-blue-700">• <strong>Main Course:</strong> Salads/Starters, Main selection, Desserts</p>
                        </div>
                        {/* Debug information */}
                        <div className="p-3 bg-gray-50 rounded-lg text-xs">
                          <p><strong>Form Debug:</strong></p>
                          <p>Name: "{itemForm.name}" (length: {itemForm.name?.length || 0})</p>
                          <p>Staff Price: "{itemForm.staffPrice}" (parsed: {parseFloat(itemForm.staffPrice) || 0})</p>
                          <p>Guest Price: "{itemForm.guestPrice}" (parsed: {parseFloat(itemForm.guestPrice) || 0})</p>
                          <p>Category: "{itemForm.category}" (length: {itemForm.category?.length || 0})</p>
                          <p>Prep Time: "{itemForm.preparationTime}" (parsed: {parseInt(itemForm.preparationTime) || 0})</p>
                          <p>Available: {itemForm.isAvailable ? 'Yes' : 'No'}</p>
                          <p>Selected ingredients: {selectedIngredients.length}</p>
                          <p>Has image: {selectedImage ? 'Yes' : 'No'}</p>
                          <p>Form valid: {!!(itemForm.name && itemForm.staffPrice && itemForm.guestPrice && itemForm.category) ? 'Yes' : 'No'}</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="submit"
                            className="flex-1"
                            disabled={uploadingImage || !itemForm.name || !itemForm.staffPrice || !itemForm.guestPrice || !itemForm.category}
                          >
                            {uploadingImage ? 'Adding...' : 'Add Item'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowAddItem(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {Object.keys(menu).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="animate-bounce-in">
                      <Package className="w-16 h-16 text-ump-green/40 mx-auto mb-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-ump-gray-800 mb-2">No Menu Items Yet</h3>
                    <p className="text-ump-gray-600">Start building your menu by adding your first item</p>
                    <p className="text-sm text-ump-gray-500 mt-2">🍽️ Create delicious menu items for your customers!</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(menu).map(([category, items]) => (
                      <div key={category}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold">{getCategoryDisplayName(category)}</h3>
                            <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {category.startsWith('breakfast') ? '🍳 Breakfast' : 
                             category.startsWith('beverages') ? '🍷 Beverages' : 
                             category.startsWith('main') ? '🍽️ Main Course' : 
                             'Other'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item) => (
                            <Card key={item.id} className="relative">
                              <CardContent className="p-4">
                                {item.image && (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-32 object-cover rounded-md mb-3"
                                  />
                                )}
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-medium">{item.name}</h4>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startEdit(item)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => confirmDelete(item)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                                  <div className="flex justify-between items-center">
                                    <div className="text-sm">
                                      <div className="font-bold">Staff: R{(item.staffPrice || 0).toFixed(2)}</div>
                                      <div className="text-gray-600">Guest: R{(item.guestPrice || 0).toFixed(2)}</div>
                                    </div>
                                    <Badge variant={item.isAvailable ? "default" : "secondary"}>
                                      {item.isAvailable ? 'Available' : 'Unavailable'}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Prep time: {item.preparationTime} min
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab Content */}
          <TabsContent value="users" className="mt-6">
            <div className="space-y-6">
              {/* User Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getUserStats().totalUsers}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getUserStats().activeUsers}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Inactive Staff</CardTitle>
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getUserStats().inactiveUsers}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getUserStats().activeShifts}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                      <CardTitle>Staff Management</CardTitle>
                      <CardDescription>Manage staff accounts, roles, and permissions</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                        <DialogTrigger asChild>
                          <Button onClick={() => setShowAddUser(true)}>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add Staff Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add New Staff Member</DialogTitle>
                            <DialogDescription>
                              Create a staff account with assigned role and permissions.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="user-name">Full Name</Label>
                              <Input
                                id="user-name"
                                value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="user-email">Email</Label>
                              <Input
                                id="user-email"
                                type="email"
                                value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="user-password">Password</Label>
                              <Input
                                id="user-password"
                                type="password"
                                value={userForm.password}
                                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                required
                                minLength={6}
                                placeholder="Minimum 6 characters"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="user-role">Role</Label>
                              <Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value })}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cashier">Cashier</SelectItem>
                                  <SelectItem value="kitchen">Kitchen Staff</SelectItem>
                                  <SelectItem value="delivery">Delivery Staff</SelectItem>
                                  <SelectItem value="stores">Stores Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="user-phone">Phone</Label>
                              <Input
                                id="user-phone"
                                type="tel"
                                value={userForm.phone}
                                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="user-staffNo">Staff Number (optional)</Label>
                              <Input
                                id="user-staffNo"
                                value={userForm.staffNo}
                                onChange={(e) => setUserForm({ ...userForm, staffNo: e.target.value })}
                                placeholder="Enter UMP staff number"
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button type="submit" className="flex-1">
                                Add Staff Member
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setShowAddUser(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" onClick={() => setShowShiftManagement(true)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Manage Shifts  
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search and Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="kitchen">Kitchen</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="stores">Stores</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Staff List */}
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No staff members found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredUsers.map((user) => (
                        <Card key={user.id}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-medium">{user?.name || 'Unknown User'}</h3>
                                  <Badge variant={user.isActive ? "default" : "secondary"}>
                                    {user.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                  <Badge variant="outline" className="capitalize">
                                    {user.role}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">{user.email}</p>
                                {user.phone && (
                                  <p className="text-sm text-gray-600 mb-1">{user.phone}</p>
                                )}
                                <p className="text-xs text-gray-500">
                                  Created: {new Date(user.createdAt).toLocaleString()}
                                  {user.createdByName && ` by ${user.createdByName}`}
                                </p>
                                {user.updatedAt && user.updatedAt !== user.createdAt && (
                                  <p className="text-xs text-gray-500">
                                    Updated: {new Date(user.updatedAt).toLocaleString()}
                                    {user.updatedByName && ` by ${user.updatedByName}`}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditUser(user)}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPasswordResetUser(user)}
                                >
                                  <Key className="w-3 h-3 mr-1" />
                                  Reset Password
                                </Button>

                                <Button
                                  size="sm"
                                  variant={user.isActive ? "destructive" : "default"}
                                  onClick={() => toggleUserStatus(user.id, !user.isActive)}
                                >
                                  {user.isActive ? (
                                    <>
                                      <UserX className="w-3 h-3 mr-1" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3 h-3 mr-1" />
                                      Activate
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => confirmDeleteUser(user)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Analytics Dashboard</CardTitle>
                  <CardDescription>Revenue insights and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" value={analyticsView} onValueChange={(value: any) => setAnalyticsView(value)}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="charts">Charts</TabsTrigger>
                      <TabsTrigger value="items">Top Items</TabsTrigger>
                      <TabsTrigger value="reports">Reports</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 text-muted-foreground mr-1" />
                              {revenueAnalytics.daily.growth > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">R{revenueAnalytics.daily.revenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.daily.growth > 0 ? '+' : ''}{revenueAnalytics.daily.growth.toFixed(1)}% from yesterday
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.daily.orders} orders today
                            </p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Weekly Revenue</CardTitle>
                            <div className="flex items-center">
                              <TrendingUp className="h-4 w-4 text-muted-foreground mr-1" />
                              {revenueAnalytics.weekly.growth > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">R{revenueAnalytics.weekly.revenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.weekly.growth > 0 ? '+' : ''}{revenueAnalytics.weekly.growth.toFixed(1)}% from last week
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.weekly.orders} orders this week
                            </p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
                              {revenueAnalytics.monthly.growth > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">R{revenueAnalytics.monthly.revenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.monthly.growth > 0 ? '+' : ''}{revenueAnalytics.monthly.growth.toFixed(1)}% from last month
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.monthly.orders} orders this month
                            </p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Yearly Revenue</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">R{revenueAnalytics.yearly.revenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">
                              Total this year
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {revenueAnalytics.yearly.orders} orders this year
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="charts" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Daily Revenue Trend</CardTitle>
                            <CardDescription>Revenue over the last 7 days</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis />
                                  <Tooltip />
                                  <Line 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke="#f59e0b" 
                                    strokeWidth={2}
                                    name="Revenue (R)"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Daily Orders</CardTitle>
                            <CardDescription>Order count over the last 7 days</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="orders" fill="#82ca9d" name="Orders" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="items" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Performing Menu Items</CardTitle>
                          <CardDescription>Best selling items by revenue</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {topItems.length === 0 ? (
                            <div className="text-center py-8">
                              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-500">No sales data available</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {topItems.map((item, index) => (
                                <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <h3 className="font-medium">{item.name}</h3>
                                      <p className="text-sm text-gray-600">{item.quantity} units sold</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold">R{item.revenue.toFixed(2)}</div>
                                    <div className="text-sm text-gray-600">Revenue</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="reports" className="mt-6">
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Daily Reports</CardTitle>
                            <CardDescription>Generate and download daily business reports</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                              <div className="flex-1">
                                <Label htmlFor="report-date">Report Date</Label>
                                <Input
                                  id="report-date"
                                  type="date"
                                  value={reportDate}
                                  onChange={(e) => setReportDate(e.target.value)}
                                  max={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              <Button 
  onClick={() => generateAnalyticsReport(reportDateRange.startDate, reportDateRange.endDate)}
  disabled={generatingReport}
  className="bg-ump-orange hover:bg-ump-orange/90"
>
  {generatingReport ? (
    <>
      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      Generating...
    </>
  ) : (
    <>
      <BarChart3 className="w-4 h-4 mr-2" />
      Generate Analytics
    </>
  )}
</Button>
                            </div>

                            {reportData && (
                              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h3 className="font-semibold text-lg">Daily Report - {reportData.date}</h3>
                                    <p className="text-sm text-gray-600">Generated: {new Date(reportData.generatedAt).toLocaleString()}</p>
                                    <p className="text-sm text-gray-600">By: {reportData.generatedBy}</p>
                                  </div>
                                  <Button
                                    onClick={() => downloadReportAsPDF(reportData, 'daily')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-ump-navy">{reportData.totalOrders}</div>
                                    <p className="text-sm text-gray-600">Total Orders</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-ump-green">R{reportData.totalSales?.toFixed(2) || '0.00'}</div>
                                    <p className="text-sm text-gray-600">Total Sales</p>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-ump-orange">R{reportData.averageOrderValue?.toFixed(2) || '0.00'}</div>
                                    <p className="text-sm text-gray-600">Average Order Value</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Analytics Reports</CardTitle>
                            <CardDescription>Generate comprehensive sales analytics for date ranges</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                              <div className="flex-1">
                                <Label htmlFor="start-date">Start Date</Label>
                                <Input
                                  id="start-date"
                                  type="date"
                                  value={reportDateRange.startDate}
                                  onChange={(e) => setReportDateRange({ ...reportDateRange, startDate: e.target.value })}
                                  max={reportDateRange.endDate}
                                />
                              </div>
                              <div className="flex-1">
                                <Label htmlFor="end-date">End Date</Label>
                                <Input
                                  id="end-date"
                                  type="date"
                                  value={reportDateRange.endDate}
                                  onChange={(e) => setReportDateRange({ ...reportDateRange, endDate: e.target.value })}
                                  min={reportDateRange.startDate}
                                  max={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              <Button 
                                onClick={() => generateAnalyticsReport(reportDateRange.startDate, reportDateRange.endDate)}
                                disabled={generatingReport}
                                className="bg-ump-orange hover:bg-ump-orange/90"
                              >
                                {generatingReport ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Generate Analytics
                                  </>
                                )}
                              </Button>
                            </div>

                            {salesAnalytics && (
                              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h3 className="font-semibold text-lg">Analytics Report</h3>
                                    <p className="text-sm text-gray-600">
                                      Period: {reportDateRange.startDate} to {reportDateRange.endDate}
                                    </p>
                                    <p className="text-sm text-gray-600">Generated: {new Date(salesAnalytics.generatedAt).toLocaleString()}</p>
                                    <p className="text-sm text-gray-600">By: {salesAnalytics.generatedBy}</p>
                                  </div>
                                  <Button
                                    onClick={() => downloadReportAsPDF(salesAnalytics, 'analytics')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="font-semibold mb-3">Summary</h4>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span>Total Orders:</span>
                                        <span className="font-medium">{salesAnalytics.totalOrders}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Total Sales:</span>
                                        <span className="font-medium text-ump-green">R{salesAnalytics.totalSales?.toFixed(2) || '0.00'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Daily Average:</span>
                                        <span className="font-medium">R{((salesAnalytics.totalSales || 0) / (salesAnalytics.dailySales?.length || 1)).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-semibold mb-3">Top Items</h4>
                                    <div className="space-y-2">
                                      {(salesAnalytics?.topItems || []).slice(0, 3).map((item: TopItem, index) => (
                                        <div key={item.name} className="flex justify-between text-sm">
                                          <span>{index + 1}. {item.name}</span>
                                          <span className="font-medium">R{item.revenue.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <div className="space-y-6">
              {/* Stock Issues Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Stock Issues Management</h2>
                  <p className="text-gray-600">Review and resolve reported stock issues from all departments</p>
                </div>
                <Button onClick={loadStockIssues} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
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
                  <CardTitle>All Stock Issues</CardTitle>
                  <CardDescription>Manage and resolve reported stock issues from all departments</CardDescription>
                </CardHeader>
                <CardContent>
                  {stockIssues.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No stock issues reported yet</p>
                      <p className="text-sm text-gray-400">Issues will appear here when reported by kitchen or stores staff</p>
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
                                    onClick={() => updateIssueStatus(issue.id, 'in_progress')}
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
                                      if (notes) updateIssueStatus(issue.id, 'resolved', notes);
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
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Management
              </CardTitle>
              <CardDescription>
                Data verification, system health monitoring, and administrative tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DataVerificationPanel />

              {/* Logo Management Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Logo Management</h3>

                {/* Current Logo Display */}
                <div className="mb-4">
                  <Label className="text-sm font-medium">Current Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <img
                      src={currentLogo || defaultLogo}
                      alt="Current Logo"
                      className="w-16 h-16 object-contain border rounded"
                    />
                    <div>
                      <p className="text-sm text-gray-600">
                        {currentLogo ? 'Custom logo is set' : 'Using default logo'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Logo Upload Form */}
                <form onSubmit={handleLogoUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Upload New Logo</Label>
                    <div className="space-y-3">
                      {logoPreview ? (
                        <div className="relative inline-block">
                          <img
                            src={logoPreview}
                            alt="Logo Preview"
                            className="w-32 h-32 object-contain border rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2"
                            onClick={removeLogoPreview}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 mb-2">Upload a new logo image</p>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoFileChange}
                              className="hidden"
                              id="logo-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Choose Logo
                            </Button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Supported formats: JPG, PNG, GIF (max 2MB)</p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!logoFile || uploadingLogo}
                    className="w-full"
                  >
                    {uploadingLogo ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Set Logo
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Menu Item</DialogTitle>
              <DialogDescription>
                Update the details of this menu item.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditItem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-staff-price">Staff Price (R)</Label>
                    <Input
                      id="edit-staff-price"
                      type="number"
                      step="0.01"
                      value={itemForm.staffPrice}
                      onChange={(e) => setItemForm({ ...itemForm, staffPrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-guest-price">Guest Price (R)</Label>
                    <Input
                      id="edit-guest-price"
                      type="number"
                      step="0.01"
                      value={itemForm.guestPrice}
                      onChange={(e) => setItemForm({ ...itemForm, guestPrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-prep-time">Prep Time (min)</Label>
                  <Input
                    id="edit-prep-time"
                    type="number"
                    value={itemForm.preparationTime}
                    onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ingredients">Ingredients (comma-separated)</Label>
                <Input
                  id="edit-ingredients"
                  value={itemForm.ingredients}
                  onChange={(e) => setItemForm({ ...itemForm, ingredients: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Extras</Label>
                <p className="text-xs text-gray-500 mb-2">Select available extras from inventory</p>
                <IngredientsPicker
                  inventoryItems={(inventoryItems || []).filter(item => item.name).map(item => ({
                    id: item.id,
                    name: item.name!,
                    unit: item.unit,
                    category: item.category
                  }))}
                  selectedIngredients={selectedExtras}
                  addIngredient={addExtra}
                  updateIngredientQuantity={updateExtraQuantity}
                  removeIngredient={removeExtra}
                  ingredientSelectKey={extrasSelectKey}
                  setIngredientSelectKey={setExtrasSelectKey}
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label>Item Image</Label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Upload a new image</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="edit-image-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('edit-image-upload')?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Choose Image
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
  <input
    type="checkbox"
    id="available"
    checked={itemForm.isAvailable}
    onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
  />
  <label htmlFor="available">Available</label>
</div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={uploadingImage}
                >
                  {uploadingImage ? 'Updating...' : 'Update Item'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingItem(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>
                Update staff member details and role.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Full Name</Label>
                <Input
                  id="edit-user-name"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                  disabled
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Role</Label>
                <Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="kitchen">Kitchen Staff</SelectItem>
                    <SelectItem value="delivery">Delivery Staff</SelectItem>
                    <SelectItem value="stores">Stores Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-phone">Phone</Label>
                <Input
                  id="edit-user-phone"
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="flex-1">
                  Update Staff Member
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingUser(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Password Reset Dialog */}
      {passwordResetUser && (
        <Dialog open={!!passwordResetUser} onOpenChange={() => setPasswordResetUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Reset password for {passwordResetUser?.name || 'User'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" className="flex-1">
                  Reset Password
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setPasswordResetUser(null)
                    setNewPassword('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        onConfirm={() => deleteConfirm.item && handleDeleteItem(deleteConfirm.item.id)}
        title="Delete Menu Item"
        description={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This action cannot be undone.`}
      />

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        open={deleteUserConfirm.open}
        onOpenChange={(open) => setDeleteUserConfirm({ ...deleteUserConfirm, open })}
        onConfirm={() => deleteUserConfirm.user && handleDeleteUser(deleteUserConfirm.user.id)}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteUserConfirm.user?.name}"? This action cannot be undone and will permanently remove the user account.`}
      />

      {/* Shift Management Dialog */}
      <Dialog open={showShiftManagement} onOpenChange={setShowShiftManagement}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift Management</DialogTitle>
            <DialogDescription>
              Manage staff shifts, view active shifts, and track work hours.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Create New Shift Section */}
            <Card>
              <CardHeader>
                <CardTitle>Start New Shift</CardTitle>
                <CardDescription>Create a new shift for a staff member</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (shiftForm.staffId && shiftForm.shiftType) {
                    createShift(shiftForm.staffId, shiftForm.shiftType)
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="staffId">Staff Member</Label>
                      <Select value={shiftForm.staffId || undefined} onValueChange={(value) => setShiftForm({ ...shiftForm, staffId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.filter(user => user.isActive && ['cashier', 'kitchen', 'delivery', 'stores'].includes(user.role)).map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user?.name || 'Unknown User'} ({user.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shiftType">Shift Type</Label>
                      <Select value={shiftForm.shiftType || undefined} onValueChange={(value) => setShiftForm({ ...shiftForm, shiftType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning Shift (7AM - 3PM)</SelectItem>
                          <SelectItem value="evening">Evening Shift (3PM - 11PM)</SelectItem>
                          <SelectItem value="full-day">Full Day (7AM - 11PM)</SelectItem>
                          <SelectItem value="custom">Custom Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={!shiftForm.staffId || !shiftForm.shiftType}>
                    <Clock className="w-4 h-4 mr-2" />
                    Start Shift
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Shifts Section */}
            <Card>
              <CardHeader>
                <CardTitle>Active Shifts</CardTitle>
                <CardDescription>Currently running shifts</CardDescription>
              </CardHeader>
              <CardContent>
                {shifts.filter(shift => shift.status === 'active').length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No active shifts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shifts.filter(shift => shift.status === 'active').map(shift => (
                      <Card key={shift.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-medium">{shift.userName}</h4>
                                <Badge variant="outline" className="capitalize">
                                  {shift.userRole}
                                </Badge>
                                <Badge className="bg-green-100 text-green-800">
                                  Active
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                                <p>Shift Type: <span className="capitalize">{shift.shiftType}</span></p>
                                <p>Started: {new Date(shift.startTime).toLocaleString()}</p>
                                {shift.expectedEndTime && (
                                  <p>Expected End: {new Date(shift.expectedEndTime).toLocaleString()}</p>
                                )}
                                <p>Duration: {Math.round((new Date().getTime() - new Date(shift.startTime).getTime()) / (1000 * 60))} minutes</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => endShift(shift.id)}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              End Shift
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Shifts Section */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Shifts</CardTitle>
                <CardDescription>
                  Last 10 completed shifts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shifts.filter(shift => shift.status === 'completed').length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No completed shifts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shifts
                      .filter(shift => shift.status === 'completed')
                      .slice(0, 10)
                      .map(shift => (
                      <Card key={shift.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-medium">{shift.userName}</h4>
                                <Badge variant="outline" className="capitalize">
                                  {shift.userRole}
                                </Badge>
                                <Badge variant="secondary">
                                  Completed
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                                <p>Shift Type: <span className="capitalize">{shift.shiftType}</span></p>
                                <p>Started: {new Date(shift.startTime).toLocaleString()}</p>
                                <p>Ended: {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'N/A'}</p>
                                {shift.endTime && (
                                  <p className="sm:col-span-3">
                                    Duration: {Math.round((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60))} minutes
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shift Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Shift Statistics</CardTitle>
                <CardDescription>Today's shift overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {shifts.filter(shift => shift.status === 'active').length}
                    </div>
                    <p className="text-sm text-gray-600">Active Shifts</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {shifts.filter(shift => {
                        const today = new Date().toDateString()
                        return new Date(shift.startTime).toDateString() === today
                      }).length}
                    </div>
                    <p className="text-sm text-gray-600">Today's Shifts</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {shifts.filter(shift => shift.status === 'completed').length}
                    </div>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(
                        shifts
                          .filter(shift => shift.status === 'completed' && shift.endTime)
                          .reduce((total, shift) => {
                            const duration = (new Date(shift.endTime!).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60)
                            return total + duration
                          }, 0) / 60
                      )}h
                    </div>
                    <p className="text-sm text-gray-600">Total Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowShiftManagement(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}