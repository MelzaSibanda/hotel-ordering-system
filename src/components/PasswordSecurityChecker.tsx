import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Loader2 
} from 'lucide-react'
import { 
  checkPasswordLeak, 
  validatePasswordStrength, 
  getPasswordStrengthDescription 
} from '../utils/passwordSecurity'
import { Button } from './ui/button'

interface PasswordSecurityCheckerProps {
  password: string
  onSecurityCheck?: (result: {
    isSecure: boolean
    isCompromised: boolean
    breachCount: number
    strengthScore: number
    issues: string[]
    suggestions: string[]
  }) => void
  onSecurityChange?: (result: {
    isSecure: boolean
    isCompromised: boolean
    breachCount: number
    strengthScore: number
    issues: string[]
    suggestions: string[]
  }) => void
  showStrengthOnly?: boolean
  className?: string
}

export default function PasswordSecurityChecker({
  password,
  onSecurityCheck,
  onSecurityChange,
  showStrengthOnly = false,
  className = ''
}: PasswordSecurityCheckerProps) {
  const [checking, setChecking] = useState(false)
  const [leakResult, setLeakResult] = useState<{
    isCompromised: boolean
    breachCount: number
    error?: string
    checked: boolean
  }>({ isCompromised: false, breachCount: 0, checked: false })
  
  const [showPassword, setShowPassword] = useState(false)
  const [lastCheckedPassword, setLastCheckedPassword] = useState('')
  const lastNotifiedRef = useRef<string>('')
  const onSecurityCheckRef = useRef(onSecurityCheck)
  const onSecurityChangeRef = useRef(onSecurityChange)
  
  // Update refs when callbacks change
  useEffect(() => {
    onSecurityCheckRef.current = onSecurityCheck
    onSecurityChangeRef.current = onSecurityChange
  }, [onSecurityCheck, onSecurityChange])

  // Debounced password leak check
  const checkPasswordSecurity = useCallback(async (passwordToCheck: string) => {
    if (!passwordToCheck || passwordToCheck.length < 4) {
      setLeakResult({ isCompromised: false, breachCount: 0, checked: false })
      return
    }

    if (passwordToCheck === lastCheckedPassword) {
      return // Already checked this password
    }

    setChecking(true)
    setLastCheckedPassword(passwordToCheck)

    try {
      const result = await checkPasswordLeak(passwordToCheck)
      setLeakResult({
        isCompromised: result.isCompromised,
        breachCount: result.breachCount,
        error: result.error,
        checked: true
      })
    } catch (error) {
      console.error('Password leak check failed:', error)
      setLeakResult({
        isCompromised: false,
        breachCount: 0,
        error: 'Check failed',
        checked: false
      })
    } finally {
      setChecking(false)
    }
  }, [lastCheckedPassword])

  // Debounce password checking
  useEffect(() => {
    if (showStrengthOnly) return

    const timeoutId = setTimeout(() => {
      checkPasswordSecurity(password)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, showStrengthOnly])

  // Calculate password strength
  const strengthResult = React.useMemo(
    () => validatePasswordStrength(password),
    [password]
  )
  const strengthDescription = React.useMemo(
    () => getPasswordStrengthDescription(strengthResult.score),
    [strengthResult.score]
  )

  // Notify parent component
  useEffect(() => {
    // Create a unique key from the current state to prevent duplicate notifications
    const stateKey = `${password}-${leakResult.isCompromised}-${leakResult.breachCount}-${strengthResult.score}-${strengthResult.isValid}`
    
    // Only notify if the state has actually changed
    if (lastNotifiedRef.current === stateKey) {
      return
    }
    
    lastNotifiedRef.current = stateKey
    
    const result = {
      isSecure: strengthResult.isValid && !leakResult.isCompromised,
      isCompromised: leakResult.isCompromised,
      breachCount: leakResult.breachCount,
      strengthScore: strengthResult.score,
      issues: strengthResult.issues,
      suggestions: strengthResult.suggestions
    }
    
    if (onSecurityCheckRef.current) {
      onSecurityCheckRef.current(result)
    }
    
    if (onSecurityChangeRef.current) {
      onSecurityChangeRef.current(result)
    }
  }, [
    password,
    leakResult.isCompromised,
    leakResult.breachCount,
    strengthResult.isValid,
    strengthResult.score
  ])

  if (!password) {
    return null
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Password Strength Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ump-gray">Password Strength</span>
          <div className="flex items-center gap-2">
            <Badge 
              className={`${strengthDescription.color} bg-transparent border-current`}
              variant="outline"
            >
              {strengthDescription.label}
            </Badge>
            <span className="text-sm text-ump-gray">{strengthResult.score}%</span>
          </div>
        </div>
        
        <Progress 
          value={strengthResult.score} 
          className="h-2"
        />
        
        <p className="text-xs text-ump-gray">
          {strengthDescription.description}
        </p>
      </div>

      {/* Breach Check Results (if not strength-only mode) */}
      {!showStrengthOnly && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ump-gray">Security Check</span>
            {checking && <Loader2 className="w-4 h-4 animate-spin text-ump-navy" />}
          </div>

          {leakResult.checked && !checking && (
            <>
              {leakResult.isCompromised ? (
                <Alert className="border-ump-red/30 bg-ump-red/10">
                  <ShieldX className="w-4 h-4 text-ump-red" />
                  <AlertDescription className="text-ump-red">
                    <strong>⚠️ Password Compromised!</strong>
                    <br />
                    This password was found in <strong>{leakResult.breachCount.toLocaleString()}</strong> data breaches.
                    <br />
                    <span className="text-sm">Please choose a different password for your security.</span>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-ump-green/30 bg-ump-green/10">
                  <ShieldCheck className="w-4 h-4 text-ump-green" />
                  <AlertDescription className="text-ump-green">
                    <strong>✅ Password Not Compromised</strong>
                    <br />
                    <span className="text-sm">This password was not found in known data breaches.</span>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {leakResult.error && !checking && (
            <Alert className="border-ump-orange/30 bg-ump-orange/10">
              <AlertTriangle className="w-4 h-4 text-ump-orange" />
              <AlertDescription className="text-ump-orange">
                <strong>Security Check Unavailable</strong>
                <br />
                <span className="text-sm">Unable to verify if password has been compromised. ({leakResult.error})</span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Password Issues and Suggestions */}
      {strengthResult.issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-ump-gray">Improve Your Password:</div>
          <div className="space-y-1">
            {strengthResult.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-ump-gray">
                <XCircle className="w-3 h-3 text-ump-red mt-0.5 flex-shrink-0" />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Password Requirements */}
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-ump-gray">Password Requirements:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            <div className={`flex items-center gap-2 ${password.length >= 8 ? 'text-ump-green' : 'text-ump-gray'}`}>
              {password.length >= 8 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              At least 8 characters
            </div>
            <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-ump-green' : 'text-ump-gray'}`}>
              {/[a-z]/.test(password) ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Lowercase letters
            </div>
            <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-ump-green' : 'text-ump-gray'}`}>
              {/[A-Z]/.test(password) ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Uppercase letters
            </div>
            <div className={`flex items-center gap-2 ${/\d/.test(password) ? 'text-ump-green' : 'text-ump-gray'}`}>
              {/\d/.test(password) ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Numbers
            </div>
          </div>
        </div>
      )}

      {/* Quick Security Tips */}
      {strengthResult.score < 60 && (
        <Alert className="border-ump-navy/30 bg-ump-navy/10">
          <Shield className="w-4 h-4 text-ump-navy" />
          <AlertDescription className="text-ump-navy">
            <strong>💡 Security Tips:</strong>
            <br />
            <span className="text-sm">
              Use a unique password for each account. Consider using a password manager to generate and store strong passwords securely.
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}