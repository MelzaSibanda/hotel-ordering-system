import { useEffect, useCallback, useRef } from 'react'
import { performanceOptimizer } from '../utils/serviceWorker'
import { api } from '../utils/api'

// Hook for component performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const mountTime = useRef<number>(Date.now())
  const renderCount = useRef<number>(0)

  useEffect(() => {
    renderCount.current += 1
    const loadTime = Date.now() - mountTime.current

    console.log(`📊 ${componentName} Performance:`)
    console.log(`   Mount Time: ${loadTime}ms`)
    console.log(`   Render Count: ${renderCount.current}`)

    if (loadTime > 1000) {
      console.warn(`⚠️ Slow component detected: ${componentName} took ${loadTime}ms`)
    }

    return () => {
      const totalTime = Date.now() - mountTime.current
      console.log(`🏁 ${componentName} Unmounted after ${totalTime}ms`)
    }
  }, [componentName])

  return { loadTime: Date.now() - mountTime.current, renderCount: renderCount.current }
}

// Hook for optimized data fetching with caching
export const useOptimizedFetch = () => {
  const requestQueue = useRef<Map<string, Promise<any>>>(new Map())

  const fetchWithCache = useCallback(async (endpoint: string, options: any = {}) => {
    const cacheKey = `${endpoint}_${JSON.stringify(options)}`
    
    // If request is already in progress, return the same promise
    if (requestQueue.current.has(cacheKey)) {
      console.log('🔄 Request already in progress, reusing promise:', endpoint)
      return requestQueue.current.get(cacheKey)
    }

    // Create new request promise
    const requestPromise = api.request(endpoint, options)
      .finally(() => {
        // Remove from queue when completed
        requestQueue.current.delete(cacheKey)
      })

    // Add to queue
    requestQueue.current.set(cacheKey, requestPromise)
    
    return requestPromise
  }, [])

  const batchFetch = useCallback(async (requests: Array<{ endpoint: string; options?: any }>) => {
    console.log('📦 Batching', requests.length, 'API requests')
    return api.batchRequests(requests)
  }, [])

  return { fetchWithCache, batchFetch }
}

// Hook for component preloading
export const usePreloader = () => {
  const preloadComponent = useCallback((componentPath: string) => {
    return import(componentPath).catch((error) => {
      console.warn('Failed to preload component:', componentPath, error)
    })
  }, [])

  const preloadDashboard = useCallback((role: string) => {
    return performanceOptimizer.preloadDashboardComponent(role)
  }, [])

  const prefetchData = useCallback((role: string) => {
    return performanceOptimizer.prefetchCriticalData(api, role)
  }, [])

  return { preloadComponent, preloadDashboard, prefetchData }
}

// Hook for memory management
export const useMemoryOptimization = () => {
  const cleanupTasks = useRef<(() => void)[]>([])

  const addCleanupTask = useCallback((task: () => void) => {
    cleanupTasks.current.push(task)
  }, [])

  const cleanup = useCallback(() => {
    cleanupTasks.current.forEach(task => {
      try {
        task()
      } catch (error) {
        console.warn('Cleanup task failed:', error)
      }
    })
    cleanupTasks.current = []
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { addCleanupTask, cleanup }
}

// Hook for network status monitoring
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionSpeed, setConnectionSpeed] = useState<string>('unknown')

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log('🌐 Network connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('📱 Network connection lost')
    }

    // Check connection speed
    const checkConnectionSpeed = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        setConnectionSpeed(connection.effectiveType || 'unknown')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    checkConnectionSpeed()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, connectionSpeed, isSlowConnection: connectionSpeed === 'slow-2g' || connectionSpeed === '2g' }
}

// Hook for image optimization
export const useImageOptimization = () => {
  const optimizeImage = useCallback((src: string, width?: number, height?: number) => {
    // Add query parameters for image optimization if using a CDN
    const url = new URL(src, window.location.origin)
    
    if (width) url.searchParams.set('w', width.toString())
    if (height) url.searchParams.set('h', height.toString())
    url.searchParams.set('q', '85') // Quality
    url.searchParams.set('f', 'webp') // Format
    
    return url.toString()
  }, [])

  const lazyLoadImage = useCallback((imgElement: HTMLImageElement) => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgElement.dataset.src) {
            imgElement.src = imgElement.dataset.src
            imgElement.classList.remove('lazy')
            imageObserver.unobserve(imgElement)
          }
        })
      })
      
      imageObserver.observe(imgElement)
      return () => imageObserver.unobserve(imgElement)
    }
  }, [])

  return { optimizeImage, lazyLoadImage }
}

// Hook for debounced operations
export const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedCallback = useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

import { useState } from 'react'