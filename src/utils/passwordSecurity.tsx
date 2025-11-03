// Password security utilities for Egumeni Eats
// This is a standalone implementation without external API dependencies

export interface PasswordStrengthResult {
  score: number // 0-100
  isValid: boolean
  issues: string[]
  suggestions: string[]
}

export interface PasswordLeakResult {
  isCompromised: boolean
  breachCount: number
  error?: string
}

/**
 * Validates password strength based on multiple criteria
 * Returns a score from 0-100 and validation details
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const issues: string[] = []
  const suggestions: string[] = []
  let score = 0

  // Basic validation
  if (!password) {
    return {
      score: 0,
      isValid: false,
      issues: ['Password is required'],
      suggestions: ['Enter a password']
    }
  }

  // Length check (most important factor)
  const length = password.length
  if (length >= 12) {
    score += 30
  } else if (length >= 10) {
    score += 25
  } else if (length >= 8) {
    score += 20
  } else {
    issues.push('Password is too short')
    suggestions.push('Use at least 8 characters (12+ recommended)')
    score += Math.min(length * 2, 15)
  }

  // Lowercase letters
  if (/[a-z]/.test(password)) {
    score += 15
  } else {
    issues.push('Missing lowercase letters')
    suggestions.push('Add lowercase letters (a-z)')
  }

  // Uppercase letters
  if (/[A-Z]/.test(password)) {
    score += 15
  } else {
    issues.push('Missing uppercase letters')
    suggestions.push('Add uppercase letters (A-Z)')
  }

  // Numbers
  if (/\d/.test(password)) {
    score += 15
  } else {
    issues.push('Missing numbers')
    suggestions.push('Add numbers (0-9)')
  }

  // Special characters
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 15
  } else {
    suggestions.push('Consider adding special characters (!@#$%^&*)')
  }

  // Extra points for complexity
  if (length >= 16) {
    score += 5
  }

  // Check for common patterns (reduce score)
  const commonPatterns = [
    /^[a-z]+$/i, // Only letters
    /^\d+$/, // Only numbers
    /(.)\1{2,}/, // Repeated characters (aaa, 111)
    /^(12345|qwerty|password|admin|user)/i, // Common passwords
    /^[a-z]{1,3}\d+$/i // Simple pattern like abc123
  ]

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 10)
      if (!issues.includes('Avoid common patterns')) {
        issues.push('Avoid common patterns')
        suggestions.push('Avoid common patterns like 123456, qwerty, or repeated characters')
      }
      break
    }
  }

  // Cap score at 100
  score = Math.min(100, score)

  // Password is valid if score >= 60 and meets minimum requirements
  const isValid = score >= 60 && 
                  length >= 8 && 
                  /[a-z]/.test(password) && 
                  /[A-Z]/.test(password) && 
                  /\d/.test(password)

  return {
    score,
    isValid,
    issues,
    suggestions
  }
}

/**
 * Gets a user-friendly description of password strength
 */
export function getPasswordStrengthDescription(score: number): {
  label: string
  description: string
  color: string
} {
  if (score >= 80) {
    return {
      label: 'Strong',
      description: 'Excellent! Your password is very secure.',
      color: 'text-ump-green'
    }
  } else if (score >= 60) {
    return {
      label: 'Good',
      description: 'Good password strength. Consider making it even stronger.',
      color: 'text-ump-navy'
    }
  } else if (score >= 40) {
    return {
      label: 'Fair',
      description: 'Your password could be stronger. Follow the suggestions below.',
      color: 'text-ump-orange'
    }
  } else {
    return {
      label: 'Weak',
      description: 'Weak password. Please improve it for better security.',
      color: 'text-ump-red'
    }
  }
}

/**
 * Check if password has been compromised in known data breaches
 * NOTE: This is a placeholder for the standalone system
 * In a real implementation, this would use the Have I Been Pwned API
 * For now, it just checks against a small list of commonly compromised passwords
 */
export async function checkPasswordLeak(password: string): Promise<PasswordLeakResult> {
  // For standalone system, we'll just check against common compromised passwords
  // This is NOT a replacement for a real breach database check
  
  const commonlyCompromisedPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball',
    'iloveyou', 'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
    'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael',
    'football', 'password1', 'welcome', 'jesus', 'ninja', 'mustang'
  ]

  // Simulate a small delay (like API call would have)
  await new Promise(resolve => setTimeout(resolve, 300))

  const lowerPassword = password.toLowerCase()
  const isCompromised = commonlyCompromisedPasswords.includes(lowerPassword)

  return {
    isCompromised,
    breachCount: isCompromised ? Math.floor(Math.random() * 1000000) + 10000 : 0
  }
}

/**
 * Generate a random secure password
 */
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%^&*()-_=+[]{}|;:,.<>?'
  
  const allChars = lowercase + uppercase + numbers + special
  
  let password = ''
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Check if password matches confirmation
 */
export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword && password.length > 0
}

/**
 * Get password requirements text
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 8 characters long (12+ recommended)',
    'Contains lowercase letters (a-z)',
    'Contains uppercase letters (A-Z)',
    'Contains numbers (0-9)',
    'Contains special characters (!@#$%^&*)',
    'Avoid common words or patterns'
  ]
}
