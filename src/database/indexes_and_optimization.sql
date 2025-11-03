-- ========================================
-- DATABASE INDEXES AND OPTIMIZATION
-- Egumeni Eats - Performance Optimization
-- ========================================

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Shifts table indexes
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_role ON shifts(role);
CREATE INDEX IF NOT EXISTS idx_shifts_end_time ON shifts(end_time) WHERE end_time IS NOT NULL;

-- Stock items indexes
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON stock_items(name);
CREATE INDEX IF NOT EXISTS idx_stock_items_quantity ON stock_items(quantity);

-- Menu categories indexes
CREATE INDEX IF NOT EXISTS idx_menu_categories_name ON menu_categories(name);

-- Menu items indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
CREATE INDEX IF NOT EXISTS idx_menu_items_price ON menu_items(price);

-- Menu item ingredients indexes
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu_item_id ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_stock_item_id ON menu_item_ingredients(stock_item_id);

-- Orders table indexes (most important for performance)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- ========================================
-- RLS PERFORMANCE OPTIMIZATION
-- ========================================

-- Index on auth.uid() lookups for better RLS performance
-- These indexes help with the frequent auth.uid() = user_id lookups in RLS policies
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(id) WHERE id = auth.uid();
CREATE INDEX IF NOT EXISTS idx_orders_customer_auth ON orders(customer_id) WHERE customer_id = auth.uid();

-- ========================================
-- MATERIALIZED VIEWS FOR REPORTING
-- ========================================

-- Daily sales summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales_summary AS
SELECT 
  DATE(p.paid_at) as sale_date,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(p.amount) as total_revenue,
  COUNT(DISTINCT o.customer_id) as unique_customers,
  p.method as payment_method,
  o.order_type,
  AVG(p.amount) as avg_order_value
FROM payments p
JOIN orders o ON p.order_id = o.id
WHERE p.paid_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(p.paid_at), p.method, o.order_type;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON daily_sales_summary(sale_date);

-- Popular menu items materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_menu_items AS
SELECT 
  mi.id,
  mi.name,
  mi.price,
  mc.name as category_name,
  COUNT(oi.id) as times_ordered,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.quantity * oi.price) as total_revenue,
  AVG(oi.price) as avg_price
FROM menu_items mi
LEFT JOIN menu_categories mc ON mi.category_id = mc.id
LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY mi.id, mi.name, mi.price, mc.name;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_popular_menu_items_times_ordered ON popular_menu_items(times_ordered DESC);

-- ========================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ========================================

-- Function to get daily sales report
CREATE OR REPLACE FUNCTION get_daily_sales_report(report_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_orders BIGINT,
  total_revenue NUMERIC,
  unique_customers BIGINT,
  avg_order_value NUMERIC,
  top_payment_method TEXT,
  top_order_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT o.id)::BIGINT as total_orders,
    COALESCE(SUM(p.amount), 0) as total_revenue,
    COUNT(DISTINCT o.customer_id)::BIGINT as unique_customers,
    COALESCE(AVG(p.amount), 0) as avg_order_value,
    (SELECT p2.method FROM payments p2 
     JOIN orders o2 ON p2.order_id = o2.id 
     WHERE DATE(p2.paid_at) = report_date 
     GROUP BY p2.method 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as top_payment_method,
    (SELECT o3.order_type FROM orders o3 
     WHERE DATE(o3.created_at) = report_date 
     GROUP BY o3.order_type 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as top_order_type
  FROM orders o
  LEFT JOIN payments p ON o.id = p.order_id
  WHERE DATE(o.created_at) = report_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items(threshold NUMERIC DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  quantity NUMERIC,
  unit TEXT,
  unit_price NUMERIC,
  total_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.name,
    si.category,
    si.quantity,
    si.unit,
    si.unit_price,
    (si.quantity * si.unit_price) as total_value
  FROM stock_items si
  WHERE si.quantity <= threshold
  ORDER BY si.quantity ASC, (si.quantity * si.unit_price) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get order status summary
CREATE OR REPLACE FUNCTION get_order_status_summary()
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  oldest_order_time TIMESTAMP,
  avg_processing_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.status,
    COUNT(*)::BIGINT as count,
    MIN(o.created_at) as oldest_order_time,
    AVG(CASE 
      WHEN o.status = 'completed' THEN 
        (SELECT paid_at FROM payments WHERE order_id = o.id LIMIT 1) - o.created_at
      ELSE 
        NOW() - o.created_at
    END) as avg_processing_time
  FROM orders o
  WHERE o.created_at >= CURRENT_DATE
  GROUP BY o.status
  ORDER BY 
    CASE o.status
      WHEN 'pending' THEN 1
      WHEN 'preparing' THEN 2
      WHEN 'ready' THEN 3
      WHEN 'out_for_delivery' THEN 4
      WHEN 'delivered' THEN 5
      WHEN 'completed' THEN 6
      ELSE 7
    END;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- AUTOMATIC MAINTENANCE
-- ========================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW daily_sales_summary;
  REFRESH MATERIALIZED VIEW popular_menu_items;
  
  -- Log the refresh
  INSERT INTO reports (report_date, type, data) VALUES (
    CURRENT_DATE,
    'maintenance',
    jsonb_build_object(
      'action', 'refresh_materialized_views',
      'timestamp', NOW(),
      'tables_refreshed', ARRAY['daily_sales_summary', 'popular_menu_items']
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MONITORING AND ALERTING
-- ========================================

-- Function to check system health
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  pending_orders INTEGER;
  low_stock_count INTEGER;
  failed_payments INTEGER;
BEGIN
  -- Count pending orders older than 30 minutes
  SELECT COUNT(*) INTO pending_orders
  FROM orders 
  WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '30 minutes';
  
  -- Count low stock items
  SELECT COUNT(*) INTO low_stock_count
  FROM stock_items 
  WHERE quantity <= 5;
  
  -- Count failed payment attempts (if you track them)
  failed_payments := 0; -- Placeholder
  
  result := jsonb_build_object(
    'timestamp', NOW(),
    'pending_orders_alert', pending_orders > 5,
    'pending_orders_count', pending_orders,
    'low_stock_alert', low_stock_count > 0,
    'low_stock_count', low_stock_count,
    'failed_payments_count', failed_payments,
    'overall_status', CASE 
      WHEN pending_orders > 10 OR low_stock_count > 3 THEN 'CRITICAL'
      WHEN pending_orders > 5 OR low_stock_count > 0 THEN 'WARNING'
      ELSE 'HEALTHY'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CLEANUP AND ARCHIVAL
-- ========================================

-- Function to archive old completed orders
CREATE OR REPLACE FUNCTION archive_old_orders(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move old completed orders to archive table (create if needed)
  CREATE TABLE IF NOT EXISTS orders_archive (LIKE orders INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS order_items_archive (LIKE order_items INCLUDING ALL);
  CREATE TABLE IF NOT EXISTS payments_archive (LIKE payments INCLUDING ALL);
  
  -- Insert into archive
  INSERT INTO orders_archive 
  SELECT * FROM orders 
  WHERE status = 'completed' 
  AND created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Archive related data
  INSERT INTO order_items_archive 
  SELECT oi.* FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.status = 'completed' 
  AND o.created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  INSERT INTO payments_archive 
  SELECT p.* FROM payments p
  JOIN orders o ON p.order_id = o.id
  WHERE o.status = 'completed' 
  AND o.created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  -- Delete from main tables
  DELETE FROM order_items 
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE status = 'completed' 
    AND created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
  );
  
  DELETE FROM payments 
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE status = 'completed' 
    AND created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
  );
  
  DELETE FROM orders 
  WHERE status = 'completed' 
  AND created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SCHEDULED TASKS (Run these periodically)
-- ========================================

/*
Set up these as cron jobs or scheduled functions:

1. Refresh materialized views every hour:
   SELECT refresh_materialized_views();

2. Check system health every 15 minutes:
   SELECT check_system_health();

3. Archive old orders monthly:
   SELECT archive_old_orders(90);

4. Update table statistics for query planner:
   ANALYZE;

5. Vacuum tables weekly:
   VACUUM ANALYZE;
*/