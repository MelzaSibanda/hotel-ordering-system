import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { useConnectionManager } from '../utils/connectionUtils'
import { api } from '../utils/api'
import { Activity, Wifi, Clock, Zap } from 'lucide-react'

export const PerformanceMonitor = ({ showDetailed = false }: { showDetailed?: boolean }) => {
  const { connectionQuality, isOnline } = useConnectionManager()
  const [metrics, setMetrics] = useState({
    pageLoadTime: 0,
    apiResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0
  })

  useEffect(() => {
    // Measure page load time
    if ('performance' in window) {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (perfData) {
        const loadTime = perfData.loadEventEnd - perfData.loadEventStart
        setMetrics(prev => ({ ...prev, pageLoadTime: loadTime }))
      }
    }

    // Test API response time
    const testApiResponse = async () => {
      const startTime = performance.now()
      try {
        await api.request('/menu')
        const endTime = performance.now()
        setMetrics(prev => ({ ...prev, apiResponseTime: endTime - startTime }))
      } catch (error) {
        console.warn('API response test failed:', error)
      }
    }

    testApiResponse()
  }, [])

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'fast': return '🚀'
      case 'moderate': return '📶'
      case 'slow': return '🐌'
      case 'offline': return '📱'
      default: return '❓'
    }
  }

  const getPerformanceScore = () => {
    const loadScore = metrics.pageLoadTime < 3000 ? 100 : Math.max(0, 100 - (metrics.pageLoadTime - 3000) / 100)
    const apiScore = metrics.apiResponseTime < 1000 ? 100 : Math.max(0, 100 - (metrics.apiResponseTime - 1000) / 50)
    const connectionScore = connectionQuality === 'fast' ? 100 : connectionQuality === 'moderate' ? 80 : connectionQuality === 'slow' ? 50 : 0
    
    return Math.round((loadScore + apiScore + connectionScore) / 3)
  }

  const performanceScore = getPerformanceScore()

  if (!showDetailed) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>{getConnectionIcon()}</span>
        <Badge variant={connectionQuality === 'fast' ? 'default' : connectionQuality === 'moderate' ? 'secondary' : 'destructive'}>
          {connectionQuality}
        </Badge>
        {performanceScore >= 80 ? (
          <Zap className="w-4 h-4 text-ump-green" />
        ) : performanceScore >= 60 ? (
          <Clock className="w-4 h-4 text-ump-orange" />
        ) : (
          <Activity className="w-4 h-4 text-ump-red" />
        )}
      </div>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Performance Monitor
          <Badge 
            variant={performanceScore >= 80 ? 'default' : performanceScore >= 60 ? 'secondary' : 'destructive'}
          >
            Score: {performanceScore}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{getConnectionIcon()}</span>
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {isOnline ? connectionQuality : 'offline'}
            </Badge>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-card rounded-lg border">
            <div className="text-sm text-muted-foreground">Page Load</div>
            <div className="text-lg font-medium">
              {metrics.pageLoadTime > 0 ? `${Math.round(metrics.pageLoadTime)}ms` : 'Measuring...'}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.pageLoadTime < 3000 ? '✅ Good' : metrics.pageLoadTime < 5000 ? '⚠️ Slow' : '❌ Poor'}
            </div>
          </div>

          <div className="p-3 bg-card rounded-lg border">
            <div className="text-sm text-muted-foreground">API Response</div>
            <div className="text-lg font-medium">
              {metrics.apiResponseTime > 0 ? `${Math.round(metrics.apiResponseTime)}ms` : 'Testing...'}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.apiResponseTime < 1000 ? '✅ Fast' : metrics.apiResponseTime < 2000 ? '⚠️ Slow' : '❌ Poor'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              api.clearCache()
              window.location.reload()
            }}
          >
            Clear Cache & Reload
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => api.resetFallbackMode()}
          >
            Reset Network Mode
          </Button>
        </div>

        {/* Tips */}
        {connectionQuality === 'slow' && (
          <div className="p-3 bg-ump-orange/10 border border-ump-orange/20 rounded-lg">
            <div className="text-sm">
              <strong>💡 Tip:</strong> Slow connection detected. Try closing other apps or moving closer to your WiFi router.
            </div>
          </div>
        )}

        {performanceScore < 60 && (
          <div className="p-3 bg-ump-red/10 border border-ump-red/20 rounded-lg">
            <div className="text-sm">
              <strong>⚠️ Performance Issue:</strong> Consider refreshing the page or checking your internet connection.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PerformanceMonitor