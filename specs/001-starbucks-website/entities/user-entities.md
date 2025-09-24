# User Management Entities

**Module**: User & Authentication  
**Updated**: September 11, 2025

## Entities trong module này

- **AdminUser** - Admin users quản lý hệ thống
- **Customer** - Khách hàng (được admin tạo)
- **CustomerAddress** - Địa chỉ giao hàng khách hàng

---

## AdminUser

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

- One-to-Many with Customer (admin creates customers)
- One-to-Many with Color (admin creates colors)
- One-to-Many with Capacity (admin creates capacities)
- One-to-Many with Category (admin creates categories)
- One-to-Many with AuditLog (admin action tracking)

**Business Rules**:

- Super admins có full access
- Regular admins không thể tạo admin khác
- Staff chỉ có read access cho reports

---

## Customer

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

**Business Rules**:

- Admin-managed accounts only, no customer self-registration
- Phone number is primary identifier
- Can be deactivated but not deleted (preserve order history)

---

## CustomerAddress

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

**Business Rules**:

- Default address used for new orders
- Cannot delete address if used in pending/confirmed orders
- Admin can add addresses on behalf of customers

---

## CustomerSocialAccount

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

**Business Rules**:

- Used for Messenger integration and contact management
- Admin verifies and adds social accounts
- Supports multiple platforms per customer
