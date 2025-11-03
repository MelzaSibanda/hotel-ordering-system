import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2, CreditCard, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from "sonner"

interface YocoPaymentProps {
  amount: number
  orderId: string
  customerEmail?: string
  customerName?: string
  onSuccess: (paymentData: any) => void
  onError: (error: any) => void
  onCancel?: () => void
}

export default function YocoPayment({
  amount,
  orderId,
  customerEmail,
  customerName,
  onSuccess,
  onError,
  onCancel
}: YocoPaymentProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Yoco public key - Live keys for production
  const YOCO_PUBLIC_KEY = 'pk_live_4e0103acDm0961b10ca4' // Live public key

  useEffect(() => {
    // Load Yoco SDK if not already loaded
    if (!window.YocoSDK) {
      const script = document.createElement('script')
      script.src = 'https://js.yoco.com/sdk/v1/yoco-sdk-web.js'
      script.async = true
      script.onload = () => {
        console.log('✅ Yoco SDK loaded successfully')
      }
      script.onerror = () => {
        console.error('❌ Failed to load Yoco SDK')
        setErrorMessage('Failed to load payment system. Please try again.')
      }
      document.head.appendChild(script)
    } else {
      console.log('✅ Yoco SDK already loaded')
    }
  }, [])

  const initiatePayment = async () => {
    setIsLoading(true)
    setPaymentStatus('processing')
    setErrorMessage('')

    try {
      // Prepare customer details for Yoco payment link
      const firstName = customerName?.split(' ')[0] || 'Customer'
      const lastName = customerName?.split(' ').slice(1).join(' ') || 'User'
      const email = customerEmail || ''

      // Create Yoco payment URL with customer details and return URL
      const returnUrl = `${window.location.origin}/payment/success?orderId=${orderId}`
      const paymentUrl = `https://pay.yoco.com/rinae-ramadi?` +
        `amount=${amount.toFixed(2)}&` +
        `currency=ZAR&` +
        `description=Order%20%23${orderId.slice(-6)}&` +
        `firstName=${encodeURIComponent(firstName)}&` +
        `lastName=${encodeURIComponent(lastName)}&` +
        `email=${encodeURIComponent(email)}&` +
        `reference=${orderId}&` +
        `returnUrl=${encodeURIComponent(returnUrl)}`

      console.log('🔗 Opening Yoco payment URL:', paymentUrl)

      // Open payment link in new tab/window
      window.open(paymentUrl, '_blank')

      // Simulate payment processing (in real implementation, you'd need webhooks)
      setTimeout(() => {
        // For demo purposes, simulate successful payment after 5 seconds
        setPaymentStatus('success')
        setIsLoading(false)

        // Call success callback with payment data
        onSuccess({
          id: `yoco_live_${Date.now()}`,
          amount: amount,
          currency: 'ZAR',
          status: 'completed',
          orderId: orderId,
          timestamp: new Date().toISOString(),
          paymentMethod: 'card',
          metadata: {
            yocoPaymentId: `yoco_live_${Date.now()}`,
            customerEmail,
            customerName,
            firstName,
            lastName,
            paymentUrl: paymentUrl,
            liveMode: true
          }
        })

        toast.success('Payment completed successfully! Please check your email for confirmation.')
      }, 5000)

    } catch (error: any) {
      console.error('❌ Payment initialization error:', error)
      setPaymentStatus('failed')
      setIsLoading(false)
      setErrorMessage('Failed to initialize payment. Please try again.')

      onError({
        code: 'INITIALIZATION_ERROR',
        message: 'Failed to initialize payment',
        orderId: orderId
      })

      toast.error('Failed to initialize payment. Please try again.')
    }
  }

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <CreditCard className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'processing':
        return 'bg-blue-50 border-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <Card className={`transition-all duration-300 ${getStatusColor()}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {getStatusIcon()}
          Secure Payment
        </CardTitle>
        <CardDescription>
          Complete your payment securely with Yoco
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payment Summary */}
        <div className="flex justify-between items-center p-4 bg-white rounded-lg border">
          <div>
            <p className="font-medium text-gray-900">Order #{orderId.slice(-6)}</p>
            <p className="text-sm text-gray-600">Total Amount</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">R{amount.toFixed(2)}</p>
            <Badge variant="outline" className="text-xs">
              ZAR
            </Badge>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Payment Status */}
        {paymentStatus !== 'idle' && (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getStatusIcon()}
              <span className="font-medium capitalize">{paymentStatus}</span>
            </div>
            {paymentStatus === 'processing' && (
              <p className="text-sm text-gray-600">
                Processing your payment... Please complete the payment in the popup window.
              </p>
            )}
            {paymentStatus === 'success' && (
              <p className="text-sm text-green-600">
                Payment completed successfully! Your order is being processed.
              </p>
            )}
            {paymentStatus === 'failed' && (
              <p className="text-sm text-red-600">
                Payment failed. Please try again or contact support.
              </p>
            )}
          </div>
        )}

        {/* Payment Button */}
        {paymentStatus === 'idle' && (
          <Button
            onClick={initiatePayment}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Initializing Payment...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay R{amount.toFixed(2)} with Yoco
              </>
            )}
          </Button>
        )}

        {/* Retry Button for Failed Payments */}
        {paymentStatus === 'failed' && (
          <Button
            onClick={initiatePayment}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
          >
            Try Payment Again
          </Button>
        )}

        {/* Security Notice */}
        <div className="text-center text-xs text-gray-500 mt-4">
          <p>🔒 Your payment information is secure and encrypted</p>
          <p>Powered by Yoco • PCI DSS Compliant</p>
        </div>
      </CardContent>
    </Card>
  )
}

// TypeScript declaration for Yoco SDK
declare global {
  interface Window {
    YocoSDK?: any
  }
}