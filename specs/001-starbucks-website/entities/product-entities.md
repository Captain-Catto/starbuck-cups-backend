# Product Catalog Entities

**Module**: Product Management  
**Updated**: September 11, 2025

## Entities trong module này

- **Product** - Sản phẩm chính (1 color per product)
- **Color** - Màu sắc (dynamic management)
- **Capacity** - Dung tích (dynamic management)
- **Category** - Phân loại sản phẩm (hierarchical)

---

## Product

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
- `is_deleted`: Boolean, Default: false, Soft delete flag for data integrity
- `deleted_at`: Timestamp, Optional, Soft deletion time
- `deleted_by_admin_id`: UUID, Optional, Foreign Key to AdminUser.id who deleted this product

**Note**: Each product represents one color, capacity and category variant. Product references Color, Capacity, and Category entities for dynamic management.

**Lifecycle Management**: Products use soft delete to preserve order history integrity. Hard delete only allowed for products never referenced in orders.

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

**Business Rules**:

- Single color per product - customers consult for alternatives
- SEO-optimized slugs for Vietnamese market
- Stock tracking per color variant
- Admin manages availability and pricing
- **Soft Delete Policy**: Products referenced in orders cannot be hard deleted
- **Active vs Deleted**: `is_active=false` hides from catalog, `is_deleted=true` removes completely
- **Order Integrity**: OrderItem maintains product snapshots for historical accuracy

---

## Color

**Purpose**: Dynamic color management system allowing creation of new colors as needed

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(50), Required, Vietnamese color name (e.g., "Đỏ", "Xanh lá")
- `hex_code`: String(7), Required, Color representation for UI (#RRGGBB format)
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this color
- `created_at`: Timestamp, Auto-generated, Color creation time
- `usage_count`: Integer, Default: 0, Number of products using this color
- `is_active`: Boolean, Default: true, Color availability flag

**Note**: Colors are created dynamically when admin needs new color options for products.

**Validation Rules**:

- `name` must be unique (case-insensitive) and in Vietnamese
- `hex_code` must be valid hex color format (#RRGGBB)
- `hex_code` must be unique (prevent duplicate colors with different names)
- `name` must contain only Vietnamese characters and spaces
- `usage_count` automatically calculated from product references

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- One-to-Many with Product (colors used in products)

**Business Rules**:

- Cannot delete colors used by active products
- Vietnamese color names for local market
- Hex codes for consistent UI display
- Admin creates as needed during product entry

---

## Capacity

**Purpose**: Dynamic capacity management system for different cup sizes

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(50), Required, Display name (e.g., "Grande (16 oz)", "Venti (20 oz)")
- `value_ml`: Integer, Required, Volume in milliliters
- `sort_order`: Integer, Required, Display order (1=smallest, 2=medium, etc.)
- `created_by_admin_id`: UUID, Required, Foreign Key to AdminUser.id who created this capacity
- `created_at`: Timestamp, Auto-generated, Capacity creation time
- `usage_count`: Integer, Default: 0, Number of products using this capacity
- `is_active`: Boolean, Default: true, Capacity availability flag

**Note**: Capacities are created dynamically when admin needs new size options for products.

**Validation Rules**:

- `name` must be unique (case-insensitive)
- `value_ml` must be positive integer and unique (prevent duplicate volumes)
- `sort_order` used for logical size ordering in UI
- `usage_count` automatically calculated from product references

**Relationships**:

- Many-to-One with AdminUser (created by admin)
- One-to-Many with Product (capacities used in products)

**Business Rules**:

- Cannot delete capacities used by active products
- Sort order determines display sequence (small to large)
- Support both Vietnamese and international naming
- Admin creates as needed during product entry

---

## Category

**Purpose**: Hierarchical category system for complex product classification

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `name`: String(100), Required, Category display name (e.g., "Ly giai - Cold Cup")
- `description`: Text, Optional, Detailed category description
- `slug`: String(150), Required, SEO-friendly URL identifier (e.g., "ly-giai-cold-cup")
- `parent_category_id`: UUID, Optional, Foreign Key to Category.id for hierarchical structure
- `sort_order`: Integer, Required, Display order within parent level
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

**Business Rules**:

- Support complex Facebook-style categorization
- SEO-friendly URLs for category pages
- Cannot delete categories used by active products
- Cannot delete categories with child categories
- Hierarchical structure: Root → Level 1 → Level 2 (max 3 levels)
