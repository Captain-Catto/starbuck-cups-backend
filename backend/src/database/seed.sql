-- Seed data for Starbucks Shop MySQL
-- This file contains default data for the application

-- Default admin user (password: admin123)
INSERT IGNORE INTO admin_users (id, username, password_hash, email, role, is_active)
VALUES (
    UUID(),
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZhJBm.SjTAoG',  -- admin123
    'admin@starbucks.com',
    'SUPER_ADMIN',
    TRUE
);

-- Get admin user ID for foreign keys
SET @admin_id = (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1);

-- Default capacities
INSERT IGNORE INTO capacities (id, value, unit, display_name, is_active, created_by_admin_id) VALUES
(UUID(), 250, 'ml', '250ml', TRUE, @admin_id),
(UUID(), 300, 'ml', '300ml', TRUE, @admin_id),
(UUID(), 350, 'ml', '350ml', TRUE, @admin_id),
(UUID(), 400, 'ml', '400ml', TRUE, @admin_id),
(UUID(), 450, 'ml', '450ml', TRUE, @admin_id),
(UUID(), 500, 'ml', '500ml', TRUE, @admin_id),
(UUID(), 600, 'ml', '600ml', TRUE, @admin_id);

-- Default colors
INSERT IGNORE INTO colors (id, name, hex_code, is_active, created_by_admin_id) VALUES
(UUID(), 'White', '#FFFFFF', TRUE, @admin_id),
(UUID(), 'Black', '#000000', TRUE, @admin_id),
(UUID(), 'Red', '#FF0000', TRUE, @admin_id),
(UUID(), 'Blue', '#0000FF', TRUE, @admin_id),
(UUID(), 'Green', '#008000', TRUE, @admin_id),
(UUID(), 'Pink', '#FFC0CB', TRUE, @admin_id),
(UUID(), 'Purple', '#800080', TRUE, @admin_id),
(UUID(), 'Orange', '#FFA500', TRUE, @admin_id),
(UUID(), 'Yellow', '#FFFF00', TRUE, @admin_id),
(UUID(), 'Gray', '#808080', TRUE, @admin_id),
(UUID(), 'Brown', '#A52A2A', TRUE, @admin_id),
(UUID(), 'Gold', '#FFD700', TRUE, @admin_id),
(UUID(), 'Silver', '#C0C0C0', TRUE, @admin_id),
(UUID(), 'Teal', '#008080', TRUE, @admin_id),
(UUID(), 'Navy', '#000080', TRUE, @admin_id);

-- Default categories
INSERT IGNORE INTO categories (id, name, slug, description, is_active, created_by_admin_id) VALUES
(UUID(), 'Tumblers', 'tumblers', 'Stainless steel and plastic tumblers for daily use', TRUE, @admin_id),
(UUID(), 'Mugs', 'mugs', 'Ceramic and glass mugs for home and office', TRUE, @admin_id),
(UUID(), 'Cold Cups', 'cold-cups', 'Cups designed for cold beverages', TRUE, @admin_id),
(UUID(), 'Travel Mugs', 'travel-mugs', 'Insulated mugs perfect for on-the-go', TRUE, @admin_id),
(UUID(), 'Gift Sets', 'gift-sets', 'Special gift collections and bundles', TRUE, @admin_id),
(UUID(), 'Limited Edition', 'limited-edition', 'Exclusive and seasonal collections', TRUE, @admin_id),
(UUID(), 'Classic', 'classic', 'Timeless Starbucks designs', TRUE, @admin_id),
(UUID(), 'Seasonal', 'seasonal', 'Holiday and seasonal themed cups', TRUE, @admin_id);

-- Create a sample hero image
INSERT IGNORE INTO hero_images (id, title, image_url, alt_text, link_url, is_active, display_order, created_by_admin_id)
VALUES (
    UUID(),
    'Welcome to Starbucks Cups Collection',
    '/images/hero/welcome-banner.jpg',
    'Starbucks Cups Collection Banner',
    '/products',
    TRUE,
    0,
    @admin_id
);