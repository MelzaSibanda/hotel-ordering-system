import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'
import { trackClientCreation } from './clientGuard'

// SINGLE SUPABASE CLIENT INSTANCE
// This is the ONLY Supabase client instance in the entire frontend application.
// All other files MUST import from here to avoid multiple GoTrueClient instances.
// Do NOT create new clients elsewhere - always import { supabase } from this file.

// Track client creation to prevent duplicates
trackClientCreation('/utils/supabase/client.tsx')

export const supabase = (() => {
  try {
    if (!projectId || !publicAnonKey) {
      console.error('❌ Missing Supabase configuration')
      throw new Error('Supabase configuration is incomplete')
    }
    
    const client = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window?.localStorage, // Explicitly set storage
          storageKey: 'supabase.auth.token', // Use consistent storage key
        },
        realtime: {
          params: {
            eventsPerSecond: 2
          }
        }
      }
    )
    
    console.log('✅ Single Supabase client initialized successfully')
    console.log('🔒 Auth storage key: supabase.auth.token')
    return client
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error)
    throw error
  }
})()

// Database types based on your schema
export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: 'admin' | 'customer' | 'kitchen' | 'delivery' | 'cashier' | 'stores'
  created_at: string
}

export interface Shift {
  id: string
  staff_id: string
  role: string
  start_time: string
  end_time?: string
  cash_in: number
  cash_out?: number
  created_at: string
}

export interface StockItem {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number
  barcode?: string
  supplier?: string
  created_at: string
}

export interface MenuCategory {
  id: string
  name: string
  description?: string
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description?: string
  price: number
  available: boolean
  created_at: string
  category?: MenuCategory
}

export interface MenuItemIngredient {
  id: string
  menu_item_id: string
  stock_item_id: string
  quantity_used: number
  menu_item?: MenuItem
  stock_item?: StockItem
}

export interface Order {
  id: string
  customer_id: string
  order_type: 'room_service' | 'delivery' | 'collection'
  status: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'completed'
  room_number?: string
  delivery_address?: string
  created_at: string
  customer?: User
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  price: number
  menu_item?: MenuItem
}

export interface Payment {
  id: string
  order_id: string
  method: 'cash' | 'card' | 'room_charge' | 'mobile'
  amount: number
  paid_at: string
  order?: Order
}

export interface Report {
  id: string
  report_date: string
  type: 'sales' | 'inventory' | 'shift'
  data: any
  created_at: string
}