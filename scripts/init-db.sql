-- Initialize database for Cups Shop
-- This file is automatically run when postgres container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create databases if they don't exist
SELECT 'CREATE DATABASE starbucks_shop_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'starbucks_shop_test')\gexec

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE starbucks_shop TO postgres;
GRANT ALL PRIVILEGES ON DATABASE starbucks_shop_test TO postgres;

-- =================================
-- CUPS SHOP SCHEMA (Based on Prisma)
-- =================================

-- Create enums first
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF');
CREATE TYPE order_type AS ENUM ('CUSTOM', 'PRODUCT');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE consultation_status AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role admin_role DEFAULT 'STAFF',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Colors table
CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    hex_code VARCHAR(7) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_admin_id UUID NOT NULL REFERENCES admin_users(id)
);

-- Capacities table
CREATE TABLE IF NOT EXISTS capacities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    volume_ml INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_admin_id UUID NOT NULL REFERENCES admin_users(id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(300) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_admin_id UUID NOT NULL REFERENCES admin_users(id)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    messenger_id VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(200),
    phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_admin_id UUID NOT NULL REFERENCES admin_users(id)
);

-- Customer addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_line VARCHAR(500) NOT NULL,
    district VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(300) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity_id UUID NOT NULL REFERENCES capacities(id),
    color_id UUID NOT NULL REFERENCES colors(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    stock_quantity INTEGER DEFAULT 0,
    images JSONB NOT NULL,
    product_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by_admin_id UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_type order_type NOT NULL,
    status order_status DEFAULT 'PENDING',
    total_amount DECIMAL(10,2) DEFAULT 0,
    shipping_cost DECIMAL(8,2) DEFAULT 0,
    is_free_shipping BOOLEAN DEFAULT false,
    custom_description TEXT,
    delivery_address_id UUID REFERENCES customer_addresses(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    product_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consultations table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    messenger_id VARCHAR(100) NOT NULL,
    status consultation_status DEFAULT 'PENDING',
    customer_message TEXT NOT NULL,
    product_interests JSONB NOT NULL,
    admin_response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_colors_created_by_admin_id ON colors(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_capacities_created_by_admin_id ON capacities(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_categories_created_by_admin_id ON categories(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_customers_messenger_id ON customers(messenger_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by_admin_id ON customers(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_capacity_id ON products(capacity_id);
CREATE INDEX IF NOT EXISTS idx_products_color_id ON products(color_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_consultations_customer_id ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_colors_updated_at BEFORE UPDATE ON colors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_capacities_updated_at BEFORE UPDATE ON capacities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
