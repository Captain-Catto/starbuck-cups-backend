# Data Model Overview

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Status**: Complete

## 📁 Entity Documentation

Data model được tách thành các module chuyên biệt để dễ quản lý và bảo trì:

### Core Entity Modules

- **[🙋‍♀️ User Entities](./entities/user-entities.md)** - User management & authentication

  - AdminUser, Customer, CustomerAddress, CustomerSocialAccount

- **[📦 Product Entities](./entities/product-entities.md)** - Product catalog management

  - Product, Color, Capacity, Category (all with dynamic management)

- **[🛍️ Order Entities](./entities/order-entities.md)** - Order processing & fulfillment

  - Order, OrderItem

- **[💬 Consultation Entities](./entities/consultation-entities.md)** - Messenger integration
  - MessengerConsultation

## 🔗 Cross-Module Relationships

### Entity Relationship Diagram

```
┌─────────────┐    creates    ┌──────────────┐    has     ┌─────────────────┐
│ AdminUser   │───────────────│ Customer     │────────────│ CustomerAddress │
└─────────────┘               └──────────────┘            └─────────────────┘
       │                             │
       │ creates                     │ places
       ▼                             ▼
┌─────────────┐                ┌──────────────┐    contains   ┌─────────────┐
│ Color       │                │ Order        │───────────────│ OrderItem   │
│ Capacity    │                └──────────────┘               └─────────────┘
│ Category    │                                                       │
└─────────────┘                                                       │ references
       │                                                               ▼
       │ referenced by                                         ┌─────────────┐
       └───────────────────────────────────────────────────────│ Product     │
                                                               └─────────────┘
```

### Key Business Flows

#### 1. Product Management Flow

```
Admin creates → Color/Capacity/Category → Product → Customer orders → OrderItem
```

#### 2. Customer Journey

```
Admin creates Customer → Customer browses Products → Messenger consultation → Order placement
```

#### 3. Order Processing

```
Customer inquiry → Consultation → Product selection → Order creation → Fulfillment
```

## 🎯 Design Principles

### 1. **Dynamic Entity Management**

- Color, Capacity, Category được tạo dynamically bởi admin
- Không có fixed values, cho phép mở rộng linh hoạt
- Usage tracking để biết entities nào đang được sử dụng

### 2. **Single Color per Product**

- Mỗi Product = 1 color variant để đơn giản hóa catalog
- Consultation qua Messenger cho other color options
- Giảm complexity trong inventory management

### 3. **Hierarchical Categories**

- Support 3-level category hierarchy cho complex classification
- SEO-friendly slugs cho category pages
- Facebook marketplace-style categorization

### 4. **Admin-Managed Customers**

- Không có customer self-registration
- Admin tạo và quản lý tất cả customer accounts
- Simplifies authentication và security

### 5. **Vietnamese-First Design**

- Vietnamese color names và descriptions
- Vietnamese phone number formats
- Local administrative divisions (ward/district/city)

## 📊 Database Constraints

### Primary Keys

- All entities use UUID primary keys for better distributed system support
- UUIDs prevent ID enumeration attacks in public APIs

### Foreign Key Constraints

- All foreign keys include CASCADE DELETE where appropriate
- CustomerAddress cascades with Customer
- Customer does NOT cascade with AdminUser (preserve history)
- OrderItem cascades with Order
- Order does NOT cascade with Customer (preserve order history)

### Unique Constraints

- Product: (`name`, `category_id`, `color_id`, `capacity_id`) - prevent duplicates
- Customer: `phone` - primary contact uniqueness
- Customer: `email` - email uniqueness (nullable)
- Order: `order_number` - human-readable reference uniqueness
- AdminUser: `username`, `email` - login identifier uniqueness
- Color: `name`, `hex_code` - prevent duplicate colors
- Capacity: `name`, `value_ml` - prevent duplicate capacities
- Category: `name` within same parent level, `slug` globally

## 🔄 State Transitions

### Order Status Flow

```
pending → confirmed → processing → shipped → delivered
   ↓         ↓           ↓          ↓
cancelled cancelled  cancelled  cancelled
```

### Product Lifecycle Management

```
active → inactive → soft_deleted → [hard_delete only if no orders]
  ↑         ↑            ↑
  └─────────┴────────────┘ (can reactivate)
```

**Product Deletion Policy**:

- **Inactive**: `is_active = false` - Hidden from catalog, keeps in database
- **Soft Delete**: `is_deleted = true` - Marked as deleted, preserves order references
- **Hard Delete**: Only allowed for products never referenced in orders

### Product Availability

```
active (stock > 0) → active (stock = 0) → inactive → soft_deleted
     ↑                      ↓                ↓           ↓
     ←── restocked ←────────┘              ←─────────────┘
```

### Consultation Flow

```
pending → in_progress → completed
   ↓           ↓           ↓
 closed     closed     closed
```

## 🛡️ Data Integrity Strategy

### Product Deletion Management

**Problem**: Deleting products breaks foreign key references in OrderItems, causing system errors and loss of order history.

**Solution**: Multi-layer product lifecycle management

#### 1. Soft Delete System

```sql
-- Product lifecycle fields
is_active: BOOLEAN DEFAULT true    -- Controls catalog visibility
is_deleted: BOOLEAN DEFAULT false  -- Soft deletion flag
deleted_at: TIMESTAMP              -- Deletion timestamp
deleted_by_admin_id: UUID          -- Who deleted it
```

#### 2. Product Snapshots in OrderItems

- Complete product data stored in `product_snapshot` JSON field
- Includes all related entity data (Color, Capacity, Category)
- Orders remain valid even if source product is deleted
- Historical accuracy for reporting and compliance

#### 3. Deletion Business Rules

- **Soft Delete Required**: Products referenced in orders cannot be hard deleted
- **Admin Confirmation**: Deletion requires explicit admin confirmation
- **Reactivation**: Soft deleted products can be reactivated if needed
- **Hard Delete**: Only allowed for products never used in orders

#### 4. API Behavior

```javascript
// Product listing - excludes deleted products
GET /products?include_deleted=false  // Default

// Admin management - shows all states
GET /admin/products?include_deleted=true

// Deletion attempt
DELETE /admin/products/{id}
// → Returns 400 if product has orders
// → Suggests soft delete instead
```

## 🚀 Migration Strategy

### Phase 1: Core Entities

1. AdminUser, Customer, CustomerAddress
2. Basic auth và customer management

### Phase 2: Dynamic Product System

1. Color, Capacity, Category entities
2. Product with entity references
3. Migration từ string categories

### Phase 3: Order Processing

1. Order, OrderItem entities
2. Status tracking và fulfillment

### Phase 4: Messenger Integration

1. MessengerConsultation entity
2. Facebook Platform integration

---

**Data Model Status**: ✅ Complete - All entities, relationships, and constraints defined  
**Last Updated**: September 11, 2025
