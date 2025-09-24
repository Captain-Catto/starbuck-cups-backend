# AWS S3 Upload Integration Guide

## 📋 Summary

Đã thêm thành công AWS S3 upload integration thay thế cho local file storage.

## 🔧 Dependencies đã cài đặt

```bash
npm install aws-sdk@^2.1691.0 uuid@^10.0.0 multer@^1.4.5-lts.1 @types/aws-sdk@^2.7.0 @types/uuid@^10.0.0 @types/multer@^1.4.12
```

## 📁 Files đã tạo

### 1. S3 Service (`src/services/s3.service.ts`)

- Upload single/multiple files
- Delete files
- Generate signed URLs
- File validation
- Content type detection

### 2. Upload Middleware (`src/middleware/upload.middleware.ts`)

- Multer configuration cho memory storage
- File type validation
- Error handling

### 3. Admin Upload Routes (`src/routes/admin/upload.routes.ts`)

- `POST /api/admin/upload/single` - Upload 1 file
- `POST /api/admin/upload/multiple` - Upload nhiều files
- `DELETE /api/admin/upload/:key` - Delete file
- `GET /api/admin/upload/signed-url/:key` - Get signed URL

## ⚙️ Environment Configuration

`.env` file đã được cập nhật:

```env
# AWS uploads
AWS_ACCESS_KEY_ID=AWS_SECRET_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=your-AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-southeast-2
S3_BUCKET=starbucks-shop-uploads

# File Upload
MAX_FILE_SIZE=5242880  # 5MB
ALLOWED_FOLDERS="products,categories,colors,avatars,uploads"
```

## 🚀 Usage Examples

### Upload single image:

```bash
curl -X POST http://localhost:8080/api/admin/upload/single \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "folder=products"
```

### Upload multiple images:

```bash
curl -X POST http://localhost:8080/api/admin/upload/multiple \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "folder=products"
```

### Delete file:

```bash
curl -X DELETE http://localhost:8080/api/admin/upload/products/uuid-filename.jpg \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📂 S3 Folder Structure

```
starbucks-shop-uploads/
├── products/          # Product images
├── categories/        # Category images
├── colors/           # Color swatches
├── avatars/          # User avatars
└── uploads/          # General uploads
```

## 🔒 Security Features

- JWT authentication required
- File type validation (images only)
- File size limits (5MB)
- Folder validation
- Public read access on S3
- Secure signed URLs for temporary access

## 🎯 Next Steps

1. **Update Product Management**: Modify product creation/update APIs to use S3 URLs
2. **Frontend Integration**: Update upload components to use new endpoints
3. **Database Migration**: Update existing image URLs from local to S3
4. **Cleanup**: Remove old local upload directories

## 📋 Integration Points

### Product Management:

```typescript
// Thay đổi từ:
const imageUrl = `/uploads/${filename}`;

// Thành:
const uploadResult = await s3Service.uploadFile(buffer, filename, "products");
const imageUrl = uploadResult.url;
```

### Frontend Upload Component:

```typescript
// Upload to S3 via admin API
const formData = new FormData();
formData.append("image", file);
formData.append("folder", "products");

const response = await fetch("/api/admin/upload/single", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

## ✅ Ready to use!

S3 upload system đã sẵn sàng. Bạn có thể bắt đầu integrate vào các API product management và frontend components.
