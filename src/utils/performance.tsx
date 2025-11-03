// Performance utilities for Egumeni Eats
// Helps prevent browser hangs and timeout issues

export const performanceUtils = {
  // Debounce function to prevent excessive API calls
  debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout
    return ((...args: any[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), wait)
    }) as T
  },

  // Throttle function to limit execution frequency
  throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
    let inThrottle: boolean
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }) as T
  },

  // Safe setTimeout with cleanup
  safeTimeout(callback: () => void, delay: number): () => void {
    const timeoutId = setTimeout(callback, delay)
    return () => clearTimeout(timeoutId)
  },

  // Check if browser is overloaded
  isMainThreadBusy(): Promise<boolean> {
    return new Promise((resolve) => {
      const start = performance.now()
      setTimeout(() => {
        const elapsed = performance.now() - start
        // If setTimeout took more than 50ms longer than expected, thread is busy
        resolve(elapsed > 100)
      }, 50)
    })
  },

  // Memory usage check (if available)
  getMemoryUsage(): { used?: number; total?: number; percentage?: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
      }
    }
    return {}
  },

  // Yield to main thread
  yieldToMain(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  },

  // Run task with yielding to prevent blocking
  async runWithYield<T>(task: () => Promise<T>): Promise<T> {
    await this.yieldToMain()
    return task()
  },

  // Batch operations to prevent overwhelming the browser
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    delayBetweenBatches: number = 10
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(processor))
      results.push(...batchResults)
      
      // Yield to main thread between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }
    
    return results
  }
}

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = React.useState({
    memoryUsage: { percentage: 0 },
    isMainThreadBusy: false,
    lastUpdate: Date.now()
  })

  React.useEffect(() => {
    const updateMetrics = performanceUtils.throttle(() => {
      performanceUtils.isMainThreadBusy().then(isBusy => {
        setMetrics({
          memoryUsage: performanceUtils.getMemoryUsage(),
          isMainThreadBusy: isBusy,
          lastUpdate: Date.now()
        })
      })
    }, 5000) // Check every 5 seconds

    const interval = setInterval(updateMetrics, 5000)
    updateMetrics() // Initial check

    return () => clearInterval(interval)
  }, [])

  return metrics
}

// React import for the hook
import React from 'react'