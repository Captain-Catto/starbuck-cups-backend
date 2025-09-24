# MeiliSearch Integration Guide

Hướng dẫn sử dụng MeiliSearch trong dự án Starbucks Shop.

## 🚀 Setup

### 1. Cài đặt MeiliSearch Server

**Option A: Docker (Recommended)**

```bash
docker run -it --rm \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY="starbucks_meilisearch_key_2024" \
  -v $(pwd)/meili_data:/meili_data \
  getmeili/meilisearch:v1.5
```

**Option B: Binary Download**

```bash
# Download và chạy binary
curl -L https://install.meilisearch.com | sh
./meilisearch --master-key "starbucks_meilisearch_key_2024"
```

### 2. Environment Variables

Đảm bảo file `.env` có các biến sau:

```env
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="starbucks_meilisearch_key_2024"
MEILISEARCH_INDEXES="products,categories,colors,capacities,customers"
```

### 3. Khởi tạo Indexes

```bash
# Initialize MeiliSearch indexes
npm run search:init

# Sync data from database to MeiliSearch
npm run search:sync
```

## 📚 API Endpoints

### Product Search

```
GET /api/search/products?q=coffee&limit=20&offset=0
GET /api/search/products/autocomplete?q=coffee&limit=10
GET /api/search/products/facets
```

**Example Request:**

```bash
curl "http://localhost:8080/api/search/products?q=coffee&categoryIds=cat1,cat2&colorIds=red&limit=10"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "hits": [
      {
        "id": "product-123",
        "name": "Premium Coffee Mug",
        "slug": "premium-coffee-mug",
        "description": "High-quality ceramic coffee mug",
        "category": {
          "id": "cat1",
          "name": "Mugs",
          "slug": "mugs"
        },
        "color": {
          "id": "red",
          "name": "Red",
          "hexCode": "#FF0000"
        },
        "capacity": {
          "id": "350ml",
          "name": "350ml",
          "volumeMl": 350
        },
        "images": ["image1.jpg", "image2.jpg"]
      }
    ],
    "estimatedTotalHits": 1,
    "limit": 10,
    "offset": 0
  },
  "query": "coffee",
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

### Category Search

```
GET /api/search/categories?q=mug&limit=20
GET /api/search/categories/autocomplete?q=mug&limit=10
```

### Color Search

```
GET /api/search/colors?q=red&limit=20
GET /api/search/colors/autocomplete?q=red&limit=10
```

### Capacity Search

```
GET /api/search/capacities?q=350&limit=20
GET /api/search/capacities/autocomplete?q=350&limit=10
```

### Customer Search (Admin Only)

```
GET /api/search/customers?q=john&limit=20
GET /api/search/customers/autocomplete?q=john&limit=10
```

### Global Search

```
GET /api/search/global?q=coffee&limit=20
```

## 🔧 Advanced Usage

### Search with Filters

```javascript
// Frontend example
const searchProducts = async (query, filters = {}) => {
  const params = new URLSearchParams({
    q: query,
    limit: filters.limit || 20,
    offset: filters.offset || 0,
    sortBy: filters.sortBy || "relevance",
  });

  if (filters.categoryIds) {
    filters.categoryIds.forEach((id) => params.append("categoryIds", id));
  }

  if (filters.colorIds) {
    filters.colorIds.forEach((id) => params.append("colorIds", id));
  }

  const response = await fetch(`/api/search/products?${params}`);
  return response.json();
};

// Usage
const results = await searchProducts("coffee mug", {
  categoryIds: ["mugs", "tumblers"],
  colorIds: ["red", "blue"],
  limit: 10,
  sortBy: "name",
});
```

### Autocomplete with Debouncing

```javascript
// React example
import { useState, useEffect } from "react";
import { debounce } from "lodash";

const SearchAutocomplete = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const debouncedSearch = debounce(async (searchQuery) => {
    if (searchQuery.length >= 2) {
      const response = await fetch(
        `/api/search/products/autocomplete?q=${searchQuery}&limit=5`
      );
      const data = await response.json();
      setSuggestions(data.data || []);
    } else {
      setSuggestions([]);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />
      {suggestions.length > 0 && (
        <ul>
          {suggestions.map((item) => (
            <li key={item.id}>
              <img src={item.image} alt="" />
              <span>{item.name}</span>
              <small>{item.category}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

## 🔄 Auto Sync

Hệ thống tự động sync dữ liệu khi có thay đổi trong database. Để sử dụng auto-sync trong controllers:

```typescript
import { syncProduct } from "../middleware/auto-sync.middleware";

// In your product controller routes
router.post("/products", syncProduct.create(), createProductController);
router.put("/products/:id", syncProduct.update(), updateProductController);
router.delete("/products/:id", syncProduct.delete(), deleteProductController);
```

## 🛠 Manual Operations

### Sync All Data

```bash
npm run search:sync
```

### Clear All Indexes

```typescript
import { meilisearchService } from "./services/meilisearch.service";

await meilisearchService.clearAllIndexes();
```

### Get Index Statistics

```typescript
const stats = await meilisearchService.getIndexStats();
console.log("Index stats:", stats);
```

## 🎯 Best Practices

### 1. Search Query Optimization

- Sử dụng typo tolerance để xử lý lỗi chính tả
- Implement synonyms cho các từ tương đương
- Sử dụng stop words để lọc bỏ từ không cần thiết

### 2. Faceting Strategy

```javascript
// Get facets để build filters UI
const facets = await fetch('/api/search/products/facets').then(r => r.json());

// Facets response:
{
  "category.name": {
    "Mugs": 150,
    "Tumblers": 75,
    "Bottles": 32
  },
  "color.name": {
    "Red": 45,
    "Blue": 38,
    "Black": 67
  }
}
```

### 3. Performance Tips

- Sử dụng limit để giới hạn số kết quả
- Implement pagination với offset
- Cache frequent searches ở frontend
- Sử dụng debouncing cho autocomplete

### 4. Error Handling

```typescript
try {
  const results = await meilisearchService.searchProducts(query, options);
  return results;
} catch (error) {
  console.error("Search error:", error);
  // Fallback to database search or show error message
  return { hits: [], estimatedTotalHits: 0 };
}
```

## 🔍 Monitoring

### Check MeiliSearch Health

```bash
curl http://localhost:7700/health
```

### View MeiliSearch Dashboard

Open browser: `http://localhost:7700`

### Monitor Index Stats

```typescript
const stats = await meilisearchService.getIndexStats();
console.log("Products index:", stats.products.numberOfDocuments);
```

## 🚨 Troubleshooting

### Common Issues

**1. Connection Error**

```
Error: Request to MeiliSearch failed
```

- Kiểm tra MeiliSearch server có đang chạy không
- Verify MEILISEARCH_HOST và MEILISEARCH_MASTER_KEY

**2. Index Not Found**

```
Error: Index products not found
```

- Chạy `npm run search:init` để tạo indexes

**3. Sync Issues**

```
Error: Failed to sync product to MeiliSearch
```

- Kiểm tra data format có đúng SearchableProduct interface không
- Verify MeiliSearch có đủ quyền write không

**4. Empty Search Results**

- Chạy `npm run search:sync` để sync data
- Kiểm tra indexes có data không với `getIndexStats()`

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = "meilisearch:*";
```

---

📝 **Note**: MeiliSearch sẽ tự động initialize khi app start. Nếu có lỗi, app vẫn sẽ chạy nhưng không có search functionality.
