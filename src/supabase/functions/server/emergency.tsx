console.log('🆘 Emergency server test starting...')

// Test if we can at least create a basic HTTP response
const handler = (request: Request): Response => {
  console.log('📞 Request received:', request.method, request.url)
  
  const url = new URL(request.url)
  
  if (url.pathname.includes('/health')) {
    console.log('✅ Health check called')
    return new Response(JSON.stringify({ 
      status: 'emergency_ok',
      timestamp: new Date().toISOString(),
      message: 'Emergency server is responding'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }
  
  if (url.pathname.includes('/test')) {
    console.log('🧪 Test endpoint called')
    return new Response(JSON.stringify({ 
      working: true,
      server: 'emergency_no_imports',
      path: url.pathname
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // Default response
  console.log('📍 Default response for:', url.pathname)
  return new Response(JSON.stringify({ 
    message: 'Emergency server responding',
    path: url.pathname,
    method: request.method,
    timestamp: new Date().toISOString()
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

console.log('🚀 Starting emergency handler...')

try {
  Deno.serve(handler)
  console.log('✅ Emergency server started successfully')
} catch (error) {
  console.error('❌ Even emergency server failed:', error)
}