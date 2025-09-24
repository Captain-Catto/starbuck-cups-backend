# Research: Starbucks Cup E-commerce Website

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Status**: Complete

## Technical Decisions

### 1. Frontend Framework & State Management

**Decision**: React 18+ with Redux Toolkit and RTK Query on port 3000  
**Rationale**:

- React provides component reusability and strong ecosystem
- Redux Toolkit simplifies state management with less boilerplate
- RTK Query handles API state synchronization automatically
- TypeScript support for type safety across the application
- Standard development port 3000 for local development

**Alternatives Considered**:

- Vue.js + Pinia: Smaller learning curve but less enterprise ecosystem
- Next.js: Overkill for SPA requirements, SSR not needed for admin panel
- Zustand: Simpler but lacks advanced features like RTK Query

### 2. Swiper Integration

**Decision**: Swiper.js 10+ with React wrapper  
**Rationale**:

- Best-in-class touch gesture support for mobile devices
- Extensive customization options for hero section requirements
- Built-in accessibility features (keyboard navigation, ARIA support)
- Lightweight and performant with tree-shaking support

**Alternatives Considered**:

- Embla Carousel: Good performance but less feature-complete
- React Slick: Older, heavier, jQuery dependency concerns
- Custom solution: Development time not justified for standard carousel needs

### 3. Backend Architecture

**Decision**: Node.js with Express.js on port 8080 and Prisma ORM  
**Rationale**:

- JavaScript/TypeScript consistency across full stack
- Express.js provides minimal, flexible API framework on standardized port
- Prisma offers type-safe database access with excellent PostgreSQL support
- Strong ecosystem for Messenger Platform API integration
- Standardized response format ensures consistent client-server communication

**Response Structure Standard**:

```json
{
  "success": true,
  "data": {}, // Main response data
  "meta": {}, // Metadata: pagination, total records, timestamp
  "error": null // Error object when success is false
}
```

**Alternatives Considered**:

- NestJS: More structure but adds complexity for straightforward API needs
- Python + FastAPI: Different language adds team complexity
- PHP + Laravel: Mature but JavaScript ecosystem preferred

### 4. Database Design

**Decision**: PostgreSQL with Redis for caching/sessions  
**Rationale**:

- PostgreSQL handles complex relationships (multiple addresses per user) excellently
- JSON column support for flexible social account storage
- Redis provides fast session management and cart state caching
- Both have excellent Prisma/Node.js integration

**Alternatives Considered**:

- MongoDB: NoSQL flexibility not needed, relationships are well-defined
- MySQL: Good but PostgreSQL has better JSON and array support
- SQLite: Too limited for production multi-user requirements

### 5. Messenger Integration

**Decision**: Facebook Messenger Platform API with webhooks  
**Rationale**:

- Native Vietnamese user adoption for business communication
- Rich message templates support for product information
- Webhook system enables real-time communication
- Official API with comprehensive documentation

**Alternatives Considered**:

- Zalo Business API: Good local option but Facebook has broader reach
- WhatsApp Business API: More complex approval process
- Custom chat solution: Development overhead not justified

### 6. Authentication & Security

**Decision**: JWT with httpOnly cookies and refresh token rotation  
**Rationale**:

- Stateless authentication suitable for admin panel requirements
- httpOnly cookies prevent XSS attacks on tokens
- Refresh token rotation provides security against token theft
- Industry standard with extensive library support

**Alternatives Considered**:

- Session-based auth: Requires server state management complexity
- OAuth 2.0: Overkill for internal admin system
- Basic auth: Insufficient security for admin operations

### 7. Testing Strategy

**Decision**: Jest + React Testing Library + Playwright + Supertest  
**Rationale**:

- Jest provides comprehensive unit testing with mocking capabilities
- React Testing Library encourages accessible component testing
- Playwright offers reliable cross-browser E2E testing
- Supertest integrates well with Express for API testing

**Alternatives Considered**:

- Cypress: Good but Playwright has better browser support and speed
- Vitest: Newer but Jest ecosystem is more mature
- Puppeteer: More low-level than needed for E2E scenarios

### 8. Stock Management

**Decision**: Database-level constraints with optimistic locking  
**Rationale**:

- PostgreSQL row-level locking prevents overselling
- Optimistic locking handles concurrent order attempts gracefully
- Stock validation at both frontend and backend levels
- Real-time stock updates via WebSocket for admin panel

**Alternatives Considered**:

- Pessimistic locking: Could cause performance bottlenecks
- Event sourcing: Complexity not justified for straightforward inventory
- External inventory service: Adds network latency and complexity

### 9. Analytics Implementation

**Decision**: Aggregated daily tables with time-series queries  
**Rationale**:

- Pre-aggregated data provides fast dashboard performance
- PostgreSQL window functions enable efficient time-period calculations
- Daily batch jobs maintain data consistency
- Supports real-time updates for current day metrics

**Alternatives Considered**:

- Real-time analytics: Unnecessary complexity for daily/weekly/monthly reports
- External analytics service: Adds cost and data privacy concerns
- NoSQL analytics store: Relational data fits well in PostgreSQL

### 10. Deployment & Infrastructure

**Decision**: Docker containers with environment-based configuration  
**Rationale**:

- Consistent deployment across development and production environments
- Easy scaling of frontend and backend services independently
- Environment variables handle configuration differences
- Standard DevOps practices with CI/CD pipeline support

**Alternatives Considered**:

- Serverless functions: Cold start latency issues for real-time features
- Traditional server deployment: Less flexible for scaling requirements
- Kubernetes: Overkill for initial deployment, can migrate later if needed

## Implementation Priorities

### Phase 1: Core Infrastructure

1. Database schema with proper relationships and constraints
2. Basic Express API with authentication middleware
3. Frontend project setup with Redux Toolkit store structure
4. Core product browsing functionality

### Phase 2: Business Logic

1. Admin panel with customer and product management
2. Order creation flows (both custom and product-based)
3. Stock validation and inventory tracking
4. Messenger integration for customer consultation

### Phase 3: Advanced Features

1. Analytics dashboard with time-period filtering
2. Low stock alerts and notifications
3. Advanced product filtering and search
4. Performance optimization and caching

### Phase 4: Production Readiness

1. Comprehensive error handling and logging
2. Security hardening and rate limiting
3. E2E testing coverage for all user flows
4. Deployment automation and monitoring

## Risk Mitigation

### Technical Risks

- **Messenger API changes**: Use versioned API endpoints, implement fallback communication methods
- **Database performance**: Implement proper indexing, connection pooling, query optimization
- **Concurrent stock updates**: Database-level locking with retry logic and user feedback

### Business Risks

- **User experience without prices**: A/B testing for consultation conversion rates
- **Admin complexity**: Progressive disclosure in UI, comprehensive documentation
- **Scalability**: Monitor performance metrics, implement caching strategies

## Success Metrics

### Performance Targets

- Page load time: <2 seconds on 3G connection
- API response time: <500ms for 95th percentile
- Database query time: <100ms for product filtering
- Messenger integration: <1 second for redirect and message template

### Quality Targets

- Test coverage: >90% for business logic, >80% overall
- Accessibility: WCAG 2.1 AA compliance
- Browser support: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile responsiveness: All features functional on 320px+ screens

---

**Research Status**: ✅ Complete - All technical decisions documented and justified
