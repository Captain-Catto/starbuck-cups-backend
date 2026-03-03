# Migration Guide: Thêm Feature VIP Badge cho Products

## 📅 Ngày thực hiện
**Date:** 2025-10-10

## 🎯 Mục đích
Thêm cột `is_vip` vào bảng `products` để đánh dấu sản phẩm VIP và hiển thị badge đặc biệt trên frontend.

---

## 🗄️ Database Migration

### SQL Script để chạy trên phpMyAdmin

```sql
-- Thêm cột is_vip vào bảng products
ALTER TABLE products
ADD COLUMN is_vip BOOLEAN NOT NULL DEFAULT FALSE
AFTER is_deleted;

-- (Optional) Kiểm tra cột đã được thêm
DESCRIBE products;

-- (Optional) Đánh dấu một số sản phẩm mẫu là VIP để test
UPDATE products
SET is_vip = TRUE
WHERE id IN (
  'product-id-1',
  'product-id-2'
);
```

### Cấu trúc cột mới

| Column Name | Type | Null | Default | Description |
|------------|------|------|---------|-------------|
| `is_vip` | BOOLEAN | NO | FALSE | Đánh dấu sản phẩm có phải VIP không |

---

## 💻 Backend Changes

### 1. Model Update: `src/models/Product.ts`

**Interface ProductAttributes:**
```typescript
export interface ProductAttributes {
  id: string;
  slug: string;
  name: string;
  description?: string;
  capacityId: string;
  stockQuantity: number;
  productUrl?: string;
  isActive: boolean;
  isDeleted: boolean;
  isVip: boolean;  // ✅ NEW FIELD
  deletedAt?: Date;
  deletedByAdminId?: string;
  createdAt: Date;
  updatedAt: Date;
  unitPrice: number;
  createdByAdminId: string;
}
```

**Class Product:**
```typescript
export class Product extends Model<ProductAttributes, ProductCreationAttributes> {
  declare isVip: boolean;  // ✅ NEW FIELD
  // ... other fields
}
```

**Sequelize Schema:**
```typescript
isVip: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
  field: "is_vip",
},
```

### 2. Controller Update: `src/controllers/products.controller.ts`

**Validation Schema:**
```typescript
const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  capacityId: z.string().uuid("Invalid capacity ID"),
  stockQuantity: z.coerce.number().int().nonnegative(),
  unitPrice: z.coerce.number().nonnegative().optional().default(0),
  productUrl: z.string().url().optional().or(z.literal("")),
  isVip: z.boolean().optional().default(false),  // ✅ NEW FIELD
  categoryIds: z.array(z.string().uuid()).min(1),
  colorIds: z.array(z.string().uuid()).min(1),
  productImages: z.array(z.object({
    url: z.string().url(),
    order: z.number().int().nonnegative(),
  })).optional().default([]),
});
```

**Product Creation:**
```typescript
const product = await Product.create({
  name: name.trim(),
  slug: finalSlug,
  description: description?.trim(),
  capacityId,
  stockQuantity,
  unitPrice,
  productUrl,
  isVip: isVip || false,  // ✅ NEW FIELD
  isActive: true,
  isDeleted: false,
  createdByAdminId: req.user!.userId,
}, { transaction: t });
```

**API Response Attributes:**
```typescript
attributes: [
  "id",
  "name",
  "slug",
  "description",
  "stockQuantity",
  "unitPrice",
  "productUrl",
  "isVip",  // ✅ NEW FIELD - được trả về trong tất cả APIs
  "createdAt",
]
```

---

## 📡 API Documentation

### Admin APIs

#### 1. Create Product (Admin)
**Endpoint:** `POST /api/admin/products`

**Request Body:**
```json
{
  "name": "Starbucks VIP Limited Cup",
  "slug": "starbucks-vip-limited-cup",
  "description": "Limited edition VIP cup for loyal customers",
  "capacityId": "uuid-of-capacity",
  "stockQuantity": 50,
  "unitPrice": 750000,
  "productUrl": "https://example.com/product",
  "isVip": true,  // ✅ NEW FIELD - Optional, default: false
  "categoryIds": [
    "category-uuid-1",
    "category-uuid-2"
  ],
  "colorIds": [
    "color-uuid-1"
  ],
  "productImages": [
    {
      "url": "https://drive.google.com/...",
      "order": 0
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "name": "Starbucks VIP Limited Cup",
    "slug": "starbucks-vip-limited-cup",
    "description": "Limited edition VIP cup for loyal customers",
    "stockQuantity": 50,
    "unitPrice": "750000.00",
    "productUrl": "https://example.com/product",
    "isVip": true,  // ✅ NEW FIELD
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2025-10-10T10:00:00.000Z",
    "updatedAt": "2025-10-10T10:00:00.000Z",
    "capacity": {
      "id": "capacity-uuid",
      "name": "16oz",
      "slug": "16oz",
      "volumeMl": 473
    },
    "productCategories": [...],
    "productColors": [...],
    "productImages": [...]
  }
}
```

#### 2. Update Product (Admin)
**Endpoint:** `PUT /api/admin/products/:id`

**Request Body (partial update):**
```json
{
  "isVip": true  // ✅ Có thể update field này riêng lẻ
}
```

#### 3. Get All Products (Admin)
**Endpoint:** `GET /api/admin/products?page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid",
      "name": "Starbucks Cup",
      "slug": "starbucks-cup",
      "isVip": true,  // ✅ NEW FIELD
      "stockQuantity": 50,
      "isActive": true,
      "createdAt": "2025-10-10T10:00:00.000Z",
      ...
    }
  ],
  "pagination": {...}
}
```

---

### Public APIs (cho Frontend)

#### 1. Get Public Products
**Endpoint:** `GET /api/products?page=1&limit=20`

**Query Parameters:**
- `page` - Số trang (default: 1)
- `limit` - Số sản phẩm mỗi trang (default: 20)
- `search` - Tìm kiếm theo tên
- `category` hoặc `categorySlug` - Filter theo category
- `color` hoặc `colorSlug` - Filter theo màu
- `capacity` hoặc `capacitySlug` - Filter theo dung tích
- `minCapacity`, `maxCapacity` - Filter theo khoảng dung tích (ml)
- `sortBy` - Sắp xếp theo field (default: "createdAt")
- `sortOrder` - Thứ tự (asc/desc, default: "desc")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid-1",
      "name": "Starbucks VIP Limited Cup",
      "slug": "starbucks-vip-limited-cup",
      "description": "Limited edition VIP cup",
      "stockQuantity": 50,
      "unitPrice": "750000.00",
      "productUrl": "https://example.com/product",
      "isVip": true,  // ✅ NEW FIELD - Dùng để hiển thị badge
      "createdAt": "2025-10-10T10:00:00.000Z",
      "capacity": {
        "id": "capacity-uuid",
        "name": "16oz",
        "slug": "16oz",
        "volumeMl": 473
      },
      "productCategories": [
        {
          "productId": "product-uuid-1",
          "categoryId": "category-uuid",
          "category": {
            "id": "category-uuid",
            "name": "Limited Edition",
            "slug": "limited-edition"
          }
        }
      ],
      "productColors": [
        {
          "productId": "product-uuid-1",
          "colorId": "color-uuid",
          "color": {
            "id": "color-uuid",
            "name": "Gold",
            "slug": "gold",
            "hexCode": "#FFD700"
          }
        }
      ],
      "productImages": [
        {
          "id": "image-uuid",
          "url": "https://drive.google.com/...",
          "altText": "Starbucks VIP Limited Cup",
          "order": 0
        }
      ]
    },
    {
      "id": "product-uuid-2",
      "name": "Starbucks Regular Cup",
      "isVip": false,  // ✅ Sản phẩm thường
      ...
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_items": 100,
    "has_next": true,
    "has_prev": false
  }
}
```

#### 2. Get Single Product
**Endpoint:** `GET /api/products/:idOrSlug`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "name": "Starbucks VIP Limited Cup",
    "slug": "starbucks-vip-limited-cup",
    "description": "Limited edition VIP cup for loyal customers",
    "stockQuantity": 50,
    "unitPrice": "750000.00",
    "productUrl": "https://example.com/product",
    "isVip": true,  // ✅ NEW FIELD
    "createdAt": "2025-10-10T10:00:00.000Z",
    "capacity": {...},
    "productCategories": [...],
    "productColors": [...],
    "productImages": [...]
  }
}
```

#### 3. Search Products
**Endpoint:** `GET /api/products/search?q=vip&page=1&limit=20`

**Response:** (Giống như Get Public Products)

---

## 🎨 Frontend Integration Guide

### TypeScript Interface

```typescript
// types/product.ts
export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  stockQuantity: number;
  unitPrice: string;
  productUrl?: string;
  isVip: boolean;  // ✅ NEW FIELD
  createdAt: string;
  capacity: {
    id: string;
    name: string;
    slug: string;
    volumeMl: number;
  };
  productCategories: Array<{
    productId: string;
    categoryId: string;
    category: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  productColors: Array<{
    productId: string;
    colorId: string;
    color: {
      id: string;
      name: string;
      slug: string;
      hexCode: string;
    };
  }>;
  productImages: Array<{
    id: string;
    url: string;
    altText: string;
    order: number;
  }>;
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
  pagination: {
    current_page: number;
    per_page: number;
    total_pages: number;
    total_items: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

### React/Next.js Component Examples

#### 1. Product Card với VIP Badge

```tsx
// components/ProductCard.tsx
import Image from 'next/image';
import { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="relative rounded-lg border p-4 hover:shadow-lg transition-shadow">
      {/* VIP Badge */}
      {product.isVip && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            VIP
          </span>
        </div>
      )}

      {/* Product Image */}
      <div className="relative h-48 w-full mb-4">
        <Image
          src={product.productImages[0]?.url || '/placeholder.jpg'}
          alt={product.productImages[0]?.altText || product.name}
          fill
          className="object-cover rounded-md"
        />
      </div>

      {/* Product Info */}
      <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {product.description}
      </p>

      {/* Capacity & Colors */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
          {product.capacity.name}
        </span>
        <div className="flex gap-1">
          {product.productColors.map((pc) => (
            <div
              key={pc.colorId}
              className="w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: pc.color.hexCode }}
              title={pc.color.name}
            />
          ))}
        </div>
      </div>

      {/* Stock Status */}
      <div className="text-sm text-gray-500">
        {product.stockQuantity > 0 ? (
          <span className="text-green-600">Còn hàng</span>
        ) : (
          <span className="text-red-600">Hết hàng</span>
        )}
      </div>
    </div>
  );
}
```

#### 2. Products List Page

```tsx
// app/products/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import { Product, ProductsResponse } from '@/types/product';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/products?page=${page}&limit=20`
      );
      const data: ProductsResponse = await response.json();

      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Sản phẩm</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
```

#### 3. Filter VIP Products Only

```tsx
// app/products/vip/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types/product';

export default function VIPProductsPage() {
  const [vipProducts, setVipProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchVIPProducts();
  }, []);

  const fetchVIPProducts = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/products?page=1&limit=100`
      );
      const data = await response.json();

      if (data.success) {
        // Filter VIP products on client side
        const vips = data.data.filter((product: Product) => product.isVip);
        setVipProducts(vips);
      }
    } catch (error) {
      console.error('Error fetching VIP products:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Sản phẩm VIP</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-2 text-sm font-semibold text-white">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          VIP Collection
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {vipProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {vipProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Chưa có sản phẩm VIP nào
        </div>
      )}
    </div>
  );
}
```

#### 4. Admin Form - Create/Edit Product

```tsx
// components/admin/ProductForm.tsx
import { useState } from 'react';

export default function ProductForm() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacityId: '',
    stockQuantity: 0,
    unitPrice: 0,
    productUrl: '',
    isVip: false,  // ✅ NEW FIELD
    categoryIds: [],
    colorIds: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/products`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('Tạo sản phẩm thành công!');
        // Reset form or redirect
      }
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Other form fields... */}

      {/* VIP Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isVip"
          checked={formData.isVip}
          onChange={(e) => setFormData({
            ...formData,
            isVip: e.target.checked
          })}
          className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
        />
        <label htmlFor="isVip" className="text-sm font-medium">
          Đánh dấu là sản phẩm VIP
        </label>
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Tạo sản phẩm
      </button>
    </form>
  );
}
```

---

## 🎨 CSS Styles cho VIP Badge

### Tailwind CSS
```css
/* tailwind.config.js - Có thể thêm custom colors */
module.exports = {
  theme: {
    extend: {
      colors: {
        'vip-gold': {
          light: '#FFD700',
          DEFAULT: '#FFC107',
          dark: '#FF6F00',
        }
      }
    }
  }
}
```

### Custom CSS
```css
/* styles/vip-badge.css */
.vip-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: linear-gradient(135deg, #FFD700 0%, #FFC107 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.4);
  animation: vip-shine 2s ease-in-out infinite;
}

@keyframes vip-shine {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.4);
  }
  50% {
    box-shadow: 0 4px 16px rgba(255, 193, 7, 0.6);
  }
}

.vip-badge-icon {
  width: 1rem;
  height: 1rem;
}
```

---

## ✅ Testing Checklist

### Backend Testing
- [ ] Chạy SQL migration trên phpMyAdmin thành công
- [ ] Verify cột `is_vip` đã tồn tại trong bảng `products`
- [ ] Test API: Tạo sản phẩm mới với `isVip: true`
- [ ] Test API: Tạo sản phẩm mới với `isVip: false`
- [ ] Test API: Tạo sản phẩm mới không truyền `isVip` (should default to false)
- [ ] Test API: Update product với `isVip: true`
- [ ] Test API: Get all products - verify `isVip` field exists
- [ ] Test API: Get single product - verify `isVip` field exists
- [ ] Test API: Search products - verify `isVip` field exists

### Frontend Testing
- [ ] TypeScript interface có field `isVip: boolean`
- [ ] Product card hiển thị VIP badge khi `isVip === true`
- [ ] Product card KHÔNG hiển thị badge khi `isVip === false`
- [ ] VIP badge có style đẹp và nổi bật
- [ ] Filter VIP products hoạt động chính xác
- [ ] Admin form có checkbox để set `isVip`
- [ ] Admin form save/update `isVip` thành công

---

## 🔄 Rollback Plan

Nếu cần rollback:

### 1. Database Rollback
```sql
-- Xóa cột is_vip
ALTER TABLE products DROP COLUMN is_vip;
```

### 2. Code Rollback
```bash
git revert <commit-hash>
# hoặc
git checkout <previous-commit>
```

---

## 📝 Notes

- Field `isVip` có giá trị mặc định là `false`
- Tất cả sản phẩm hiện tại sẽ tự động có `isVip = false`
- Admin có thể update `isVip` bất cứ lúc nào
- Field này được trả về trong TẤT CẢ API responses (public & admin)
- Không cần authentication để xem field này (public API)

---

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. SQL migration đã chạy thành công chưa
2. Backend code đã được deploy chưa
3. Build backend có lỗi không (`npm run build`)
4. API response có trả về field `isVip` chưa
5. Frontend TypeScript interface đã cập nhật chưa

---

**Created by:** Claude Code Assistant
**Date:** 2025-10-10
**Version:** 1.0.0
