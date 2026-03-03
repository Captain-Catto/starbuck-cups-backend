# Starbucks Cups Shop - Backend API

Backend API server cho website bán ly Starbucks được xây dựng với Node.js, Express, TypeScript và Prisma.

## 🚀 Công nghệ sử dụng

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL với Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT
- **Testing**: Jest
- **Security**: Helmet, CORS, Rate Limiting
- **API Documentation**: OpenAPI/Swagger (sắp tới)

## 📁 Cấu trúc project

```
backend/
├── src/
│   ├── config/         # Cấu hình database, Redis, etc.
│   ├── controllers/    # API controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Prisma models và database logic
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Application entry point
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── migrations/     # Database migrations
├── tests/              # Test files
└── docs/               # API documentation
```

## 🛠️ Setup Development

### Prerequisites

- Node.js 18+ và npm
- PostgreSQL 14+
- Redis 6+
- Git

### Installation

1. **Clone và navigate:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Setup environment:**

   ```bash
   cp .env.example .env
   # Chỉnh sửa .env với database credentials
   ```

4. **Setup database:**

   ```bash
   # Tạo database
   createdb starbucks_shop
   createdb starbucks_shop_test

   # Run migrations
   npx prisma migrate dev

   # Generate Prisma client
   npx prisma generate
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

Server sẽ chạy tại: http://localhost:8080

## 🐳 Docker (Backend + PostgreSQL + MeiliSearch)

Chạy từ thư mục project root `starbucks-shop/`:

1. Tạo file env cho Docker Compose:

   ```bash
   cp .env.docker.example .env
   ```

2. Build và start toàn bộ backend stack:

   ```bash
   docker compose up -d --build
   ```

3. Xem log backend:

   ```bash
   docker compose logs -f backend
   ```

4. Sync dữ liệu ban đầu sang MeiliSearch (chạy 1 lần sau khi DB có data):

   ```bash
   docker compose exec backend node dist/scripts/sync-meilisearch.js
   ```

## 🎯 Available Scripts

### Development

- `npm run dev` - Start development server với hot reload
- `npm run build` - Build production
- `npm start` - Start production server

### Database

- `npm run db:migrate` - Chạy database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Mở Prisma Studio
- `npm run db:seed` - Seed database với sample data

### Testing

- `npm test` - Chạy tests
- `npm run test:watch` - Chạy tests ở watch mode
- `npm run test:coverage` - Chạy tests với coverage report

### Code Quality

- `npm run lint` - Chạy ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Kiểm tra TypeScript types

## 🔧 VS Code Tasks

Sử dụng VS Code Command Palette (`Ctrl+Shift+P`) và chọn "Tasks: Run Task":

- `dev:backend` - Start development server
- `test:backend` - Run tests
- `lint:backend` - Lint code
- `prisma:generate` - Generate Prisma client
- `prisma:migrate` - Run migrations
- `prisma:studio` - Open Prisma Studio

## 🌐 API Endpoints

### Health Check

- `GET /health` - Server health status

### Authentication

- `POST /api/auth/login` - Admin login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout

### Products

- `GET /api/products` - Lấy danh sách sản phẩm
- `GET /api/products/:id` - Lấy chi tiết sản phẩm
- `POST /api/products` - Tạo sản phẩm mới (Admin)
- `PUT /api/products/:id` - Cập nhật sản phẩm (Admin)
- `DELETE /api/products/:id` - Xóa sản phẩm (Admin)

### Categories

- `GET /api/categories` - Lấy danh sách danh mục
- `POST /api/categories` - Tạo danh mục mới (Admin)

### Orders

- `POST /api/orders` - Tạo đơn hàng mới
- `GET /api/orders` - Lấy danh sách đơn hàng (Admin)

### Consultations (Messenger)

- `POST /api/consultations` - Tạo consultation request
- `GET /api/consultations` - Lấy danh sách consultations (Admin)

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **JWT**: JSON Web Token authentication
- **Bcrypt**: Password hashing
- **Input Validation**: Request validation middleware

## 🗄️ Database Schema

### Core Entities

- **AdminUser**: Quản trị viên
- **Customer**: Khách hàng
- **Product**: Sản phẩm
- **Category**: Danh mục sản phẩm
- **Color**: Màu sắc động
- **Capacity**: Dung tích động
- **Order**: Đơn hàng
- **OrderItem**: Chi tiết đơn hàng
- **Consultation**: Tư vấn qua Messenger

## 📊 API Response Format

Tất cả API responses theo format chuẩn:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "pagination": { ... }
  },
  "error": null
}
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Test Coverage

```bash
npm run test:coverage
```

## 🐛 Debugging

### VS Code Debugging

1. Set breakpoints trong code
2. Chọn "Debug Backend" configuration
3. Press F5 để start debugging

### Logging

Application sử dụng structured logging với levels:

- `error` - Error messages
- `warn` - Warning messages
- `info` - Info messages
- `debug` - Debug messages (development only)

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Đảm bảo set các env vars cần thiết:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `MESSENGER_*` credentials

## 🤝 Contributing

1. Tạo feature branch từ `main`
2. Implement changes với tests
3. Chạy `npm run lint` và `npm test`
4. Create pull request

## 📝 License

Private project - All rights reserved.
