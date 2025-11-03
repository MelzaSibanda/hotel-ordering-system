import React, { useState, useEffect } from 'react'
import { db } from '../utils/firebase/config'
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { toast } from 'sonner'
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Users,
  ShoppingCart,
  Package,
  Clock,
  Sparkles
} from 'lucide-react'

interface DataStatus {
  dataStatus: string
  timestamp: string
  counts: {
    menuItems: number
    inventoryItems: number
    recipes: number
    orders: number
    userProfiles: number
    shifts: number
  }
  menuCategories: string[]
  recentOrders: Array<{
    id: string
    status: string
    paymentStatus: string
    totalAmount: number
    itemCount: number
    createdAt: string
    customerName: string
  }>
  systemInfo: {
    database: string
    dataType: string
    environment: string
  }
}

export default function DataVerificationPanel() {
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null)
  const [loading, setLoading] = useState(false)


  const loadDataStatus = async () => {
    setLoading(true)
    try {
      // Fetch counts from Firestore
      const [menuSnap, invSnap, recipeSnap, orderSnap, userSnap, shiftSnap] = await Promise.all([
        getDocs(collection(db, 'menu')),
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'recipes')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'shifts')),
      ])

      // Extract categories from menu
      const menuCategories = Array.from(
        new Set(menuSnap.docs.map((doc) => doc.data().category).filter(Boolean))
      ) as string[]

      // Fetch last 5 orders
      const recentOrdersSnap = await getDocs(
        query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5))
      )
      const recentOrders = recentOrdersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[]

      const normalizedResponse: DataStatus = {
        dataStatus: 'success',
        timestamp: new Date().toISOString(),
        counts: {
          menuItems: menuSnap.size,
          inventoryItems: invSnap.size,
          recipes: recipeSnap.size,
          orders: orderSnap.size,
          userProfiles: userSnap.size,
          shifts: shiftSnap.size,
        },
        menuCategories,
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          status: order.status || 'unknown',
          paymentStatus: order.paymentStatus || 'unpaid',
          totalAmount: order.totalAmount || 0,
          itemCount: order.items ? order.items.length : 0,
          createdAt: order.createdAt?.toDate
            ? order.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          customerName: order.customerName || 'N/A',
        })),
        systemInfo: {
          database: 'Firestore',
          dataType: 'persistent',
          environment: 'production',
        },
      }

      setDataStatus(normalizedResponse)
      console.log('📊 Data status loaded:', normalizedResponse)
    } catch (error) {
      console.error('Failed to load data status:', error)
      toast.error('Failed to load data status')
      setDataStatus({
        dataStatus: 'error',
        timestamp: new Date().toISOString(),
        counts: {
          menuItems: 0,
          inventoryItems: 0,
          recipes: 0,
          orders: 0,
          userProfiles: 0,
          shifts: 0,
        },
        menuCategories: [],
        recentOrders: [],
        systemInfo: {
          database: 'Firestore',
          dataType: 'persistent',
          environment: 'production',
        },
      })
    } finally {
      setLoading(false)
    }
  }



  useEffect(() => {
    loadDataStatus()
  }, [])

  if (loading && !dataStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-ump-orange" />
            <span className="ml-2">Loading data status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-ump-navy" />
            System Data Status
          </CardTitle>
          <CardDescription>
            Real-time status of your Egumeni Eats database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataStatus && (
            <div className="space-y-6">
              {/* System Info */}
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>✅ Real Firestore Data Active</strong>
                  <br />
                  The app is using actual Firestore data. All operations are live.
                </AlertDescription>
              </Alert>

              {/* Data Counts */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-ump-orange mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.menuItems || 0}</div>
                  <div className="text-sm text-ump-gray">Menu Items</div>
                </div>
                
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <Package className="w-6 h-6 text-ump-green mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.inventoryItems || 0}</div>
                  <div className="text-sm text-ump-gray">Inventory Items</div>
                </div>
                
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <BarChart3 className="w-6 h-6 text-ump-navy mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.orders || 0}</div>
                  <div className="text-sm text-ump-gray">Total Orders</div>
                </div>
                
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <Users className="w-6 h-6 text-ump-red mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.userProfiles || 0}</div>
                  <div className="text-sm text-ump-gray">User Profiles</div>
                </div>
                
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <Clock className="w-6 h-6 text-ump-orange mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.shifts || 0}</div>
                  <div className="text-sm text-ump-gray">Shifts</div>
                </div>
                
                <div className="text-center p-4 bg-ump-light-gray rounded-lg">
                  <Sparkles className="w-6 h-6 text-ump-green mx-auto mb-2" />
                  <div className="text-2xl font-bold text-ump-navy">{dataStatus.counts?.recipes || 0}</div>
                  <div className="text-sm text-ump-gray">Recipes</div>
                </div>
              </div>

              {/* Menu Categories */}
              {dataStatus.menuCategories && dataStatus.menuCategories.length > 0 && (
                <div>
                  <h4 className="font-medium text-ump-navy mb-2">Menu Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {dataStatus.menuCategories.map((category) => (
                      <Badge key={category} variant="outline" className="capitalize">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              {dataStatus.recentOrders && dataStatus.recentOrders.length > 0 && (
                <div>
                  <h4 className="font-medium text-ump-navy mb-2">Recent Orders (Real Data)</h4>
                  <div className="space-y-2">
                    {dataStatus.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-sm text-ump-gray">
                            {order.itemCount} items • R{order.totalAmount?.toFixed(2) ?? '0.00'}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={order.status === 'completed' ? 'default' : 'outline'}
                            className={order.status === 'completed' ? 'bg-ump-green' : ''}
                          >
                            {order.status}
                          </Badge>
                          <div className="text-xs text-ump-gray mt-1">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button 
                  onClick={loadDataStatus} 
                  disabled={loading}
                  variant="outline"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
                

              </div>

              {/* Warning for empty system */}
              {(dataStatus.counts?.menuItems || 0) === 0 && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>No menu items found.</strong> Add menu items through the admin panel to get started.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}