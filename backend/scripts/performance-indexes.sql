-- Performance indexes for higher concurrent traffic (100-200 users)

CREATE INDEX IF NOT EXISTS idx_products_active_deleted_created
  ON products (is_active, is_deleted, created_at);

CREATE INDEX IF NOT EXISTS idx_products_active_deleted_stock
  ON products (is_active, is_deleted, stock_quantity);

CREATE INDEX IF NOT EXISTS idx_products_featured_active_deleted_created
  ON products (is_featured, is_active, is_deleted, created_at);

CREATE INDEX IF NOT EXISTS idx_products_name
  ON products (name);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders (status, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
  ON orders (customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_type_created_at
  ON orders (order_type, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_product
  ON order_items (order_id, product_id);
