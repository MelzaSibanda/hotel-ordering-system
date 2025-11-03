-- =============================================
-- ADDITIONAL SECURITY MEASURES
-- Egumeni Eats - University of Mpumalanga
-- =============================================

-- =============================================
-- SECURE VIEWS FOR LIMITED DATA ACCESS
-- =============================================

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

-- Staff order view (excludes sensitive customer data)
CREATE OR REPLACE VIEW staff_orders AS
SELECT 
  o.id,
  o.order_type,
  o.status,
  o.room_number,
  o.delivery_address,
  o.created_at,
  u.name as customer_name,
  u.phone as customer_phone,
  -- Exclude email and other sensitive data
  CASE 
    WHEN get_user_role() IN ('admin', 'supervisor', 'cashier') THEN u.email
    ELSE '[HIDDEN]'
  END as customer_email
FROM orders o
JOIN users u ON o.customer_id = u.id;

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
  mi.description as item_description,
  -- Include preparation instructions if available
  COALESCE(mi.description, '') as preparation_notes
FROM orders o
JOIN users u ON o.customer_id = u.id
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.status IN ('pending', 'preparing', 'ready')
ORDER BY o.created_at ASC;

-- Delivery order view
CREATE OR REPLACE VIEW delivery_orders AS
SELECT 
  o.id as order_id,
  o.delivery_address,
  o.room_number,
  o.status,
  o.created_at,
  u.name as customer_name,
  u.phone as customer_phone,
  COUNT(oi.id) as total_items
FROM orders o
JOIN users u ON o.customer_id = u.id
JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_type IN ('delivery', 'room_service')
  AND o.status IN ('ready', 'out_for_delivery')
GROUP BY o.id, o.delivery_address, o.room_number, o.status, o.created_at, u.name, u.phone
ORDER BY o.created_at ASC;

-- =============================================
-- SECURITY CONSTRAINTS
-- =============================================

-- Ensure email uniqueness across users
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

-- =============================================
-- AUDIT FUNCTIONS
-- =============================================

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

-- Create audit log table
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

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
CREATE POLICY "Admin can view audit logs" ON audit_log
  FOR SELECT USING (get_user_role() = 'admin');

-- =============================================
-- AUDIT TRIGGERS FOR SENSITIVE TABLES
-- =============================================

-- Audit user changes
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

-- Audit payment changes
CREATE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

-- Audit stock changes
CREATE TRIGGER audit_stock_trigger
  AFTER UPDATE OR DELETE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operation();

-- =============================================
-- RATE LIMITING FUNCTIONS
-- =============================================

-- Function to check order rate limiting
CREATE OR REPLACE FUNCTION check_order_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_orders INTEGER;
BEGIN
  -- Check if user has placed more than 10 orders in the last hour
  SELECT COUNT(*)
  INTO recent_orders
  FROM orders
  WHERE customer_id = NEW.customer_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_orders >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many orders in the last hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply rate limiting to orders
CREATE TRIGGER order_rate_limit_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION check_order_rate_limit();

-- =============================================
-- DATA VALIDATION FUNCTIONS
-- =============================================

-- Function to validate phone numbers
CREATE OR REPLACE FUNCTION validate_phone_number(phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- South African phone number validation (basic)
  RETURN phone IS NULL OR phone ~ '^(\+27|0)[0-9]{9}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate email addresses
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add validation constraints
ALTER TABLE users ADD CONSTRAINT chk_valid_email 
  CHECK (validate_email(email));

ALTER TABLE users ADD CONSTRAINT chk_valid_phone 
  CHECK (validate_phone_number(phone));

-- =============================================
-- SECURITY MAINTENANCE PROCEDURES
-- =============================================

-- Function to clean up old sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 1 year (adjust as needed)
  DELETE FROM audit_log 
  WHERE timestamp < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for security violations
CREATE OR REPLACE FUNCTION check_security_violations()
RETURNS TABLE(violation_type TEXT, details TEXT, count BIGINT) AS $$
BEGIN
  -- Check for users without proper roles
  RETURN QUERY
  SELECT 
    'Invalid Role'::TEXT,
    'Users with invalid or missing roles'::TEXT,
    COUNT(*)
  FROM users 
  WHERE role NOT IN ('admin', 'customer', 'kitchen', 'delivery', 'cashier', 'stores')
     OR role IS NULL;
  
  -- Check for orders with missing customer references
  RETURN QUERY
  SELECT 
    'Orphaned Orders'::TEXT,
    'Orders without valid customer references'::TEXT,
    COUNT(*)
  FROM orders o
  LEFT JOIN users u ON o.customer_id = u.id
  WHERE u.id IS NULL;
  
  -- Check for payments without valid orders
  RETURN QUERY
  SELECT 
    'Orphaned Payments'::TEXT,
    'Payments without valid order references'::TEXT,
    COUNT(*)
  FROM payments p
  LEFT JOIN orders o ON p.order_id = o.id
  WHERE o.id IS NULL;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PERFORMANCE OPTIMIZATION FOR RLS
-- =============================================

-- Additional indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_type_status ON orders(order_type, status);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_end ON shifts(staff_id, end_time);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, timestamp);

-- Analyze tables for better query planning
ANALYZE users;
ANALYZE orders;
ANALYZE order_items;
ANALYZE payments;
ANALYZE stock_items;
ANALYZE menu_items;
ANALYZE shifts;

-- =============================================
-- SECURITY TESTING FUNCTIONS
-- =============================================

-- Function to test RLS policies (admin only)
CREATE OR REPLACE FUNCTION test_rls_policies()
RETURNS TABLE(test_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Only allow admin to run this
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admin can run security tests';
  END IF;
  
  -- Test 1: Verify RLS is enabled on all tables
  RETURN QUERY
  SELECT 
    'RLS Enabled Check'::TEXT,
    CASE WHEN COUNT(*) = 10 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Tables with RLS enabled: ' || COUNT(*)::TEXT || '/10'::TEXT
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  WHERE t.table_schema = 'public' 
    AND t.table_name IN ('users', 'shifts', 'stock_items', 'menu_categories', 
                         'menu_items', 'menu_item_ingredients', 'orders', 
                         'order_items', 'payments', 'reports')
    AND c.relrowsecurity = true;
  
  -- Test 2: Check for tables without policies
  RETURN QUERY
  SELECT 
    'Policy Coverage Check'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Tables without policies: ' || STRING_AGG(schemaname || '.' || tablename, ', ')
  FROM pg_policies p
  RIGHT JOIN pg_tables t ON p.tablename = t.tablename AND p.schemaname = t.schemaname
  WHERE t.schemaname = 'public' 
    AND t.tablename IN ('users', 'shifts', 'stock_items', 'menu_categories', 
                        'menu_items', 'menu_item_ingredients', 'orders', 
                        'order_items', 'payments', 'reports')
    AND p.policyname IS NULL;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION check_security_violations() TO authenticated;
GRANT EXECUTE ON FUNCTION test_rls_policies() TO authenticated;

-- =============================================
-- DOCUMENTATION AND COMMENTS
-- =============================================

COMMENT ON VIEW public_menu IS 
'Safe public view of available menu items with category information';

COMMENT ON VIEW staff_orders IS 
'Staff view of orders with role-appropriate customer information';

COMMENT ON VIEW kitchen_orders IS 
'Kitchen-focused view showing orders ready for preparation';

COMMENT ON VIEW delivery_orders IS 
'Delivery-focused view showing orders ready for delivery';

COMMENT ON TABLE audit_log IS 
'Audit trail for sensitive operations on critical tables';

COMMENT ON FUNCTION log_sensitive_operation() IS 
'Trigger function to log changes to sensitive data';

COMMENT ON FUNCTION check_order_rate_limit() IS 
'Prevents customers from placing too many orders in a short time';

COMMENT ON FUNCTION test_rls_policies() IS 
'Admin function to verify RLS policies are properly configured';

-- =============================================
-- FINAL SECURITY CHECKLIST
-- =============================================

/*
SECURITY IMPLEMENTATION CHECKLIST:

✅ 1. Row Level Security (RLS) enabled on all tables
✅ 2. Comprehensive policies for all user roles
✅ 3. Data isolation between customers
✅ 4. Role-based access control
✅ 5. Audit logging for sensitive operations
✅ 6. Rate limiting for order creation
✅ 7. Data validation constraints
✅ 8. Secure views for limited data access
✅ 9. Performance indexes for RLS queries
✅ 10. Security testing functions

ADDITIONAL RECOMMENDATIONS:

🔒 1. Regularly run check_security_violations() to monitor for issues
🔒 2. Set up periodic cleanup_old_audit_logs() execution
🔒 3. Monitor audit_log table for suspicious activities
🔒 4. Test RLS policies with different user roles
🔒 5. Implement application-level validation as additional security layer
🔒 6. Use HTTPS only for all database connections
🔒 7. Regularly update Supabase and dependencies
🔒 8. Implement backup and disaster recovery procedures
🔒 9. Monitor database performance with RLS enabled
🔒 10. Train staff on security best practices

TESTING COMMANDS:

-- Test as admin
SELECT * FROM test_rls_policies();

-- Check for security violations
SELECT * FROM check_security_violations();

-- View audit logs (admin only)
SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100;

-- Clean up old audit logs
SELECT cleanup_old_audit_logs();
*/