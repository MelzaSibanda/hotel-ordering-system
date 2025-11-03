import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Shield, CheckCircle, XCircle, ExternalLink, TestTube } from 'lucide-react'

export default function PasswordSecurityStatus() {
  const [serviceStatus, setServiceStatus] = useState<{
    available: boolean
    tested: boolean
    error?: string
  }>({ available: false, tested: false })

  const testPasswordSecurity = async () => {
    try {
      const { checkPasswordLeak } = await import('../utils/passwordSecurity')
      
      // Test with a known compromised password ("password")
      const result = await checkPasswordLeak('password')
      
      setServiceStatus({
        available: true,
        tested: true,
        error: result.error
      })
    } catch (error) {
      setServiceStatus({
        available: false,
        tested: true,
        error: error instanceof Error ? error.message : 'Test failed'
      })
    }
  }

  const getStatusBadge = () => {
    if (!serviceStatus.tested) {
      return <Badge className="bg-ump-gray/10 text-ump-gray border-ump-gray/20">
        Not Tested
      </Badge>
    } else if (serviceStatus.available && !serviceStatus.error) {
      return <Badge className="bg-ump-green/10 text-ump-green border-ump-green/20">
        <CheckCircle className="w-3 h-3 mr-1" />
        Available
      </Badge>
    } else {
      return <Badge className="bg-ump-red/10 text-ump-red border-ump-red/20">
        <XCircle className="w-3 h-3 mr-1" />
        Unavailable
      </Badge>
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-ump-navy" />
            Password Security
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-ump-gray">
          Real-time password leak detection using Have I Been Pwned API
        </div>

        {serviceStatus.tested && serviceStatus.error && (
          <div className="p-3 bg-ump-orange/10 border border-ump-orange/20 rounded-lg">
            <div className="text-sm text-ump-orange font-medium mb-1">
              Service Issue
            </div>
            <div className="text-xs text-ump-orange">
              {serviceStatus.error}
            </div>
          </div>
        )}

        {serviceStatus.tested && serviceStatus.available && !serviceStatus.error && (
          <div className="p-3 bg-ump-green/10 border border-ump-green/20 rounded-lg">
            <div className="text-sm text-ump-green font-medium mb-1">
              ✅ Service Active
            </div>
            <div className="text-xs text-ump-green">
              Password leak detection is working properly
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={testPasswordSecurity}
            size="sm"
            variant="outline"
            className="flex-1 border-ump-navy text-ump-navy hover:bg-ump-navy/10"
          >
            <TestTube className="w-3 h-3 mr-1" />
            Test Service
          </Button>
          
          <Button 
            onClick={() => window.location.href = window.location.origin + '?password-security'}
            size="sm"
            className="flex-1 bg-ump-navy hover:bg-ump-navy/90 text-white"
          >
            <Shield className="w-3 h-3 mr-1" />
            Demo
          </Button>
        </div>

        <Button 
          onClick={() => window.open('https://haveibeenpwned.com/API/v3#PwnedPasswords', '_blank')}
          size="sm"
          variant="outline"
          className="w-full border-ump-green text-ump-green hover:bg-ump-green/10"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Learn About HIBP API
        </Button>

        <div className="text-xs text-ump-gray">
          Prevents users from choosing compromised passwords during signup
        </div>
      </CardContent>
    </Card>
  )
}