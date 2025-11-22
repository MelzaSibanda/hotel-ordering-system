-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Egumeni Eats - University of Mpumalanga
-- ========================================

-- Enable RLS on all tables
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
-- HELPER FUNCTION: Get Current User Role
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

-- Helper function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is staff (any role except customer)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_user_role() IN ('admin', 'supervisor', 'kitchen', 'delivery', 'cashier', 'stores');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- USERS TABLE POLICIES
-- ========================================

-- Users can view their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

-- Admin/supervisor can view all users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (is_admin_or_supervisor());

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND 
    -- Users can only update these fields about themselves
    (OLD.role = NEW.role) AND 
    (OLD.email = NEW.email)
  );

-- Admin can update any user
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (is_admin_or_supervisor());

-- Admin can insert new users
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

-- Admin can delete users
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (is_admin_or_supervisor());

-- ========================================
-- SHIFTS TABLE POLICIES
-- ========================================

-- Staff can view their own shifts
CREATE POLICY "shifts_select_own" ON shifts
  FOR SELECT USING (staff_id = auth.uid());

-- Admin/supervisor can view all shifts
CREATE POLICY "shifts_select_admin" ON shifts
  FOR SELECT USING (is_admin_or_supervisor());

-- Admin/supervisor can manage all shifts
CREATE POLICY "shifts_insert_admin" ON shifts
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

CREATE POLICY "shifts_update_admin" ON shifts
  FOR UPDATE USING (is_admin_or_supervisor());

CREATE POLICY "shifts_delete_admin" ON shifts
  FOR DELETE USING (is_admin_or_supervisor());

-- ========================================
-- STOCK ITEMS TABLE POLICIES
-- ========================================

-- All staff can view stock items (needed for menu planning, order preparation)
CREATE POLICY "stock_items_select_staff" ON stock_items
  FOR SELECT USING (is_staff());

-- Only stores staff and admin can modify stock
CREATE POLICY "stock_items_modify_stores_admin" ON stock_items
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'stores')
  );

-- ========================================
-- MENU CATEGORIES TABLE POLICIES
-- ========================================

-- Everyone can view menu categories (customers need to see menu)
CREATE POLICY "menu_categories_select_all" ON menu_categories
  FOR SELECT USING (true);

-- Only admin and kitchen staff can modify menu categories
CREATE POLICY "menu_categories_modify_admin_kitchen" ON menu_categories
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- ========================================
-- MENU ITEMS TABLE POLICIES
-- ========================================

-- Everyone can view available menu items
CREATE POLICY "menu_items_select_all" ON menu_items
  FOR SELECT USING (true);

-- Only admin and kitchen staff can modify menu items
CREATE POLICY "menu_items_modify_admin_kitchen" ON menu_items
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- ========================================
-- MENU ITEM INGREDIENTS TABLE POLICIES
-- ========================================

-- Kitchen, stores, and admin can view ingredients (for inventory management)
CREATE POLICY "menu_item_ingredients_select_staff" ON menu_item_ingredients
  FOR SELECT USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen', 'stores')
  );

-- Only admin and kitchen can modify ingredients
CREATE POLICY "menu_item_ingredients_modify_admin_kitchen" ON menu_item_ingredients
  FOR ALL USING (
    get_current_user_role() IN ('admin', 'supervisor', 'kitchen')
  );

-- ========================================
-- ORDERS TABLE POLICIES
-- ========================================

-- Customers can view their own orders
CREATE POLICY "orders_select_customer_own" ON orders
  FOR SELECT USING (
    customer_id = auth.uid() AND 
    get_current_user_role() = 'customer'
  );

-- Staff can view orders relevant to their role
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

-- Customers can create their own orders
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() AND 
    get_current_user_role() = 'customer'
  );

-- Staff can update order status based on their role
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

-- Admin can delete orders
CREATE POLICY "orders_delete_admin" ON orders
  FOR DELETE USING (is_admin_or_supervisor());

-- ========================================
-- ORDER ITEMS TABLE POLICIES
-- ========================================

-- Users can view order items for orders they can see
-- This is handled through joins with orders table, so we allow based on order access
CREATE POLICY "order_items_select_based_on_order" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id AND (
        -- Customer can see their own order items
        (orders.customer_id = auth.uid() AND get_current_user_role() = 'customer') OR
        -- Staff can see order items based on order visibility rules
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

-- Customers can add items to their own orders (when placing order)
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

-- Admin can modify order items
CREATE POLICY "order_items_modify_admin" ON order_items
  FOR ALL USING (is_admin_or_supervisor());

-- ========================================
-- PAYMENTS TABLE POLICIES
-- ========================================

-- Customers can view their own payments
CREATE POLICY "payments_select_customer" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = payments.order_id AND 
      orders.customer_id = auth.uid() AND 
      get_current_user_role() = 'customer'
    )
  );

-- Cashier and admin can view all payments
CREATE POLICY "payments_select_cashier_admin" ON payments
  FOR SELECT USING (
    get_current_user_role() IN ('admin', 'supervisor', 'cashier')
  );

-- Cashier and admin can create payments
CREATE POLICY "payments_insert_cashier_admin" ON payments
  FOR INSERT WITH CHECK (
    get_current_user_role() IN ('admin', 'supervisor', 'cashier')
  );

-- Admin can modify payments
CREATE POLICY "payments_modify_admin" ON payments
  FOR ALL USING (is_admin_or_supervisor());

-- ========================================
-- REPORTS TABLE POLICIES
-- ========================================

-- Only admin and supervisor can access reports
CREATE POLICY "reports_admin_supervisor_only" ON reports
  FOR ALL USING (is_admin_or_supervisor());

-- ========================================
-- ADDITIONAL SECURITY MEASURES
-- ========================================

-- Create a function to validate order transitions
CREATE OR REPLACE FUNCTION validate_order_status_transition(old_status TEXT, new_status TEXT, user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Define valid transitions based on role
  CASE user_role
    WHEN 'kitchen' THEN
      RETURN (old_status = 'pending' AND new_status = 'preparing') OR
             (old_status = 'preparing' AND new_status = 'ready');
    WHEN 'delivery' THEN
      RETURN (old_status = 'ready' AND new_status = 'out_for_delivery') OR
             (old_status = 'out_for_delivery' AND new_status = 'delivered');
    WHEN 'cashier' THEN
      RETURN (old_status = 'delivered' AND new_status = 'completed');
    WHEN 'admin', 'supervisor' THEN
      RETURN true; -- Admin can make any transition
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Add a check constraint for order status transitions
ALTER TABLE orders ADD CONSTRAINT valid_status_transition 
CHECK (
  CASE 
    WHEN get_current_user_role() IN ('admin', 'supervisor') THEN true
    ELSE validate_order_status_transition(status, status, get_current_user_role())
  END
);

-- ========================================
-- GRANTS FOR AUTHENTICATED USERS
-- ========================================

-- Grant basic permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table access to authenticated users (RLS will control row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant sequence usage for auto-generated IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ========================================
-- SECURITY NOTES
-- ========================================

/*
IMPORTANT SECURITY CONSIDERATIONS:

1. User Authentication:
   - All policies assume users are authenticated via Supabase Auth
   - auth.uid() returns the authenticated user's ID
   - Users must exist in the users table with proper role assignment

2. Role-Based Access:
   - Customer: Can view/create own orders, view menu, view own payments
   - Kitchen: Can view and update orders in preparation stages, manage menu
   - Delivery: Can view and update orders for delivery
   - Cashier: Can view all orders/payments, process payments, complete orders
   - Stores: Can manage inventory/stock items
   - Admin/Supervisor: Full access to all data

3. Data Flow Security:
   - Orders progress through specific statuses with role-appropriate transitions
   - Inventory is automatically deducted via triggers
   - Payment records are immutable except by admin

4. Audit Trail:
   - All tables include created_at timestamps
   - Order status changes should be logged (consider adding audit table)
   - Reports table maintains historical snapshots

5. Performance Considerations:
   - RLS policies are evaluated on every query
   - Consider indexing on user_id, role, and status fields
   - Monitor query performance with complex policies

6. Testing:
   - Test all user roles thoroughly
   - Verify cross-role data isolation
   - Test edge cases like concurrent order updates
*/