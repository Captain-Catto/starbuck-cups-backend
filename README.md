# Starbucks Cup E-commerce Website

A Vietnamese Starbucks cup e-commerce platform with customer browsing (no prices) and Messenger integration for consultation, plus comprehensive admin management.

## 🏗️ Project Structure

```
starbucks-shop/
├── backend/          # Node.js API server (port 8080)
├── frontend/         # React app (port 3000)
├── shared/           # Shared types and schemas
├── docs/             # Technical documentation
├── specs/            # Feature specifications
└── docker-compose.yml # Local development setup
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and install dependencies**:

```bash
git clone <repository>
cd starbucks-shop
```

2. **Start databases**:

```bash
docker-compose up -d
```

3. **Initialize project** (VS Code):

   - Open VS Code in project root
   - Run task: `Ctrl+Shift+P` → "Tasks: Run Task" → "setup:init-project"
   - Or run individual setup tasks

4. **Start development servers**:

```bash
# Backend (port 8080)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev

# Or use VS Code task: "dev:full-stack"
```

5. **Access applications**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - API Docs: http://localhost:8080/docs
   - Database Admin: http://localhost:8081

## 📋 Implementation Tasks

See [specs/001-starbucks-website/tasks.md](./specs/001-starbucks-website/tasks.md) for detailed implementation breakdown.

## 🛠️ VS Code Tasks

Available tasks (Ctrl+Shift+P → "Tasks: Run Task"):

- `setup:init-project` - Initialize project structure
- `dev:full-stack` - Start both backend and frontend
- `db:migrate` - Run database migrations
- `db:seed` - Seed database with initial data
- `test:backend` - Run backend tests
- `test:frontend` - Run frontend tests
- `build:all` - Build for production

## 📚 Documentation

- [Feature Specification](./specs/001-starbucks-website/spec.md)
- [Implementation Plan](./specs/001-starbucks-website/plan.md)
- [Data Model](./specs/001-starbucks-website/data-model-overview.md)
- [API Contracts](./specs/001-starbucks-website/contracts/)
- [Tasks Breakdown](./specs/001-starbucks-website/tasks.md)

## 🔧 Technology Stack

**Backend**:

- Node.js 18+ with TypeScript
- Express.js with OpenAPI validation
- Prisma ORM + PostgreSQL
- Redis for sessions/cache
- JWT authentication

**Frontend**:

- React 18+ with TypeScript
- Redux Toolkit for state management
- Vite for build tooling
- Swiper.js for carousel
- Mobile-first responsive design

**Integration**:

- Facebook Messenger Platform API
- OpenAPI contract-first development
- Docker for local development

## 🎯 Key Features

- **Customer Interface**: Product browsing without prices, Messenger consultation
- **Admin Dashboard**: Complete management for products, orders, customers
- **Dynamic Management**: Colors, capacities, categories created as needed
- **Single Color Products**: Simplified catalog with consultation for variants
- **Vietnamese-first**: Optimized for Vietnamese market and language

## 📊 Project Status

- **Specification**: ✅ Complete
- **Planning**: ✅ Complete
- **Implementation**: 🔄 In Progress (Completed Task 3.4 - Customer & Order Management UI)
- **Testing**: ⏳ Pending
- **Deployment**: ⏳ Pending

**Recent Completions**:

- ✅ Task 3.4: Advanced pagination, optimistic updates, enhanced filtering
- ✅ Customer management dashboard with comprehensive UI
- ✅ Order processing interface with mobile responsiveness

---

**Next Steps**: Continue with Phase 4 (Messenger Integration) or expand current features
