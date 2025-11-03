import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../utils/firebase/config'
import { Clock, AlertTriangle, RefreshCw, CheckCircle, Minus, Plus } from 'lucide-react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

// Interfaces
interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  isAvailable: boolean
}

interface Ingredient {
  inventoryId: string
  name: string
  quantity: number
  unit: string
}

// Component section
export const InventorySelection: React.FC<{
  selectedIngredients: Ingredient[]
  updateIngredientQuantity: (id: string, qty: number) => void
  removeIngredient: (id: string) => void
  addIngredient: (inventoryId: string, name: string, unit: string) => void
}> = ({ selectedIngredients, updateIngredientQuantity, removeIngredient, addIngredient }) => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[] | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  // ✅ Fetch inventory from Firestore
  const loadInventoryItems = async () => {
    try {
      console.log('📦 InventorySelection: Loading inventory items directly from Firestore...')

      // Fetch all documents from the "inventory" collection
      const querySnapshot = await getDocs(collection(db, 'inventory'))

      if (querySnapshot.empty) {
        console.warn('⚠️ InventorySelection: No inventory items found in Firestore.')
        setInventoryItems([])
        return
      }

      // Map through all documents to form an array
      const items: InventoryItem[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<InventoryItem, 'id'>)
      }))

      console.log(`✅ InventorySelection: Loaded ${items.length} inventory items from Firestore.`)

      // Log category breakdown
      const ingredients = items.filter((i) => i?.category === 'ingredients')
      const supplies = items.filter((i) => i?.category === 'supplies')
      const beverages = items.filter((i) => i?.category === 'beverages')

      console.log(`📦 Inventory breakdown:`)
      console.log(`   • ${ingredients.length} ingredients`)
      console.log(`   • ${supplies.length} supplies`)
      console.log(`   • ${beverages.length} beverages`)

      if (items.length > 0) {
        console.log(
          '📋 Sample items:',
          items.slice(0, 3).map((i) => `${i?.name || 'Unnamed'} (${i?.category || 'unknown'})`)
        )
      }

      // Save items in state
      setInventoryItems(items)
    } catch (error) {
      console.error('❌ InventorySelection: Failed to load inventory from Firestore.')
      if (error instanceof Error) {
        console.error('Error details:', error.message)
      }
      setInventoryItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventoryItems()
  }, [])

  // ✅ Compute counts
  const ingredientCount = inventoryItems?.filter(i => i.category === 'ingredients').length || 0
  const supplyCount = inventoryItems?.filter(i => i.category === 'supplies').length || 0
  const beverageCount = inventoryItems?.filter(i => i.category === 'beverages').length || 0

  return (
    <div className="space-y-3">
      {/* Selected Ingredients */}
      {selectedIngredients.length > 0 && (
        <div className="border rounded-lg p-3 space-y-2">
          <Label className="text-sm">
            Selected Inventory Items ({selectedIngredients.length}):
          </Label>

          {selectedIngredients.map((ingredient) => {
            const inventoryItem = inventoryItems?.find(item => item.id === ingredient.inventoryId)
            return (
              <div key={ingredient.inventoryId} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{ingredient.name}</span>
                  {inventoryItem && (
                    <Badge variant="outline" className="text-xs">
                      {inventoryItem.category}
                    </Badge>
                  )}
                </div>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    updateIngredientQuantity(ingredient.inventoryId, parseFloat(e.target.value) || 0)
                  }
                  className="w-20 h-8"
                />
                <span className="text-sm text-gray-500 w-12">{ingredient.unit}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeIngredient(ingredient.inventoryId)}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Inventory Status Messages */}
      {loading ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <Clock className="w-4 h-4 inline mr-1" />
            Loading inventory items...
          </p>
        </div>
      ) : inventoryItems === undefined || inventoryItems.length === 0 ? (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
          <p className="text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            <strong>No inventory items found</strong>
          </p>
          <p className="text-xs text-yellow-700">
            Go to Stores Dashboard to add inventory items (ingredients, supplies, beverages)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadInventoryItems}
            className="text-xs h-7"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Inventory
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              {inventoryItems.length} items available: {ingredientCount} ingredients, {supplyCount} supplies, {beverageCount} beverages
            </p>
          </div>

          {/* Available Inventory Items */}
          <div className="border rounded-lg p-3">
            <Label className="text-sm font-medium mb-3 block">
              Available Inventory Items:
            </Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {inventoryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white border rounded p-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        ({item.quantity} {item.unit} available)
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addIngredient(item.id, item.name, item.unit)}
                    className="h-8 w-8 p-0 ml-2"
                    disabled={!item.isAvailable}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
