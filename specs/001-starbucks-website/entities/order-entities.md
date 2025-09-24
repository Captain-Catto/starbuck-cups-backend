# Order Processing Entities

**Module**: Order Management  
**Updated**: September 11, 2025

## Entities trong module này

- **Order** - Đơn hàng chính (custom + product orders)
- **OrderItem** - Chi tiết sản phẩm trong đơn hàng

---

## Order

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

**Business Rules**:

- Support both custom designs and catalog products
- Auto-generate human-readable order numbers
- Track status transitions with timestamps
- Free shipping threshold can be configured
- Admin can add notes for internal tracking

**Status Flow**:

```
pending → confirmed → processing → shipped → delivered
   ↓         ↓           ↓          ↓
cancelled cancelled  cancelled  cancelled
```

**Status Rules**:

- Only pending orders can be modified
- Cancelled orders cannot be reactivated
- Status changes must follow sequential order (no skipping)
- Stock is reserved on confirmation, deducted on processing

---

## OrderItem

**Purpose**: Individual line items for product-based orders with color selection

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `order_id`: UUID, Foreign Key, References Order.id
- `product_id`: UUID, Foreign Key, References Product.id
- `requested_color`: String(50), Optional, Customer's requested color if different from product's display color
- `quantity`: Integer, Required, Number of items ordered
- `unit_price`: Decimal(10,2), Required, Price per unit in VND (admin-set)
- `total_price`: Decimal(10,2), Computed, `quantity * unit_price`
- `product_snapshot`: JSON, Required, Product details at time of order including color information
- `created_at`: Timestamp, Auto-generated

**Note**: Since each Product now represents one specific color, `requested_color` is only used when customer wants a different color variant (handled through Messenger consultation).

**Validation Rules**:

- `quantity` must be positive integer
- `unit_price` must be positive
- `total_price` automatically calculated
- `requested_color` is optional - used only when customer wants different color than product's display color
- Cannot exceed product's total stock at order creation
- `product_snapshot` preserves product state for historical accuracy

**Relationships**:

- Many-to-One with Order (belongs to single order)
- Many-to-One with Product (references current product)

**Business Rules**:

- Capture product details at order time (snapshot for history)
- Admin sets pricing per order (no fixed product prices)
- Most orders use product's display color (requested_color = null)
- Color variants handled through Messenger consultation before order creation
- Cannot modify once order is confirmed
- Used for inventory tracking and reporting
- **Product Reference Integrity**: Foreign key maintained for active products
- **Deletion Safety**: Product snapshots ensure order validity if products are deleted
- **Historical Accuracy**: Snapshots preserve exact product state at purchase time

**Product Snapshot Structure**:

```json
{
  "product_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Ly Starbucks Classic",
  "slug": "ly-starbucks-classic-trang-450ml",
  "display_color": {
    "id": "color-uuid",
    "name": "Trắng",
    "hex_code": "#FFFFFF"
  },
  "capacity": {
    "id": "capacity-uuid",
    "name": "Grande (16 oz)",
    "value_ml": 450
  },
  "category": {
    "id": "category-uuid",
    "name": "Tumblers",
    "slug": "tumblers"
  },
  "images": ["url1.jpg", "url2.jpg"],
  "description": "Classic Starbucks tumbler...",
  "stock_quantity": 25,
  "created_at": "2025-09-11T10:00:00Z"
}
```

**Order Flow with Single Color Products**:

1. Customer browses product with display color (e.g., "Ly Classic Trắng")
2. If customer wants same color → Direct order with `requested_color = null`
3. If customer wants different color → Messenger consultation first
4. Admin creates order after consultation with `requested_color = "Đen"` if different
5. Product snapshot always captures the original product's display color

**Data Integrity Strategy**:

- **Complete Product Snapshot**: OrderItem stores full product details at order time
- **Foreign Key + Snapshot**: Maintains both reference and historical data
- **Product Deletion Handling**: Orders remain valid even if referenced product is deleted
- **Audit Trail**: Snapshot preserves exact product state for compliance and reporting
