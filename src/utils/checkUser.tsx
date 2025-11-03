// Helper utility to check user credentials in Firebase
// Use this in browser console to verify user data

import { getUsers } from './api'

export const checkUserCredentials = async (email?: string) => {
  try {
    if (!email) {
      console.error('❌ No email provided')
      return null
    }

    const users = await getUsers()
    const user = users.find((u: any) => u.email && u.email.toLowerCase() === email.toLowerCase())

    if (user) {
      console.log('✅ User found:', {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        created: user.created_at || user.createdAt
      })
      return user
    } else {
      console.log('❌ User not found with email:', email)
      console.log('📋 Available users:')
      users.forEach((u: any, index: number) => {
        console.log(`  ${index + 1}. ${u.email} (${u.role})`)
      })
      return null
    }
  } catch (error) {
    console.error('Error checking user:', error)
    return null
  }
}

export const listAllUsers = async () => {
  try {
    const users = await getUsers()

    // Filter out any malformed user objects
    const validUsers = users.filter((u: any) => u && u.email)

    if (validUsers.length < users.length) {
      console.warn(`⚠️ Found ${users.length - validUsers.length} malformed user records`)
    }

    console.table(validUsers.map((u: any) => ({
      email: u.email || 'N/A',
      name: u.name || 'N/A',
      role: u.role || 'N/A',
      active: u.isActive !== false
    })))
    return validUsers
  } catch (error) {
    console.error('Error listing users:', error)
    return []
  }
}

// Add to window for easy console access
// Only assign to window when it's fully loaded
if (typeof window !== 'undefined' && window) {
  try {
    (window as any).checkUserCredentials = checkUserCredentials;
    (window as any).listAllUsers = listAllUsers;
  } catch (error) {
    console.log('Note: Debug functions will be available after page load')
  }
}
