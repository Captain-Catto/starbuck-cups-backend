-- Create admin user for testing authentication
-- Password: Admin123!
-- Run this after database initialization

INSERT INTO admin_users (username, password_hash, email, role) VALUES
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBz3gO0fYYCGru', 'admin@cupsshop.com', 'SUPER_ADMIN');

-- Password: Staff123!
INSERT INTO admin_users (username, password_hash, email, role) VALUES
('staff', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff@cupsshop.com', 'STAFF');

-- Verify insertion
SELECT id, username, email, role, is_active, created_at FROM admin_users;