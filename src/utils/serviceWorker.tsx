// Service Worker Registration and Performance Utilities
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
)

export function registerSW() {
  if ('serviceWorker' in navigator) {
    // Don't use process.env in browser - just use relative paths
    const publicUrl = new URL('/', window.location.href)
    if (publicUrl.origin !== window.location.origin) {
      return
    }

    window.addEventListener('load', () => {
      const swUrl = '/sw.js' // Simple relative path

      if (isLocalhost) {
        // This is running on localhost
        checkValidServiceWorker(swUrl)
      } else {
        // Is not localhost
        registerValidSW(swUrl)
      }
    })
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('🚀 Service Worker registered successfully:', registration.scope)
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 New content available, refresh to update')
              // Optionally show user notification about update
              showUpdateNotification()
            } else {
              console.log('✅ Content cached for offline use')
            }
          }
        }
      }
    })
    .catch((error) => {
      console.error('❌ Service Worker registration failed:', error)
    })
}

function checkValidServiceWorker(swUrl: string) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type')
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      } else {
        registerValidSW(swUrl)
      }
    })
    .catch(() => {
      console.log('🔄 No internet connection, running in offline mode')
    })
}

function showUpdateNotification() {
  // You can integrate this with your toast notification system
  if (window.confirm('New version available! Refresh to update?')) {
    window.location.reload()
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => {
        console.error(error.message)
      })
  }
}

// Performance utilities
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer
  private preloadedComponents = new Set<string>()

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer()
    }
    return PerformanceOptimizer.instance
  }

  // Preload critical dashboard components based on user role
  preloadDashboardComponent(role: string) {
    if (this.preloadedComponents.has(role)) {
      return Promise.resolve()
    }

    console.log('📦 Preloading dashboard component for role:', role)
    this.preloadedComponents.add(role)

    // For now, just mark as preloaded without dynamic imports to avoid errors
    // In a production environment, you would implement proper component preloading
    return Promise.resolve().catch((error) => {
      console.warn('Failed to preload component for role:', role, error)
      this.preloadedComponents.delete(role)
    })
  }

  // Prefetch critical API data
  async prefetchCriticalData(api: any, userRole: string) {
    console.log('📡 Prefetching critical data for role:', userRole)
    
    const prefetchPromises: Promise<any>[] = []

    // Always prefetch menu data
    prefetchPromises.push(
      api.request('/menu').catch((error: any) => {
        console.warn('Failed to prefetch menu:', error)
        return null
      })
    )

    // Role-specific prefetching
    switch (userRole) {
      case 'kitchen':
        prefetchPromises.push(
          api.request('/orders?status=pending,preparing').catch(() => null)
        )
        break
      case 'delivery':
        prefetchPromises.push(
          api.request('/orders?status=ready').catch(() => null)
        )
        break
      case 'cashier':
        prefetchPromises.push(
          api.request('/pos/inventory').catch(() => null)
        )
        break
      case 'admin':
      case 'supervisor':
        prefetchPromises.push(
          api.request('/reporting/dashboard').catch(() => null),
          api.request('/pos/shifts/current').catch(() => null)
        )
        break
    }

    try {
      await Promise.allSettled(prefetchPromises)
      console.log('✅ Critical data prefetching completed')
    } catch (error) {
      console.warn('⚠️ Some prefetch operations failed:', error)
    }
  }

  // Optimize images with lazy loading
  setupImageOptimization() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            if (img.dataset.src) {
              img.src = img.dataset.src
              img.classList.remove('lazy')
              imageObserver.unobserve(img)
            }
          }
        })
      })

      // Observe all lazy images
      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img)
      })
    }
  }

  // Memory cleanup
  clearCache() {
    this.preloadedComponents.clear()
    
    // Clear service worker caches
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'CLEAR_CACHE'
      })
    }
  }

  // Monitor performance
  measurePageLoad() {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          const loadTime = perfData.loadEventEnd - perfData.loadEventStart
          const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart
          
          console.log('📊 Performance Metrics:')
          console.log(`   Page Load Time: ${loadTime}ms`)
          console.log(`   DOM Content Loaded: ${domContentLoaded}ms`)
          console.log(`   First Contentful Paint: ${perfData.responseEnd - perfData.requestStart}ms`)
          
          // Send analytics if needed
          if (loadTime > 3000) {
            console.warn('⚠️ Slow page load detected:', loadTime + 'ms')
          }
        }, 0)
      })
    }
  }
}

// Initialize performance monitoring
export function initializePerformanceMonitoring() {
  try {
    const optimizer = PerformanceOptimizer.getInstance()
    optimizer.measurePageLoad()
    optimizer.setupImageOptimization()
  } catch (error) {
    console.warn('Performance monitoring initialization failed:', error)
  }
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance()