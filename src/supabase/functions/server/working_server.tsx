console.log('🚀 Testing Deno server startup...')

// Test if Deno can run basic code
const testData = {
  timestamp: new Date().toISOString(),
  message: 'Deno environment is working'
}

console.log('✅ Basic Deno test passed:', testData)

// Try importing Hono
try {
  const { Hono } = await import('npm:hono')
  console.log('✅ Hono import successful')
  
  const app = new Hono()
  
  app.get('/make-server-7657fe8e/health', (c) => {
    console.log('✅ Health endpoint called')
    return c.json({ 
      status: 'working',
      timestamp: new Date().toISOString()
    })
  })
  
  app.get('/make-server-7657fe8e/test', (c) => {
    console.log('✅ Test endpoint called')
    return c.json({ 
      working: true,
      server: 'emergency_minimal'
    })
  })
  
  app.all('*', (c) => {
    console.log('📍 Catch all hit:', c.req.path)
    return c.json({ 
      message: 'Server is working',
      path: c.req.path
    })
  })
  
  console.log('🚀 Starting emergency server...')
  
  Deno.serve(app.fetch)
  
} catch (error) {
  console.error('❌ Server startup failed:', error)
  console.error('Error details:', error.message)
  console.error('Error stack:', error.stack)
  
  // Emergency fallback - just log that we tried
  console.log('🆘 Emergency fallback - server could not start')
}