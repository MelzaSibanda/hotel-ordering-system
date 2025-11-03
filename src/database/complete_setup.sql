-- ========================================
-- COMPLETE DATABASE SETUP
-- Egumeni Eats - Tfokomala Hotel & University of Mpumalanga
-- 
-- This script creates the complete database schema with:
-- 1. Tables and relationships
-- 2. Row Level Security (RLS) policies  
-- 3. Performance indexes
-- 4. Stored procedures and functions
-- 5. Triggers for business logic
-- ========================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 1. CREATE TABLES
-- ========================================

-- USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- handled securely in auth system
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','customer','kitchen','delivery','cashier','stores')) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- STAFF SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT now(),
  end_time TIMESTAMP,
  cash_in NUMERIC(10,2) DEFAULT 0,
  cash_out NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

-- INVENTORY / STOCK
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. beverages, meats, vegetables
  unit TEXT NOT NULL, -- kg, liters, pcs
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  barcode TEXT UNIQUE,
  supplier TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- MENU CATEGORIES
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT
);

-- MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- MENU ITEM INGREDIENTS (Link between menu item & stock usage)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE CASCADE,
  quantity_used NUMERIC(12,2) NOT NULL
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_type TEXT CHECK (order_type IN ('room_service','delivery','collection')) NOT NULL,
  status TEXT CHECK (status IN ('pending','preparing','ready','out_for_delivery','delivered','completed')) DEFAULT 'pending',
  room_number TEXT, -- if room service
  delivery_address TEXT, -- if delivery
  created_at TIMESTAMP DEFAULT now()
);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT CHECK (method IN ('cash','card','room_charge','mobile')) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMP DEFAULT now()
);

-- REPORTS (snapshots for admin)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  type TEXT CHECK (type IN ('sales','inventory','shift','maintenance')) NOT NULL,
  data JSONB NOT NULL, -- flexible structure
  created_at TIMESTAMP DEFAULT now()
);

-- ========================================
-- 2. CREATE TRIGGERS FOR BUSINESS LOGIC
-- ========================================

-- Deduct stock when order is placed
CREATE OR REPLACE FUNCTION deduct_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stock_items
  SET quantity = quantity - (NEW.quantity * mii.quantity_used)
  FROM menu_item_ingredients mii
  WHERE mii.menu_item_id = NEW.menu_item_id
    AND stock_items.id = mii.stock_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_stock ON order_items;
CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION deduct_stock_on_order();

-- ========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. CREATE HELPER FUNCTIONS FOR RLS
-- ========================================

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() IN ('admin', 'supervisor', 'kitchen', 'delivery', 'cashier', 'stores');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. CREATE RLS POLICIES
-- ========================================

-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_select_admin" ON users;
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (is_admin_or_supervisor());

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND 
    (OLD.role = NEW.role) AND 
    (OLD.email = NEW.email)
  );

DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (is_admin_or_supervisor());

DROP POLICY IF EXISTS "users_insert_admin" ON users;
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

DROP POLICY IF EXISTS "users_delete_admin" ON users;
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (is_admin_or_supervisor());

-- SHIFTS TABLE POLICIES
DROP POLICY IF EXISTS "shifts_select_own" ON shifts;
CREATE POLICY "shifts_select_own" ON shifts
  FOR SELECT USING (staff_id = auth.uid());

DROP POLICY IF EXISTS "shifts_select_admin" ON shifts;
CREATE POLICY "shifts_select_admin" ON shifts
  FOR SELECT USING (is_admin_or_supervisor());

DROP POLICY IF EXISTS "shifts_insert_admin" ON shifts;
CREATE POLICY "shifts_insert_admin" ON shifts
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

DROP POLICY IF EXISTS "shifts_update_admin" ON shifts;
CREATE POLICY "shifts_update_admin" ON shifts
  FOR UPDATE USING (is_admin_or_supervisor());

DROP POLICY IF EXISTS "shifts_delete_admin" ON shifts;
CREATE POLICY "shifts_delete_admin" ON shifts
  FOR DELETE USING (is_admin_or_supervisor());

-- STOCK ITEMS TABLE POLICIES
DROP POLICY IF EXISTS "stock_items_select_staff" ON stock_items;
CREATE POLICY "stock_items_select_staff" ON stock_items
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS "stock_items_modify_stores_admin" ON stock_items;
CREATE POLICY "stock_items_modify_stores_admin" ON stock_items
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'stores')
  );

-- MENU CATEGORIES TABLE POLICIES
DROP POLICY IF EXISTS "menu_categories_select_all" ON menu_categories;
CREATE POLICY "menu_categories_select_all" ON menu_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "menu_categories_modify_admin_kitchen" ON menu_categories;
CREATE POLICY "menu_categories_modify_admin_kitchen" ON menu_categories
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- MENU ITEMS TABLE POLICIES
DROP POLICY IF EXISTS "menu_items_select_all" ON menu_items;
CREATE POLICY "menu_items_select_all" ON menu_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "menu_items_modify_admin_kitchen" ON menu_items;
CREATE POLICY "menu_items_modify_admin_kitchen" ON menu_items
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- MENU ITEM INGREDIENTS TABLE POLICIES
DROP POLICY IF EXISTS "menu_item_ingredients_select_staff" ON menu_item_ingredients;
CREATE POLICY "menu_item_ingredients_select_staff" ON menu_item_ingredients
  FOR SELECT USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen', 'stores')
  );

DROP POLICY IF EXISTS "menu_item_ingredients_modify_admin_kitchen" ON menu_item_ingredients;
CREATE POLICY "menu_item_ingredients_modify_admin_kitchen" ON menu_item_ingredients
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- ORDERS TABLE POLICIES
DROP POLICY IF EXISTS "orders_select_customer_own" ON orders;
CREATE POLICY "orders_select_customer_own" ON orders
  FOR SELECT USING (
    customer_id = auth.uid() AND 
    get_current_user_role() = 'customer'
  );

DROP POLICY IF EXISTS "orders_select_staff" ON orders;
CREATE POLICY "orders_select_staff" ON orders
  FOR SELECT USING (
    CASE get_current_user_role()
      WHEN 'admin', 'supervisor' THEN true
      WHEN 'kitchen' THEN status IN ('pending', 'preparing')
      WHEN 'delivery' THEN status IN ('ready', 'out_for_delivery')
      WHEN 'cashier' THEN true
      ELSE false
    END
  );

DROP POLICY IF EXISTS "orders_insert_customer" ON orders;
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() AND 
    get_current_user_role() = 'customer'
  );

DROP POLICY IF EXISTS "orders_update_staff" ON orders;
CREATE POLICY "orders_update_staff" ON orders
  FOR UPDATE USING (
    CASE get_current_user_role()
      WHEN 'admin', 'supervisor' THEN true
      WHEN 'kitchen' THEN 
        OLD.status IN ('pending', 'preparing') AND 
        NEW.status IN ('preparing', 'ready')
      WHEN 'delivery' THEN 
        OLD.status IN ('ready', 'out_for_delivery') AND 
        NEW.status IN ('out_for_delivery', 'delivered')
      WHEN 'cashier' THEN 
        OLD.status = 'delivered' AND 
        NEW.status = 'completed'
      ELSE false
    END
  );

DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
CREATE POLICY "orders_delete_admin" ON orders
  FOR DELETE USING (is_admin_or_supervisor());

-- ORDER ITEMS TABLE POLICIES
DROP POLICY IF EXISTS "order_items_select_based_on_order" ON order_items;
CREATE POLICY "order_items_select_based_on_order" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id AND (
        (orders.customer_id = auth.uid() AND get_current_user_role() = 'customer') OR
        CASE get_current_user_role()
          WHEN 'admin', 'supervisor' THEN true
          WHEN 'kitchen' THEN orders.status IN ('pending', 'preparing')
          WHEN 'delivery' THEN orders.status IN ('ready', 'out_for_delivery')
          WHEN 'cashier' THEN true
          ELSE false
        END
      )
    )
  );

DROP POLICY IF EXISTS "order_items_insert_customer" ON order_items;
CREATE POLICY "order_items_insert_customer" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id AND 
      orders.customer_id = auth.uid() AND 
      orders.status = 'pending' AND 
      get_current_user_role() = 'customer'
    )
  );

DROP POLICY IF EXISTS "order_items_modify_admin" ON order_items;
CREATE POLICY "order_items_modify_admin" ON order_items
  FOR ALL USING (is_admin_or_supervisor());

-- PAYMENTS TABLE POLICIES
DROP POLICY IF EXISTS "payments_select_customer" ON payments;
CREATE POLICY "payments_select_customer" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = payments.order_id AND 
      orders.customer_id = auth.uid() AND 
      get_current_user_role() = 'customer'
    )
  );

DROP POLICY IF EXISTS "payments_select_cashier_admin" ON payments;
CREATE POLICY "payments_select_cashier_admin" ON payments
  FOR SELECT USING (
    get_current_user_role() IN ('admin', 'supervisor', 'cashier')
  );

DROP POLICY IF EXISTS "payments_insert_cashier_admin" ON payments;
CREATE POLICY "payments_insert_cashier_admin" ON payments
  FOR INSERT WITH CHECK (
    get_current_user_role() IN ('admin', 'supervisor', 'cashier')
  );

DROP POLICY IF EXISTS "payments_modify_admin" ON payments;
CREATE POLICY "payments_modify_admin" ON payments
  FOR ALL USING (is_admin_or_supervisor());

-- REPORTS TABLE POLICIES
DROP POLICY IF EXISTS "reports_admin_supervisor_only" ON reports;
CREATE POLICY "reports_admin_supervisor_only" ON reports
  FOR ALL USING (is_admin_or_supervisor());

-- ========================================
-- 6. CREATE PERFORMANCE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- ========================================
-- 7. GRANT PERMISSIONS
-- ========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ========================================
-- 8. INSERT SAMPLE DATA (Optional)
-- ========================================

-- Sample admin user (update with real data)
INSERT INTO users (email, password, name, role) VALUES 
('admin@egumenieats.com', 'hashed_password', 'System Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Sample menu categories
INSERT INTO menu_categories (name, description) VALUES 
('Beverages', 'Hot and cold drinks'),
('Main Courses', 'Primary meals and dishes'),
('Desserts', 'Sweet treats and desserts'),
('Appetizers', 'Starters and light bites')
ON CONFLICT DO NOTHING;

-- Sample stock items
INSERT INTO stock_items (name, category, unit, quantity, unit_price) VALUES 
('Coffee Beans', 'beverages', 'kg', 50, 120.00),
('Chicken Breast', 'meats', 'kg', 25, 180.00),
('Rice', 'grains', 'kg', 100, 25.00),
('Tomatoes', 'vegetables', 'kg', 30, 35.00)
ON CONFLICT DO NOTHING;

-- ========================================
-- 9. VERIFICATION QUERIES
-- ========================================

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- Log completion
INSERT INTO reports (report_date, type, data) VALUES (
  CURRENT_DATE,
  'maintenance',
  jsonb_build_object(
    'action', 'database_setup_complete',
    'timestamp', NOW(),
    'version', '1.0',
    'tables_created', (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    ),
    'policies_created', (
      SELECT COUNT(*) FROM pg_policies 
      WHERE schemaname = 'public'
    )
  )
);

SELECT 'Database setup completed successfully!' as status;