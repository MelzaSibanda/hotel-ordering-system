import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { toast } from 'sonner'
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore'
import { db } from '../utils/firebase/config'
import { saveAs } from 'file-saver'
import { utils, write } from 'xlsx'
import { getSalesByCashier, getCashierSales, Sale } from '../utils/firebase/sales'
import {
  DollarSign,
  ShoppingCart,
  Calculator,
  FileText,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  Home,
  Plus,
  Minus,
  Trash2,
  LogOut
} from 'lucide-react'
import egumeniLogo from '../assets/logo.png'

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description: string
  isAvailable: boolean
}

interface CartItem {
  id: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  total: number
  specialInstructions?: string
}

interface Shift {
  id: string
  date: string
  shiftNumber: number
  openingFloat: number
  expectedCash: number
  actualCash?: number
  cashVariance?: number
  status: 'open' | 'pending_approval' | 'closed'
}

interface Order {
  id: string
  orderNumber: string
  customerInfo: {
    name: string
    phone?: string
    roomNumber?: string
    tableNumber?: string
  }
  items: CartItem[]
  subtotal: number
  tax: number
  total: number
  orderType: 'dine_in' | 'takeaway' | 'room_service'
  paymentMethod: 'cash' | 'card' | 'room_charge' | 'mobile'
  status: string
  createdAt: string
}

export default function CashierDashboard() {
  const { user, profile, logout } = useAuth()
  const [menu, setMenu] = useState<{ [category: string]: MenuItem[] }>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'room_service'>('dine_in')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'room_charge' | 'mobile'>('cash')
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    roomNumber: '',
    tableNumber: ''
  })
  const [isOpeningShift, setIsOpeningShift] = useState(false)
  const [openingFloat, setOpeningFloat] = useState('100')
  const [showCashUp, setShowCashUp] = useState(false)
  const [denominations, setDenominations] = useState({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0,
    '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0, '0.05': 0
  })
  const [loading, setLoading] = useState(false)
  const [shiftSales, setShiftSales] = useState<number>(0)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null)
  const [salesData, setSalesData] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [cashierSales, setCashierSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [error, setError] = useState("")

  // Fetch menu on component mount
  useEffect(() => {
    fetchMenu()
    fetchCurrentShift()
    fetchSales()
  }, [])

  // Fetch cashier sales when user or shift changes
  useEffect(() => {
    fetchCashierSales()
  }, [user, currentShift])

  const fetchSales = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'sales'))
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setSales(data)
    } catch (error) {
      console.error('Error fetching sales:', error)
    }
  }

  const fetchCashierSales = async () => {
    if (!user?.id || !currentShift?.id) return
    setLoadingSales(true)
    setError("")

    try {
      const sales = await getCashierSales(user.id, currentShift.id)
      setCashierSales(sales)
    } catch (err) {
      console.error('Error fetching cashier sales:', err)
      setError("Failed to load sales history.")
    } finally {
      setLoadingSales(false)
    }
  }

  const fetchMenu = async () => {
    try {
      const data = await api.request('/menu')
      setMenu(data.menu || {})
    } catch (error) {
      console.error('Error fetching menu:', error)
      toast.error('Failed to load menu')
    }
  }

  const fetchCurrentShift = async () => {
    try {
      const data = await api.request('/pos/shift/current')
      setCurrentShift(data.shift)
    } catch (error) {
      console.error('Error fetching current shift:', error)
    }
  }

  const openShift = async () => {
    if (!openingFloat || parseFloat(openingFloat) < 0) {
      toast.error('Please enter a valid opening float amount')
      return
    }

    setLoading(true)
    try {
      const data = await api.request('/pos/shift/open', {
        method: 'POST',
        body: JSON.stringify({
          openingFloat: parseFloat(openingFloat)
        })
      })

      if (!data.shift) {
        throw new Error('Invalid shift data returned from server')
      }

      setCurrentShift(data.shift)
      setShiftStartTime(new Date())
      setShiftSales(0)
      setOrderCount(0)
      setIsOpeningShift(false)
      toast.success('Shift opened successfully')
    } catch (error) {
      console.error('Error opening shift:', error)
      toast.error('Failed to open shift')
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (menuItem: MenuItem) => {
    const existingItem = cart.find(item => item.menuItemId === menuItem.id)
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.menuItemId === menuItem.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ))
    } else {
      const cartItem: CartItem = {
        id: crypto.randomUUID(),
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        total: menuItem.price
      }
      setCart([...cart, cartItem])
    }
  }

  const updateCartItemQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.id !== cartItemId))
    } else {
      setCart(cart.map(item => 
        item.id === cartItemId 
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ))
    }
  }

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId))
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0)
    const tax = subtotal * 0.15 // 15% VAT
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const processOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to cart')
      return
    }

    if (!currentShift || currentShift.status !== 'open') {
      toast.error('No active shift. Please open a shift first.')
      return
    }

    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name')
      return
    }

    setLoading(true)
    try {
      const { subtotal, tax, total } = calculateTotals()

      const orderData = {
        customerInfo,
        items: cart.map(item => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total,
          specialInstructions: item.specialInstructions,
          status: 'pending'
        })),
        subtotal,
        tax,
        total,
        orderType,
        paymentMethod,
        paymentStatus: 'completed', // Assuming cash/card payments are processed immediately
        status: 'pending'
      }

      const data = await api.request('/pos/order/create', {
        method: 'POST',
        body: JSON.stringify(orderData)
      })

      if (data.success) {
        toast.success(`Order ${data.order.orderNumber} created successfully`)

        // Record the sale
        recordSale(total)

        // Store sale in Firebase
        await recordSaleInFirebase(data.order)

        // Refresh sales history to show the new sale
        await fetchCashierSales()

        // Add to sales data for reporting
        const newSales = cart.map(item => ({
          orderId: data.order.orderNumber,
          itemName: item.name,
          quantity: item.quantity,
          total: item.total,
          timestamp: { seconds: Math.floor(Date.now() / 1000) }
        }))
        setSalesData(prev => [...prev, ...newSales])

        // Clear cart and form
        setCart([])
        setCustomerInfo({ name: '', phone: '', roomNumber: '', tableNumber: '' })

        // Print receipt (in a real POS system, this would trigger actual printing)
        printReceipt(data.order)
      } else {
        toast.error(data.error || 'Failed to create order')
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((error: string) => toast.error(error))
        }
      }
    } catch (error) {
      console.error('Error processing order:', error)
      toast.error('Failed to process order')
    } finally {
      setLoading(false)
    }
  }

  const printReceipt = (order: Order) => {
    // In a real implementation, this would send to a thermal printer
    console.log('Printing receipt for order:', order.orderNumber)
    toast.success('Receipt printed successfully')
  }

  const recordSale = (amount: number) => {
    setShiftSales((prev) => prev + amount)
    setOrderCount((prev) => prev + 1)
  }

  const recordSaleInFirebase = async (order: any) => {
    try {
      await addDoc(collection(db, 'sales'), {
        cashierId: user?.id,
        cashierName: profile?.name,
        customerName: customerInfo.name,
        customerEmail: customerInfo.phone || '', // Using phone as email placeholder
        shiftId: currentShift?.id,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        totalPrice: order.total,
        timestamp: serverTimestamp()
      })
      console.log('✅ Sale recorded successfully.')
    } catch (error) {
      console.error('❌ Error saving sale:', error)
    }
  }

  const closeShift = async () => {
    if (!currentShift) {
      toast.error('No active shift')
      return
    }

    setLoading(true)
    try {
      await api.request('/pos/shift/close', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: currentShift.id,
          totalSales: shiftSales,
          totalOrders: orderCount
        })
      })

      toast.success('Shift closed successfully')
      setCurrentShift(null)
      setShiftStartTime(null)
      setShiftSales(0)
      setOrderCount(0)
    } catch (error) {
      console.error('Error closing shift:', error)
      toast.error('Failed to close shift')
    } finally {
      setLoading(false)
    }
  }

  const performCashUp = async (type: 'mid_shift' | 'end_shift') => {
    if (!currentShift) {
      toast.error('No active shift')
      return
    }

    setLoading(true)
    try {
      const data = await api.request('/pos/shift/cash-up', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: currentShift.id,
          denominations,
          type
        })
      })

      toast.success('Cash up completed successfully')
      setShowCashUp(false)
      fetchCurrentShift() // Refresh shift data

      if (type === 'end_shift') {
        setCurrentShift(null) // Clear current shift
      }
    } catch (error) {
      console.error('Error performing cash up:', error)
      toast.error('Failed to perform cash up')
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, tax, total } = calculateTotals()

  // Generate CSV report of today's sales
  const generateReport = () => {
    if (!salesData || salesData.length === 0) {
      toast.error("No sales data available for today.");
      return;
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Order ID,Item,Quantity,Total Price,Date"]
        .concat(
          salesData.map(
            (sale: any) =>
              `${sale.orderId},${sale.itemName},${sale.quantity},${sale.total.toFixed(2)},${new Date(
                sale.timestamp.seconds * 1000
              ).toLocaleString()}`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EgumeniEats_Sales_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("✅ Sales report generated successfully!");
  };

  // Generate XLSX report of cashier's sales
  const generateSalesReport = async () => {
    setLoadingReport(true)
    try {
      const rows = cashierSales.map(sale => ({
        Cashier: sale.cashierName,
        Customer: sale.customerName,
        Email: sale.customerEmail,
        'Items Ordered': sale.items.map((item: any) => `${item.name} (x${item.quantity})`).join(', '),
        'Total Price (R)': sale.totalPrice.toFixed(2),
        Date: new Date(sale.timestamp.seconds * 1000).toLocaleString(),
      }))

      const worksheet = utils.json_to_sheet(rows)
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, worksheet, 'Sales Report')

      const buffer = write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      saveAs(blob, `Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success("✅ Sales report generated successfully!");
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error("Failed to generate sales report.");
    }
    setLoadingReport(false)
  };

  // Show shift opening dialog if no current shift
  if (!currentShift && !isOpeningShift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center">Open Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="openingFloat">Opening Float (R)</Label>
              <Input
                id="openingFloat"
                type="number"
                step="0.01"
                min="0"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <Button 
              onClick={openShift} 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Opening...' : 'Open Shift'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={egumeniLogo}
              alt="Egumeni Eats Logo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-2xl">Cashier POS</h1>
              <p className="text-gray-600">
                Shift {currentShift?.shiftNumber} • {profile?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              Float: R{currentShift?.expectedCash.toFixed(2)}
            </Badge>
            <Button variant="outline" onClick={closeShift} disabled={loading}>
              Close Shift
            </Button>
            <Dialog open={showCashUp} onOpenChange={setShowCashUp}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Calculator className="w-4 h-4 mr-2" />
                  Cash Up
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cash Up</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {Object.entries(denominations).map(([denom, count]) => (
                      <div key={denom} className="flex items-center gap-2">
                        <span className="w-12">R{denom}:</span>
                        <Input
                          type="number"
                          min="0"
                          value={count}
                          onChange={(e) => setDenominations({
                            ...denominations,
                            [denom]: parseInt(e.target.value) || 0
                          })}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t">
                    <p>
                      Total Counted: R{Object.entries(denominations)
                        .reduce((sum, [denom, count]) => sum + (parseFloat(denom) * count), 0)
                        .toFixed(2)}
                    </p>
                    <p>
                      Expected: R{currentShift?.expectedCash.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => performCashUp('mid_shift')}
                      variant="outline"
                      className="flex-1"
                    >
                      Mid-Shift
                    </Button>
                    <Button 
                      onClick={() => performCashUp('end_shift')}
                      className="flex-1"
                    >
                      End Shift
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Menu Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Menu</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={Object.keys(menu)[0]} className="w-full">
                <TabsList className="grid grid-cols-4 w-full mb-4">
                  {Object.keys(menu).map(category => (
                    <TabsTrigger key={category} value={category} className="capitalize">
                      {category.replace('_', ' ')}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(menu).map(([category, items]) => (
                  <TabsContent key={category} value={category} className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {items.map(item => (
                        <Card 
                          key={item.id} 
                          className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                            !item.isAvailable ? 'opacity-50' : ''
                          }`}
                          onClick={() => item.isAvailable && addToCart(item)}
                        >
                          <CardContent className="p-4">
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold">R{item.price.toFixed(2)}</span>
                              {!item.isAvailable && (
                                <Badge variant="destructive">Out of Stock</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Cart and Order Section */}
        <div className="space-y-6">
          {/* Order Type and Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Order Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    variant={orderType === 'dine_in' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderType('dine_in')}
                  >
                    Dine In
                  </Button>
                  <Button
                    variant={orderType === 'takeaway' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderType('takeaway')}
                  >
                    Takeaway
                  </Button>
                  <Button
                    variant={orderType === 'room_service' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOrderType('room_service')}
                  >
                    Room Service
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  placeholder="Customer phone"
                />
              </div>

              {orderType === 'room_service' && (
                <div>
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Input
                    id="roomNumber"
                    value={customerInfo.roomNumber}
                    onChange={(e) => setCustomerInfo({...customerInfo, roomNumber: e.target.value})}
                    placeholder="Room number"
                  />
                </div>
              )}

              {orderType === 'dine_in' && (
                <div>
                  <Label htmlFor="tableNumber">Table Number</Label>
                  <Input
                    id="tableNumber"
                    value={customerInfo.tableNumber}
                    onChange={(e) => setCustomerInfo({...customerInfo, tableNumber: e.target.value})}
                    placeholder="Table number"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Cart ({cart.length} items)
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No items in cart</p>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">R{item.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <span className="w-16 text-right">R{item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment and Totals */}
          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Cash
                    </Button>
                    <Button
                      variant={paymentMethod === 'card' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Card
                    </Button>
                    <Button
                      variant={paymentMethod === 'room_charge' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod('room_charge')}
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Room
                    </Button>
                    <Button
                      variant={paymentMethod === 'mobile' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod('mobile')}
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      Mobile
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (15%):</span>
                    <span>R{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>R{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={processOrder}
                  className="w-full"
                  size="lg"
                  disabled={loading || cart.length === 0}
                >
                  {loading ? 'Processing...' : `Process Order - R${total.toFixed(2)}`}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Sales History Card */}
          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">All sales you made during your shift</p>

              {loadingSales ? (
                <div className="text-center text-gray-500">Loading sales...</div>
              ) : error ? (
                <div className="text-red-500 text-center">{error}</div>
              ) : cashierSales.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No sales recorded yet.</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {cashierSales.map((sale) => (
                    <Card key={sale.id} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {sale.customerName} ({sale.customerEmail})
                            </h4>
                            <p className="text-sm text-gray-500">
                              {sale.timestamp?.toDate().toLocaleDateString()} at {sale.timestamp?.toDate().toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-green-600">
                              R{sale.totalPrice?.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {sale.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span>R{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sales Report Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-ump-navy text-white shadow-lg z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-3 text-sm md:text-base">
          <div>
            <strong>Shift Sales:</strong> R{shiftSales.toFixed(2)}
          </div>
          <div>
            <strong>Orders:</strong> {orderCount}
          </div>
          <div>
            <strong>Started:</strong> {shiftStartTime ? shiftStartTime.toLocaleTimeString() : '--:--'}
          </div>
        </div>

        {/* Generate Report Button */}
        <div className="text-center py-2 border-t border-white/20">
          <button
            onClick={generateReport}
            className="bg-ump-orange hover:bg-ump-orange/90 text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg transition-all duration-200 mr-4"
          >
            📊 Generate CSV Report
          </button>
          <button
            onClick={generateSalesReport}
            disabled={loadingReport}
            className="bg-ump-orange hover:bg-ump-orange/90 text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            {loadingReport ? 'Generating...' : '📊 Generate XLSX Report'}
          </button>
        </div>
      </div>


    </div>
  )
}
