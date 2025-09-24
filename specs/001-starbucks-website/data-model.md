# Data Model: Starbucks Cup E-commerce Website

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Status**: Complete

## Entity Definitions

### Product

**Purpose**: Represents Starbucks cups with single representative color, customers consult via Messenger for other colors

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `slug`: String(300), Required, SEO-friendly URL identifier (e.g., "ly-starbucks-classic-trang-450ml")
- `name`: String(255), Required, Product display name
- `description`: Text, Optional, Detailed product information
- `capacity_id`: UUID, Required, Foreign Key to Capacity.id for the product volume
- `color_id`: UUID, Required, Foreign Key to Color.id for the product color
- `category_id`: UUID, Required, Foreign Key to Category.id for the product classification
- `stock_quantity`: Integer, Required, Inventory count for this specific color variant, Min: 0
- `images`: JSON Array, Required, Array of image URLs for the display color
- `product_url`: String(500), Optional, Link to official product page
- `created_at`: Timestamp, Auto-generated, Record creation time
- `updated_at`: Timestamp, Auto-updated, Last modification time
- `is_active`: Boolean, Default: true, Product visibility flag

**Note**: Each product represents one color, capacity and category variant. Product references Color, Capacity, and Category entities for dynamic management.

**Validation Rules**:

- `slug` must be unique across all products, URL-safe format (lowercase, hyphens, no spaces)
- `slug` auto-generated from name + color + capacity (e.g., "ly-starbucks-classic-trang-450ml")
- `capacity_id` must reference valid active capacity
- `color_id` must reference valid active color
- `category_id` must reference valid active category
- `stock_quantity` cannot be negative and represents inventory for this variant
- `images` array must contain at least one valid image URL
- `name` must be unique within same category, color, and capacity combination

**Relationships**:

- Many-to-One with Color (references color definition)
- Many-to-One with Capacity (references capacity definition)
- Many-to-One with Category (references category definition)
- One-to-Many with OrderItem (products can appear in multiple orders)
- Referenced by CartItem (temporary shopping cart storage)

### Color

**Purpose**: Dynamic color management system allowing creation of new colors as needed

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(100), Required, Vietnamese color name (e.g., "Trắng", "Đen", "Be")
- `hex_code`: String(7), Optional, Color hex code for UI display (e.g., "#FFFFFF")
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this color
- `created_at`: Timestamp, Auto-generated, Color creation time
- `usage_count`: Integer, Default: 0, Number of products using this color
- `is_active`: Boolean, Default: true, Color availability flag

**Note**: Colors are created dynamically when admin needs new color options. System uses Vietnamese only.

**Validation Rules**:

- `name` must be unique (case-insensitive)
- `hex_code` must be valid hex color format if provided
- `name` must contain only Vietnamese characters and spaces
- `usage_count` automatically calculated from product references

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- One-to-Many with Product (colors used in products)

### Capacity

**Purpose**: Dynamic capacity management system for cup volumes

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(50), Required, Vietnamese capacity name (e.g., "350ml", "450ml", "Siêu lớn 750ml")
- `value_ml`: Integer, Required, Capacity value in milliliters for sorting/filtering
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this capacity
- `created_at`: Timestamp, Auto-generated, Capacity creation time
- `usage_count`: Integer, Default: 0, Number of products using this capacity
- `is_active`: Boolean, Default: true, Capacity availability flag

**Note**: Capacities are created dynamically when admin needs new volume options.

**Validation Rules**:

- `name` must be unique (case-insensitive)
- `value_ml` must be positive integer between 50-2000ml
- `value_ml` must be unique (prevent duplicate volumes)
- `usage_count` automatically calculated from product references

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- One-to-Many with Product (capacities used in products)

### Category

**Purpose**: Dynamic category management system for product classification

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(255), Required, Vietnamese category name (e.g., "Ly đá", "Ly giai - Cold Cup", "Bình giữ nhiệt", "Stanley", "Ly giữ nhiệt", "Túi - Balo", "Phụ kiện", "Gấu bông", "Ly sứ - Thuỷ tinh")
- `description`: Text, Optional, Detailed category description
- `slug`: String(300), Required, SEO-friendly URL identifier (e.g., "ly-giai-cold-cup")
- `parent_category_id`: UUID, Optional, Foreign Key to Category.id for hierarchical structure
- `sort_order`: Integer, Default: 0, Display order for frontend
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this category
- `created_at`: Timestamp, Auto-generated, Category creation time
- `usage_count`: Integer, Default: 0, Number of products using this category
- `is_active`: Boolean, Default: true, Category availability flag

**Note**: Categories support hierarchical structure (parent-child) and are created dynamically when admin needs new classification options.

**Validation Rules**:

- `name` must be unique within same parent level (case-insensitive)
- `slug` must be unique across all categories, URL-safe format
- `slug` auto-generated from name (e.g., "Ly giai - Cold Cup" → "ly-giai-cold-cup")
- `parent_category_id` cannot reference itself (prevent circular hierarchy)
- `sort_order` used for frontend display ordering
- `usage_count` automatically calculated from product references
- Maximum 3 levels of hierarchy depth

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- Many-to-One with Category (parent category, optional)
- One-to-Many with Category (child categories)
- One-to-Many with Product (categories used in products)

### Customer

**Purpose**: Represents customers created and managed by admin users

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `phone`: String(20), Required, Primary contact number (Vietnamese format)
- `email`: String(255), Optional, Email address for notifications
- `full_name`: String(255), Optional, Customer display name
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this customer
- `created_at`: Timestamp, Auto-generated, Account creation time
- `updated_at`: Timestamp, Auto-updated, Last profile modification
- `is_active`: Boolean, Default: true, Account status flag

**Note**: All customers are created by admin users. No self-registration or verification process needed.

**Validation Rules**:

- `phone` must match Vietnamese phone number format (+84 or 0)
- `email` must be valid email format if provided
- `phone` must be unique across all customers
- `email` must be unique if provided (nullable unique constraint)
- `created_by_admin_id` must reference valid admin user

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- One-to-Many with CustomerAddress (multiple delivery addresses)
- One-to-Many with CustomerSocialAccount (multiple social media accounts)
- One-to-Many with Order (customer order history)

### CustomerAddress

**Purpose**: Stores multiple delivery addresses per customer

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `customer_id`: UUID, Foreign Key, References Customer.id
- `label`: String(50), Required, Address label (e.g., "Home", "Office")
- `street_address`: String(500), Required, Full street address
- `ward`: String(100), Required, Ward/commune name
- `district`: String(100), Required, District name
- `city`: String(100), Required, City/province name
- `postal_code`: String(10), Optional, Postal code if applicable
- `is_default`: Boolean, Default: false, Primary address flag
- `created_at`: Timestamp, Auto-generated
- `updated_at`: Timestamp, Auto-updated

**Validation Rules**:

- Only one `is_default = true` per customer
- `street_address` cannot be empty
- Vietnamese administrative division validation
- Maximum 5 addresses per customer

**Relationships**:

- Many-to-One with Customer (belongs to single customer)
- Referenced by Order (delivery address selection)

### CustomerSocialAccount

**Purpose**: Stores multiple social media accounts per customer (admin-managed)

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `customer_id`: UUID, Foreign Key, References Customer.id
- `platform`: Enum, Required, Social platform type ('facebook', 'zalo')
- `account_identifier`: String(255), Required, Username/phone/ID for platform
- `display_name`: String(255), Optional, Public display name on platform
- `created_at`: Timestamp, Auto-generated
- `updated_at`: Timestamp, Auto-updated

**Note**: Verification fields removed since admin manages all customer social accounts.

**Validation Rules**:

- Unique combination of (`customer_id`, `platform`, `account_identifier`)
- `platform` must be from allowed enum values
- Platform-specific validation for `account_identifier` format
- Maximum 3 accounts per platform per customer

**Relationships**:

- Many-to-One with Customer (belongs to single customer)

### Order

**Purpose**: Represents both custom orders and product-based orders

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `order_number`: String(20), Required, Human-readable order reference
- `customer_id`: UUID, Foreign Key, References Customer.id
- `order_type`: Enum, Required, Order type ('custom', 'product')
- `status`: Enum, Required, Order status ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
- `total_amount`: Decimal(10,2), Required, Total order value in VND
- `shipping_cost`: Decimal(8,2), Default: 0, Shipping fee in VND
- `is_free_shipping`: Boolean, Default: false, Free shipping applied
- `custom_description`: Text, Optional, Free-form description for custom orders
- `delivery_address_id`: UUID, Optional, Foreign Key to CustomerAddress.id
- `notes`: Text, Optional, Additional order notes
- `created_at`: Timestamp, Auto-generated, Order creation time
- `updated_at`: Timestamp, Auto-updated, Last status change
- `confirmed_at`: Timestamp, Optional, Order confirmation time
- `completed_at`: Timestamp, Optional, Order completion time

**Validation Rules**:

- `order_number` must be unique and follow format: ORD-YYYYMMDD-XXXX
- `total_amount` must be positive for confirmed orders
- `custom_description` required when `order_type = 'custom'`
- `delivery_address_id` must belong to the same customer
- Cannot modify confirmed orders except status updates

**Relationships**:

- Many-to-One with Customer (belongs to single customer)
- Many-to-One with CustomerAddress (delivery address)
- One-to-Many with OrderItem (order line items for product orders)

### OrderItem

**Purpose**: Individual line items for product-based orders with color selection

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `order_id`: UUID, Foreign Key, References Order.id
- `product_id`: UUID, Foreign Key, References Product.id
- `selected_color`: String(50), Required, Customer's chosen color from available options
- `quantity`: Integer, Required, Number of items ordered
- `unit_price`: Decimal(10,2), Required, Price per unit in VND (admin-set)
- `total_price`: Decimal(10,2), Computed, `quantity * unit_price`
- `product_snapshot`: JSON, Required, Product details at time of order including available colors
- `created_at`: Timestamp, Auto-generated

**Validation Rules**:

- `quantity` must be positive integer
- `unit_price` must be positive
- `total_price` automatically calculated
- `selected_color` must be in product's `available_colors` array at time of order
- Cannot exceed product's total stock at order creation
- `product_snapshot` preserves product state for historical accuracy

**Relationships**:

- Many-to-One with Order (belongs to single order)
- Many-to-One with Product (references current product)

### AdminUser

**Purpose**: Administrative users for backend management

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `username`: String(50), Required, Login identifier
- `password_hash`: String(255), Required, Bcrypt hashed password
- `email`: String(255), Required, Admin email address
- `role`: Enum, Required, Admin role ('super_admin', 'admin', 'staff')
- `is_active`: Boolean, Default: true, Account status
- `last_login_at`: Timestamp, Optional, Last successful login
- `created_at`: Timestamp, Auto-generated
- `updated_at`: Timestamp, Auto-updated

**Validation Rules**:

- `username` must be unique and alphanumeric
- `email` must be unique and valid email format
- Password must meet complexity requirements (8+ chars, mixed case, numbers)
- Only super_admin can create other admin accounts

**Relationships**:

- One-to-Many with AuditLog (admin action tracking)

### AnalyticsSummary

**Purpose**: Pre-aggregated analytics data for dashboard performance

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `date`: Date, Required, Summary date (YYYY-MM-DD)
- `period_type`: Enum, Required, Time period ('daily', 'weekly', 'monthly', 'yearly')
- `total_revenue`: Decimal(12,2), Required, Total sales in VND
- `total_orders`: Integer, Required, Number of orders completed
- `total_products_sold`: Integer, Required, Total quantity of products sold
- `unique_customers`: Integer, Required, Number of unique customers
- `average_order_value`: Decimal(10,2), Computed, Revenue / Orders
- `created_at`: Timestamp, Auto-generated
- `updated_at`: Timestamp, Auto-updated

**Validation Rules**:

- Unique combination of (`date`, `period_type`)
- All numeric fields must be non-negative
- `average_order_value` automatically calculated
- Daily summaries updated in real-time, others via batch jobs

**Relationships**:

- Aggregated from Order and OrderItem data
- Referenced by dashboard queries

## Relationships Summary

### One-to-Many Relationships

- AdminUser → Customer (1:N) - admin creates customers
- Customer → CustomerAddress (1:N)
- Customer → CustomerSocialAccount (1:N)
- Customer → Order (1:N)
- Order → OrderItem (1:N)
- Product → OrderItem (1:N)
- AdminUser → AuditLog (1:N)

### Many-to-One Relationships

- CustomerAddress → Customer (N:1)
- CustomerSocialAccount → Customer (N:1)
- Customer → AdminUser (N:1) - created by admin
- Order → Customer (N:1)
- Order → CustomerAddress (N:1)
- OrderItem → Order (N:1)
- OrderItem → Product (N:1)

## Database Constraints

### Primary Keys

- All entities use UUID primary keys for better distributed system support
- UUIDs prevent ID enumeration attacks in public APIs

### Foreign Key Constraints

- All foreign keys include CASCADE DELETE where appropriate
- CustomerAddress and CustomerSocialAccount cascade delete with Customer
- Customer does NOT cascade delete with AdminUser (preserve customer history even if admin is removed)
- OrderItem cascade deletes with Order
- Order does NOT cascade delete with Customer (preserve order history)

### Unique Constraints

- Product: (`name`, `category`) - prevent duplicate products
- Customer: `phone` - primary contact uniqueness
- Customer: `email` - email uniqueness (nullable)
- Order: `order_number` - human-readable reference uniqueness
- AdminUser: `username`, `email` - login identifier uniqueness
- AnalyticsSummary: (`date`, `period_type`) - prevent duplicate summaries

### Check Constraints

- Product.`stock_quantity` >= 0
- Product.`capacity` BETWEEN 50 AND 2000
- OrderItem.`quantity` > 0
- OrderItem.`unit_price` > 0
- Order.`total_amount` > 0 (for confirmed orders)
- Customer phone format validation

### Indexes for Performance

- Product: (`category`, `is_active`) - filtering active products by category
- Product: (`stock_quantity`) - low stock queries
- Product: (`available_colors`) - color-based filtering (GIN index for JSON array)
- Customer: (`created_by_admin_id`) - admin customer management
- Order: (`customer_id`, `created_at`) - customer order history
- Order: (`status`, `created_at`) - admin order management
- OrderItem: (`selected_color`) - color preference analytics
- AnalyticsSummary: (`date`, `period_type`) - dashboard queries
- CustomerAddress: (`customer_id`, `is_default`) - address lookup

## State Transitions

### Order Status Flow

```
pending → confirmed → processing → shipped → delivered
   ↓         ↓           ↓          ↓
cancelled cancelled  cancelled  cancelled
```

**Business Rules**:

- Only pending orders can be modified
- Cancelled orders cannot be reactivated
- Status changes must follow sequential order (no skipping)
- Stock is reserved on confirmation, deducted on processing

### Product Availability

```
active (stock > 0) → active (stock = 0) → inactive
     ↑                      ↓                ↓
     ←── restocked ←────────┘      permanently_removed
```

**Business Rules**:

- Products with stock = 0 remain active but show "out of stock"
- Inactive products don't appear in customer browsing
- Low stock alerts trigger when stock < 5

---

**Data Model Status**: ✅ Complete - All entities, relationships, and constraints defined
