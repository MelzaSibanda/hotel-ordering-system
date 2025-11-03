import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Create Hono app
const app = new Hono()

// Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.use('*', logger(console.log))

// Health check endpoint
app.get('/make-server-7657fe8e/health', async (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Egumeni Eats Server'
  })
})

// Auth endpoints
app.post('/make-server-7657fe8e/auth/signup', async (c) => {
  try {
    const body = await c.req.json()
    const { email, name, role, phone } = body
    
    console.log('Creating user profile:', { email, name, role })
    
    // Create user profile in database
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        role,
        phone: phone || null,
        password: 'handled_by_supabase_auth' // Required by schema
      })
      .select()
      .single()
      
    if (error) {
      console.error('Database error:', error)
      return c.json({ success: false, error: 'Failed to create user profile' }, 500)
    }
    
    return c.json({ success: true, user: data })
  } catch (error) {
    console.error('Signup error:', error)
    return c.json({ success: false, error: 'Signup failed' }, 500)
  }
})

app.get('/make-server-7657fe8e/auth/profile', async (c) => {
  try {
    // Get user from auth header
    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
      return c.json({ success: false, error: 'No authorization header' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return c.json({ success: false, error: 'Invalid token' }, 401)
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single()

    if (profileError) {
      console.log('Profile not found in database, creating fallback')
      // Return fallback profile
      return c.json({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: user.user_metadata?.role || 'customer',
        phone: user.user_metadata?.phone || '',
        created_at: user.created_at
      })
    }

    return c.json(profile)
  } catch (error) {
    console.error('Profile fetch error:', error)
    return c.json({ success: false, error: 'Failed to fetch profile' }, 500)
  }
})

// Menu endpoints
app.get('/make-server-7657fe8e/menu/categories', async (c) => {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('name')

    if (error) {
      console.error('Categories fetch error:', error)
      return c.json({ success: false, error: 'Failed to fetch categories' }, 500)
    }

    return c.json({ success: true, categories: data })
  } catch (error) {
    console.error('Categories error:', error)
    return c.json({ success: false, error: 'Failed to fetch categories' }, 500)
  }
})

app.get('/make-server-7657fe8e/menu/items', async (c) => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(name)
      `)
      .eq('available', true)
      .order('name')

    if (error) {
      console.error('Menu items fetch error:', error)
      return c.json({ success: false, error: 'Failed to fetch menu items' }, 500)
    }

    return c.json({ success: true, items: data })
  } catch (error) {
    console.error('Menu items error:', error)
    return c.json({ success: false, error: 'Failed to fetch menu items' }, 500)
  }
})

// Orders endpoint
app.get('/make-server-7657fe8e/orders', async (c) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          menu_item:menu_items(name, price)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Orders fetch error:', error)
      return c.json({ success: false, error: 'Failed to fetch orders' }, 500)
    }

    return c.json({ success: true, orders: data })
  } catch (error) {
    console.error('Orders error:', error)
    return c.json({ success: false, error: 'Failed to fetch orders' }, 500)
  }
})

// Default route
app.all('*', (c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Start server
Deno.serve(app.fetch)