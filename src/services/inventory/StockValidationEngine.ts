import { recipeOperations } from '../../utils/firebase/firestore'
import { UnitConversionService } from './UnitConversionService'
import { InventoryService } from './InventoryService'
import { StockValidationResult, IngredientValidation, OrderItem } from './types'

export class StockValidationEngine {
  private unitConverter = new UnitConversionService()
  private inventoryService = new InventoryService()

  async validate(orderItems: OrderItem[]): Promise<StockValidationResult> {
    const results: IngredientValidation[] = []

    for (const item of orderItems) {
      try {
        // Get recipe for this menu item
        const recipe = await recipeOperations.getRecipe(item.menuItemId) as any

        if (!recipe || !recipe.ingredients?.length) {
          results.push({
            itemId: item.menuItemId,
            itemName: item.name,
            valid: false,
            reason: 'No recipe configured'
          })
          continue
        }

        // Validate each ingredient
        for (const ingredient of recipe.ingredients) {
          const stockInfo = await this.inventoryService.getCurrentStock(ingredient.inventoryId)
          const requiredQuantity = ingredient.quantity * item.quantity

          // Convert units if necessary
          const convertedRequired = this.unitConverter.convert(
            requiredQuantity,
            ingredient.unit,
            stockInfo.unit
          )

          if (convertedRequired > stockInfo.quantity) {
            results.push({
              itemId: item.menuItemId,
              itemName: item.name,
              ingredientId: ingredient.inventoryId,
              ingredientName: ingredient.name,
              required: convertedRequired,
              available: stockInfo.quantity,
              unit: stockInfo.unit,
              valid: false,
              reason: 'Insufficient stock'
            })
          } else {
            results.push({
              itemId: item.menuItemId,
              itemName: item.name,
              valid: true,
              reason: 'Stock available'
            })
          }
        }
      } catch (error) {
        console.error(`Error validating ${item.name}:`, error)
        results.push({
          itemId: item.menuItemId,
          itemName: item.name,
          valid: false,
          reason: 'Validation error'
        })
      }
    }

    return {
      isValid: results.every(r => r.valid),
      results
    }
  }
}