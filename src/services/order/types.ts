export interface OrderDraft {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  items: OrderItem[]
  totalAmount: number
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  tableNumber?: string
  deliveryAddress?: string
  specialInstructions?: string
  orderDate: string
  estimatedTime: number
}

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  requiresCooking?: boolean
  specialInstructions?: string
  selectedExtras?: any[]
}

export interface OrderResult {
  success: boolean
  order?: any
  reservation?: any
  payment?: any
  stage?: string
  error?: string
  details?: any
}

export interface PaymentResult {
  success: boolean
  paymentId?: string
  error?: string
}

export interface Order {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  items: OrderItem[]
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'failed'
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  tableNumber?: string
  deliveryAddress?: string
  specialInstructions?: string
  orderDate: string
  estimatedTime: number
  paymentId?: string
  reservationId?: string
}