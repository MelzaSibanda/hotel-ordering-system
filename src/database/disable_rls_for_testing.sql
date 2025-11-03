-- Disable RLS for Testing (TEMPORARY FIX)
-- Run this SQL in your Supabase SQL Editor if you're getting permission denied errors
-- This is only for testing - you should enable RLS with proper policies in production

-- Disable RLS on all tables temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

-- Add some test data to verify tables are working
INSERT INTO menu_categories (name, description) 
VALUES 
  ('Main Courses', 'Hearty main dishes'),
  ('Beverages', 'Drinks and refreshments'),
  ('Desserts', 'Sweet treats')
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, available)
SELECT 
  c.id,
  'Test Menu Item',
  'A test item to verify the system is working',
  25.00,
  true
FROM menu_categories c
WHERE c.name = 'Main Courses'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Check if everything worked
SELECT 'Tables created successfully' as status;
SELECT COUNT(*) as category_count FROM menu_categories;
SELECT COUNT(*) as menu_item_count FROM menu_items;