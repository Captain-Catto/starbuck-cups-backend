# Implementation Plan: Starbucks Cup E-commerce Website

**Branch**: `001-starbucks-website` | **Date**: September 11, 2025 | **Spec**: [specs/001-starbucks-website/spec.md](specs/001-starbucks-website/spec.md)
**Input**: Feature specification from `/specs/001-starbucks-website/spec.md`

## Summary

Create a Starbucks cup e-commerce website with customer-facing product browsing (no prices shown) that redirects to Messenger for consultation, plus a comprehensive admin panel for customer management, order processing, and analytics. The system uses white/black color scheme with interactive swiper hero section and global state management.

## Technical Context

**Language/Version**: JavaScript/TypeScript with Node.js 18+ and React 18+  
**Primary Dependencies**: React, Redux Toolkit, Swiper, Express.js, Prisma ORM, Messenger Platform API  
**Storage**: PostgreSQL for main data, Redis for session/cache management  
**Testing**: Jest for unit tests, Playwright for E2E, Supertest for API testing  
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge) and mobile responsive  
**Project Type**: web - requires frontend and backend projects  
**Performance Goals**: <2s page load, <500ms API response times, 60fps animations  
**Constraints**: Mobile-first responsive design, WCAG accessibility standards  
**Scale/Scope**: 1000+ concurrent users, 10k+ products, real-time Messenger integration  
**Port Configuration**: Backend API on port 8080, Frontend on port 3000  
**Response Format**: Standardized response structure with success, data, meta, error fields  
**Pricing Strategy**: Products have no fixed prices, admin sets prices during order creation

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 2 (frontend, backend) - within limit of 3
- Using framework directly? Yes - React, Express without unnecessary wrappers
- Single data model? Yes - shared between frontend/backend via OpenAPI
- Avoiding patterns? Yes - direct database access via Prisma, no repository layer

**Architecture**:

- EVERY feature as library? Yes - auth, products, orders, analytics as separate modules
- Libraries listed:
  - auth-service (authentication/authorization)
  - product-service (catalog management)
  - order-service (order processing)
  - analytics-service (reporting)
  - messenger-service (external integration)
- CLI per library: Admin CLI with --help/--version/--format for data management
- Library docs: llms.txt format planned for each service module

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? Yes - contract tests written first
- Git commits show tests before implementation? Yes - TDD workflow enforced
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes - actual PostgreSQL, Redis, Messenger API
- Integration tests for: API contracts, database schemas, Messenger integration
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:

- Structured logging included? Yes - Winston with JSON format
- Frontend logs → backend? Yes - centralized logging via API
- Error context sufficient? Yes - user ID, session, action context

**Versioning**:

- Version number assigned? Yes - 1.0.0 (MAJOR.MINOR.BUILD)
- BUILD increments on every change? Yes - automated via CI/CD
- Breaking changes handled? Yes - API versioning, database migrations

## Project Structure

### Documentation (this feature)

```
specs/001-starbucks-website/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
backend/
├── src/
│   ├── models/          # Prisma models
│   ├── services/        # Business logic modules
│   ├── api/            # Express routes
│   ├── middleware/     # Auth, logging, validation
│   └── lib/            # Shared utilities
└── tests/
    ├── contract/       # OpenAPI contract tests
    ├── integration/    # Service integration tests
    └── unit/          # Unit tests

frontend/
├── src/
│   ├── components/     # React components
│   ├── pages/         # Route components
│   ├── services/      # API clients, state management
│   ├── hooks/         # Custom React hooks
│   └── utils/         # Shared utilities
└── tests/
    ├── components/    # Component tests
    ├── integration/   # Page flow tests
    └── e2e/          # End-to-end tests
```

**Structure Decision**: Option 2 (Web application) - frontend + backend structure

## Phase 0: Outline & Research

**Research Tasks Required**:

1. **Messenger Platform API integration** - Authentication, webhook setup, message templates
2. **Swiper.js best practices** - Performance optimization, accessibility, mobile touch
3. **Redux Toolkit patterns** - RTK Query for API state, normalized store structure
4. **E-commerce without pricing** - User experience patterns, conversion optimization
5. **Admin panel security** - JWT authentication, role-based access, session management
6. **PostgreSQL schema design** - Multi-relationship handling (addresses, social accounts)
7. **Stock management patterns** - Real-time inventory, concurrent order handling
8. **Analytics aggregation** - Time-series data, efficient querying strategies

**Consolidation in research.md**:

- Decision: Technology choices and integration approaches
- Rationale: Performance, maintainability, team expertise considerations
- Alternatives considered: Other state management, database, messaging solutions

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

**Data Model Extraction** (→ data-model.md):

- **Product**: id, name, description, capacity, color, category, stock, images, urls
- **Customer**: id, phone (required), email, addresses[], facebook_accounts[], zalo_accounts[]
- **Order**: id, type (custom/product), customer_id, items[], total_amount, shipping_cost, free_shipping, status
- **Admin**: id, username, password_hash, role, created_at
- **Analytics**: date, revenue, products_sold, low_stock_items[]

**API Contracts Generation** (→ contracts/):

- **Customer API**: GET /products, GET /products/:id, POST /cart/messenger-redirect
- **Admin API**: POST /auth/login, GET/POST/PUT/DELETE /customers, GET/POST/PUT /orders, GET /analytics
- **Product API**: GET /products (with filters), GET /categories, GET /stock-status
- **Messenger API**: POST /webhook, GET /webhook (verification)

**Contract Tests**:

- Each endpoint schema validation
- Authentication flow testing
- Messenger webhook verification
- Stock validation on order creation

**Integration Test Scenarios**:

- Customer product browsing and consultation flow
- Admin order creation with stock checking
- Analytics data aggregation and filtering
- Messenger message template generation

**Agent File Update**:

- Add React, Redux Toolkit, Swiper.js, Express, Prisma technologies
- Include API patterns and state management approaches
- Update with current feature context and conventions

**Output**: data-model.md, contracts/\*, failing contract tests, quickstart.md, .github/copilot-instructions.md

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `/templates/tasks-template.md` as base
- Generate setup tasks: project initialization, dependency installation, database setup
- Create contract test tasks for each API endpoint [P]
- Generate model creation tasks for each entity [P]
- Create service implementation tasks following TDD order
- Add frontend component tasks after backend API completion
- Include integration tasks for Messenger API, database connections
- Add E2E test tasks for complete user flows

**Ordering Strategy**:

- TDD order: Contract tests → Integration tests → Implementation
- Dependency order: Database models → Services → API routes → Frontend components
- Mark [P] for parallel execution: independent API endpoints, separate frontend components
- Sequential for: database migrations, API integration, E2E test scenarios

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md covering:

- Setup (5 tasks): Project init, database, dependencies
- Backend tests (12 tasks): Contract + integration tests
- Backend implementation (10 tasks): Models, services, API routes
- Frontend tests (8 tasks): Component + integration tests
- Frontend implementation (8 tasks): Components, pages, state management
- Integration (5 tasks): Messenger API, deployment, E2E tests

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_No constitutional violations detected - all within acceptable complexity bounds_

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

**Deliverables Created**:

- [x] research.md - Technical decisions and rationale
- [x] data-model.md - Complete entity definitions and relationships
- [x] contracts/customer-api.yaml - Customer-facing API contract
- [x] contracts/admin-api.yaml - Administrative API contract
- [x] quickstart.md - Validation scenarios and testing guide

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
