-- Migration: Add requiresCooking field to menu_items table
-- This field determines whether an item needs to go through the kitchen workflow

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS requires_cooking BOOLEAN DEFAULT true;

-- Update existing menu items based on category
-- Beverages don't require cooking
UPDATE menu_items
SET requires_cooking = false
WHERE category_id IN (
    SELECT id FROM menu_categories
    WHERE name ILIKE '%beverage%' OR name ILIKE '%drink%'
);

-- You can manually update other items as needed
-- For example, snacks and pre-packaged items:
-- UPDATE menu_items SET requires_cooking = false WHERE name ILIKE '%snack%';

-- Add comment for documentation
COMMENT ON COLUMN menu_items.requires_cooking IS 'Indicates if this menu item requires kitchen preparation. False for ready-to-serve items like beverages.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_requires_cooking ON menu_items(requires_cooking);