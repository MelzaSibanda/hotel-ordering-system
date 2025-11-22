import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription } from './ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Utensils, Hotel, Users, AlertCircle, UserPlus, CheckCircle, Shield, ChevronLeft, ChevronRight, Clock, Star, Zap, Key } from 'lucide-react'
import PasswordSecurityChecker from './PasswordSecurityChecker'
import { Badge } from './ui/badge'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from '../utils/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'

// University of Mpumalanga logo and background (fallback to placeholder if assets not available)
const defaultLogo = "/src/assets/logo.png"

const backgroundImage = "/src/assets/background.png"

export default function Login() {
  const { login, signup } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('login')
  const [currentLogo, setCurrentLogo] = useState(defaultLogo)
  
  // Clear messages when switching tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Clear error messages when switching tabs, but keep success message if switching to login after signup
    if (value === 'signup') {
      setError('')
      setSuccess('')
    }
  }

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })

  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'customer', // Fixed as customer for public signup
    phone: '',
    staffNo: '',
    roomNumber: '',
    visitorNo: '',
    isAdmin: false, // Admin checkbox
    adminPin: '' // Admin PIN for verification
  })

  // Password security state
  const [passwordSecurity, setPasswordSecurity] = useState({
    isSecure: false,
    isCompromised: false,
    breachCount: 0,
    strengthScore: 0,
    issues: [] as string[],
    suggestions: [] as string[]
  })

  // Ref for auto-focusing password field after signup
  const loginPasswordRef = useRef<HTMLInputElement>(null)

  // Load logo on component mount
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const { api } = await import('../utils/api')
        const data = await api.request('/logo')
        if (data.logoUrl) {
          setCurrentLogo(data.logoUrl)
        }
      } catch (error) {
        console.error('Failed to load logo:', error)
        // Keep default logo
      }
    }
    loadLogo()
  }, [])

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  // Slideshow component
  const Slideshow = () => {
    const [currentSlide, setCurrentSlide] = useState(0)

    const slides = [
      {
        icon: <Utensils className="w-8 h-8 text-ump-orange" />,
        title: "Welcome to Egumeni Eats",
        description: "Experience premium dining with our innovative ordering system powered by University of Mpumalanga technology."
      },
      {
        icon: <Clock className="w-8 h-8 text-ump-blue" />,
        title: "Fast & Reliable Service",
        description: "Place your orders instantly and track them in real-time. Our kitchen staff ensures your food is prepared fresh and delivered promptly."
      },
      {
        icon: <Star className="w-8 h-8 text-ump-green" />,
        title: "Quality Ingredients",
        description: "We use only the finest ingredients sourced locally and internationally. Our inventory management ensures freshness and quality."
      },
      {
        icon: <Zap className="w-8 h-8 text-ump-red" />,
        title: "Modern Technology",
        description: "Built with cutting-edge Firebase technology for secure, cloud-based operations. Experience the future of hotel dining today."
      },
      {
        icon: <Users className="w-8 h-8 text-ump-navy" />,
        title: "For Everyone",
        description: "Whether you're a hotel guest, conference attendee, or UMP community member, our system caters to all your dining needs."
      }
    ]

    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length)
      }, 4000) // Change slide every 4 seconds

      return () => clearInterval(timer)
    }, [slides.length])

    const nextSlide = () => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }

    const prevSlide = () => {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    }

    return (
      <div className="relative overflow-hidden">
        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          {slides.map((slide, index) => (
            <div key={index} className="w-full flex-shrink-0 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white/10 rounded-full border border-white/20">
                  {slide.icon}
                </div>
                <h3 className="text-xl font-bold text-white">{slide.title}</h3>
                <p className="text-white/80 text-sm max-w-md leading-relaxed">{slide.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center space-x-2 mt-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              title={`Go to slide ${index + 1}`}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide ? 'bg-white w-6' : 'bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        <button
          onClick={prevSlide}
          title="Previous slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300"
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={nextSlide}
          title="Next slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('') // Clear success message when attempting login

    console.log('🔐 Attempting login for:', loginData.email)
    
    const result = await login(loginData.email, loginData.password)
    
    if (!result.success) {
      console.error('❌ Login failed:', result.error)
      setError(result.error || 'Login failed')
    } else {
      console.log('✅ Login successful!')
    }
    
    setIsLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    // Admin PIN validation
    if (signupData.isAdmin && signupData.adminPin !== 'EfGoUoMdEsNyIsEtAeTmS') {
      setError('Invalid administrator PIN. Please contact your system administrator.')
      setIsLoading(false)
      return
    }

    // Password security validation
    if (!passwordSecurity.isSecure) {
      setError('Please choose a stronger password. Your password must meet all security requirements.')
      setIsLoading(false)
      return
    }

    // Admin validation - require staff number
    if (signupData.isAdmin && !signupData.staffNo.trim()) {
      setError('Administrator accounts require a valid staff number.')
      setIsLoading(false)
      return
    }

    // Determine role based on selections
    let selectedRole = 'customer'
    if (signupData.isAdmin) {
      selectedRole = 'admin'
    }

    console.log('📝 Creating account for:', signupData.email, `(Role: ${selectedRole})`)

    const result = await signup(
      signupData.email,
      signupData.password,
      signupData.name,
      selectedRole, // Use the determined role
      signupData.phone,
      signupData.staffNo,
      signupData.roomNumber,
      signupData.visitorNo
    )

    if (!result.success) {
      console.error('❌ Signup failed:', result.error)
      setError(result.error || 'Signup failed')
    } else {
      console.log('✅ Signup successful! User must now log in.')

      // Clear the signup form
      setSignupData({
        email: '',
        password: '',
        name: '',
        role: 'customer',
        phone: '',
        staffNo: '',
        roomNumber: '',
        visitorNo: '',
        isAdmin: false,
        adminPin: ''
      })

      // Pre-fill the login email for convenience
      setLoginData({
        email: signupData.email,
        password: ''
      })

      // Switch to login tab
      setActiveTab('login')

      // Show success message
      const accountType = selectedRole === 'admin' ? 'Administrator' :
                         'Customer'
      setSuccess(`🎉 ${accountType} account created successfully for ${signupData.email}! Your password has been saved. Please enter your credentials below to log in.`)

      // Auto-focus password field after a short delay
      setTimeout(() => {
        loginPasswordRef.current?.focus()
      }, 300)
    }

    setIsLoading(false)
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    if (!resetEmail.trim()) {
      setError('Please enter your email address')
      setIsLoading(false)
      return
    }

    try {
      // Check if user exists in our system first
      const userExists = await checkUserExists(resetEmail.trim())

      if (!userExists) {
        setError('No account found with this email address. Please check your email or create a new account.')
        setIsLoading(false)
        return
      }

      // Send password reset email via Firebase Auth
      await sendPasswordResetEmail(auth, resetEmail.trim())

      setSuccess('Password reset email sent! Please check your inbox and follow the instructions to reset your password.')
      setResetEmail('')
      setShowPasswordReset(false)

      // Auto-switch to login tab after successful reset request
      setTimeout(() => {
        setActiveTab('login')
      }, 2000)

    } catch (error: any) {
      console.error('Password reset error:', error)

      if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format')
      } else if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address')
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many reset attempts. Please try again later.')
      } else {
        setError('Failed to send password reset email. Please try again.')
      }
    }

    setIsLoading(false)
  }

  const checkUserExists = async (email: string): Promise<boolean> => {
    try {
      // Query Firestore for user with this email
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email.toLowerCase()))
      const querySnapshot = await getDocs(q)

      return !querySnapshot.empty
    } catch (error) {
      console.error('Error checking user existence:', error)
      return false
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #2c5273 0%, #1e3a5f 50%, #0f1419 100%)`
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-ump-orange/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-ump-green/10 rounded-full blur-lg animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-ump-blue/10 rounded-full blur-2xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-ump-red/10 rounded-full blur-xl animate-pulse delay-3000"></div>

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.1) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
        {/* Header Section with Enhanced Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute inset-0 bg-gradient-to-r from-ump-orange via-ump-green to-ump-blue rounded-full blur-xl opacity-30 animate-pulse"></div>
              {/* Main logo container */}
              <div className="relative gradient-accent rounded-full p-8 shadow-2xl border-4 border-white/20 backdrop-blur-sm animate-premium-float">
                <img
                  src={currentLogo}
                  alt="Egumeni Eats"
                  className="w-20 h-20 object-contain drop-shadow-lg"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-ump-orange rounded-full border-2 border-white shadow-lg animate-bounce"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-ump-green rounded-full border-2 border-white shadow-lg animate-bounce delay-300"></div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-white drop-shadow-2xl tracking-tight animate-fade-in-up">
              Egumeni Eats
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-1 text-sm font-medium">
                University of Mpumalanga
              </Badge>
              <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
            </div>
            <p className="text-white/90 font-semibold text-xl drop-shadow-md">
              Conference Centre
            </p>
            <p className="text-white/80 font-medium text-lg">
              Egumeni Restaurant & Bar Ordering System
            </p>
          </div>

          {/* Enhanced Brand Colors */}
          <div className="flex justify-center items-center space-x-4 mt-8">
            <div className="group cursor-pointer">
              <div className="w-5 h-5 bg-gradient-to-br from-ump-orange to-[#d4941a] rounded-full shadow-lg border-2 border-white/30 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="text-xs text-white/70 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Energy</div>
            </div>
            <div className="group cursor-pointer">
              <div className="w-5 h-5 bg-gradient-to-br from-ump-green to-[#3a8d6d] rounded-full shadow-lg border-2 border-white/30 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="text-xs text-white/70 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Growth</div>
            </div>
            <div className="group cursor-pointer">
              <div className="w-5 h-5 bg-gradient-to-br from-ump-red to-[#c9433f] rounded-full shadow-lg border-2 border-white/30 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="text-xs text-white/70 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Passion</div>
            </div>
            <div className="group cursor-pointer">
              <div className="w-5 h-5 bg-gradient-to-br from-ump-blue to-[#2c5273] rounded-full shadow-lg border-2 border-white/30 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="text-xs text-white/70 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Trust</div>
            </div>
          </div>
        </div>

        {/* Main Login Card with Enhanced Design */}
        <div className="backdrop-blur-xl bg-white/10 shadow-2xl rounded-3xl border border-white/20 overflow-hidden">
          <div className="p-8 pb-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-md">Welcome Back</h2>
              <p className="text-white/90 font-medium text-lg">
                Sign in to your account or create a new customer account
              </p>
              <div className="flex items-center justify-center mt-4">
                <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
                <Utensils className="w-5 h-5 text-ump-orange mx-3" />
                <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 backdrop-blur-md bg-white/10 p-2 h-auto gap-3 mb-8 border border-white/20 rounded-2xl">
                <TabsTrigger value="login" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-ump-navy data-[state=active]:shadow-lg transition-all duration-300 py-4 font-bold text-white data-[state=active]:scale-105 hover:bg-white/20">
                  <Users className="w-4 h-4 mr-2" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-ump-navy data-[state=active]:shadow-lg transition-all duration-300 py-4 font-bold text-white data-[state=active]:scale-105 hover:bg-white/20">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {error && (
                <Alert className="mt-6 border-red-400/50 bg-red-500/10 backdrop-blur-sm">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-200 font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mt-6 border-green-400/50 bg-green-500/10 backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-200 font-medium">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="login-email" className="text-white font-semibold text-lg">Email Address</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your email address"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="login-password" className="text-white font-semibold text-lg">Password / PIN</Label>
                    <Input
                      ref={loginPasswordRef}
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your password or PIN"
                    />
                  </div>
                  <div className="space-y-4">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-ump-orange to-ump-red hover:from-ump-orange/90 hover:to-ump-red/90 text-white font-bold py-4 text-lg shadow-xl transform hover:scale-105 transition-all duration-300"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                          Signing In...
                        </>
                      ) : (
                        <>
                          <Users className="w-5 h-5 mr-3" />
                          Sign In to Dashboard
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowPasswordReset(true)}
                      className="w-full text-white/80 hover:text-white hover:bg-white/10 font-medium py-2"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Forgot Password?
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-6">
                <form onSubmit={handleSignup} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="signup-name" className="text-white font-semibold text-lg">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupData.name}
                      onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-email" className="text-white font-semibold text-lg">Email Address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your email address"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-password" className="text-white font-semibold text-lg">Create Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Create a secure password"
                    />

                    {/* Password Security Checker */}
                    {signupData.password && (
                      <div className="mt-3">
                        <PasswordSecurityChecker
                          password={signupData.password}
                          onSecurityChange={setPasswordSecurity}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-phone" className="text-white font-semibold text-lg">Cell Number</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      value={signupData.phone}
                      onChange={(e) => setSignupData({...signupData, phone: e.target.value})}
                      required
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your cell number"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-staffNo" className="text-white font-semibold text-lg">Staff Number <span className="text-white/60 font-normal">(for UMP staff)</span></Label>
                    <Input
                      id="signup-staffNo"
                      type="text"
                      value={signupData.staffNo}
                      onChange={(e) => setSignupData({...signupData, staffNo: e.target.value})}
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your UMP staff number"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-roomNumber" className="text-white font-semibold text-lg">Room Number <span className="text-white/60 font-normal">(for hotel guests)</span></Label>
                    <Input
                      id="signup-roomNumber"
                      type="text"
                      value={signupData.roomNumber}
                      onChange={(e) => setSignupData({...signupData, roomNumber: e.target.value})}
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your room number"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-visitorNo" className="text-white font-semibold text-lg">Visitor Number <span className="text-white/60 font-normal">(for conference guests)</span></Label>
                    <Input
                      id="signup-visitorNo"
                      type="text"
                      value={signupData.visitorNo}
                      onChange={(e) => setSignupData({...signupData, visitorNo: e.target.value})}
                      className="backdrop-blur-md bg-white/10 border-white/30 focus:border-white text-white placeholder:text-white/70 h-12 text-lg"
                      placeholder="Enter your visitor number"
                    />
                  </div>

                  {/* Role Selection Checkboxes */}
                  <div className="space-y-6">
                    <Label className="text-white font-semibold text-lg">Account Type</Label>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Admin Checkbox */}
                      <div className="flex items-center space-x-4 p-4 backdrop-blur-md bg-white/10 border border-white/30 rounded-xl hover:bg-white/20 transition-all duration-300 cursor-pointer"
                           onClick={() => setSignupData({...signupData, isAdmin: !signupData.isAdmin})}>
                        <input
                          id="signup-isAdmin"
                          type="checkbox"
                          checked={signupData.isAdmin}
                          onChange={(e) => setSignupData({...signupData, isAdmin: e.target.checked})}
                          className="rounded border-white/50 focus:ring-white text-ump-orange"
                          title="Check this box if you are an administrator"
                        />
                        <div className="flex-1">
                          <Label htmlFor="signup-isAdmin" className="text-white font-semibold text-lg cursor-pointer">
                            Administrator Access
                          </Label>
                          <p className="text-white/80 text-sm">Full system access and user management (requires PIN)</p>
                        </div>
                        <Shield className="w-6 h-6 text-ump-orange" />
                      </div>

                      {/* Default Customer Option */}
                      <div className={`flex items-center space-x-4 p-4 backdrop-blur-md border rounded-xl transition-all duration-300 cursor-pointer ${
                        !signupData.isAdmin
                          ? 'bg-gradient-to-r from-ump-green/20 to-ump-blue/20 border-ump-green/50'
                          : 'bg-white/10 border-white/30 hover:bg-white/20'
                      }`}
                           onClick={() => setSignupData({ ...signupData, isAdmin: false })}>
                        <input
                          id="signup-isCustomer"
                          type="checkbox"
                          checked={!signupData.isAdmin}
                          onChange={() => setSignupData({ ...signupData, isAdmin: false })}
                          className="rounded border-white/50 focus:ring-white text-ump-green"
                          title="Sign up as a customer"
                        />
                        <div className="flex-1">
                          <Label htmlFor="signup-isCustomer" className="text-white font-semibold text-lg cursor-pointer">
                            Customer / Guest
                          </Label>
                          <p className="text-white/80 text-sm">Hotel guest or UMP community member</p>
                        </div>
                        <Users className="w-6 h-6 text-ump-green" />
                      </div>
                    </div>

                    {signupData.isAdmin && (
                      <div className="animate-fade-in-up space-y-3">
                        <Label htmlFor="signup-adminPin" className="text-white font-semibold text-lg">Administrator PIN</Label>
                        <Input
                          id="signup-adminPin"
                          type="password"
                          value={signupData.adminPin}
                          onChange={(e) => setSignupData({...signupData, adminPin: e.target.value})}
                          required={signupData.isAdmin}
                          className="backdrop-blur-md bg-white/10 border-white/30 focus:border-ump-red text-white placeholder:text-white/70 h-12 text-lg"
                          placeholder="Enter admin PIN: EfGoUoMdEsNyIsEtAeTmS"
                        />
                      </div>
                    )}
                  </div>

                  {/* Info about signup options */}
                  <Alert className="bg-white/10 border-white/30 backdrop-blur-sm">
                    <Users className="h-5 w-5 text-white" />
                    <AlertDescription className="text-white/90 font-medium">
                      <strong>Account Options:</strong> Select your role above. Customers and guests can sign up directly. Staff accounts must be created by an administrator. Administrators require PIN verification.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-ump-green to-ump-blue hover:from-ump-green/90 hover:to-ump-blue/90 text-white font-bold py-4 text-lg shadow-xl transform hover:scale-105 transition-all duration-300"
                    disabled={isLoading || (signupData.password && !passwordSecurity.isSecure) || (signupData.isAdmin && signupData.adminPin !== 'EfGoUoMdEsNyIsEtAeTmS')}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                        Creating Account...
                      </>
                    ) : signupData.isAdmin ? (
                      <>
                        <Shield className="w-5 h-5 mr-3" />
                        Create Admin Account
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 mr-3" />
                        Create Customer Account
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Informative Messages Slideshow */}
        <div className="mt-8">
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <Slideshow />
          </div>
        </div>

        {/* Password Reset Dialog */}
        <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-ump-orange" />
                Reset Password
              </DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-gray-700 font-semibold">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="h-12"
                  placeholder="Enter your email address"
                />
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <Button
                  type="submit"
                  className="w-full bg-ump-navy hover:bg-ump-navy/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending Reset Email...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Send Reset Email
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordReset(false)
                    setResetEmail('')
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Footer Information */}
        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-white/90">
            <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
            <Hotel className="w-5 h-5 text-ump-orange" />
            <span className="font-semibold">Premium Dining Experience</span>
            <Hotel className="w-5 h-5 text-ump-orange" />
            <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent flex-1"></div>
          </div>

          <p className="text-white/80 font-medium">Powered by University of Mpumalanga Technology Services</p>
          <div className="flex items-center justify-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              Firebase Edition
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              Cloud Database
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
