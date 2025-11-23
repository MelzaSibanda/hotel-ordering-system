export class UnitConversionService {
  private conversionRates: { [key: string]: { [key: string]: number } } = {
    // Weight conversions (base: grams)
    g: { g: 1, kg: 0.001, lb: 0.00220462, oz: 0.035274 },
    kg: { g: 1000, kg: 1, lb: 2.20462, oz: 35.274 },
    lb: { g: 453.592, kg: 0.453592, lb: 1, oz: 16 },
    oz: { g: 28.3495, kg: 0.0283495, lb: 0.0625, oz: 1 },

    // Volume conversions (base: ml)
    ml: { ml: 1, l: 0.001, cup: 0.00416667, tbsp: 0.067628, tsp: 0.202884, fl_oz: 0.033814 },
    l: { ml: 1000, l: 1, cup: 4.16667, tbsp: 67.628, tsp: 202.884, fl_oz: 33.814 },
    cup: { ml: 240, l: 0.24, cup: 1, tbsp: 16, tsp: 48, fl_oz: 8 },
    tbsp: { ml: 14.7868, l: 0.0147868, cup: 0.0625, tbsp: 1, tsp: 3, fl_oz: 0.5 },
    tsp: { ml: 4.92892, l: 0.00492892, cup: 0.0208333, tbsp: 0.333333, tsp: 1, fl_oz: 0.166667 },
    fl_oz: { ml: 29.5735, l: 0.0295735, cup: 0.125, tbsp: 2, tsp: 6, fl_oz: 1 },

    // Count conversions (no conversion needed)
    each: { each: 1, piece: 1, item: 1, unit: 1 },
    piece: { each: 1, piece: 1, item: 1, unit: 1 },
    item: { each: 1, piece: 1, item: 1, unit: 1 },
    unit: { each: 1, piece: 1, item: 1, unit: 1 }
  }

  convert(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) {
      return quantity
    }

    const fromConversions = this.conversionRates[fromUnit.toLowerCase()]
    const toConversions = this.conversionRates[toUnit.toLowerCase()]

    if (!fromConversions || !toConversions) {
      throw new Error(`Unsupported unit conversion: ${fromUnit} to ${toUnit}`)
    }

    // Check if units are in the same category
    const fromBase = this.getBaseUnit(fromUnit)
    const toBase = this.getBaseUnit(toUnit)

    if (fromBase !== toBase) {
      throw new Error(`Cannot convert between different unit types: ${fromBase} to ${toBase}`)
    }

    // Convert to base unit first, then to target unit
    const baseQuantity = quantity / fromConversions[fromBase]
    return baseQuantity * toConversions[fromBase]
  }

  private getBaseUnit(unit: string): string {
    const lowerUnit = unit.toLowerCase()

    if (this.conversionRates[lowerUnit]) {
      // Find the unit with factor 1 in this conversion group
      for (const [baseUnit, factor] of Object.entries(this.conversionRates[lowerUnit])) {
        if (factor === 1) {
          return baseUnit
        }
      }
    }

    throw new Error(`Unknown unit: ${unit}`)
  }

  getCompatibleUnits(unit: string): string[] {
    const lowerUnit = unit.toLowerCase()
    return Object.keys(this.conversionRates[lowerUnit] || {})
  }

  isValidUnit(unit: string): boolean {
    return unit.toLowerCase() in this.conversionRates
  }

  getUnitType(unit: string): 'weight' | 'volume' | 'count' {
    const lowerUnit = unit.toLowerCase()

    if (['g', 'kg', 'lb', 'oz'].includes(lowerUnit)) {
      return 'weight'
    }
    if (['ml', 'l', 'cup', 'tbsp', 'tsp', 'fl_oz'].includes(lowerUnit)) {
      return 'volume'
    }
    if (['each', 'piece', 'item', 'unit'].includes(lowerUnit)) {
      return 'count'
    }

    return 'count' // Default fallback
  }
}