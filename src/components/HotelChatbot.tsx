import React, { useEffect } from 'react'

// Declare Tawk.to global variables for TypeScript
declare global {
  interface Window {
    Tawk_API?: any
    Tawk_LoadStart?: Date
  }
}

export default function HotelChatbot() {
  useEffect(() => {
    // Initialize Tawk.to variables
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    // Create and inject the Tawk.to script
    const script = document.createElement('script')
    const firstScript = document.getElementsByTagName('script')[0]
    
    script.async = true
    script.src = 'https://embed.tawk.to/68d7a3f1c06f4419529ffd38/1j655gq7u'
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')
    
    // Insert the script into the DOM
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    }

    // Optional: Customize the widget appearance to match UMP theme
    window.Tawk_API.onLoad = function() {
      // You can add custom styling or configuration here if needed
      console.log('Tawk.to chatbot loaded successfully for Egumeni Eats')
    }

    // Cleanup function to remove script when component unmounts
    return () => {
      // Remove the script if it exists
      const existingScript = document.querySelector('script[src*="tawk.to"]')
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript)
      }

      // Clean up global variables (safely handle non-configurable properties)
      try {
        delete window.Tawk_API
      } catch (e) {
        // Ignore if property cannot be deleted
      }
      try {
        delete window.Tawk_LoadStart
      } catch (e) {
        // Ignore if property cannot be deleted
      }
    }
  }, [])

  // Return null since Tawk.to handles its own UI
  return null
}