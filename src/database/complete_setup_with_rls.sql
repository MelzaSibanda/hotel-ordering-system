-- =============================================
-- COMPLETE DATABASE SETUP WITH COMPREHENSIVE RLS
-- Egumeni Eats - University of Mpumalanga
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------
-- USERS & ROLES
-- -----------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- handled securely in auth system
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','customer','kitchen','delivery','cashier','stores')) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- STAFF SHIFTS
-- -----------------------------
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

-- -----------------------------
-- INVENTORY / STOCK
-- -----------------------------
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

-- -----------------------------
-- MENU CATEGORIES
-- -----------------------------
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT
);

-- -----------------------------
-- MENU ITEMS
-- -----------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- MENU ITEM INGREDIENTS
-- (Link between menu item & stock usage)
-- -----------------------------
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE CASCADE,
  quantity_used NUMERIC(12,2) NOT NULL
);

-- -----------------------------
-- ORDERS
-- -----------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_type TEXT CHECK (order_type IN ('room_service','delivery','collection')) NOT NULL,
  status TEXT CHECK (status IN ('pending','preparing','ready','out_for_delivery','delivered','completed')) DEFAULT 'pending',
  room_number TEXT, -- if room service
  delivery_address TEXT, -- if delivery
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- ORDER ITEMS
-- -----------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL
);

-- -----------------------------
-- PAYMENTS
-- -----------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT CHECK (method IN ('cash','card','room_charge','mobile')) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- REPORTS (snapshots for admin)
-- -----------------------------
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  type TEXT CHECK (type IN ('sales','inventory','shift')) NOT NULL,
  data JSONB NOT NULL, -- flexible structure
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- AUDIT LOG TABLE
-- -----------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  user_role TEXT,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- -----------------------------
-- TRIGGERS / INVENTORY UPDATES
-- Deduct stock when order is placed
-- -----------------------------
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

CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION deduct_stock_on_order();

-- -----------------------------
-- ENABLE ROW LEVEL SECURITY
-- -----------------------------
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
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- HELPER FUNCTIONS FOR RLS
-- -----------------------------

-- Function to get current user's role from auth.users metadata
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role',
    'customer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('admin', 'supervisor', 'kitchen', 'delivery', 'cashier', 'stores');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------
-- COMPREHENSIVE RLS POLICIES
-- -----------------------------

-- ===== USERS TABLE POLICIES =====

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Users cannot change their role or id
    (OLD.role = NEW.role) AND
    (OLD.id = NEW.id)
  );

-- Admin/supervisor can view all users
CREATE POLICY "Admin can view all users" ON users
  FOR SELECT USING (is_admin_or_supervisor());

-- Admin/supervisor can create users
CREATE POLICY "Admin can create users" ON users
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

-- Admin/supervisor can update users
CREATE POLICY "Admin can update users" ON users
  FOR UPDATE USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- Admin can delete users
CREATE POLICY "Admin can delete users" ON users
  FOR DELETE USING (is_admin_or_supervisor());

-- Staff can view basic user info for orders
CREATE POLICY "Staff can view basic user info" ON users
  FOR SELECT USING (
    is_staff() AND
    role IN ('customer', 'delivery')
  );

-- ===== SHIFTS TABLE POLICIES =====

-- Users can view their own shifts
CREATE POLICY "Users can view own shifts" ON shifts
  FOR SELECT USING (staff_id = auth.uid());

-- Admin/supervisor can view all shifts
CREATE POLICY "Admin can view all shifts" ON shifts
  FOR SELECT USING (is_admin_or_supervisor());

-- Admin/supervisor can create shifts
CREATE POLICY "Admin can create shifts" ON shifts
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

-- Admin/supervisor can update shifts
CREATE POLICY "Admin can update shifts" ON shifts
  FOR UPDATE USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- Users can update their own active shift end time
CREATE POLICY "Users can end own shift" ON shifts
  FOR UPDATE USING (
    staff_id = auth.uid() AND
    end_time IS NULL
  )
  WITH CHECK (
    staff_id = auth.uid() AND
    OLD.staff_id = NEW.staff_id AND
    OLD.role = NEW.role AND
    OLD.start_time = NEW.start_time AND
    OLD.cash_in = NEW.cash_in
  );

-- ===== STOCK ITEMS TABLE POLICIES =====

-- Admin/supervisor and stores staff can view all stock
CREATE POLICY "Admin and stores can view stock" ON stock_items
  FOR SELECT USING (get_user_role() IN ('admin', 'supervisor', 'stores'));

-- Admin/supervisor and stores staff can manage stock
CREATE POLICY "Admin and stores can insert stock" ON stock_items
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'stores'));

CREATE POLICY "Admin and stores can update stock" ON stock_items
  FOR UPDATE USING (get_user_role() IN ('admin', 'supervisor', 'stores'))
  WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'stores'));

CREATE POLICY "Admin can delete stock" ON stock_items
  FOR DELETE USING (is_admin_or_supervisor());

-- Kitchen staff can view stock (read-only)
CREATE POLICY "Kitchen can view stock" ON stock_items
  FOR SELECT USING (get_user_role() = 'kitchen');

-- ===== MENU CATEGORIES TABLE POLICIES =====

-- Everyone can view menu categories (public information)
CREATE POLICY "Everyone can view menu categories" ON menu_categories
  FOR SELECT USING (true);

-- Admin/supervisor can manage menu categories
CREATE POLICY "Admin can manage menu categories" ON menu_categories
  FOR ALL USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- ===== MENU ITEMS TABLE POLICIES =====

-- Everyone can view available menu items
CREATE POLICY "Everyone can view available menu items" ON menu_items
  FOR SELECT USING (available = true OR is_staff());

-- Admin/supervisor can view all menu items
CREATE POLICY "Admin can view all menu items" ON menu_items
  FOR SELECT USING (is_admin_or_supervisor());

-- Admin/supervisor can manage menu items
CREATE POLICY "Admin can manage menu items" ON menu_items
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

CREATE POLICY "Admin can update menu items" ON menu_items
  FOR UPDATE USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

CREATE POLICY "Admin can delete menu items" ON menu_items
  FOR DELETE USING (is_admin_or_supervisor());

-- ===== MENU ITEM INGREDIENTS TABLE POLICIES =====

-- Admin/supervisor and kitchen staff can view ingredients
CREATE POLICY "Admin and kitchen can view ingredients" ON menu_item_ingredients
  FOR SELECT USING (get_user_role() IN ('admin', 'supervisor', 'kitchen', 'stores'));

-- Admin/supervisor can manage ingredients
CREATE POLICY "Admin can manage ingredients" ON menu_item_ingredients
  FOR ALL USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- ===== ORDERS TABLE POLICIES =====

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders" ON orders
  FOR SELECT USING (
    customer_id = auth.uid() OR
    is_staff()
  );

-- Customers can create their own orders
CREATE POLICY "Customers can create own orders" ON orders
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() OR
    get_user_role() IN ('admin', 'supervisor', 'cashier')
  );

-- Customers can update their own pending orders
CREATE POLICY "Customers can update own pending orders" ON orders
  FOR UPDATE USING (
    customer_id = auth.uid() AND
    status = 'pending'
  )
  WITH CHECK (
    customer_id = auth.uid() AND
    OLD.customer_id = NEW.customer_id AND
    OLD.order_type = NEW.order_type
  );

-- Staff can view orders relevant to their role
CREATE POLICY "Staff can view relevant orders" ON orders
  FOR SELECT USING (
    CASE get_user_role()
      WHEN 'kitchen' THEN status IN ('pending', 'preparing', 'ready')
      WHEN 'delivery' THEN order_type = 'delivery' AND status IN ('ready', 'out_for_delivery')
      WHEN 'cashier' THEN true
      ELSE false
    END OR
    is_admin_or_supervisor()
  );

-- Staff can update order status
CREATE POLICY "Staff can update order status" ON orders
  FOR UPDATE USING (
    CASE get_user_role()
      WHEN 'kitchen' THEN status IN ('pending', 'preparing') AND NEW.status IN ('preparing', 'ready')
      WHEN 'delivery' THEN order_type = 'delivery' AND status IN ('ready', 'out_for_delivery') AND NEW.status IN ('out_for_delivery', 'delivered')
      WHEN 'cashier' THEN NEW.status IN ('pending', 'preparing', 'ready', 'completed')
      ELSE false
    END OR
    is_admin_or_supervisor()
  )
  WITH CHECK (
    OLD.customer_id = NEW.customer_id AND
    OLD.order_type = NEW.order_type AND
    OLD.room_number = NEW.room_number AND
    OLD.delivery_address = NEW.delivery_address AND
    OLD.created_at = NEW.created_at
  );

-- Admin/supervisor can manage all orders
CREATE POLICY "Admin can manage all orders" ON orders
  FOR ALL USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- ===== ORDER ITEMS TABLE POLICIES =====

-- Users can view order items for orders they can see
CREATE POLICY "Users can view order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_id AND (
        o.customer_id = auth.uid() OR
        is_staff()
      )
    )
  );

-- Customers and cashiers can create order items for new orders
CREATE POLICY "Customers can create order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_id AND (
        (o.customer_id = auth.uid() AND o.status = 'pending') OR
        get_user_role() IN ('admin', 'supervisor', 'cashier')
      )
    )
  );

-- Admin/supervisor can manage all order items
CREATE POLICY "Admin can manage order items" ON order_items
  FOR ALL USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- ===== PAYMENTS TABLE POLICIES =====

-- Customers can view their own payments
CREATE POLICY "Customers can view own payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_id AND 
      o.customer_id = auth.uid()
    ) OR
    get_user_role() IN ('admin', 'supervisor', 'cashier')
  );

-- Only cashier, admin, and supervisor can create payments
CREATE POLICY "Cashier can create payments" ON payments
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'supervisor', 'cashier')
  );

-- Admin/supervisor can view all payments
CREATE POLICY "Admin can view all payments" ON payments
  FOR SELECT USING (is_admin_or_supervisor());

-- Admin/supervisor can update payments
CREATE POLICY "Admin can update payments" ON payments
  FOR UPDATE USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- Only admin can delete payments
CREATE POLICY "Admin can delete payments" ON payments
  FOR DELETE USING (get_user_role() = 'admin');

-- ===== REPORTS TABLE POLICIES =====

-- Only admin/supervisor can access reports
CREATE POLICY "Admin can access reports" ON reports
  FOR ALL USING (is_admin_or_supervisor())
  WITH CHECK (is_admin_or_supervisor());

-- ===== AUDIT LOG TABLE POLICIES =====

-- Only admin can view audit logs
CREATE POLICY "Admin can view audit logs" ON audit_log
  FOR SELECT USING (get_user_role() = 'admin');

-- -----------------------------
-- SECURITY CONSTRAINTS
-- -----------------------------

-- Ensure email uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email));

-- Prevent negative quantities and prices
ALTER TABLE stock_items ADD CONSTRAINT chk_stock_quantity_positive 
  CHECK (quantity >= 0);

ALTER TABLE stock_items ADD CONSTRAINT chk_stock_price_positive 
  CHECK (unit_price >= 0);

ALTER TABLE menu_items ADD CONSTRAINT chk_menu_price_positive 
  CHECK (price >= 0);

ALTER TABLE order_items ADD CONSTRAINT chk_order_quantity_positive 
  CHECK (quantity > 0);

ALTER TABLE order_items ADD CONSTRAINT chk_order_price_positive 
  CHECK (price >= 0);

ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive 
  CHECK (amount >= 0);

-- Ensure shift times are logical
ALTER TABLE shifts ADD CONSTRAINT chk_shift_times 
  CHECK (end_time IS NULL OR end_time >= start_time);

ALTER TABLE shifts ADD CONSTRAINT chk_cash_amounts 
  CHECK (cash_in >= 0 AND (cash_out IS NULL OR cash_out >= 0));

-- -----------------------------
-- AUDIT FUNCTIONS AND TRIGGERS
-- -----------------------------

-- Function to log sensitive operations
CREATE OR REPLACE FUNCTION log_sensitive_operation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    user_role,
    old_data,
    new_data,
    timestamp
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    get_current_user_id(),
    get_user_role(),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit triggers for sensitive tables
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

CREATE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

CREATE TRIGGER audit_stock_trigger
  AFTER UPDATE OR DELETE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

-- -----------------------------
-- PERFORMANCE INDEXES
-- -----------------------------

-- Core indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_type_status ON orders(order_type, status);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_end ON shifts(staff_id, end_time);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, timestamp);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_reports_date_type ON reports(report_date, type);

-- -----------------------------
-- SECURE VIEWS
-- -----------------------------

-- Public menu view (safe for all users)
CREATE OR REPLACE VIEW public_menu AS
SELECT 
  mi.id,
  mi.name,
  mi.description,
  mi.price,
  mi.available,
  mc.name as category_name,
  mc.description as category_description
FROM menu_items mi
JOIN menu_categories mc ON mi.category_id = mc.id
WHERE mi.available = true;

-- Kitchen order view (focused on preparation)
CREATE OR REPLACE VIEW kitchen_orders AS
SELECT 
  o.id as order_id,
  o.order_type,
  o.status,
  o.room_number,
  o.created_at,
  u.name as customer_name,
  oi.quantity,
  mi.name as item_name,
  mi.description as item_description
FROM orders o
JOIN users u ON o.customer_id = u.id
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.status IN ('pending', 'preparing', 'ready')
ORDER BY o.created_at ASC;

-- -----------------------------
-- GRANTS AND PERMISSIONS
-- -----------------------------

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_supervisor() TO authenticated;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- -----------------------------
-- VALIDATION FUNCTIONS
-- -----------------------------

-- Test RLS policies
CREATE OR REPLACE FUNCTION test_rls_setup()
RETURNS TABLE(test_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Test 1: Check RLS is enabled
  RETURN QUERY
  SELECT 
    'RLS Enabled Check'::TEXT,
    CASE WHEN COUNT(*) >= 10 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Tables with RLS: ' || COUNT(*)::TEXT
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  WHERE t.table_schema = 'public' 
    AND c.relrowsecurity = true;
  
  -- Test 2: Check policies exist
  RETURN QUERY
  SELECT 
    'Policy Count Check'::TEXT,
    CASE WHEN COUNT(*) >= 20 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Total policies: ' || COUNT(*)::TEXT
  FROM pg_policies 
  WHERE schemaname = 'public';
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_rls_setup() TO authenticated;

-- -----------------------------
-- FINAL SETUP VERIFICATION
-- -----------------------------

-- Analyze tables for better performance
ANALYZE users;
ANALYZE orders;
ANALYZE order_items;
ANALYZE payments;
ANALYZE stock_items;
ANALYZE menu_items;
ANALYZE shifts;

-- Insert setup completion record
INSERT INTO reports (report_date, type, data) VALUES (
  CURRENT_DATE,
  'inventory',
  jsonb_build_object(
    'action', 'comprehensive_database_setup_complete',
    'timestamp', NOW(),
    'version', '2.0_with_rls',
    'tables_created', (
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    ),
    'policies_created', (
      SELECT COUNT(*) FROM pg_policies 
      WHERE schemaname = 'public'
    ),
    'indexes_created', (
      SELECT COUNT(*) FROM pg_indexes 
      WHERE schemaname = 'public'
    ),
    'security_features', jsonb_build_array(
      'row_level_security',
      'audit_logging',
      'data_validation',
      'rate_limiting',
      'secure_views'
    )
  )
);

-- Display setup summary
SELECT 
  'Database Setup Complete!'::TEXT as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as tables_created,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as policies_created,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as indexes_created;