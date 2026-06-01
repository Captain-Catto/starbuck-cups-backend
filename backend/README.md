# Starbucks Cups Backend API

Express + TypeScript backend API for the Starbucks cups shop.

## Stack

- Node.js + TypeScript
- Express
- Sequelize + PostgreSQL
- Redis for cache/session/rate-limit storage
- MeiliSearch for product search
- Socket.IO for realtime admin updates
- Sentry and Winston for observability

## Project Layout

```text
backend/
├── src/
│   ├── config/        # Environment, database, CORS, MeiliSearch setup
│   ├── controllers/   # HTTP handlers
│   ├── middleware/    # Express middleware
│   ├── migrations/    # Sequelize migrations are in ../migrations
│   ├── models/        # Sequelize models
│   ├── routes/        # Express route registration
│   ├── scripts/       # Operational scripts
│   ├── services/      # Business logic
│   ├── types/         # TypeScript types
│   └── utils/         # Shared utilities
├── migrations/        # Sequelize migration files
├── scripts/           # SQL maintenance helpers
├── package.json
└── tsconfig.json
```

## Setup

```bash
npm install
cp .env.development .env
npm run dev
```

The API listens on `http://localhost:8080` by default.

## Commands

```bash
npm run dev
npm run build
npm start
npm run start:low-memory
npm run db:migrate
npm run db:migrate:undo
npm run db:migrate:status
npm run sync-meilisearch
npm run test-meilisearch
```

## Core Endpoints

- `GET /health`
- `POST /api/auth/admin/login`
- `POST /api/auth/admin/refresh`
- `POST /api/auth/admin/logout`
- `GET /api/products/public`
- `GET /api/products/public/:slug`
- `GET /api/admin/products`
- `GET /api/admin/orders`
- `GET /api/admin/customers`
- `GET /api/admin/consultations`
- `GET /api/admin/dashboard/statistics`

## Database

Use Sequelize migrations:

```bash
npm run db:migrate
npm run db:migrate:status
```

Maintenance SQL that is still intentionally kept:

- `scripts/performance-indexes.sql`

## Search

Sync product data to MeiliSearch:

```bash
npm run sync-meilisearch
```
