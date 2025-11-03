import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { 
  Truck,
  Package,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  MapPin,
  Clock,
  Phone,
  User,
  Navigation
} from 'lucide-react'
const egumeniLogo = "/src/assets/logo.png"

interface Order {
  id: string
  customerId: string
  customerInfo: any
  items: any[]
  totalAmount: number
  status: string
  estimatedTime: number
  createdAt: string
  readyAt: string | null
  deliveredAt: string | null
  deliveredBy: string | null
  assignedTo: string | null
  assignedAt: string | null
  specialInstructions: string
  orderType: string
}

interface DeliveryAssignment {
  id: string
  orderId: string
  assignedTo: string
  assignedBy: string
  assignedAt: string
  status: 'assigned' | 'en_route' | 'delivered'
  estimatedDeliveryTime: string
  actualDeliveryTime?: string
}

export default function DeliveryDashboard() {
  const { profile, logout } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const formatCurrency = (amount?: number) => (amount ?? 0).toFixed(2)

  const loadOrders = async () => {
    try {
      const data = await api.request('/orders')
      // Delivery staff see ready and out_for_delivery orders
      const deliveryOrders = data.orders.filter((order: Order) => 
        ['ready', 'out_for_delivery'].includes(order.status)
      )
      setOrders(deliveryOrders)
    } catch (error) {
      console.error('Failed to load orders:', error)
      setError('Failed to load orders')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await loadOrders()
      setLoading(false)
    }
    loadData()
  }, [])

  // Auto-refresh orders every 20 seconds
  useEffect(() => {
    const interval = setInterval(loadOrders, 20000)
    return () => clearInterval(interval)
  }, [])

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.request(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })
      
      await loadOrders()
      const statusMessages = {
        'out_for_delivery': 'Order picked up for delivery',
        'delivered': 'Order marked as delivered'
      }
      setSuccess(statusMessages[newStatus as keyof typeof statusMessages] || 'Order updated')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to update order status:', error)
      setError('Failed to update order status')
    }
  }

  const pickupOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'out_for_delivery')
  }

  const markDelivered = (orderId: string) => {
    updateOrderStatus(orderId, 'delivered')
  }

  const getTimeSinceReady = (readyAt: string | null) => {
    if (!readyAt) return null
    
    const now = new Date()
    const ready = new Date(readyAt)
    const diffMinutes = Math.floor((now.getTime() - ready.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just ready'
    if (diffMinutes === 1) return '1 minute ago'
    return `${diffMinutes} minutes ago`
  }

  const getDeliveryTime = (order: Order) => {
    const now = new Date()
    const created = new Date(order.createdAt)
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just ordered'
    if (diffMinutes === 1) return '1 minute ago'
    return `${diffMinutes} minutes ago`
  }

  const getUrgencyLevel = (order: Order) => {
    if (!order.readyAt) return 'normal'
    
    const now = new Date()
    const ready = new Date(order.readyAt)
    const waitingMinutes = (now.getTime() - ready.getTime()) / (1000 * 60)
    
    if (waitingMinutes > 15) return 'high'
    if (waitingMinutes > 8) return 'medium'
    return 'normal'
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'border-red-300 bg-red-50'
      case 'medium': return 'border-yellow-300 bg-yellow-50'
      default: return 'border-gray-200 bg-white'
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'high': return <Badge className="bg-red-100 text-red-800">Urgent</Badge>
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-800">Priority</Badge>
      default: return null
    }
  }

  const readyOrders = orders.filter(order => order.status === 'ready')
  const outForDeliveryOrders = orders.filter(order => order.status === 'out_for_delivery')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Truck className="w-8 h-8 animate-bounce mx-auto mb-4" />
          <p>Loading delivery orders...</p>
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
              <h1 className="text-xl font-bold">Delivery Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadOrders}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <span className="text-sm text-gray-600">{profile?.name}</span>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready for Pickup</CardTitle>
              <Package className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{readyOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Waiting for pickup
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out for Delivery</CardTitle>
              <Truck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{outForDeliveryOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently delivering
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <Navigation className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
              <p className="text-xs text-muted-foreground">
                Orders to handle
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ready for Pickup */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-500" />
              Ready for Pickup ({readyOrders.length})
            </h2>
            
            {readyOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No orders ready</p>
                  <p className="text-sm text-gray-400">Check back for new deliveries</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {readyOrders
                  .sort((a, b) => new Date(a.readyAt || a.createdAt).getTime() - new Date(b.readyAt || b.createdAt).getTime())
                  .map(order => {
                    const urgency = getUrgencyLevel(order)
                    return (
                      <Card key={order.id} className={`border-2 ${getUrgencyColor(urgency)}`}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                Order #{order.id.slice(-8)}
                                {getUrgencyBadge(urgency)}
                              </CardTitle>
                              <CardDescription>
                                Ready {getTimeSinceReady(order.readyAt)}
                              </CardDescription>
                            </div>
                            <Button
                              onClick={() => pickupOrder(order.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Package className="w-4 h-4 mr-2" />
                              Pick Up
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Customer Info */}
                            <div className="bg-gray-50 p-3 rounded border">
                              <h4 className="font-medium mb-2 flex items-center">
                                <User className="w-4 h-4 mr-2" />
                                Customer Details
                              </h4>
                              <div className="text-sm space-y-1">
                                <div><strong>Name:</strong> {order.customerInfo?.name || 'Guest'}</div>
                                {order.customerInfo?.phone && (
                                  <div className="flex items-center">
                                    <Phone className="w-4 h-4 mr-1" />
                                    <strong>Phone:</strong> {order.customerInfo.phone}
                                  </div>
                                )}
                                <div><strong>Email:</strong> {order.customerInfo?.email || 'N/A'}</div>
                              </div>
                            </div>

                            {/* Order Items */}
                            <div>
                              <h4 className="font-medium mb-2">Order Items:</h4>
                              <div className="space-y-1">
                                {order.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                    <span>{item.quantity}x {item.name}</span>
                                    <span className="text-gray-600">R{formatCurrency((item.price ?? 0) * (item.quantity ?? 0))}</span>
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
                                <Clock className="w-4 h-4 inline mr-1" />
                                Ordered {getDeliveryTime(order)}
                              </span>
                              <span className="font-bold text-lg">R{formatCurrency(order.totalAmount)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Out for Delivery */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2 text-purple-500" />
              Out for Delivery ({outForDeliveryOrders.length})
            </h2>
            
            {outForDeliveryOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No active deliveries</p>
                  <p className="text-sm text-gray-400">Pick up orders to start delivering</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {outForDeliveryOrders
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map(order => (
                    <Card key={order.id} className="border-2 border-purple-300 bg-purple-50">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              Order #{order.id.slice(-8)}
                            </CardTitle>
                            <CardDescription>
                              Out for delivery | {getDeliveryTime(order)}
                            </CardDescription>
                          </div>
                          <Button
                            onClick={() => markDelivered(order.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Delivered
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Customer Info */}
                          <div className="bg-white p-3 rounded border">
                            <h4 className="font-medium mb-2 flex items-center">
                              <MapPin className="w-4 h-4 mr-2 text-purple-600" />
                              Delivery To
                            </h4>
                            <div className="text-sm space-y-1">
                              <div><strong>Name:</strong> {order.customerInfo?.name || 'Guest'}</div>
                              {order.customerInfo?.phone && (
                                <div className="flex items-center">
                                  <Phone className="w-4 h-4 mr-1" />
                                  <a
                                    href={`tel:${order.customerInfo.phone}`}
                                    className="text-purple-600 hover:underline"
                                  >
                                    {order.customerInfo.phone}
                                  </a>
                                </div>
                              )}
                              <div><strong>Email:</strong> {order.customerInfo?.email || 'N/A'}</div>
                            </div>
                          </div>

                          {/* Order Summary */}
                          <div>
                            <h4 className="font-medium mb-2">Order Summary:</h4>
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Items: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                <span>Total: R{formatCurrency(order.totalAmount)}</span>
                              </div>
                              <div className="text-xs text-gray-600">
                                {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                              </div>
                            </div>
                          </div>
                          
                          {order.specialInstructions && (
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                              <h5 className="font-medium text-yellow-800 mb-1">Special Instructions:</h5>
                              <p className="text-sm text-yellow-700">{order.specialInstructions}</p>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-3 border-t">
                            <Badge className="bg-purple-100 text-purple-800">
                              <Truck className="w-3 h-3 mr-1" />
                              In Transit
                            </Badge>
                            <span className="font-bold">R{formatCurrency(order.totalAmount)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </div>

        {orders.length === 0 && (
          <Card className="mt-8">
            <CardContent className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries</h3>
              <p className="text-gray-500">All orders are either being prepared or have been delivered.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}