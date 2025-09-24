# Data Model Entities

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Status**: Complete

## Tổng quan

Data model được tách thành các file chuyên biệt để dễ quản lý:

## 📁 Entity Files

- **[user-entities.md](./user-entities.md)** - User management entities

  - AdminUser
  - Customer
  - CustomerAddress

- **[product-entities.md](./product-entities.md)** - Product catalog entities

  - Product
  - Color (dynamic management)
  - Capacity (dynamic management)
  - Category (hierarchical management)

- **[order-entities.md](./order-entities.md)** - Order processing entities

  - Order
  - OrderItem

- **[consultation-entities.md](./consultation-entities.md)** - Messenger integration
  - MessengerConsultation

## 🔗 Key Relationships

### Product Management Flow

```
Category (hierarchical) ←─ Product ─→ Color (dynamic)
                              ↓
                           Capacity (dynamic)
                              ↓
                           OrderItem ─→ Order
```

### User & Order Flow

```
AdminUser ─→ manages all entities
    ↓
Customer ─→ CustomerAddress
    ↓           ↓
Order ←─────────┘
    ↓
OrderItem ─→ Product
```

### Consultation Flow

```
Customer ─→ MessengerConsultation ─→ Product variants
```

## 🎯 Design Principles

1. **Dynamic Management**: Color, Capacity, Category tạo mới khi cần
2. **Single Color per Product**: Mỗi Product = 1 color, consultation cho variants
3. **Hierarchical Categories**: Support phân loại phức tạp 3 levels
4. **SEO Optimization**: Slugs cho Product và Category
5. **Vietnamese-first**: Interface và data structure cho thị trường VN

## 📋 Migration Notes

- Products migrate từ string category → category_id reference
- Colors/Capacities migrate từ embedded → separate entities
- Categories được tạo từ existing product data
- Slugs auto-generate cho backward compatibility
