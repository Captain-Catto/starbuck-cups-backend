# Messenger Integration Entities

**Module**: Customer Consultation  
**Updated**: September 11, 2025

## Entities trong module này

- **MessengerConsultation** - Lưu trữ thông tin tư vấn qua Messenger

---

## MessengerConsultation

**Purpose**: Tracks customer consultation requests via Facebook Messenger Platform

**Attributes**:

- `id`: UUID, Primary Key, Auto-generated
- `customer_id`: UUID, Optional, Foreign Key to Customer.id if identified
- `messenger_user_id`: String(255), Required, Facebook user identifier from Messenger Platform
- `conversation_type`: Enum, Required, Type of consultation ('product_inquiry', 'cart_consultation', 'custom_order')
- `product_ids`: JSON Array, Optional, Array of product UUIDs customer is interested in
- `customer_message`: Text, Required, Initial customer inquiry message
- `admin_response`: Text, Optional, Admin response to customer
- `consultation_status`: Enum, Required, Status ('pending', 'in_progress', 'completed', 'closed')
- `priority`: Enum, Default: 'normal', Priority level ('low', 'normal', 'high', 'urgent')
- `assigned_admin_id`: UUID, Optional, Foreign Key to AdminUser.id handling this consultation
- `created_at`: Timestamp, Auto-generated, Consultation request time
- `updated_at`: Timestamp, Auto-updated, Last interaction time
- `responded_at`: Timestamp, Optional, First admin response time
- `completed_at`: Timestamp, Optional, Consultation completion time
- `messenger_thread_id`: String(255), Optional, Messenger conversation thread reference
- `customer_preferences`: JSON, Optional, Collected customer preferences (colors, sizes, budget, etc.)

**Validation Rules**:

- `messenger_user_id` must be valid Facebook user identifier
- `conversation_type` must be from allowed enum values
- `product_ids` must reference valid products if provided
- `assigned_admin_id` must reference active admin user
- Cannot close consultation without admin response

**Relationships**:

- Many-to-One with Customer (optional - if customer identified)
- Many-to-One with AdminUser (assigned consultant)
- Referenced by Order (if consultation leads to order)

**Business Rules**:

- Auto-created when customer initiates Messenger conversation
- Supports anonymous consultations (before customer identification)
- Priority escalation based on inquiry type and customer history
- Admin assignment based on availability and expertise
- Tracks response times for service quality metrics

**Conversation Types**:

- `product_inquiry`: Questions about specific products, colors, availability
- `cart_consultation`: Help with product selection and cart optimization
- `custom_order`: Requests for custom designs or special requirements

**Status Flow**:

```
pending → in_progress → completed
   ↓           ↓           ↓
 closed     closed     closed
```

**Customer Preferences Structure**:

```json
{
  "preferred_colors": ["Đỏ", "Xanh lá"],
  "budget_range": {
    "min": 200000,
    "max": 500000
  },
  "capacity_preference": "450ml",
  "use_case": "office",
  "delivery_urgency": "standard"
}
```

**Integration Notes**:

- Connected to Facebook Messenger Platform API
- Webhook handles incoming messages and creates consultations
- Admin dashboard shows pending consultations
- Support for rich media (images, product catalogs)
- Automated responses for common questions
- Escalation to human agents for complex inquiries
