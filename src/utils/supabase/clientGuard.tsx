// Supabase Client Guard
// This utility helps prevent accidental creation of multiple Supabase client instances
// which can cause "Multiple GoTrueClient instances detected" warnings

let clientInstanceCount = 0
const CLIENT_INSTANCES_CREATED: string[] = []

export const trackClientCreation = (location: string) => {
  clientInstanceCount++
  CLIENT_INSTANCES_CREATED.push(location)
  
  if (clientInstanceCount > 1) {
    console.error('🚨 MULTIPLE SUPABASE CLIENTS DETECTED!')
    console.error(`Total instances: ${clientInstanceCount}`)
    console.error('Created at:', CLIENT_INSTANCES_CREATED)
    console.error('This will cause GoTrueClient warnings and potential auth issues.')
    console.error('Solution: Import { supabase } from "./utils/supabase/client" instead of creating new clients.')
  } else {
    console.log(`✅ Supabase client tracked: ${location}`)
  }
}

export const getClientStats = () => ({
  count: clientInstanceCount,
  locations: [...CLIENT_INSTANCES_CREATED]
})

export const resetClientTracking = () => {
  clientInstanceCount = 0
  CLIENT_INSTANCES_CREATED.length = 0
  if (typeof window !== 'undefined') {
    delete (window as any).__supabaseClientCreated
  }
}