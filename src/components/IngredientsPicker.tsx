import React, { useState, useMemo } from 'react'
import { Input } from './ui/input'

type SimpleInventoryItem = {
  id: string
  name: string
  unit?: string
  category?: string
}

export function IngredientsPicker({
  inventoryItems,
  selectedIngredients,
  addIngredient,
  updateIngredientQuantity,
  removeIngredient,
  ingredientSelectKey,
  setIngredientSelectKey
}: {
  inventoryItems: SimpleInventoryItem[]
  selectedIngredients: { inventoryId: string; name: string; quantity: number; unit?: string }[]
  addIngredient: (inventoryId: string, name: string, unit: string) => void
  updateIngredientQuantity: (inventoryId: string, quantity: number) => void
  removeIngredient: (inventoryId: string) => void
  ingredientSelectKey?: number
  setIngredientSelectKey?: (fn: (prev: number) => number) => void
}) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'ingredients' | 'supplies' | 'beverages' | 'extras'>('ingredients')

  // Filter available inventory to show — exclude already selected
  const availableItems = useMemo(() => {
    const lower = search.trim().toLowerCase()
    return (inventoryItems || [])
      .filter(i => (filterCategory === 'all' ? true : i.category === filterCategory))
      .filter(i => !selectedIngredients.some(si => si.inventoryId === i.id))
      .filter(i => !lower || i.name.toLowerCase().includes(lower))
  }, [inventoryItems, selectedIngredients, search, filterCategory])

  const handleSelectAdd = (id: string) => {
    const item = inventoryItems.find(i => i.id === id)
    if (!item) return
    addIngredient(item.id, item.name, item.unit || 'unit')
    // reset select if caller provided key setter
    if (typeof setIngredientSelectKey === 'function') setIngredientSelectKey(k => k + 1)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

      {/* LEFT: scrollable inventory list with search + category filter */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              placeholder="Search inventory..."
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="ml-2 border rounded p-2"
            aria-label="Filter category"
          >
            <option value="ingredients">Ingredients</option>
            <option value="supplies">Supplies</option>
            <option value="beverages">Beverages</option>
            <option value="extras">Extras</option>
            <option value="all">All</option>
          </select>
        </div>

        <div
          className="ingredient-list max-h-64 overflow-y-auto border rounded-lg p-3 bg-white"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.02)' }}
        >
          {availableItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No matching items</div>
          ) : (
            availableItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.unit || 'unit'}</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* quick select (adds one with default qty=1) */}
                  <button
                    type="button"
                    onClick={() => handleSelectAdd(item.id)}
                    className="px-3 py-1 rounded text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* optional: select dropdown for keyboard users */}
        <div className="mt-3">
          <select
            key={ingredientSelectKey ?? 'ingredient-select'}
            onChange={(e) => {
              const id = e.target.value
              if (!id) return
              handleSelectAdd(id)
              e.currentTarget.value = ''
            }}
            defaultValue=""
            className="w-full border rounded p-2"
            aria-label="Select ingredient"
          >
            <option value="">Select and add an ingredient...</option>
            {inventoryItems
              .filter(i => (filterCategory === 'all' ? true : i.category === filterCategory))
              .map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.unit ? `(${i.unit})` : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* RIGHT: selected ingredients (scrollable) with quantity inputs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Selected Ingredients ({selectedIngredients.length})</h4>
          <div className="text-xs text-gray-500">You can change quantities or remove items</div>
        </div>

        <div className="selected-list max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
          {selectedIngredients.length === 0 ? (
            <div className="text-sm text-muted-foreground">No ingredients selected</div>
          ) : (
            selectedIngredients.map(ing => (
              <div key={ing.inventoryId} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ing.name}</div>
                  <div className="text-xs text-gray-500">{ing.unit || 'unit'}</div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={ing.quantity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (Number.isNaN(v)) return
                      updateIngredientQuantity(ing.inventoryId, v)
                    }}
                    className="w-20 border rounded text-center px-2 py-1"
                    aria-label={`Quantity for ${ing.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(ing.inventoryId)}
                    className="px-2 py-1 rounded text-sm border hover:bg-red-50 text-red-600"
                    aria-label={`Remove ${ing.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* optional: small helpers */}
        <div className="mt-3 text-xs text-gray-500">
          Tip: Use the search above to quickly find ingredients. The list and selected panel are both scrollable.
        </div>
      </div>
    </div>
  )
}
