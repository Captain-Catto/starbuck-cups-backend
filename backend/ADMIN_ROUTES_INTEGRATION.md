# Admin Routes Integration Guide

## 📋 Summary

Đã restructure AWS S3 upload theo đúng pattern admin với folder structure và naming convention chuẩn.

## 📁 Updated File Structure

```
backend/src/
├── services/
│   └── s3.service.ts           # ✅ S3 upload service
├── middleware/
│   └── upload.middleware.ts    # ✅ Multer upload middleware
└── routes/
    ├── upload.routes.ts        # ✅ Upload routes với admin auth
    ├── auth.routes.ts
    ├── products.routes.ts
    └── ... (other routes)
```

## 🔧 API Endpoints

All upload endpoints are now under `/api/admin/upload`:

- `POST /api/admin/upload/single` - Upload single file
- `POST /api/admin/upload/multiple` - Upload multiple files
- `DELETE /api/admin/upload/:key` - Delete file
- `GET /api/admin/upload/signed-url/:key` - Get signed URL

## 🚀 Integration Steps

### 1. Import upload routes trong main app:

```typescript
// In src/index.ts
import uploadRoutes from "./routes/upload.routes";

// Mount admin upload routes
app.use("/api/admin/upload", uploadRoutes);
```

### 2. Update frontend calls:

```typescript
// Change from:
fetch('/api/upload/single', ...)

// To:
fetch('/api/admin/upload/single', ...)
```

### 3. Environment remains the same:

```env
AWS_ACCESS_KEY_ID=your-aws-secret
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=ap-southeast-2
S3_BUCKET=starbucks-shop-uploads
```

## ✅ Benefits

1. **Simple Structure**: Upload routes ở chung với các routes khác
2. **Naming Convention**: Tất cả files follow `.service.ts`, `.middleware.ts`, `.routes.ts` pattern
3. **Security**: Admin-only upload endpoints vẫn có authentication
4. **Organization**: Clean và đơn giản hơn

## 🎯 Next Steps

1. Mount admin routes in main app
2. Update frontend to use `/api/admin/upload` endpoints
3. Test file upload functionality
4. Integrate with product management forms
