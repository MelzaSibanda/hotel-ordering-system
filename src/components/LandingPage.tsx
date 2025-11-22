import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import {
  Utensils,
  Star,
  Clock,
  Users,
  ShoppingCart,
  LogIn,
  ChefHat,
  Award,
  TrendingUp,
  Heart,
  Sparkles,
  Crown,
  Zap
} from 'lucide-react'
import { api } from '../utils/api'

// University of Mpumalanga logo and background
const defaultLogo = "/src/assets/logo.png"
const backgroundImage = "/src/assets/background.png"

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  image: string
  ingredients: string[]
  preparationTime: number
  isAvailable: boolean
  isPopular?: boolean
  rating?: number
  reviewCount?: number
}

export default function LandingPage() {
  const [menu, setMenu] = useState<{ [category: string]: MenuItem[] }>({})
  const [topSellingItems, setTopSellingItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentLogo, setCurrentLogo] = useState<string>(defaultLogo)

  useEffect(() => {
    loadMenu()
    loadLogo()
  }, [])

  const loadMenu = async () => {
    try {
      console.log('📋 Loading menu for landing page...')
      const data = await api.request('/menu')
      const menuData = data.menu || {}

      // Mark some items as popular for demo purposes
      const processedMenu: { [category: string]: MenuItem[] } = {}
      Object.keys(menuData).forEach(category => {
        processedMenu[category] = menuData[category].map((item: MenuItem, index: number) => ({
          ...item,
          isPopular: index < 3, // Mark first 3 items in each category as popular
          rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
          reviewCount: Math.floor(Math.random() * 50) + 10 // Random review count
        }))
      })

      setMenu(processedMenu)

      // Get top selling items (first 6 popular items)
      const allItems = Object.values(processedMenu).flat()
      const popularItems = allItems.filter(item => item.isPopular).slice(0, 6)
      setTopSellingItems(popularItems)

      console.log('✅ Menu loaded successfully:', allItems.length, 'items')
    } catch (error) {
      console.error('Failed to load menu:', error)
      setMenu({})
      setTopSellingItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadLogo = async () => {
    try {
      console.log('🖼️ Loading logo for landing page...')
      const data = await api.request('/logo')
      if (data.logoUrl) {
        setCurrentLogo(data.logoUrl)
        console.log('✅ Logo loaded successfully')
      }
    } catch (error) {
      console.error('Failed to load logo:', error)
      // Keep default logo
    }
  }

  const handleOrderClick = (item: MenuItem) => {
    handleLoginRedirect()
  }

  const handleLoginRedirect = () => {
    // Navigate to login page by updating URL
    window.location.href = '/login'
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'breakfast-meals-on-the-go': 'bg-orange-100 text-orange-800 border-orange-200',
      'breakfast-light-meal': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'main-salads-starters': 'bg-green-100 text-green-800 border-green-200',
      'main-selection': 'bg-blue-100 text-blue-800 border-blue-200',
      'beverages-white-wine': 'bg-purple-100 text-purple-800 border-purple-200',
      'beverages-coffee': 'bg-brown-100 text-brown-800 border-brown-200'
    }
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getCategoryDisplayName = (categoryValue: string): string => {
    const categoryMap: { [key: string]: string } = {
      'breakfast-meals-on-the-go': 'Meals on the Go',
      'breakfast-light-meal': 'Light Meals',
      'main-salads-starters': 'Salads & Starters',
      'main-selection': 'Main Selection',
      'beverages-white-wine': 'White Wine',
      'beverages-coffee': 'Coffee & Beverages'
    }
    return categoryMap[categoryValue] || categoryValue.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ump-blue-50 via-white to-ump-orange-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-ump-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ump-navy font-medium">Loading delicious options...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ump-blue-50 via-white to-ump-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-ump-blue/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src={currentLogo}
                alt="Egumeni Eats"
                className="w-10 h-10 object-contain mr-3"
              />
              <div>
                <h1 className="text-xl font-bold text-ump-navy">Egumeni Eats</h1>
                <p className="text-xs text-ump-gray"></p>
              </div>
            </div>
            <Button
              onClick={handleLoginRedirect}
              className="bg-ump-navy hover:bg-ump-navy/90 text-white"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-ump-orange via-ump-green to-ump-blue rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative gradient-accent rounded-full p-6 shadow-2xl">
                <img
                  src={currentLogo}
                  alt="Egumeni Eats"
                  className="w-20 h-20 object-contain"
                />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold text-ump-navy mb-4">
            Welcome to <span className="text-ump-orange">Egumeni Eats</span>
          </h1>
          
          <p className="text-lg text-ump-gray/80 max-w-2xl mx-auto">
            Experience exceptional cuisine crafted with the finest ingredients.
            Order from our most popular dishes or explore our complete menu.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-ump-blue/20">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              <span className="font-medium text-ump-navy">4.8/5 Customer Rating</span>
            </div>
            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-ump-blue/20">
              <Clock className="w-5 h-5 text-ump-green" />
              <span className="font-medium text-ump-navy">15-25 min Prep Time</span>
            </div>
            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-ump-blue/20">
              <Award className="w-5 h-5 text-ump-orange" />
              <span className="font-medium text-ump-navy">Award Winning Cuisine</span>
            </div>
          </div>
        </div>

        {/* Top Selling Items Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-ump-navy mb-4 flex items-center justify-center gap-3">
              <Crown className="w-8 h-8 text-ump-orange" />
              Our Most Popular Dishes
              <Crown className="w-8 h-8 text-ump-orange" />
            </h2>
            <p className="text-lg text-ump-gray max-w-2xl mx-auto">
              Discover what our guests love most. These customer favorites are prepared fresh daily
              using only the finest ingredients from local and international suppliers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {topSellingItems.map((item, index) => (
              <Card key={item.id} className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-0 shadow-lg overflow-hidden">
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-ump-orange/20 to-ump-blue/20 flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Utensils className="w-16 h-16 text-ump-navy/50" />
                    )}
                  </div>

                  {/* Popular Badge */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-gradient-to-r from-ump-orange to-ump-red text-white border-0 shadow-lg">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>

                  {/* Rating */}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-bold text-ump-navy">
                        {item.rating?.toFixed(1)}
                      </span>
                      <span className="text-xs text-ump-gray">
                        ({item.reviewCount})
                      </span>
                    </div>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <CardTitle className="text-xl text-ump-navy group-hover:text-ump-orange transition-colors">
                        {item.name}
                      </CardTitle>
                      <Badge className={`mt-2 ${getCategoryColor(item.category)}`}>
                        {getCategoryDisplayName(item.category)}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-ump-navy">
                        R{item.price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <CardDescription className="text-ump-gray mb-4 line-clamp-2">
                    {item.description}
                  </CardDescription>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-ump-gray">
                      <Clock className="w-4 h-4" />
                      <span>{item.preparationTime} min</span>
                    </div>

                    <Button
                      onClick={() => handleOrderClick(item)}
                      className="bg-gradient-to-r from-ump-orange to-ump-red hover:from-ump-orange/90 hover:to-ump-red/90 text-white shadow-lg transform hover:scale-105 transition-all duration-300"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Order Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center p-8 border-0 shadow-lg bg-gradient-to-br from-ump-green/10 to-ump-blue/10">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-ump-green to-ump-blue rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-ump-navy mb-3">Expert Chefs</CardTitle>
              <CardDescription className="text-ump-gray">
                Our culinary team brings years of experience and passion for creating exceptional dining experiences.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center p-8 border-0 shadow-lg bg-gradient-to-br from-ump-orange/10 to-ump-red/10">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-ump-orange to-ump-red rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-ump-navy mb-3">Fresh Ingredients</CardTitle>
              <CardDescription className="text-ump-gray">
                We source only the finest, freshest ingredients to ensure every dish meets our high standards.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center p-8 border-0 shadow-lg bg-gradient-to-br from-ump-blue/10 to-ump-navy/10">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-ump-blue to-ump-navy rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-ump-navy mb-3">Quick Service</CardTitle>
              <CardDescription className="text-ump-gray">
                Fast, efficient service without compromising on quality. Your satisfaction is our priority.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-ump-navy to-ump-blue rounded-3xl p-12 text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Experience Premium Dining?</h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Join thousands of satisfied guests who choose Egumeni Eats for their dining experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleLoginRedirect}
              size="lg"
              className="bg-white text-ump-navy hover:bg-white/90 font-bold px-8 py-4 text-lg shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <LogIn className="w-5 h-5 mr-3" />
              Sign In to Order
            </Button>
            <Button
              onClick={handleLoginRedirect}
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-ump-navy font-bold px-8 py-4 text-lg shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <Users className="w-5 h-5 mr-3" />
              Create Account
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}