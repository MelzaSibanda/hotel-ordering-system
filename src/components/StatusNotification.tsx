import React from 'react'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  X,
  Database
} from 'lucide-react'

interface StatusNotificationProps {
  isOnline: boolean
  error?: string
  loading: boolean
  onRetry: () => void
  onDismiss: () => void
}

export default function StatusNotification({ 
  isOnline, 
  error, 
  loading, 
  onRetry, 
  onDismiss 
}: StatusNotificationProps) {
  // Always show standalone mode indicator
  return (
    <div className="space-y-2">
      {/* Standalone Mode Status */}
      <Alert className="border-ump-green/30 bg-ump-green/10">
        <Database className="w-4 h-4 text-ump-green" />
        <AlertDescription className="text-ump-green flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>Hungry? Explore our menu and satisfy your cravings with just a tap!</span>
            <Badge variant="outline" className="bg-ump-green/10 text-ump-green border-ump-green/30">
              Craving something delicious? Order now and enjoy fresh meals delivered fast!
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-ump-green hover:bg-ump-green/20"
          >
            <X className="w-3 h-3" />
          </Button>
        </AlertDescription>
      </Alert>

      {/* Error Status */}
      {error && (
        <Alert className="border-ump-red/30 bg-ump-red/10">
          <AlertTriangle className="w-4 h-4 text-ump-red" />
          <AlertDescription className="text-ump-red flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>{error}</span>
              <Badge variant="outline" className="bg-ump-red/10 text-ump-red border-ump-red/30">
                Error
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                disabled={loading}
                className="h-6 px-2 text-ump-red hover:bg-ump-red/20"
              >
                {loading ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-6 w-6 p-0 text-ump-red hover:bg-ump-red/20"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Status */}
      {loading && !error && (
        <Alert className="border-ump-navy/30 bg-ump-navy/10">
          <RefreshCw className="w-4 h-4 text-ump-navy animate-spin" />
          <AlertDescription className="text-ump-navy flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>Loading data...</span>
              <Badge variant="outline" className="bg-ump-navy/10 text-ump-navy border-ump-navy/30">
                Processing
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-ump-navy hover:bg-ump-navy/20"
            >
              <X className="w-3 h-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Status */}
      {isOnline && !error && !loading && (
        <Alert className="border-ump-green/30 bg-ump-green/10">
          <CheckCircle className="w-4 h-4 text-ump-green" />
          <AlertDescription className="text-ump-green flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>System ready - all data loaded successfully</span>
              <Badge variant="outline" className="bg-ump-green/10 text-ump-green border-ump-green/30">
                Ready
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-ump-green hover:bg-ump-green/20"
            >
              <X className="w-3 h-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}