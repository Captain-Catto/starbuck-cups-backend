# Migration Guide: Thêm Feature Featured Badge cho Products

## 📅 Ngày thực hiện
**Date:** 2026-01-11

## 🎯 Mục đích
Thêm cột `is_featured` vào bảng `products` để đánh dấu sản phẩm nổi bật và hiển thị ưu tiên trên frontend.

---

## 🗄️ Database Migration

### SQL Script để chạy trên phpMyAdmin

```sql
-- Thêm cột is_featured vào bảng products
ALTER TABLE products
ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE
AFTER is_vip;

-- (Optional) Kiểm tra cột đã được thêm
DESCRIBE products;

-- (Optional) Đánh dấu một số sản phẩm mẫu là Featured để test
UPDATE products
SET is_featured = TRUE
WHERE id IN (
  'product-id-1',
  'product-id-2'
);
```

### Cấu trúc cột mới

| Column Name | Type | Null | Default | Description |
|------------|------|------|---------|-------------|
| `is_featured` | BOOLEAN | NO | FALSE | Đánh dấu sản phẩm có phải Featured không |

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
  isVip: boolean;
  isFeatured: boolean;  // ✅ NEW FIELD
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
  declare isVip: boolean;
  declare isFeatured: boolean;  // ✅ NEW FIELD
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
isFeatured: {  // ✅ NEW FIELD
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
  field: "is_featured",
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
  isVip: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),  // ✅ NEW FIELD
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
  isVip: Boolean(isVip),
  isFeatured: Boolean(isFeatured),  // ✅ NEW FIELD
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
  "isVip",
  "isFeatured",  // ✅ NEW FIELD - được trả về trong tất cả APIs
  "createdAt",
]
```

**Query Filtering with Featured First:**
```typescript
// Query parameters
const {
  page = "1",
  limit = "20",
  isFeatured = "all",  // ✅ NEW PARAMETER
  sortBy = "createdAt",
  sortOrder = "desc",
} = req.query;

// WHERE filter
if (isFeatured !== "all") {
  where.isFeatured = isFeatured === "true";
}

// Sorting: Featured products first when filtering
const orderClauses: any[] = [];

if (isFeatured === "true") {
  orderClauses.push(["isFeatured", "DESC"]);  // ✅ Featured first
}

orderClauses.push([sortBy as string, sortOrder.toUpperCase()]);
```

---

## 📡 API Documentation

### Admin APIs

#### 1. Create Product (Admin)
**Endpoint:** `POST /api/admin/products`

**Request Body:**
```json
{
  "name": "Starbucks Featured Limited Cup",
  "slug": "starbucks-featured-limited-cup",
  "description": "Special featured cup for homepage",
  "capacityId": "uuid-of-capacity",
  "stockQuantity": 50,
  "unitPrice": 850000,
  "productUrl": "https://example.com/product",
  "isVip": false,
  "isFeatured": true,  // ✅ NEW FIELD - Optional, default: false
  "categoryIds": [
    "category-uuid-1"
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
    "name": "Starbucks Featured Limited Cup",
    "slug": "starbucks-featured-limited-cup",
    "isVip": false,
    "isFeatured": true,  // ✅ NEW FIELD
    "isActive": true,
    ...
  }
}
```

#### 2. Update Product (Admin)
**Endpoint:** `PUT /api/admin/products/:id`

**Request Body (partial update):**
```json
{
  "isFeatured": true  // ✅ Có thể update field này riêng lẻ
}
```

#### 3. Get All Products with Featured Filter (Admin)
**Endpoint:** `GET /api/admin/products?isFeatured=true&page=1&limit=20`

**Query Parameters:**
- `isFeatured` - Filter theo featured status (`all` | `true` | `false`)
- Khi `isFeatured=true`: Sản phẩm featured hiển thị trước

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid-1",
      "name": "Featured Cup A",
      "isFeatured": true,  // ✅ Featured products first
      ...
    },
    {
      "id": "product-uuid-2",
      "name": "Featured Cup B",
      "isFeatured": true,
      ...
    }
  ],
  "pagination": {...}
}
```

#### 4. Get Featured Products Statistics (Admin)
**Endpoint:** `GET /api/admin/products/stats/featured`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": {
      "allProducts": 150,
      "activeProducts": 145,
      "featuredProducts": 25,
      "activeFeaturedProducts": 24
    },
    "percentages": {
      "featuredOfTotal": 16.7,
      "featuredOfActive": 16.6
    },
    "breakdown": {
      "notFeatured": 125,
      "inactiveFeatured": 1
    }
  }
}
```

---

### Public APIs (cho Frontend)

#### 1. Get Public Products with Featured Filter
**Endpoint:** `GET /api/products?isFeatured=true&page=1&limit=20`

**Query Parameters:**
- `page` - Số trang (default: 1)
- `limit` - Số sản phẩm mỗi trang (default: 20)
- `search` - Tìm kiếm theo tên
- `isFeatured` - Filter theo featured status (`all` | `true` | `false`)  // ✅ NEW
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
      "name": "Starbucks Featured Cup",
      "slug": "starbucks-featured-cup",
      "description": "Special featured product",
      "stockQuantity": 50,
      "unitPrice": "850000.00",
      "productUrl": "https://example.com/product",
      "isVip": false,
      "isFeatured": true,  // ✅ NEW FIELD - Hiển thị trước
      "createdAt": "2026-01-11T10:00:00.000Z",
      ...
    },
    {
      "id": "product-uuid-2",
      "name": "Regular Cup",
      "isFeatured": false,  // ✅ Sản phẩm thường hiển thị sau
      ...
    }
  ],
  "pagination": {...}
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
    "name": "Starbucks Featured Cup",
    "isFeatured": true,  // ✅ NEW FIELD
    ...
  }
}
```

---

## 🎨 Frontend Integration Example

### TypeScript Interface
```typescript
export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  stockQuantity: number;
  unitPrice: string;
  productUrl?: string;
  isVip: boolean;
  isFeatured: boolean;  // ✅ NEW FIELD
  createdAt: string;
  ...
}
```

### Product Card với Featured Badge
```tsx
export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="relative rounded-lg border p-4">
      {/* Featured Badge */}
      {product.isFeatured && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
            ⭐ Featured
          </span>
        </div>
      )}

      {/* VIP Badge */}
      {product.isVip && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
            VIP
          </span>
        </div>
      )}

      {/* Product Content */}
      <div className="relative h-48 w-full mb-4">
        <Image src={product.productImages[0]?.url} alt={product.name} fill />
      </div>
      <h3 className="text-lg font-semibold">{product.name}</h3>
      ...
    </div>
  );
}
```

### Fetch Featured Products
```tsx
// Lấy chỉ sản phẩm featured
const response = await fetch(
  `${API_URL}/api/products?isFeatured=true&limit=8`
);

// Kết quả: Featured products được sắp xếp ưu tiên trước
```

---

## ✅ Testing Checklist

### Backend Testing
- [ ] Chạy SQL migration trên phpMyAdmin thành công
- [ ] Verify cột `is_featured` đã tồn tại trong bảng `products`
- [ ] Test API: Tạo sản phẩm mới với `isFeatured: true`
- [ ] Test API: Tạo sản phẩm không truyền `isFeatured` (default to false)
- [ ] Test API: Update product với `isFeatured: true`
- [ ] Test API: `GET /api/products?isFeatured=true` - chỉ featured products
- [ ] Test API: `GET /api/products?isFeatured=true` - featured products hiển thị trước
- [ ] Test API: `GET /api/admin/products/stats/featured` - thống kê chính xác
- [ ] Test API: Kết hợp filter `?isFeatured=true&categorySlug=cups`

### Frontend Testing
- [ ] TypeScript interface có field `isFeatured: boolean`
- [ ] Product card hiển thị Featured badge khi `isFeatured === true`
- [ ] Homepage hiển thị featured products trước
- [ ] Filter featured products hoạt động chính xác
- [ ] Admin form có checkbox để set `isFeatured`
- [ ] Admin dashboard hiển thị statistics

---

## 🔄 Rollback Plan

Nếu cần rollback:

### 1. Database Rollback
```sql
-- Xóa cột is_featured
ALTER TABLE products DROP COLUMN is_featured;
```

### 2. Code Rollback
```bash
git revert <commit-hash>
```

---

## 📝 Notes

- Field `isFeatured` có giá trị mặc định là `false`
- Tất cả sản phẩm hiện tại sẽ tự động có `isFeatured = false`
- **Khác với `isVip`:** Featured dùng cho hiển thị ưu tiên, VIP dùng cho sản phẩm cao cấp
- **Độc lập:** Một sản phẩm có thể vừa VIP vừa Featured
- **Sorting:** Featured products chỉ ưu tiên hiển thị trước khi có filter `isFeatured=true`
- Field này được trả về trong TẤT CẢ API responses (public & admin)
- Không cần authentication để xem field này (public API)

---

## 🎯 Use Cases

1. **Homepage Featured Section:** Hiển thị 8 sản phẩm featured mới nhất
2. **Category Pages:** Featured products trong category luôn hiển thị trước
3. **Admin Dashboard:** Xem thống kê featured products
4. **Marketing Campaigns:** Đánh dấu sản phẩm để promote

---

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. SQL migration đã chạy thành công chưa
2. Backend code đã được build chưa (`npm run build`)
3. API response có trả về field `isFeatured` chưa
4. Filter `?isFeatured=true` có hoạt động không
5. Featured products có hiển thị trước không

---

**Created by:** Claude Code Assistant
**Date:** 2026-01-11
**Version:** 1.0.0
