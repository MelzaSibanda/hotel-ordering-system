import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../utils/firebase/config'
import { Package, RefreshCcw } from 'lucide-react'

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  isAvailable: boolean
}

export const InventoryStatusBanner: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [error, setError] = useState('')

  // 🔥 Fetch inventory from Firestore (Stores Dashboard collection)
  const fetchInventory = async () => {
    try {
      setLoadingInventory(true)
      setError('')

      const inventoryRef = collection(db, 'inventory')
      // Optional: Filter out deleted or inactive items
      const q = query(inventoryRef, where('isAvailable', '==', true))
      const snapshot = await getDocs(q)

      const items: InventoryItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<InventoryItem, 'id'>)
      }))

      setInventoryItems(items)
    } catch (err) {
      console.error('Error fetching inventory:', err)
      setError('Failed to load inventory. Please check your connection.')
    } finally {
      setLoadingInventory(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const ingredientCount = inventoryItems.filter(i => i.category === 'ingredients').length
  const supplyCount = inventoryItems.filter(i => i.category === 'supplies').length
  const beverageCount = inventoryItems.filter(i => i.category === 'beverages').length

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-2">
        <Package className="w-4 h-4 text-blue-600 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="text-blue-900 font-medium">Inventory Status</p>
          {loadingInventory ? (
            <p className="text-blue-700 text-xs mt-1">Loading inventory...</p>
          ) : error ? (
            <p className="text-red-600 text-xs mt-1">{error}</p>
          ) : inventoryItems.length === 0 ? (
            <p className="text-blue-700 text-xs mt-1">
              No inventory items found. Create items in the Stores Dashboard first.
            </p>
          ) : (
            <p className="text-blue-700 text-xs mt-1">
              <strong>{inventoryItems.length} total items:</strong>{' '}
              {ingredientCount} ingredients • {supplyCount} supplies • {beverageCount} beverages
            </p>
          )}
        </div>

        <button
          onClick={fetchInventory}
          disabled={loadingInventory}
          className="text-blue-700 hover:text-blue-900 text-xs flex items-center gap-1"
        >
          <RefreshCcw className={`w-3 h-3 ${loadingInventory ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  )
}
