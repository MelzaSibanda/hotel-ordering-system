import { Hono } from 'npm:hono'
import * as kv from './kv_store.tsx'
import OrderService from './order_service.tsx'
import InventoryService from './inventory_service.tsx'
import ShiftService from './shift_service.tsx'
// Temporarily disable reporting service to fix server startup
// import ReportingService from './reporting_service.tsx'

export function addPOSRoutes(app: Hono, verifyUser: any, getUserProfile: any) {

  // Check role authorization
  const checkRole = (allowedRoles: string[]) => {
    return async (profile: any) => {
      console.log('🔍 Role check - User profile:', JSON.stringify(profile, null, 2))
      console.log('🔍 Role check - Allowed roles:', allowedRoles)
      
      if (!profile) {
        console.error('❌ Role check failed: No profile provided')
        return { error: 'User profile not found', status: 403 }
      }
      
      if (!profile.role) {
        console.error('❌ Role check failed: No role in profile')
        return { error: 'User role not defined', status: 403 }
      }
      
      if (!allowedRoles.includes(profile.role)) {
        console.error(`❌ Role check failed: User role '${profile.role}' not in allowed roles [${allowedRoles.join(', ')}]`)
        return { error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${profile.role}`, status: 403 }
      }
      
      console.log(`✅ Role check passed: User role '${profile.role}' is authorized`)
      return { authorized: true }
    }
  }

  // SHIFT MANAGEMENT ROUTES
  
  // Open new shift (Cashier)
  app.post('/make-server-7657fe8e/pos/shift/open', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['cashier', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const { openingFloat, date } = await c.req.json()
      
      if (!openingFloat || openingFloat < 0) {
        return c.json({ error: 'Valid opening float required' }, 400)
      }

      const shift = await ShiftService.openShift(
        auth.user!.id,
        profile.name,
        parseFloat(openingFloat),
        date
      )

      return c.json({ shift })
    } catch (error) {
      console.error('Open shift error:', error)
      return c.json({ error: 'Failed to open shift' }, 500)
    }
  })

  // Get current shift
  app.get('/make-server-7657fe8e/pos/shift/current', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const shift = await ShiftService.getCurrentShift()
      return c.json({ shift })
    } catch (error) {
      console.error('Get current shift error:', error)
      return c.json({ error: 'Failed to get current shift' }, 500)
    }
  })

  // Perform cash up
  app.post('/make-server-7657fe8e/pos/shift/cash-up', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['cashier', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const { shiftId, denominations, type } = await c.req.json()
      
      if (!shiftId || !denominations || !type) {
        return c.json({ error: 'Shift ID, denominations, and type required' }, 400)
      }

      const cashUp = await ShiftService.performCashUp(
        shiftId,
        auth.user!.id,
        denominations,
        type
      )

      return c.json({ cashUp })
    } catch (error) {
      console.error('Cash up error:', error)
      return c.json({ error: 'Failed to perform cash up' }, 500)
    }
  })

  // Approve shift (Supervisor only)
  app.post('/make-server-7657fe8e/pos/shift/approve/:shiftId', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const shiftId = c.req.param('shiftId')
      const { notes } = await c.req.json()

      const success = await ShiftService.approveShift(
        shiftId,
        auth.user!.id,
        profile.name,
        notes
      )

      if (success) {
        return c.json({ message: 'Shift approved successfully' })
      } else {
        return c.json({ error: 'Failed to approve shift' }, 400)
      }
    } catch (error) {
      console.error('Approve shift error:', error)
      return c.json({ error: 'Failed to approve shift' }, 500)
    }
  })

  // Get shifts requiring approval
  app.get('/make-server-7657fe8e/pos/shift/pending-approval', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const shifts = await ShiftService.getShiftsRequiringApproval()
      return c.json({ shifts })
    } catch (error) {
      console.error('Get pending approvals error:', error)
      return c.json({ error: 'Failed to get pending approvals' }, 500)
    }
  })

  // ORDER MANAGEMENT ROUTES

  // Create POS order (Cashier)
  app.post('/make-server-7657fe8e/pos/order/create', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['cashier', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const orderData = await c.req.json()
      
      if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        return c.json({ error: 'Order must contain at least one item' }, 400)
      }

      // Add cashier info to order
      orderData.cashierId = auth.user!.id
      orderData.cashierName = profile.name

      const result = await OrderService.createOrder(orderData, auth.user!.id)
      
      return c.json(result)
    } catch (error) {
      console.error('Create POS order error:', error)
      return c.json({ error: 'Failed to create order' }, 500)
    }
  })

  // Get kitchen orders
  app.get('/make-server-7657fe8e/pos/order/kitchen', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const orders = await OrderService.getKitchenOrders()
      return c.json({ orders })
    } catch (error) {
      console.error('Get kitchen orders error:', error)
      return c.json({ error: 'Failed to get kitchen orders' }, 500)
    }
  })

  // Update order status (Kitchen/Delivery)
  app.put('/make-server-7657fe8e/pos/order/:orderId/status', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'delivery', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const orderId = c.req.param('orderId')
      const { status, notes } = await c.req.json()

      if (!status) {
        return c.json({ error: 'Status is required' }, 400)
      }

      const order = await OrderService.updateOrderStatus(
        orderId,
        status,
        profile.name,
        notes
      )

      if (order) {
        return c.json({ order })
      } else {
        return c.json({ error: 'Order not found' }, 404)
      }
    } catch (error) {
      console.error('Update order status error:', error)
      return c.json({ error: 'Failed to update order status' }, 500)
    }
  })

  // Void order (Supervisor only)
  app.post('/make-server-7657fe8e/pos/order/:orderId/void', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const orderId = c.req.param('orderId')
      const { reason, restoreStock = true } = await c.req.json()

      if (!reason) {
        return c.json({ error: 'Void reason is required' }, 400)
      }

      const result = await OrderService.voidOrder(
        orderId,
        profile.name,
        reason,
        restoreStock
      )

      return c.json(result)
    } catch (error) {
      console.error('Void order error:', error)
      return c.json({ error: 'Failed to void order' }, 500)
    }
  })

  // INVENTORY MANAGEMENT ROUTES

  // Get all inventory items
  app.get('/make-server-7657fe8e/pos/inventory', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor', 'kitchen', 'admin', 'cashier'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const items = await InventoryService.getAllItems()
      return c.json({ items })
    } catch (error) {
      console.error('Get inventory error:', error)
      return c.json({ error: 'Failed to get inventory' }, 500)
    }
  })

  // Create inventory item
  app.post('/make-server-7657fe8e/pos/inventory', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const itemData = await c.req.json()
      
      if (!itemData.name || !itemData.unit || itemData.currentStock === undefined) {
        return c.json({ error: 'Name, unit, and current stock are required' }, 400)
      }

      const item = await InventoryService.createItem(itemData)
      return c.json({ item })
    } catch (error) {
      console.error('Create inventory item error:', error)
      return c.json({ error: 'Failed to create inventory item' }, 500)
    }
  })

  // Update inventory item
  app.put('/make-server-7657fe8e/pos/inventory/:itemId', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const itemId = c.req.param('itemId')
      const updates = await c.req.json()

      const item = await InventoryService.updateItem(itemId, updates)
      
      if (item) {
        return c.json({ item })
      } else {
        return c.json({ error: 'Item not found' }, 404)
      }
    } catch (error) {
      console.error('Update inventory item error:', error)
      return c.json({ error: 'Failed to update inventory item' }, 500)
    }
  })

  // Receive stock
  app.post('/make-server-7657fe8e/pos/inventory/receive', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const receiptData = await c.req.json()
      receiptData.receivedBy = profile.name
      receiptData.receivedAt = new Date().toISOString()

      const receipt = await InventoryService.receiveStock(receiptData)
      return c.json({ receipt })
    } catch (error) {
      console.error('Receive stock error:', error)
      return c.json({ error: 'Failed to receive stock' }, 500)
    }
  })

  // Create stock issue (Kitchen request)
  app.post('/make-server-7657fe8e/pos/inventory/issue', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const issueData = await c.req.json()
      issueData.requestedBy = profile.name

      const issue = await InventoryService.createStockIssue(issueData)
      return c.json({ issue })
    } catch (error) {
      console.error('Create stock issue error:', error)
      return c.json({ error: 'Failed to create stock issue' }, 500)
    }
  })

  // Approve stock issue
  app.post('/make-server-7657fe8e/pos/inventory/issue/:issueId/approve', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const issueId = c.req.param('issueId')
      
      const success = await InventoryService.approveStockIssue(issueId, profile.name)
      
      if (success) {
        return c.json({ message: 'Stock issue approved successfully' })
      } else {
        return c.json({ error: 'Failed to approve stock issue' }, 400)
      }
    } catch (error) {
      console.error('Approve stock issue error:', error)
      return c.json({ error: 'Failed to approve stock issue' }, 500)
    }
  })

  // Get pending stock issues
  app.get('/make-server-7657fe8e/pos/inventory/issues/pending', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const issues = await InventoryService.getPendingStockIssues()
      return c.json({ issues })
    } catch (error) {
      console.error('Get pending stock issues error:', error)
      return c.json({ error: 'Failed to get pending stock issues' }, 500)
    }
  })

  // Get all inventory requests for kitchen staff
  app.get('/make-server-7657fe8e/pos/inventory/requests', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'stores', 'supervisor', 'admin'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const allRequests = await kv.getByPrefix('stock_issue:')
      const requests = allRequests
        .map(request => JSON.parse(request))
        .filter(request => 
          // Kitchen staff see only their own requests, stores/supervisors see all
          profile.role === 'kitchen' ? request.requestedBy === profile.name : true
        )
        .map(request => {
          // Add item details
          const enhancedRequest = { ...request }
          if (request.items && request.items.length > 0) {
            enhancedRequest.itemName = request.items[0].name
            enhancedRequest.quantity = request.items[0].quantity
            enhancedRequest.unit = 'units' // Default unit, could be enhanced
          }
          return enhancedRequest
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return c.json({ requests })
    } catch (error) {
      console.error('Get inventory requests error:', error)
      return c.json({ error: 'Failed to get inventory requests' }, 500)
    }
  })

  // Create inventory request (simplified for kitchen use)
  app.post('/make-server-7657fe8e/pos/inventory/request', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'stores', 'supervisor', 'admin'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const { inventoryId, quantity, purpose, notes } = await c.req.json()

      if (!inventoryId || !quantity) {
        return c.json({ error: 'Inventory ID and quantity are required' }, 400)
      }

      // Get inventory item details
      const inventoryItem = await InventoryService.getItem(inventoryId)
      if (!inventoryItem) {
        return c.json({ error: 'Inventory item not found' }, 404)
      }

      // Create stock issue request
      const issueData = {
        requestedBy: profile.name,
        items: [{
          inventoryId,
          name: inventoryItem.name,
          quantity: parseInt(quantity),
          unitCost: inventoryItem.unitCost || 0
        }],
        purpose: purpose || 'order',
        status: 'pending',
        notes
      }

      const issue = await InventoryService.createStockIssue(issueData)
      return c.json({ request: issue })
    } catch (error) {
      console.error('Create inventory request error:', error)
      return c.json({ error: 'Failed to create inventory request' }, 500)
    }
  })

  // Get low stock items
  app.get('/make-server-7657fe8e/pos/inventory/low-stock', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor', 'kitchen'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const items = await InventoryService.getLowStockItems()
      return c.json({ items })
    } catch (error) {
      console.error('Get low stock error:', error)
      return c.json({ error: 'Failed to get low stock items' }, 500)
    }
  })

  // Perform stock count
  app.post('/make-server-7657fe8e/pos/inventory/count', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['stores', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const countData = await c.req.json()
      countData.countedBy = profile.name

      const count = await InventoryService.createStockCount(countData)
      return c.json({ count })
    } catch (error) {
      console.error('Stock count error:', error)
      return c.json({ error: 'Failed to perform stock count' }, 500)
    }
  })

  // RECIPE MANAGEMENT ROUTES

  // Get recipe for menu item
  app.get('/make-server-7657fe8e/pos/recipe/:menuItemId', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'supervisor', 'stores', 'admin'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const menuItemId = c.req.param('menuItemId')
      const recipe = await InventoryService.getRecipe(menuItemId)
      
      return c.json({ recipe })
    } catch (error) {
      console.error('Get recipe error:', error)
      return c.json({ error: 'Failed to get recipe' }, 500)
    }
  })

  // Decrement stock for order preparation
  app.post('/make-server-7657fe8e/pos/inventory/:itemId/decrement', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['kitchen', 'supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const itemId = c.req.param('itemId')
      const { quantity } = await c.req.json()

      if (!quantity || quantity <= 0) {
        return c.json({ error: 'Valid quantity required' }, 400)
      }

      const success = await InventoryService.decrementStock(itemId, quantity)
      
      if (success) {
        return c.json({ message: 'Stock decremented successfully' })
      } else {
        return c.json({ error: 'Insufficient stock or item not found' }, 400)
      }
    } catch (error) {
      console.error('Decrement stock error:', error)
      return c.json({ error: 'Failed to decrement stock' }, 500)
    }
  })

  // Set recipe for menu item
  app.post('/make-server-7657fe8e/pos/recipe', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor', 'admin'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const recipe = await c.req.json()
      
      if (!recipe.menuItemId || !recipe.ingredients) {
        return c.json({ error: 'Menu item ID and ingredients are required' }, 400)
      }

      await InventoryService.setRecipe(recipe)
      return c.json({ message: 'Recipe saved successfully' })
    } catch (error) {
      console.error('Set recipe error:', error)
      return c.json({ error: 'Failed to save recipe' }, 500)
    }
  })

  // REPORTING ROUTES

  // Generate daily report
  app.post('/make-server-7657fe8e/pos/reports/daily/:date', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const date = c.req.param('date')
      const report = await ReportingService.generateDailyReport(date, profile.name)
      
      return c.json({ report })
    } catch (error) {
      console.error('Generate daily report error:', error)
      return c.json({ error: 'Failed to generate daily report' }, 500)
    }
  })

  // Get daily report
  app.get('/make-server-7657fe8e/pos/reports/daily/:date', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor', 'cashier'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const date = c.req.param('date')
      const report = await ReportingService.getDailyReport(date)
      
      return c.json({ report })
    } catch (error) {
      console.error('Get daily report error:', error)
      return c.json({ error: 'Failed to get daily report' }, 500)
    }
  })

  // Get sales analytics
  app.get('/make-server-7657fe8e/pos/reports/analytics', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0]
      const endDate = c.req.query('endDate') || startDate

      const analytics = await ReportingService.getSalesAnalytics(startDate, endDate)
      return c.json({ analytics })
    } catch (error) {
      console.error('Get analytics error:', error)
      return c.json({ error: 'Failed to get analytics' }, 500)
    }
  })

  // Get PDF report data
  app.get('/make-server-7657fe8e/pos/reports/pdf/:date', async (c) => {
    try {
      const auth = await verifyUser(c.req.raw)
      if (auth.error) return c.json({ error: auth.error }, auth.status)

      const profile = await getUserProfile(auth.user!.id)
      const roleCheck = await checkRole(['supervisor'])(profile)
      if (roleCheck.error) return c.json({ error: roleCheck.error }, roleCheck.status)

      const date = c.req.param('date')
      const pdfData = await ReportingService.generatePDFReportData(date)
      
      return c.json(pdfData)
    } catch (error) {
      console.error('Get PDF report data error:', error)
      return c.json({ error: 'Failed to get PDF report data' }, 500)
    }
  })

}