import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from "sonner"

export default function PaymentSuccess() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [order, setOrder] = useState<any>(null)

  // Get orderId from URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const orderId = urlParams.get('orderId')

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      if (!orderId) {
        setError('No order ID provided')
        setLoading(false)
        return
      }

      try {
        // For demo purposes, we'll simulate finding the order
        // In production, you'd fetch from Firebase
        const mockOrder = {
          id: orderId,
          customerName: 'Customer',
          totalAmount: 85.00,
          status: 'preparing',
          paymentStatus: 'paid',
          orderDate: new Date().toISOString(),
          items: [
            { name: 'Burger', quantity: 1, price: 45.00 },
            { name: 'Fries', quantity: 1, price: 25.00 },
            { name: 'Drink', quantity: 1, price: 15.00 }
          ]
        }

        setOrder(mockOrder)

        // Show success message
        toast.success('Payment successful! Your order is being prepared.')

        // Redirect to orders tab after 3 seconds
        setTimeout(() => {
          window.location.href = '/?tab=orders'
        }, 3000)

      } catch (err) {
        console.error('Error processing payment success:', err)
        setError('Failed to process payment confirmation')
      } finally {
        setLoading(false)
      }
    }

    handlePaymentSuccess()
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-premium">
        <Card className="w-full max-w-md glass-effect shadow-modern">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-gray-600">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-premium">
        <Card className="w-full max-w-md glass-effect shadow-modern">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.href = '/'} className="w-full">
              Return to App
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-premium">
      <Card className="w-full max-w-md glass-effect shadow-modern">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Payment Successful!</CardTitle>
          <CardDescription className="text-gray-600">
            Your payment has been processed successfully
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {order && (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">Order ID</span>
                <span className="text-gray-600">#{order.id.slice(-6)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">Amount Paid</span>
                <span className="text-gray-600">R{order.totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">Status</span>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Paid
                </Badge>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-6">
            <p>You will be redirected to your orders shortly...</p>
            <p className="mt-1">Or click below to return now</p>
          </div>

          <Button onClick={() => window.location.href = '/?tab=orders'} className="w-full bg-blue-600 hover:bg-blue-700">
            View My Orders
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}