-- Sample data for Cups Shop Business
-- Run this after the database is initialized

-- Insert Admin User first (required for other tables)
INSERT INTO admin_users (username, password_hash, email, role) VALUES
('admin', '$2b$10$example.hash.here', 'admin@cupsshop.com', 'SUPER_ADMIN'),
('staff1', '$2b$10$example.hash.here', 'staff1@cupsshop.com', 'STAFF');

-- Get admin ID for foreign key references
-- Insert Colors
INSERT INTO colors (name, hex_code, created_by_admin_id) VALUES
('White', '#FFFFFF', (SELECT id FROM admin_users WHERE username = 'admin')),
('Black', '#000000', (SELECT id FROM admin_users WHERE username = 'admin')),
('Red', '#FF0000', (SELECT id FROM admin_users WHERE username = 'admin')),
('Blue', '#0000FF', (SELECT id FROM admin_users WHERE username = 'admin')),
('Green', '#008000', (SELECT id FROM admin_users WHERE username = 'admin')),
('Yellow', '#FFFF00', (SELECT id FROM admin_users WHERE username = 'admin')),
('Pink', '#FFC0CB', (SELECT id FROM admin_users WHERE username = 'admin')),
('Orange', '#FFA500', (SELECT id FROM admin_users WHERE username = 'admin'));

-- Insert Capacities
INSERT INTO capacities (name, volume_ml, created_by_admin_id) VALUES
('Small (8oz)', 240, (SELECT id FROM admin_users WHERE username = 'admin')),
('Medium (12oz)', 355, (SELECT id FROM admin_users WHERE username = 'admin')),
('Large (16oz)', 473, (SELECT id FROM admin_users WHERE username = 'admin')),
('Extra Large (20oz)', 591, (SELECT id FROM admin_users WHERE username = 'admin'));

-- Insert Categories
INSERT INTO categories (name, slug, description, created_by_admin_id) VALUES
('Coffee Mugs', 'coffee-mugs', 'Traditional coffee mugs for hot beverages', (SELECT id FROM admin_users WHERE username = 'admin')),
('Travel Mugs', 'travel-mugs', 'Insulated mugs for on-the-go drinking', (SELECT id FROM admin_users WHERE username = 'admin')),
('Tea Cups', 'tea-cups', 'Elegant cups designed for tea service', (SELECT id FROM admin_users WHERE username = 'admin')),
('Water Bottles', 'water-bottles', 'Reusable water bottles', (SELECT id FROM admin_users WHERE username = 'admin')),
('Wine Glasses', 'wine-glasses', 'Glassware for wine and cocktails', (SELECT id FROM admin_users WHERE username = 'admin')),
('Specialty Cups', 'specialty-cups', 'Unique and custom designed cups', (SELECT id FROM admin_users WHERE username = 'admin'));

-- Insert Sample Products
INSERT INTO products (slug, name, description, capacity_id, color_id, category_id, stock_quantity, images, product_url) VALUES
('classic-white-mug', 
 'Classic White Coffee Mug', 
 'Simple and elegant white ceramic coffee mug perfect for daily use',
 (SELECT id FROM capacities WHERE name = 'Medium (12oz)'),
 (SELECT id FROM colors WHERE name = 'White'),
 (SELECT id FROM categories WHERE slug = 'coffee-mugs'),
 50,
 '["https://example.com/images/classic-white-mug-1.jpg", "https://example.com/images/classic-white-mug-2.jpg"]',
 'https://example.com/products/classic-white-mug'),

('stainless-travel-mug', 
 'Stainless Steel Travel Mug', 
 'Double-wall insulated stainless steel mug with leak-proof lid',
 (SELECT id FROM capacities WHERE name = 'Large (16oz)'),
 (SELECT id FROM colors WHERE name = 'Black'),
 (SELECT id FROM categories WHERE slug = 'travel-mugs'),
 30,
 '["https://example.com/images/travel-mug-1.jpg", "https://example.com/images/travel-mug-2.jpg"]',
 'https://example.com/products/stainless-travel-mug'),

('ceramic-tea-cup', 
 'Delicate Ceramic Tea Cup', 
 'Fine bone china tea cup with matching saucer',
 (SELECT id FROM capacities WHERE name = 'Small (8oz)'),
 (SELECT id FROM colors WHERE name = 'Pink'),
 (SELECT id FROM categories WHERE slug = 'tea-cups'),
 25,
 '["https://example.com/images/tea-cup-1.jpg"]',
 'https://example.com/products/ceramic-tea-cup'),

('sports-water-bottle', 
 'Sports Water Bottle', 
 'BPA-free plastic water bottle with sport cap',
 (SELECT id FROM capacities WHERE name = 'Extra Large (20oz)'),
 (SELECT id FROM colors WHERE name = 'Blue'),
 (SELECT id FROM categories WHERE slug = 'water-bottles'),
 100,
 '["https://example.com/images/water-bottle-1.jpg", "https://example.com/images/water-bottle-2.jpg", "https://example.com/images/water-bottle-3.jpg"]',
 'https://example.com/products/sports-water-bottle');

-- Insert Sample Customers
INSERT INTO customers (messenger_id, full_name, phone, notes, created_by_admin_id) VALUES
('messenger_001', 'John Doe', '+84123456789', 'Regular customer, prefers travel mugs', (SELECT id FROM admin_users WHERE username = 'admin')),
('messenger_002', 'Jane Smith', '+84987654321', 'Corporate buyer, bulk orders', (SELECT id FROM admin_users WHERE username = 'staff1')),
('messenger_003', 'Mike Johnson', '+84555666777', 'Gift buyer, likes colorful products', (SELECT id FROM admin_users WHERE username = 'admin'));

-- Insert Customer Addresses
INSERT INTO customer_addresses (customer_id, address_line, district, city, postal_code, is_default) VALUES
((SELECT id FROM customers WHERE messenger_id = 'messenger_001'), 
 '123 Main Street', 'District 1', 'Ho Chi Minh City', '70000', true),
((SELECT id FROM customers WHERE messenger_id = 'messenger_002'), 
 '456 Business Ave', 'District 3', 'Ho Chi Minh City', '70000', true),
((SELECT id FROM customers WHERE messenger_id = 'messenger_003'), 
 '789 Residential Road', 'District 7', 'Ho Chi Minh City', '70000', true);

-- Insert Sample Orders
INSERT INTO orders (order_number, customer_id, order_type, status, total_amount, shipping_cost, delivery_address_id, notes) VALUES
('CUP001', 
 (SELECT id FROM customers WHERE messenger_id = 'messenger_001'),
 'PRODUCT',
 'DELIVERED',
 450000.00,
 50000.00,
 (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE messenger_id = 'messenger_001') AND is_default = true),
 'Rush delivery requested'),
 
('CUP002', 
 (SELECT id FROM customers WHERE messenger_id = 'messenger_002'),
 'CUSTOM',
 'PROCESSING',
 1200000.00,
 0.00,
 (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE messenger_id = 'messenger_002') AND is_default = true),
 'Custom logo printing required');

-- Insert Order Items
INSERT INTO order_items (order_id, product_id, quantity, product_snapshot) VALUES
((SELECT id FROM orders WHERE order_number = 'CUP001'),
 (SELECT id FROM products WHERE slug = 'stainless-travel-mug'),
 2,
 '{"name": "Stainless Steel Travel Mug", "price": 200000, "color": "Black", "capacity": "Large (16oz)"}'),

((SELECT id FROM orders WHERE order_number = 'CUP002'),
 (SELECT id FROM products WHERE slug = 'classic-white-mug'),
 10,
 '{"name": "Classic White Coffee Mug", "price": 120000, "color": "White", "capacity": "Medium (12oz)", "custom": "Company logo print"}');

-- Insert Sample Consultations
INSERT INTO consultations (customer_id, messenger_id, customer_message, product_interests, admin_response, status, responded_at) VALUES
((SELECT id FROM customers WHERE messenger_id = 'messenger_003'),
 'messenger_003',
 'Hi, I am looking for a set of colorful mugs for my office. Do you have any recommendations?',
 '{"categories": ["coffee-mugs"], "colors": ["red", "blue", "green", "yellow"], "quantity": "6-10 pieces"}',
 'We have a great selection of colorful ceramic mugs. I recommend our Classic Coffee Mug series in various colors. Would you like to see our catalog?',
 'RESOLVED',
 CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Update order timestamps
UPDATE orders SET 
  confirmed_at = created_at + INTERVAL '30 minutes',
  completed_at = created_at + INTERVAL '2 days'
WHERE status = 'DELIVERED';

-- Insert more sample products with better stock management
INSERT INTO products (slug, name, description, capacity_id, color_id, category_id, stock_quantity, images, product_url) VALUES
-- Red variants
('ceramic-mug-red-small', 
 'Ceramic Coffee Mug', 
 'Premium ceramic mug perfect for your morning coffee',
 (SELECT id FROM capacities WHERE name = 'Small (8oz)'),
 (SELECT id FROM colors WHERE name = 'Red'),
 (SELECT id FROM categories WHERE slug = 'coffee-mugs'),
 25,
 '["https://example.com/images/ceramic-mug-red-small-1.jpg", "https://example.com/images/ceramic-mug-red-small-2.jpg"]',
 'https://example.com/products/ceramic-mug-red-small'),

-- Blue variants  
('travel-tumbler-blue-large',
 'Insulated Travel Tumbler', 
 'Double-wall vacuum insulated tumbler for hot and cold beverages',
 (SELECT id FROM capacities WHERE name = 'Large (16oz)'),
 (SELECT id FROM colors WHERE name = 'Blue'),
 (SELECT id FROM categories WHERE slug = 'travel-mugs'),
 15,
 '["https://example.com/images/travel-tumbler-blue-large-1.jpg"]',
 'https://example.com/products/travel-tumbler-blue-large'),

-- Green variants
('tea-cup-green-small',
 'Elegant Tea Cup', 
 'Fine porcelain tea cup with saucer',
 (SELECT id FROM capacities WHERE name = 'Small (8oz)'),
 (SELECT id FROM colors WHERE name = 'Green'),
 (SELECT id FROM categories WHERE slug = 'tea-cups'),
 40,
 '["https://example.com/images/tea-cup-green-small-1.jpg", "https://example.com/images/tea-cup-green-small-2.jpg"]',
 'https://example.com/products/tea-cup-green-small'),

-- Low stock item
('water-bottle-yellow-xlarge',
 'Sport Water Bottle', 
 'BPA-free water bottle with flip-top cap',
 (SELECT id FROM capacities WHERE name = 'Extra Large (20oz)'),
 (SELECT id FROM colors WHERE name = 'Yellow'),
 (SELECT id FROM categories WHERE slug = 'water-bottles'),
 3, -- Low stock for testing alerts
 '["https://example.com/images/water-bottle-yellow-xlarge-1.jpg"]',
 'https://example.com/products/water-bottle-yellow-xlarge'),

-- Out of stock item  
('mug-pink-medium',
 'Pink Ceramic Mug', 
 'Stylish pink ceramic mug for coffee lovers',
 (SELECT id FROM capacities WHERE name = 'Medium (12oz)'),
 (SELECT id FROM colors WHERE name = 'Pink'),
 (SELECT id FROM categories WHERE slug = 'coffee-mugs'),
 0, -- Out of stock for testing
 '["https://example.com/images/mug-pink-medium-1.jpg"]',
 'https://example.com/products/mug-pink-medium');