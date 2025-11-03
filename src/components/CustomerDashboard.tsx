// CustomerDashboard - Payment integrations removed v2.0
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Alert, AlertDescription } from './ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import StatusNotification from './StatusNotification'
import { ImageWithFallback } from './figma/ImageWithFallback'
import HotelChatbot from './HotelChatbot'
import YocoPayment from './YocoPayment'
import { toast } from "sonner"
const defaultLogo = "/src/assets/logo.png"
import {
  getMenuItems,
  getCategories,
  addOrder,
  generateId,
  getOrdersByCustomer,
  MENU_CATEGORIES,
  type MenuItem,
  type Category,
  type Order
} from '../utils/localStorage'
import {
  ShoppingCart,
  Plus,
  Minus,
  Heart,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  Home,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Utensils,
  X,
  Loader2,
  Settings,
  Moon,
  Sun,
  Edit,
  Save,
  UserCog,
  Eye,
  Filter,
  Calendar,
  TrendingUp,
  Search,
  CreditCard
} from 'lucide-react'



interface CartItem {
  menuItem: MenuItem
  quantity: number
  specialInstructions?: string
  selectedExtras?: string[]
  customerType?: 'staff' | 'guest'
}

export default function CustomerDashboard() {
  const { user, profile, logout } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showStatusNotification, setShowStatusNotification] = useState(true)
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [filteredOrderHistory, setFilteredOrderHistory] = useState<Order[]>([])
  const [orderHistoryFilters, setOrderHistoryFilters] = useState({
    status: 'all',
    dateRange: 'all',
    searchTerm: ''
  })
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [orderDetails, setOrderDetails] = useState({
    orderType: 'dine-in' as 'dine-in' | 'takeaway' | 'delivery',
    tableNumber: '',
    deliveryAddress: '',
    specialInstructions: ''
  })
  const [locationLoading, setLocationLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('customer-dark-mode')
    return saved ? JSON.parse(saved) : false
  })

  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    name: profile?.name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    roomNumber: profile?.roomNumber || '',
    visitorNo: profile?.visitorNo || '',
    staffNo: profile?.staffNo || ''
  })

  // Determine customer type based on profile
  const getCustomerType = (): 'staff' | 'guest' => {
    if (profile?.staffNo) return 'staff'
    return 'guest'
  }

  const customerType = getCustomerType()
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [currentLogo, setCurrentLogo] = useState(defaultLogo)

  // Load data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        // Simulate loading delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500))

        const categoriesData = await getCategories()
        const menuData = await getMenuItems()
        const userOrders = user ? await getOrdersByCustomer(user.id) : []

        setCategories(categoriesData)
        setMenuItems(menuData)
        setOrderHistory(userOrders)

        console.log('✅ Loaded data successfully:', {
          categories: categoriesData.length,
          menuItems: menuData.length,
          orders: userOrders.length
        })

      } catch (err) {
        console.error('❌ Failed to load data:', err)
        setError('Failed to load menu data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    const loadLogo = async () => {
      try {
        const { api } = await import('../utils/api')
        const data = await api.request('/logo')
        if (data.logoUrl) {
          setCurrentLogo(data.logoUrl)
        }
      } catch (error) {
        console.error('Failed to load logo:', error)
        // Keep default logo
      }
    }

    loadData()
    loadLogo()
  }, [user])

  // Update profile form when profile changes
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        roomNumber: profile.roomNumber || '',
        visitorNo: profile.visitorNo || '',
        staffNo: profile.staffNo || ''
      })
    }
  }, [profile])

  // Filter order history
  useEffect(() => {
    let filtered = orderHistory

    // Status filter
    if (orderHistoryFilters.status !== 'all') {
      filtered = filtered.filter(order => order.status === orderHistoryFilters.status)
    }

    // Date range filter
    if (orderHistoryFilters.dateRange !== 'all') {
      const now = new Date()
      const filterDate = new Date()

      switch (orderHistoryFilters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          filtered = filtered.filter(order => new Date(order.orderDate) >= filterDate)
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          filtered = filtered.filter(order => new Date(order.orderDate) >= filterDate)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          filtered = filtered.filter(order => new Date(order.orderDate) >= filterDate)
          break
        case '3months':
          filterDate.setMonth(now.getMonth() - 3)
          filtered = filtered.filter(order => new Date(order.orderDate) >= filterDate)
          break
      }
    }

    // Search filter
    if (orderHistoryFilters.searchTerm) {
      const searchLower = orderHistoryFilters.searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(searchLower) ||
        order.items.some(item => item.name.toLowerCase().includes(searchLower))
      )
    }

    setFilteredOrderHistory(filtered)
  }, [orderHistory, orderHistoryFilters])

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem('customer-dark-mode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Profile update function
  const updateProfile = async () => {
    if (!profile) return

    setProfileLoading(true)
    try {
      // Update profile in Firebase
      const { doc, updateDoc } = await import('firebase/firestore')
      const { db } = await import('../utils/firebase/config')

      const userRef = doc(db, 'users', profile.id)
      await updateDoc(userRef, {
        name: profileForm.name,
        phone: profileForm.phone,
        roomNumber: profileForm.roomNumber,
        visitorNo: profileForm.visitorNo,
        staffNo: profileForm.staffNo,
        updatedAt: new Date().toISOString()
      })

      toast.success('Profile updated successfully!')
      setIsEditingProfile(false)

      // Refresh the page to get updated profile data
      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setProfileLoading(false)
    }
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  // Get filtered menu items
  const filteredMenuItems = selectedCategory === 'all' 
    ? menuItems.filter(item => item.available)
    : menuItems.filter(item => item.category === selectedCategory && item.available)

  // Group menu items by category for display
  const groupedMenuItems = categories.reduce((acc, category) => {
    const items = menuItems.filter(item => item.category === category.id && item.available)
    if (items.length > 0) {
      acc[category.id] = { category, items }
    }
    return acc
  }, {} as Record<string, { category: Category; items: MenuItem[] }>)

  // Cart functions
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.menuItem.id === item.id)
      if (existing) {
        return prev.map(cartItem =>
          cartItem.menuItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      } else {
        return [...prev, { menuItem: item, quantity: 1, selectedExtras: [], customerType }]
      }
    })
    toast.success(`Added ${item.name} to cart`)
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.menuItem.id === itemId)
      if (existing && existing.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.menuItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        )
      } else {
        return prev.filter(cartItem => cartItem.menuItem.id !== itemId)
      }
    })
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.customerType === 'staff' ? item.menuItem.staffPrice : item.menuItem.guestPrice
      return total + (price * item.quantity)
    }, 0)
  }

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    if (orderDetails.orderType === 'dine-in' && !orderDetails.tableNumber) {
      toast.error('Please enter a table number')
      return
    }

    if (orderDetails.orderType === 'delivery' && !orderDetails.deliveryAddress) {
      toast.error('Please enter a delivery address')
      return
    }

    const order: Order = {
      id: generateId('order'),
      customerId: user?.id || 'guest',
      customerName: user?.name || 'Guest Customer',
      customerEmail: user?.email || 'guest@example.com',
      items: cart.map(item => ({
        menuItemId: item.menuItem.id,
        name: item.menuItem.name,
        price: item.customerType === 'staff' ? item.menuItem.staffPrice : item.menuItem.guestPrice,
        quantity: item.quantity,
        ...(item.specialInstructions && { specialInstructions: item.specialInstructions }),
        ...(item.selectedExtras && item.selectedExtras.length > 0 && { selectedExtras: item.selectedExtras })
      })),
      status: 'pending',
      totalAmount: getCartTotal(),
      paymentStatus: 'pending',
      orderType: orderDetails.orderType,
      ...(orderDetails.tableNumber && { tableNumber: orderDetails.tableNumber }),
      ...(orderDetails.deliveryAddress && { deliveryAddress: orderDetails.deliveryAddress }),
      ...(orderDetails.specialInstructions && { specialInstructions: orderDetails.specialInstructions }),
      orderDate: new Date().toISOString(),
      estimatedTime: Math.max(15, cart.length * 8) // Estimate based on items
    }

    // Add order to Firebase
    await addOrder(order)

    // Update order history
    setOrderHistory(prev => [order, ...prev])

    // Set current order for payment
    setCurrentOrder(order)

    // Clear cart
    setCart([])
    setOrderDetails({
      orderType: 'dine-in',
      tableNumber: '',
      deliveryAddress: '',
      specialInstructions: ''
    })

    // Show payment screen
    setShowPayment(true)

    // Don't show success message until payment is completed
  }

  // Handle payment success
  const handlePaymentSuccess = async (paymentData: any) => {
    if (!currentOrder) return

    try {
      // Update order payment status
      const updatedOrder = {
        ...currentOrder,
        paymentStatus: 'paid' as const,
        status: 'preparing' as const, // Move to preparing once paid
      }

      // Update order in Firebase
      const { doc, updateDoc } = await import('firebase/firestore')
      const { db } = await import('../utils/firebase/config')

      const orderRef = doc(db, 'orders', currentOrder.id)
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        status: 'preparing',
        paymentData: paymentData,
        updatedAt: new Date().toISOString()
      })

      // Update order history
      setOrderHistory(prev =>
        prev.map(order =>
          order.id === currentOrder.id ? updatedOrder : order
        )
      )

      // Reset payment state
      setShowPayment(false)
      setCurrentOrder(null)

      toast.success('Payment successful! Your order is being prepared.')

    } catch (error) {
      console.error('Failed to update order after payment:', error)
      toast.error('Payment completed but order status update failed. Please contact support.')
    }
  }

  // Handle payment error
  const handlePaymentError = (error: any) => {
    console.error('Payment failed:', error)
    toast.error('Payment failed. Please try again.')

    // Reset payment state but keep order
    setShowPayment(false)
    // Don't clear currentOrder so user can retry payment
  }

  // Handle payment cancel
  const handlePaymentCancel = () => {
    setShowPayment(false)
    // Keep currentOrder so user can retry payment
    toast.info('Payment cancelled. You can retry payment from your order history.')
  }

  // Retry function for status notification
  const retryDataLoad = () => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const categoriesData = await getCategories()
        const menuData = await getMenuItems()
        const userOrders = user ? await getOrdersByCustomer(user.id) : []

        setCategories(categoriesData)
        setMenuItems(menuData)
        setOrderHistory(userOrders)

        toast.success('Data refreshed successfully')

      } catch (err) {
        setError('Failed to refresh data')
        toast.error('Failed to refresh data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }

  const getOrderStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-ump-orange text-white'
      case 'preparing': return 'bg-ump-navy text-white'
      case 'ready': return 'bg-ump-green text-white'
      case 'delivered': return 'bg-ump-gray text-white'
      case 'cancelled': return 'bg-ump-red text-white'
      default: return 'bg-ump-gray text-white'
    }
  }

  // Calculate order statistics
  const getOrderStatistics = () => {
    const totalOrders = orderHistory.length
    const totalSpent = orderHistory.reduce((sum, order) => sum + order.totalAmount, 0)
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0
    const favoriteItems = orderHistory.flatMap(order => order.items)
      .reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + item.quantity
        return acc
      }, {} as Record<string, number>)

    const mostOrderedItem = Object.entries(favoriteItems)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'

    return {
      totalOrders,
      totalSpent,
      avgOrderValue,
      mostOrderedItem
    }
  }

  // Reorder functionality
  const reorderItems = (order: Order) => {
    // Clear current cart
    setCart([])

    // Add all items from the order to cart
    order.items.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (menuItem) {
        for (let i = 0; i < item.quantity; i++) {
          addToCart(menuItem)
        }
      }
    })

    // Switch to cart tab
    const cartTab = document.querySelector('[value="cart"]') as HTMLElement
    if (cartTab) {
      cartTab.click()
    }

    toast.success(`Added ${order.items.length} item(s) to cart for reordering`)
  }

  // View order details
  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser')
      return
    }

    setLocationLoading(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        })
      })

      const { latitude, longitude } = position.coords

      // Reverse geocode using Nominatim (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch address')
      }

      const data = await response.json()

      if (data && data.display_name) {
        const address = data.display_name
        setOrderDetails(prev => ({ ...prev, deliveryAddress: address }))
        toast.success('Location detected and address populated')
      } else {
        throw new Error('No address found for this location')
      }
    } catch (error: any) {
      console.error('Error getting location:', error)
      if (error.code === 1) {
        toast.error('Location access denied. Please enable location permissions.')
      } else if (error.code === 2) {
        toast.error('Location unavailable. Please check your GPS settings.')
      } else if (error.code === 3) {
        toast.error('Location request timed out. Please try again.')
      } else {
        toast.error('Failed to get your location. Please enter address manually.')
      }
    } finally {
      setLocationLoading(false)
    }
  }



  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'gradient-premium'}`}>
      {/* Luxury Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, ${isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(10, 96, 171, 0.05)'} 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}></div>
      </div>

      {/* Hotel Chatbot */}
      <HotelChatbot />
      
      {/* Header */}
      <header className={`sticky top-0 z-40 border-b shadow-elevated ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img
                  src={currentLogo}
                  alt="Egumeni Eats"
                  className="w-12 h-12 rounded-2xl shadow-premium"
                />
                <div>
                  <h1 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-luxury'}`}>Egumeni Eats</h1>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-ump-gray'}`}>University of Mpumalanga</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Switch to cart tab
                    const cartTab = document.querySelector('[value="cart"]') as HTMLElement
                    if (cartTab) {
                      cartTab.click()
                    }
                  }}
                  className="border-ump-navy/20 hover:bg-ump-navy/5 transition-premium shadow-sm hover:shadow-md font-medium cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Cart ({getCartItemCount()})
                </Button>
                {getCartItemCount() > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-br from-ump-orange to-[#d4941a] text-white shadow-md animate-luxury-glow">
                    {getCartItemCount()}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-ump-navy'}`}>Welcome, <span className={isDarkMode ? 'text-blue-400' : 'text-gold'}>{user?.name}</span></span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className={`transition-premium ${isDarkMode ? 'text-red-400 hover:bg-red-400/10' : 'text-ump-red hover:bg-ump-red/10'}`}
                  >
                    Logout
                  </Button>
                </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${isDarkMode ? 'text-white' : ''}`}>
        {/* Status Notification */}
        {showStatusNotification && (
          <div className="mb-6">
            <StatusNotification
              isOnline={!loading && !error}
              error={error}
              loading={loading}
              onRetry={retryDataLoad}
              onDismiss={() => setShowStatusNotification(false)}
            />
          </div>
        )}

        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full grid-cols-4 glass-effect p-1 h-auto gap-2 shadow-modern rounded-modern-lg">
            <TabsTrigger value="menu" className="rounded-modern data-[state=active]:bg-ump-blue data-[state=active]:text-white transition-premium py-3 font-medium flex items-center gap-2">
              <Utensils className="w-4 h-4" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="cart" className="rounded-modern data-[state=active]:bg-ump-green data-[state=active]:text-white transition-premium py-3 font-medium flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Cart ({getCartItemCount()})
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-modern data-[state=active]:bg-ump-orange data-[state=active]:text-white transition-premium py-3 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-modern data-[state=active]:bg-ump-navy data-[state=active]:text-white transition-premium py-3 font-medium flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-8 animate-fade-in-up">
            {/* Profile Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-luxury mb-2">Profile Settings</h2>
                <p className="text-ump-gray">Manage your account information and preferences</p>
              </div>
              <Button
                onClick={toggleDarkMode}
                variant="outline"
                className="flex items-center gap-2 border-ump-navy/20 hover:bg-ump-navy/5"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>
            </div>

            {/* Profile Information Card */}
            <Card className="glass-effect shadow-modern rounded-modern-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-ump-navy/10">
                      <User className="w-6 h-6 text-ump-navy" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Personal Information</CardTitle>
                      <CardDescription>Update your contact details and preferences</CardDescription>
                    </div>
                  </div>
                  {!isEditingProfile ? (
                    <Button
                      onClick={() => setIsEditingProfile(true)}
                      className="bg-ump-navy hover:bg-ump-navy/90"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsEditingProfile(false)}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={updateProfile}
                        disabled={profileLoading}
                        className="bg-ump-green hover:bg-ump-green/90"
                      >
                        {profileLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-name" className="text-ump-navy font-semibold">Full Name</Label>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                      disabled={!isEditingProfile}
                      className="border-ump-navy/20 rounded-xl h-12"
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Email (Read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-email" className="text-ump-navy font-semibold">Email Address</Label>
                    <Input
                      id="profile-email"
                      value={profileForm.email}
                      disabled
                      className="border-ump-navy/20 rounded-xl h-12 bg-gray-50"
                    />
                    <p className="text-xs text-ump-gray">Email cannot be changed</p>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone" className="text-ump-navy font-semibold">Phone Number</Label>
                    <Input
                      id="profile-phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                      disabled={!isEditingProfile}
                      className="border-ump-navy/20 rounded-xl h-12"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  {/* Room Number */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-room" className="text-ump-navy font-semibold">Room Number <span className="text-ump-gray font-normal">(Hotel Guests)</span></Label>
                    <Input
                      id="profile-room"
                      value={profileForm.roomNumber}
                      onChange={(e) => setProfileForm({...profileForm, roomNumber: e.target.value})}
                      disabled={!isEditingProfile}
                      className="border-ump-navy/20 rounded-xl h-12"
                      placeholder="Enter your room number"
                    />
                  </div>

                  {/* Visitor Number */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-visitor" className="text-ump-navy font-semibold">Visitor Number <span className="text-ump-gray font-normal">(Conference Guests)</span></Label>
                    <Input
                      id="profile-visitor"
                      value={profileForm.visitorNo}
                      onChange={(e) => setProfileForm({...profileForm, visitorNo: e.target.value})}
                      disabled={!isEditingProfile}
                      className="border-ump-navy/20 rounded-xl h-12"
                      placeholder="Enter your visitor number"
                    />
                  </div>

                  {/* Staff Number */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-staff" className="text-ump-navy font-semibold">Staff Number <span className="text-ump-gray font-normal">(UMP Staff)</span></Label>
                    <Input
                      id="profile-staff"
                      value={profileForm.staffNo}
                      onChange={(e) => setProfileForm({...profileForm, staffNo: e.target.value})}
                      disabled={!isEditingProfile}
                      className="border-ump-navy/20 rounded-xl h-12"
                      placeholder="Enter your staff number"
                    />
                  </div>
                </div>

                {/* Account Information */}
                <div className="pt-6 border-t border-ump-navy/10">
                  <h3 className="text-lg font-semibold text-ump-navy mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-ump-navy/5 rounded-xl">
                      <User className="w-5 h-5 text-ump-navy" />
                      <div>
                        <p className="text-sm font-medium text-ump-navy">Account Type</p>
                        <p className="text-sm text-ump-gray capitalize">{profile?.role || 'Customer'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-ump-navy/5 rounded-xl">
                      <Clock className="w-5 h-5 text-ump-navy" />
                      <div>
                        <p className="text-sm font-medium text-ump-navy">Member Since</p>
                        <p className="text-sm text-ump-gray">
                          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preferences Card */}
            <Card className="glass-effect shadow-modern rounded-modern-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-ump-orange/10">
                    <Settings className="w-6 h-6 text-ump-orange" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Preferences</CardTitle>
                    <CardDescription>Customize your dining experience</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between p-4 border border-ump-navy/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isDarkMode ? <Moon className="w-5 h-5 text-ump-navy" /> : <Sun className="w-5 h-5 text-ump-orange" />}
                    <div>
                      <p className="font-medium text-ump-navy">Dark Mode</p>
                      <p className="text-sm text-ump-gray">Switch between light and dark themes</p>
                    </div>
                  </div>
                  <Button
                    onClick={toggleDarkMode}
                    variant={isDarkMode ? "default" : "outline"}
                    size="sm"
                    className={isDarkMode ? "bg-ump-navy" : ""}
                  >
                    {isDarkMode ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Notification Preferences */}
                <div className="flex items-center justify-between p-4 border border-ump-navy/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-ump-green" />
                    <div>
                      <p className="font-medium text-ump-navy">Order Notifications</p>
                      <p className="text-sm text-ump-gray">Receive updates about your orders</p>
                    </div>
                  </div>
                  <Badge className="bg-ump-green/10 text-ump-green border-ump-green/20">
                    Enabled
                  </Badge>
                </div>

                {/* Language Preference */}
                <div className="flex items-center justify-between p-4 border border-ump-navy/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-ump-blue" />
                    <div>
                      <p className="font-medium text-ump-navy">Language</p>
                      <p className="text-sm text-ump-gray">Interface language preference</p>
                    </div>
                  </div>
                  <Badge className="bg-ump-blue/10 text-ump-blue border-ump-blue/20">
                    English
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu" className="space-y-10 animate-fade-in-up">
            {/* Category Filter */}
            <Card className="glass-effect shadow-modern rounded-modern-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-modern bg-ump-blue/10">
                    <Utensils className="w-5 h-5 text-ump-blue" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-ump-gray-800">Browse Categories</CardTitle>
                    <CardDescription className="text-ump-gray-600">Choose from our premium menu categories</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                    className={selectedCategory === 'all'
                      ? 'bg-ump-blue hover:bg-ump-blue/90 text-white shadow-md transition-premium font-medium rounded-modern'
                      : 'border-ump-gray-200 hover:bg-ump-blue/5 transition-premium font-medium rounded-modern shadow-sm hover:shadow-md'}
                  >
                    🍽️ All Items
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className={selectedCategory === category.id
                        ? 'bg-ump-blue hover:bg-ump-blue/90 text-white shadow-md transition-premium font-medium rounded-modern'
                        : 'border-ump-gray-200 hover:bg-ump-blue/5 transition-premium font-medium rounded-modern shadow-sm hover:shadow-md'}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Menu Items by Category */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="glass-effect rounded-modern-lg overflow-hidden shadow-modern animate-pulse">
                    <div className="h-64 bg-gradient-to-br from-ump-gray-100 to-ump-gray-200"></div>
                    <CardContent className="p-6 space-y-3">
                      <div className="h-5 bg-gradient-to-r from-ump-gray-200 to-ump-gray-100 rounded-modern"></div>
                      <div className="h-8 bg-gradient-to-r from-ump-gray-100 to-ump-gray-200 rounded-modern w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : selectedCategory === 'all' ? (
              // Show all categories grouped
              <div className="space-y-10">
                {Object.values(groupedMenuItems).map(({ category, items }) => (
                  <div key={category.id} className="animate-fade-in-up">
                    {/* Category Header */}
                    <Card className="glass-effect shadow-modern rounded-modern-lg mb-8">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-3 h-16 bg-gradient-to-b from-ump-orange to-ump-orange/70 rounded-modern shadow-modern"></div>
                          <div>
                            <h2 className="text-3xl font-bold text-ump-gray-800 tracking-tight">
                              {category.name}
                            </h2>
                            <p className="text-ump-gray-600 mt-1">Premium selection from our kitchen</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Category Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {items.map((item, index) => (
                        <Card
                          key={item.id}
                          className="glass-effect rounded-modern-lg overflow-hidden hover-lift cursor-pointer group shadow-modern interactive-card"
                          onClick={() => addToCart(item)}
                        >
                          {/* Premium Image Container */}
                          <div className="relative h-64 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-premium"></div>
                            <ImageWithFallback
                              src={item.image || 'https://via.placeholder.com/400x300/cccccc/666666?text=No+Image'}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-premium"
                            />
                            {/* Premium Badge */}
                            <div className="absolute top-4 right-4 z-20 glass-effect px-3 py-1 rounded-modern shadow-modern">
                              <span className="text-xs font-semibold text-ump-blue">Premium</span>
                            </div>
                          </div>

                          {/* Item Details */}
                          <CardContent className="p-6 space-y-4">
                            <div>
                              <h3 className="text-xl font-bold text-ump-gray-800 tracking-tight mb-2">
                                {item.name}
                              </h3>

                              {item.description && (
                                <p className="text-sm text-ump-gray-600 leading-relaxed line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-baseline space-x-1">
                                <span className="text-sm text-ump-green font-semibold">R</span>
                                <span className="text-3xl font-bold text-ump-gray-800">
                                  {Math.floor(customerType === 'staff' ? item.staffPrice : item.guestPrice)}
                                </span>
                                {(customerType === 'staff' ? item.staffPrice : item.guestPrice) % 1 !== 0 && (
                                  <span className="text-lg text-ump-gray-600">
                                    .{(((customerType === 'staff' ? item.staffPrice : item.guestPrice) % 1) * 100).toFixed(0)}
                                  </span>
                                )}
                              </div>

                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addToCart(item)
                                }}
                                className="bg-ump-green hover:bg-ump-green/90 text-white shadow-md hover:shadow-lg transition-premium rounded-modern px-4 border border-ump-green/20"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add to Cart
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show filtered category
              <div className="animate-fade-in-up">
                {/* Category Header */}
                {categories.find(c => c.id === selectedCategory) && (
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="w-2 h-16 bg-gradient-to-b from-ump-orange to-[#d4941a] rounded-full shadow-md"></div>
                    <h2 className="text-4xl font-bold text-luxury tracking-tight">
                      {categories.find(c => c.id === selectedCategory)?.name}
                    </h2>
                  </div>
                )}
                
                {/* Filtered Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {filteredMenuItems.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="glass-card rounded-2xl overflow-hidden hover-lift cursor-pointer group shadow-premium"
                      onClick={() => addToCart(item)}
                    >
                      {/* Premium Image Container */}
                      <div className="relative h-64 overflow-hidden">
                        <div className="absolute inset-0 gradient-luxury-overlay z-10 opacity-0 group-hover:opacity-100 transition-premium"></div>
                        <ImageWithFallback
                          src={item.image || 'https://via.placeholder.com/400x300/cccccc/666666?text=No+Image'}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-luxury"
                        />
                        {/* Premium Badge */}
                        <div className="absolute top-4 right-4 z-20 glass-premium px-3 py-1 rounded-full">
                          <span className="text-xs font-semibold text-ump-navy">Premium</span>
                        </div>
                      </div>
                      
                      {/* Item Details */}
                      <div className="p-6 space-y-3">
                        <h3 className="text-xl font-bold text-luxury tracking-tight">
                          {item.name}
                        </h3>
                        
                        {item.description && (
                          <p className="text-sm text-ump-gray leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-baseline space-x-1">
                            <span className="text-sm text-gold font-semibold">R</span>
                            <span className="text-3xl font-bold text-luxury">
                              {Math.floor(customerType === 'staff' ? item.staffPrice : item.guestPrice)}
                            </span>
                            {(customerType === 'staff' ? item.staffPrice : item.guestPrice) % 1 !== 0 && (
                              <span className="text-lg text-ump-gray">
                                .{(((customerType === 'staff' ? item.staffPrice : item.guestPrice) % 1) * 100).toFixed(0)}
                              </span>
                            )}
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              addToCart(item)
                            }}
                            className="bg-gradient-accent hover:bg-ump-navy/90 text-green-500 shadow-md hover:shadow-lg transition-premium rounded-xl px-4 border border-black"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cart" className="space-y-8 animate-fade-in-up">
            {/* Payment Screen */}
            {showPayment && currentOrder && (
              <div className="space-y-6">
                <Card className="glass-effect shadow-modern rounded-modern-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      Complete Your Payment
                    </CardTitle>
                    <CardDescription>
                      Secure payment for Order #{currentOrder.id.slice(-6)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <YocoPayment
                      amount={currentOrder.totalAmount}
                      orderId={currentOrder.id}
                      customerEmail={currentOrder.customerEmail}
                      customerName={currentOrder.customerName}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onCancel={handlePaymentCancel}
                    />
                  </CardContent>
                </Card>

                <Card className="glass-effect shadow-modern rounded-modern-lg">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentOrder.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-medium">R{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-3 flex justify-between items-center font-bold">
                        <span>Total</span>
                        <span>R{currentOrder.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Cart Screen */}
            {!showPayment && cart.length === 0 ? (
              <Card className="glass-effect text-center py-16 rounded-modern-lg shadow-modern">
                <CardContent>
                  <div className="animate-bounce-in">
                    <div className="w-20 h-20 rounded-modern bg-ump-green/10 mx-auto mb-6 flex items-center justify-center shadow-modern">
                      <ShoppingCart className="w-10 h-10 text-ump-green" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-ump-gray-800 mb-3">Your cart is empty</h3>
                  <p className="text-ump-gray-600 text-lg">Add some delicious items from our premium menu!</p>
                  <p className="text-sm text-ump-gray-500 mt-2">🛒 Start your culinary journey!</p>
                </CardContent>
              </Card>
            ) : !showPayment && (
              <div className="space-y-6">
                {/* Cart Items */}
                {cart.map((item) => (
                  <Card key={item.menuItem.id} className="glass-effect rounded-modern-lg shadow-modern hover-lift transition-premium">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-ump-gray-800">{item.menuItem.name}</h4>
                          <p className="text-sm text-ump-gray-600 mt-1">R{(item.customerType === 'staff' ? item.menuItem.staffPrice : item.menuItem.guestPrice).toFixed(2)} each</p>
                          {item.selectedExtras && item.selectedExtras.length > 0 && (
                            <div className="mt-3 p-3 bg-ump-orange/5 rounded-modern border border-ump-orange/20">
                              <p className="text-xs text-ump-orange font-medium mb-1">Selected Extras:</p>
                              <p className="text-sm text-ump-gray-700">{item.selectedExtras.join(', ')}</p>
                            </div>
                          )}
                          {/* Extras Selection */}
                          {item.menuItem.extras && item.menuItem.extras.length > 0 && (
                            <div className="mt-4 p-4 bg-ump-blue/5 rounded-modern border border-ump-blue/20">
                              <p className="text-xs text-ump-blue font-medium mb-3">Available Extras:</p>
                              <div className="flex flex-wrap gap-2">
                                {item.menuItem.extras.map((extra, index) => {
                                  const isSelected = item.selectedExtras?.includes(extra) || false
                                  return (
                                    <Button
                                      key={index}
                                      variant={isSelected ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        setCart(prev => prev.map(cartItem =>
                                          cartItem.menuItem.id === item.menuItem.id
                                            ? {
                                                ...cartItem,
                                                selectedExtras: isSelected
                                                  ? (cartItem.selectedExtras || []).filter(e => e !== extra)
                                                  : [...(cartItem.selectedExtras || []), extra]
                                              }
                                            : cartItem
                                        ))
                                      }}
                                      className={`text-xs px-3 py-1 h-auto rounded-modern transition-premium ${
                                        isSelected
                                          ? 'bg-ump-orange hover:bg-ump-orange/90 text-white shadow-md'
                                          : 'border-ump-gray-200 hover:bg-ump-orange/5 hover:border-ump-orange'
                                      }`}
                                    >
                                      {extra}
                                    </Button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-4 ml-6">
                          <div className="flex items-center bg-ump-gray-50 rounded-modern p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.menuItem.id)}
                              className="w-8 h-8 p-0 rounded-modern hover:bg-ump-red/10 hover:text-ump-red transition-premium"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-10 text-center font-bold text-ump-gray-800 text-lg">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addToCart(item.menuItem)}
                              className="w-8 h-8 p-0 rounded-modern hover:bg-ump-green/10 hover:text-ump-green transition-premium"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="text-right ml-6">
                            <div className="text-2xl font-bold text-ump-green">
                              R{((item.customerType === 'staff' ? item.menuItem.staffPrice : item.menuItem.guestPrice) * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Order Details */}
                <div className="glass-card rounded-2xl shadow-premium">
                  <div className="p-6 border-b border-ump-navy/10">
                    <h3 className="text-2xl font-bold text-luxury">Order Details</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <Label htmlFor="orderType" className="text-ump-navy font-semibold">Order Type</Label>
                      <Select 
                        value={orderDetails.orderType} 
                        onValueChange={(value: any) => setOrderDetails(prev => ({ ...prev, orderType: value }))}
                      >
                        <SelectTrigger className="border-ump-navy/20 rounded-xl h-12 shadow-sm hover:shadow-md transition-premium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass-card rounded-xl border-premium">
                          <SelectItem value="dine-in" className="rounded-lg">Dine In</SelectItem>
                          <SelectItem value="takeaway" className="rounded-lg">Takeaway</SelectItem>
                          <SelectItem value="delivery" className="rounded-lg">Delivery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {orderDetails.orderType === 'dine-in' && (
                      <div className="animate-fade-in-up">
                        <Label htmlFor="tableNumber" className="text-ump-navy font-semibold">Table Number</Label>
                        <Input
                          id="tableNumber"
                          value={orderDetails.tableNumber}
                          onChange={(e) => setOrderDetails(prev => ({ ...prev, tableNumber: e.target.value }))}
                          placeholder="Enter table number"
                          className="border-ump-navy/20 rounded-xl h-12 shadow-sm hover:shadow-md transition-premium"
                        />
                      </div>
                    )}

                    {orderDetails.orderType === 'delivery' && (
                      <div className="animate-fade-in-up">
                        <Label htmlFor="deliveryAddress" className="text-ump-navy font-semibold">Delivery Address</Label>
                        <div className="flex gap-2">
                          <Textarea
                            id="deliveryAddress"
                            value={orderDetails.deliveryAddress}
                            onChange={(e) => setOrderDetails(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                            placeholder="Enter delivery address"
                            rows={3}
                            className="border-ump-navy/20 rounded-xl shadow-sm hover:shadow-md transition-premium flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={getCurrentLocation}
                            disabled={locationLoading}
                            className="border-ump-navy/20 hover:bg-ump-navy/5 transition-premium rounded-xl px-4 h-auto"
                            title="Use current location"
                          >
                            {locationLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="specialInstructions" className="text-ump-navy font-semibold">Special Instructions (Optional)</Label>
                      <Textarea
                        id="specialInstructions"
                        value={orderDetails.specialInstructions}
                        onChange={(e) => setOrderDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
                        placeholder="Any special requests..."
                        rows={2}
                        className="border-ump-navy/20 rounded-xl shadow-sm hover:shadow-md transition-premium"
                      />
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="glass-card rounded-2xl shadow-luxury gradient-luxury-overlay">
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xl font-medium text-ump-navy">Total Amount:</span>
                      <span className="text-4xl font-bold text-gold">R{getCartTotal().toFixed(2)}</span>
                    </div>

                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 text-center">
                        💳 Secure payment will be processed after placing your order
                      </p>
                    </div>

                    <Button
                      className="w-full bg-gradient-accent hover:bg-ump-navy/90 text-green-500 py-4 text-lg rounded-xl shadow-luxury hover:shadow-glow transition-premium font-semibold border border-black"
                      onClick={placeOrder}
                    >
                      Place Order & Pay
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-6 animate-fade-in-up">
            {/* Order Statistics */}
            {orderHistory.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                  const stats = getOrderStatistics()
                  return (
                    <>
                      <Card className="glass-effect shadow-modern rounded-modern-lg">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-ump-blue/10">
                              <Clock className="w-5 h-5 text-ump-blue" />
                            </div>
                            <div>
                              <p className="text-sm text-ump-gray">Total Orders</p>
                              <p className="text-2xl font-bold text-ump-navy">{stats.totalOrders}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="glass-effect shadow-modern rounded-modern-lg">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-ump-green/10">
                              <ShoppingCart className="w-5 h-5 text-ump-green" />
                            </div>
                            <div>
                              <p className="text-sm text-ump-gray">Total Spent</p>
                              <p className="text-2xl font-bold text-ump-green">R{stats.totalSpent.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="glass-effect shadow-modern rounded-modern-lg">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-ump-orange/10">
                              <TrendingUp className="w-5 h-5 text-ump-orange" />
                            </div>
                            <div>
                              <p className="text-sm text-ump-gray">Avg Order</p>
                              <p className="text-2xl font-bold text-ump-orange">R{stats.avgOrderValue.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="glass-effect shadow-modern rounded-modern-lg">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-ump-purple/10">
                              <Heart className="w-5 h-5 text-ump-purple" />
                            </div>
                            <div>
                              <p className="text-sm text-ump-gray">Favorite Item</p>
                              <p className="text-lg font-bold text-ump-purple truncate" title={stats.mostOrderedItem}>
                                {stats.mostOrderedItem}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Filters */}
            {orderHistory.length > 0 && (
              <Card className="glass-effect shadow-modern rounded-modern-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filter Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-ump-navy font-semibold">Search</Label>
                      <Input
                        placeholder="Order ID or item name..."
                        value={orderHistoryFilters.searchTerm}
                        onChange={(e) => setOrderHistoryFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                        className="border-ump-navy/20 rounded-xl h-10"
                      />
                    </div>

                    <div>
                      <Label className="text-ump-navy font-semibold">Status</Label>
                      <Select
                        value={orderHistoryFilters.status}
                        onValueChange={(value) => setOrderHistoryFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger className="border-ump-navy/20 rounded-xl h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="preparing">Preparing</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-ump-navy font-semibold">Date Range</Label>
                      <Select
                        value={orderHistoryFilters.dateRange}
                        onValueChange={(value) => setOrderHistoryFilters(prev => ({ ...prev, dateRange: value }))}
                      >
                        <SelectTrigger className="border-ump-navy/20 rounded-xl h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="3months">Last 3 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => setOrderHistoryFilters({ status: 'all', dateRange: 'all', searchTerm: '' })}
                        className="w-full border-ump-navy/20 hover:bg-ump-navy/5 rounded-xl h-10"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order History List */}
            {orderHistory.length === 0 ? (
              <div className="glass-card text-center py-16 rounded-2xl shadow-premium">
                <div className="gradient-accent w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-luxury">
                  <Clock className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-luxury mb-3">No orders yet</h3>
                <p className="text-ump-gray text-lg">Your order history will appear here</p>
                <p className="text-sm text-ump-gray-500 mt-2">Start your culinary journey! 🍽️</p>
              </div>
            ) : filteredOrderHistory.length === 0 ? (
              <div className="glass-card text-center py-16 rounded-2xl shadow-premium">
                <div className="w-16 h-16 rounded-2xl bg-ump-gray/10 mx-auto mb-6 flex items-center justify-center">
                  <Search className="w-8 h-8 text-ump-gray" />
                </div>
                <h3 className="text-2xl font-bold text-luxury mb-3">No orders found</h3>
                <p className="text-ump-gray text-lg">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrderHistory.map((order) => (
                  <Card key={order.id} className="glass-effect shadow-modern rounded-modern-lg hover-lift transition-premium border-ump-blue/20">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-ump-navy text-lg">
                              Order #{order.id.slice(-6)}
                            </h4>
                            <Badge className={`${getOrderStatusColor(order.status)} shadow-sm`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-ump-gray flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.orderDate).toLocaleDateString('en-ZA', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })} at {new Date(order.orderDate).toLocaleTimeString('en-ZA', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="text-sm text-ump-gray mt-1 capitalize">
                            Order Type: {order.orderType.replace('-', ' ')}
                            {order.tableNumber && ` • Table ${order.tableNumber}`}
                          </p>
                        </div>

                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-ump-green mb-3">
                            R{order.totalAmount?.toFixed(2) ?? '0.00'}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewOrderDetails(order)}
                              className="border-ump-blue/20 hover:bg-ump-blue/5 rounded-xl"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Details
                            </Button>
                            {order.paymentStatus === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentOrder(order)
                                  setShowPayment(true)
                                }}
                                className="border-green-500/20 hover:bg-green-500/5 text-green-600 rounded-xl"
                              >
                                <CreditCard className="w-4 h-4 mr-1" />
                                Pay Now
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reorderItems(order)}
                              className="border-ump-orange/20 hover:bg-ump-orange/5 rounded-xl"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reorder
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {order.items.slice(0, 4).map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm bg-ump-gray-50 p-3 rounded-xl">
                              <div className="flex-1">
                                <span className="font-medium text-ump-navy">{item.quantity}x {item.name}</span>
                                {item.selectedExtras && item.selectedExtras.length > 0 && (
                                  <div className="text-xs text-ump-orange mt-1">
                                    + {item.selectedExtras.join(', ')}
                                  </div>
                                )}
                              </div>
                              <span className="font-semibold text-ump-green">R{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {order.items.length > 4 && (
                          <div className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewOrderDetails(order)}
                              className="text-ump-blue hover:bg-ump-blue/5 rounded-xl"
                            >
                              +{order.items.length - 4} more items
                            </Button>
                          </div>
                        )}

                        {order.specialInstructions && (
                          <div className="mt-3 p-3 bg-ump-orange/5 border border-ump-orange/20 rounded-xl">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-ump-orange mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-ump-orange">Special Instructions</p>
                                <p className="text-sm text-ump-gray-700 mt-1">{order.specialInstructions}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Payment Status */}
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Payment Status</span>
                            </div>
                            <Badge
                              className={`${
                                order.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : order.paymentStatus === 'failed'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              }`}
                            >
                              {order.paymentStatus === 'paid' ? 'Paid' :
                               order.paymentStatus === 'failed' ? 'Failed' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Decorative Dividers */}
      <div className="flex justify-center space-x-4 py-6">
        <div className="w-16 h-0.5 bg-ump-gold"></div>
        <div className="w-16 h-0.5 bg-ump-navy"></div>
        <div className="w-16 h-0.5 bg-ump-orange"></div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-4 text-center text-sm ${isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
        <p className={`mb-1 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          🍽️ Egumeni Eats – Tfokomala Hotel Ordering System
        </p>
        <p>
          Bringing convenience and quality dining to the University of Mpumalanga community.
        </p>
        <p className="mt-1">
          📞 Support: <a href="mailto:support@egumenieats.co.za" className={`hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>support@egumenieats.co.za</a> |
          📍 Location: Tfokomala Hotel & Conference Centre, Mbombela Campus
        </p>
        <p className={`mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          © {new Date().getFullYear()} Egumeni Eats. All rights reserved.
        </p>
      </footer>

      {/* Order Details Modal */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-ump-blue/10">
                <Clock className="w-5 h-5 text-ump-blue" />
              </div>
              Order Details #{selectedOrder?.id.slice(-6)}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="flex items-start justify-between p-4 bg-ump-gray-50 rounded-xl">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className={`${getOrderStatusColor(selectedOrder.status)} shadow-sm`}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </Badge>
                    <span className="text-sm text-ump-gray capitalize">
                      {selectedOrder.orderType.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-ump-gray">
                    {new Date(selectedOrder.orderDate).toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {selectedOrder.tableNumber && (
                    <p className="text-sm text-ump-gray mt-1">Table: {selectedOrder.tableNumber}</p>
                  )}
                  {selectedOrder.deliveryAddress && (
                    <p className="text-sm text-ump-gray mt-1 flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {selectedOrder.deliveryAddress}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-ump-green">
                    R{selectedOrder.totalAmount?.toFixed(2) ?? '0.00'}
                  </div>
                  <p className="text-sm text-ump-gray mt-1">
                    {selectedOrder.estimatedTime} min estimated
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold text-ump-navy mb-4">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between p-4 border border-ump-gray-200 rounded-xl bg-white">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-ump-navy">{item.quantity}x</span>
                          <span className="font-medium text-ump-gray-800">{item.name}</span>
                        </div>
                        {item.selectedExtras && item.selectedExtras.length > 0 && (
                          <div className="ml-8 p-2 bg-ump-orange/5 border border-ump-orange/20 rounded-lg">
                            <p className="text-sm font-medium text-ump-orange mb-1">Extras:</p>
                            <p className="text-sm text-ump-gray-700">{item.selectedExtras.join(', ')}</p>
                          </div>
                        )}
                        {item.specialInstructions && (
                          <div className="ml-8 p-2 bg-ump-blue/5 border border-ump-blue/20 rounded-lg">
                            <p className="text-sm font-medium text-ump-blue mb-1">Special Instructions:</p>
                            <p className="text-sm text-ump-gray-700">{item.specialInstructions}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-ump-green">
                          R{(item.price * item.quantity).toFixed(2)}
                        </div>
                        <div className="text-sm text-ump-gray">
                          R{item.price.toFixed(2)} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-ump-gray-200 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-ump-navy">Order Total</span>
                  <span className="text-2xl font-bold text-ump-green">
                    R{selectedOrder.totalAmount?.toFixed(2) ?? '0.00'}
                  </span>
                </div>

                {selectedOrder.specialInstructions && (
                  <div className="p-3 bg-ump-orange/5 border border-ump-orange/20 rounded-xl mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-ump-orange mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-ump-orange">Special Instructions</p>
                        <p className="text-sm text-ump-gray-700 mt-1">{selectedOrder.specialInstructions}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => reorderItems(selectedOrder)}
                    className="flex-1 bg-ump-orange hover:bg-ump-orange/90"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reorder This Order
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOrderDetails(false)}
                    className="flex-1 border-ump-gray-200 hover:bg-ump-gray-50"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
