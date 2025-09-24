# Technical Updates: Configuration and Response Structure

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Status**: Updated

## Product Management - Dynamic Color, Capacity and SEO-Friendly URLs

### Latest Update: SEO-Friendly Product Slugs (September 11, 2025)

#### SEO and URL Structure Changes

- **Product Slugs**: Each product has unique slug for SEO-friendly URLs
- **Auto-Generation**: Slugs auto-generated from name + color + capacity
- **Format**: "ly-starbucks-classic-trang-450ml" (lowercase, hyphens, Vietnamese)
- **API Support**: Both ID and slug accepted in endpoints
- **Uniqueness**: Slug validation prevents duplicates

#### Admin Slug Management

1. **Auto-Generation**: System creates slug from product details
   - Product: "Ly Starbucks Classic" + Color: "Trắng" + Capacity: "450ml"
   - Generated: "ly-starbucks-classic-trang-450ml"
2. **Custom Override**: Admin can provide custom slug if needed
3. **Conflict Resolution**: Auto-append numbers for duplicates (-2, -3, etc.)
4. **Update Handling**: Slug regenerated when name/color/capacity changes

#### Frontend URL Structure

- **Product Detail**: `/products/ly-starbucks-classic-trang-450ml`
- **Color Consultation**: `/products/ly-starbucks-classic-trang-450ml/color-consultation`
- **Backward Compatibility**: UUID still works for API calls
- **SEO Benefits**: Descriptive URLs improve search rankings

#### API Updates

- **Flexible Parameters**: Accept both UUID and slug in path parameters
- **Response Fields**: All product objects include slug field
- **Product Management**: Full CRUD with slug generation and validation
- **Conflict Handling**: Suggest alternative slugs when duplicates occur

### Previous Updates - Dynamic Color and Capacity Management

#### Business Logic Changes

- **Color Entity**: New Color table for dynamic color management (Vietnamese only)
- **Capacity Entity**: New Capacity table for dynamic volume management
- **Dual References**: Products reference both Color and Capacity entities
- **Vietnamese Focus**: System uses Vietnamese language only, no English support
- **Usage Tracking**: System tracks product usage for both colors and capacities

#### Admin Workflow for Dynamic Management

1. **Product Creation**: Admin starts creating product "Ly Starbucks Logo"
2. **Color Selection**:
   - Search existing colors: "be" → Shows "Be", "Be Đậm"
   - Not found → Create new: "Be Nhạt" with hex #F8F6F0
3. **Capacity Selection**:
   - Search existing capacities: "650" → Shows "650ml", "Siêu lớn 680ml"
   - Not found → Create new: "Siêu lớn 650ml" with value 650ml
4. **Save Product**: Product references both color_id and capacity_id

#### Color Management Examples

```json
POST /admin/colors
{
  "name": "Be Kem",
  "hex_code": "#FFF8DC"
}

GET /admin/colors/search?q=be
// Returns: "Be", "Be Đậm", "Be Nhạt", "Be Kem"
```

#### Capacity Management Examples

```json
POST /admin/capacities
{
  "name": "Siêu lớn 750ml",
  "value_ml": 750
}

GET /admin/capacities/search?q=750
// Returns: "750ml", "Siêu lớn 750ml"
```

#### Frontend Changes

- **Dual Autocomplete**: Separate search for colors and capacities
- **Management Panels**: Admin sections for both color and capacity CRUD
- **Usage Statistics**: Show how many products use each color/capacity
- **Create Suggestions**: "Tạo màu mới" and "Tạo dung tích mới" when not found

#### Backend Changes

- **Color Table**: `id`, `name`, `hex_code`, `created_by_admin_id`, `usage_count`
- **Capacity Table**: `id`, `name`, `value_ml`, `created_by_admin_id`, `usage_count`
- **Product References**: `color_id` and `capacity_id` foreign keys
- **Search APIs**: Autocomplete for both colors and capacities
- **Usage Validation**: Prevent deletion of colors/capacities in use

#### API Updates

- **Unified Language**: All text content in Vietnamese only
- **Object Responses**: Both color and capacity return full objects in product responses
- **Images Structure**: Simple array format instead of color-mapped object
- **Management Endpoints**: Full CRUD for colors and capacities
- **Search Endpoints**: Autocomplete with create suggestions for both entities
- **Filter Updates**: Capacity filtering by IDs instead of ml values
- **Order Processing**: selected_color may differ from product display_color (customer requests)

### Previous Updates

#### Business Logic Changes

- **Color Entity**: New Color table to manage all available colors dynamically
- **Dynamic Creation**: Admin can create new colors when needed (e.g., "Be" color)
- **Color Reference**: Products reference Color entity instead of storing color strings
- **Usage Tracking**: System tracks how many products use each color
- **Multilingual Support**: Colors support both Vietnamese and English names

#### Admin Workflow for New Colors

1. **Product Creation**: Admin starts creating product "Ly Starbucks Logo"
2. **Color Selection**: Types "be" in color search box
3. **Search Results**: System shows existing "Be" colors or "No exact match"
4. **Create New Color**:
   ```json
   POST /admin/colors
   {
     "name_vi": "Be Nhạt",
     "name_en": "Light Beige",
     "hex_code": "#F8F6F0"
   }
   ```
5. **Use Color**: Select newly created color for product
6. **Autocomplete Updates**: "Be Nhạt" now appears in future searches

#### Color Search Examples

- Search "be" → Returns: "Be", "Be Đậm", "Be Nhạt"
- Search "bei" → Returns: "Beige", "Light Beige"
- Search "hồng" → Returns: "Hồng", "Hồng Phấn", "Hồng Đậm"
- No results → Suggest "Create new color: [search term]"

#### Frontend Changes

- **Color Autocomplete**: Search colors by Vietnamese/English names
- **Color Picker**: Visual color selection with hex codes
- **Color Management**: Admin panel section for color CRUD operations
- **Usage Statistics**: Show how many products use each color

#### Backend Changes

- **Color Table**: `id`, `name_vi`, `name_en`, `hex_code`, `created_by_admin_id`, `usage_count`
- **Product.color_id**: Foreign key to Color table
- **Color Endpoints**: Full CRUD API for color management
- **Search API**: `/admin/colors/search?q=be` for autocomplete
- **Usage Validation**: Prevent deletion of colors in use

#### API Updates

- **Color Schema**: Complete color object with multilingual names
- **Product Schema**: `display_color` now returns color object instead of string
- **Search Endpoint**: Color autocomplete with create suggestions
- **Management Endpoints**: Full color CRUD operations

### Previous Updates

#### Business Logic Changes

- **Single Color Display**: Each product now shows only one representative color (`display_color`)
- **Simplified Stock**: `stock_quantity` represents inventory for this specific color variant
- **Direct Image Array**: Images stored as simple array for the display color
- **Color Consultation Flow**: Customers request other colors through Messenger consultation

#### Frontend Changes

- **Product Cards**: Show product with single representative color and images
- **Consultation CTA**: "Có màu khác? Tư vấn qua Messenger để xem thêm lựa chọn!" button
- **Color Filter**: Filter by display colors available across products
- **Messenger Integration**: Enhanced consultation workflow for color requests

#### Backend Changes

- **Database Schema**: `display_color` field replaces `available_colors` array
- **Images Structure**: `images` as JSON array instead of color-mapped object
- **New Endpoint**: `/products/{id}/color-consultation` for color inquiry requests
- **Simplified Stock**: Direct inventory tracking per color variant

#### API Updates

- **ProductPublic Schema**:
  - Remove `available_colors` array
  - Add `display_color` string field
  - Change `images` from object to array
  - Add `consultation_note` field
- **New Consultation Endpoint**: Handles customer color requests and generates Messenger URLs

### Previous Updates

## Product Color Variants and User Management Updates (Superseded)

#### Business Logic Changes

- **Multiple Colors per Product**: Each product now supports multiple color options stored in `available_colors` JSON array
- **Unified Stock Management**: Single `stock_quantity` field represents total inventory across all color variants
- **Color-Mapped Images**: Images stored as JSON object with color keys: `{"white": ["url1", "url2"], "black": ["url3"]}`
- **Customer Color Selection**: When ordering, customers choose from available colors; choice stored in `selected_color` field

#### Frontend Impact

- **Product Display**: Show all available colors with corresponding images
- **Color Selection UI**: Interactive color picker on product detail pages
- **Cart Enhancement**: Display selected color alongside product information
- **Filter Updates**: Color filter now supports multiple selections from available colors

#### Backend Changes

- **Database Schema**: `available_colors` JSONB array replaces single `color` field
- **Stock Logic**: No per-color stock tracking; deduct from total `stock_quantity` regardless of color
- **Order Processing**: Validate `selected_color` exists in product's `available_colors` at order time
- **Analytics**: Track color preferences through `selected_color` in order items

### Admin-Managed User System

#### User Registration Elimination

- **No Self-Registration**: Remove all customer registration endpoints and UI
- **Admin Creation Only**: All customers created exclusively through admin panel
- **No Verification Needed**: Remove email/phone verification fields and processes
- **Simplified Onboarding**: Admin inputs customer details directly during order creation or customer management

#### Customer Management Workflow

1. **Admin Creates Customer**: Admin panel form with phone (required), email, name, addresses, social accounts
2. **Order Association**: Orders link to admin-created customers via customer selection dropdown
3. **Customer Tracking**: `created_by_admin_id` field tracks which admin created each customer
4. **No Authentication**: Customers don't log in; all interaction through Messenger or admin-facilitated

#### Security and Access Control

- **Admin-Only Access**: Customer management restricted to authenticated admin users
- **Audit Trail**: Track customer creation and modifications through admin user references
- **Data Integrity**: Foreign key constraints ensure customer-admin relationships maintained
- **Role-Based Permissions**: Different admin roles may have varying customer management permissions

## Port Configuration Changes

### Development Environment

- **Backend API**: `http://localhost:8080` (changed from 3000)
- **Frontend App**: `http://localhost:3000` (changed from 5173)
- **Database**: PostgreSQL on default port 5432
- **Cache**: Redis on default port 6379

### Production Environment

- **Backend API**: `https://api.starbucks-cups.com`
- **Frontend App**: `https://starbucks-cups.com`

## Standardized API Response Structure

All API endpoints must return responses in the following format:

```json
{
  "success": boolean,    // true for successful operations, false for errors
  "data": object|array,  // Main response data (null when success is false)
  "meta": {             // Metadata object
    "timestamp": "ISO_8601_datetime",
    "pagination": {      // For paginated responses
      "current_page": number,
      "per_page": number,
      "total_pages": number,
      "total_items": number,
      "has_next": boolean,
      "has_prev": boolean
    },
    "total_records": number,  // For list endpoints
    "filters_applied": object, // For filtered responses
    "request_id": string      // For debugging purposes
  },
  "error": {            // Error object (null when success is true)
    "code": string,     // Error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
    "message": string,  // Human-readable error message
    "details": array    // Additional error details
  }
}
```

### Success Response Examples

#### Single Item Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Starbucks Tumbler Classic",
    "category": "Tumblers",
    "capacity": 473,
    "stock_quantity": 10
  },
  "meta": {
    "timestamp": "2025-09-11T10:30:00Z",
    "request_id": "req_abc123"
  },
  "error": null
}
```

#### List Response with Pagination

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "name": "Product 1"
    },
    {
      "id": "uuid2",
      "name": "Product 2"
    }
  ],
  "meta": {
    "timestamp": "2025-09-11T10:30:00Z",
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total_pages": 5,
      "total_items": 89,
      "has_next": true,
      "has_prev": false
    },
    "total_records": 89,
    "filters_applied": {
      "category": "Tumblers",
      "color": "White"
    },
    "request_id": "req_def456"
  },
  "error": null
}
```

### Error Response Examples

#### Validation Error

```json
{
  "success": false,
  "data": null,
  "meta": {
    "timestamp": "2025-09-11T10:30:00Z",
    "request_id": "req_ghi789"
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": ["Phone number is required", "Email format is invalid"]
  }
}
```

#### Not Found Error

```json
{
  "success": false,
  "data": null,
  "meta": {
    "timestamp": "2025-09-11T10:30:00Z",
    "request_id": "req_jkl012"
  },
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found",
    "details": []
  }
}
```

## Product Pricing Strategy Changes

### Database Schema Impact

- **Products Table**: No price-related columns (removed `unit_price`, `sale_price`, etc.)
- **OrderItems Table**: Retains `unit_price` field for admin-input pricing during order creation

### Business Logic Changes

#### Customer-Facing Frontend

- Products display without any pricing information
- Cart shows quantities and product details only
- No price calculations or total amounts visible
- Messenger consultation requests don't mention pricing

#### Admin Panel Workflow

1. **Product Management**: Admin creates/edits products without setting prices
2. **Order Creation**: Admin manually inputs price for each product during order creation
3. **Price History**: OrderItems table maintains historical pricing for reporting
4. **Analytics**: Revenue calculations based on actual order prices, not product catalog

### Frontend State Management Updates

#### Redux Store Structure

```typescript
// Product slice (multiple color variants, no pricing)
interface Product {
  id: string;
  name: string;
  description: string;
  capacity: number;
  available_colors: string[]; // Array of available colors
  category: string;
  stock_quantity: number; // Total stock across all colors
  images: Record<string, string[]>; // Color-mapped images
  in_stock: boolean;
}

// Cart slice (with color selection, no pricing)
interface CartItem {
  product_id: string;
  product: Product;
  selected_color: string; // Customer's color choice
  quantity: number;
  // No price fields
}

// Order slice (pricing only in admin, with color tracking)
interface OrderItem {
  product_id: string;
  product: Product;
  selected_color: string; // Customer's chosen color
  quantity: number;
  unit_price: number; // Admin input during order creation
  total_price: number; // Calculated
}

// Customer slice (admin-created only)
interface Customer {
  id: string;
  phone: string;
  email?: string;
  full_name?: string;
  created_by_admin_id: string; // Reference to creating admin
  is_active: boolean;
  // No verification fields
}
```

### API Endpoint Changes

#### Customer API - No Changes to Structure

- `GET /api/v1/products` - Products without pricing
- `GET /api/v1/products/{id}` - Product details without pricing
- `POST /api/v1/cart/messenger-redirect` - Cart consultation without pricing

#### Admin API - Pricing in Order Creation Only

- `POST /api/v1/admin/orders` - Accepts `unit_price` for each order item
- `PUT /api/v1/admin/orders/{id}` - Can update pricing on pending orders
- `GET /api/v1/admin/analytics` - Shows revenue based on actual order prices

### Development Impact

#### Backend Changes Required

1. Remove price columns from Products model/migration
2. Update product validation rules (no price validation)
3. Enhance order creation validation (require price input)
4. Update API response serializers for new structure

#### Frontend Changes Required

1. Remove all pricing display components
2. Update cart UI to exclude price calculations
3. Modify admin order forms to include price inputs
4. Update state management to exclude product pricing

#### Database Migration

```sql
-- Update products table for color variants
ALTER TABLE products
DROP COLUMN IF EXISTS color,
ADD COLUMN available_colors JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN images TYPE JSONB USING images::JSONB;

-- Add admin reference to customers
ALTER TABLE customers
ADD COLUMN created_by_admin_id UUID REFERENCES admin_users(id);

-- Remove verification from customer social accounts
ALTER TABLE customer_social_accounts
DROP COLUMN IF EXISTS is_verified;

-- Add color selection to order items
ALTER TABLE order_items
ADD COLUMN selected_color VARCHAR(50) NOT NULL DEFAULT 'default';

-- Create indexes for new JSON columns
CREATE INDEX idx_products_available_colors ON products USING GIN (available_colors);
CREATE INDEX idx_products_images ON products USING GIN (images);
CREATE INDEX idx_customers_created_by_admin ON customers (created_by_admin_id);
CREATE INDEX idx_order_items_selected_color ON order_items (selected_color);
```

## Implementation Priority

### High Priority (Phase 1)

1. Update all API responses to new standardized format
2. Change development server ports (backend 8080, frontend 3000)
3. Remove product pricing from database schema and models
4. Update admin order creation to require price input

### Medium Priority (Phase 2)

1. Frontend state management updates for new response structure
2. Remove pricing display components from customer interface
3. Enhanced error handling for new response format
4. Admin UI updates for price input during order creation

### Low Priority (Phase 3)

1. Analytics updates to reflect variable pricing model
2. Historical price tracking and reporting
3. Price suggestion features for admin based on order history
4. Advanced error response formatting

## Update 8: Dynamic Category Management (2024-01-XX)

### Change: Added Category Entity with Hierarchical Support

- **Reason**: User showed complex Facebook product catalog requiring sophisticated category management beyond simple strings
- **Impact**: Products now reference Category entity instead of string category

### Data Model Changes:

- Added `Category` entity with hierarchical structure (parent-child relationships)
- `Product.category` changed from string to `category_id` (UUID reference)
- Category fields: id, name, description, slug, parent_category_id, sort_order, is_active, usage_count, hierarchy_level
- Support for 3-level hierarchy depth maximum
- Auto-generated SEO-friendly slugs for categories

### API Changes:

- Added `/admin/categories` endpoints with full CRUD operations
- Added `/admin/categories/search` for autocomplete in product creation
- Updated Product schemas to use `category_id` instead of string `category`
- Added Category object in Product responses with id, name, slug
- Updated all product filters to use `category_id` parameter

### Frontend Implications:

- Admin category management with tree view
- Product creation form with category autocomplete
- Category search and creation suggestions
- Hierarchical category display in frontend

### Migration Notes:

- Existing products with string categories need migration to Category entities
- Create default categories from existing product data
- Update all product references to use category_id
- Implement category hierarchy tree in admin interface

## Update 9: Product Deletion Management (2024-09-11)

### Change: Implemented Product Lifecycle Management System

- **Reason**: Deleting products breaks foreign key references in OrderItems, causing system errors
- **Solution**: Multi-layer approach with soft delete + product snapshots

### Data Model Changes:

- Added soft delete fields to Product entity: `is_deleted`, `deleted_at`, `deleted_by_admin_id`
- Enhanced OrderItem `product_snapshot` to include complete product data with related entities
- Differentiated between `is_active` (catalog visibility) and `is_deleted` (data retention)

### Business Logic Changes:

- **Soft Delete Required**: Products with order references cannot be hard deleted
- **Product Snapshots**: OrderItems store complete product state for historical accuracy
- **Reactivation Support**: Soft-deleted products can be restored if needed
- **Admin Confirmation**: Deletion attempts require explicit confirmation with affected order count

### API Changes:

- Updated `DELETE /admin/products/{id}` with soft delete logic and force parameter
- Added `POST /admin/products/{id}/reactivate` endpoint for restoring soft-deleted products
- Enhanced deletion responses with affected order information and suggested actions
- Added `include_deleted` parameter for admin product listings

### Frontend Implications:

- Admin product listing shows deletion status and reactivation options
- Confirmation dialogs display affected order count before deletion
- Soft-deleted products marked with special UI indicators
- Order history remains intact with archived product information

### Data Integrity Strategy:

```
Product Deletion Flow:
1. Check for existing orders → Require soft delete if found
2. Store complete product snapshot in OrderItems
3. Mark product as deleted but preserve in database
4. Allow reactivation with admin confirmation
5. Hard delete only for products never used in orders
```

## Update 10: OrderItem Single Color Alignment (2024-09-11)

### Change: Updated OrderItem to align with single color per product model

- **Reason**: OrderItem still had `selected_color` field from old multi-color design
- **Impact**: Simplified order processing to match current product structure

### Data Model Changes:

- `OrderItem.selected_color` → `OrderItem.requested_color` (nullable)
- `requested_color` only used when customer wants different color than product's display color
- Most orders will have `requested_color = null` (using product's display color)
- Updated product snapshot structure to remove `available_colors` array

### Business Logic Changes:

- **Standard Orders**: Customer orders product as displayed → `requested_color = null`
- **Color Variants**: Customer consults via Messenger for different color → `requested_color = "Đen"`
- **Product Snapshot**: Always captures original product's display color information
- **Consultation Flow**: Color requests handled before order creation, not during

### API Changes:

- Updated OrderItem schemas in admin API to use `requested_color` (nullable)
- Updated cart consultation endpoint to use `requested_color` instead of `selected_color`
- Removed `requested_color` from required fields in OrderItemCreate
- Enhanced product snapshot with single color structure

### Order Flow Examples:

```
Scenario 1 - Standard Order:
Customer sees "Ly Classic Trắng 450ml" → Orders directly
OrderItem: { product_id: "...", requested_color: null, ... }

Scenario 2 - Color Variant Request:
Customer sees "Ly Classic Trắng 450ml" → Wants black → Messenger consultation
Admin creates order: { product_id: "...", requested_color: "Đen", ... }
```

---

**Update Status**: ✅ Complete - All technical changes documented and requirements updated
