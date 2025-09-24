# Quickstart Guide: Starbucks Cup E-commerce Website

**Feature**: 001-starbucks-website  
**Date**: September 11, 2025  
**Prerequisites**: Implementation plan complete, development environment set up

## Overview

This guide validates the core functionality of the Starbucks cup e-commerce website through key user scenarios. It covers customer product browsing, Messenger integration, and admin panel operations.

## Test Environment Setup

### Required Services

- **Database**: PostgreSQL with test data loaded
- **Cache**: Redis for session management
- **Messenger**: Facebook Messenger test app configured
- **Backend API**: Running on http://localhost:8080
- **Frontend App**: Running on http://localhost:3000

### Test Data Requirements

```sql
-- Minimum test data needed
INSERT INTO products (name, category, color, capacity, stock_quantity, images) VALUES
  ('Starbucks Tumbler Classic', 'Tumblers', 'White', 473, 10, '["https://example.com/img1.jpg"]'),
  ('Travel Mug Pro', 'Travel Cups', 'Black', 355, 3, '["https://example.com/img2.jpg"]'),
  ('Ceramic Mug Set', 'Mugs', 'Green', 296, 15, '["https://example.com/img3.jpg"]');

INSERT INTO admin_users (username, password_hash, email, role) VALUES
  ('admin', '$hashed_password', 'admin@test.com', 'admin');

INSERT INTO customers (phone, email, full_name) VALUES
  ('+84901234567', 'customer@test.com', 'Test Customer');
```

## Validation Scenarios

### Scenario 1: Customer Product Discovery

**Test the main customer journey from homepage to Messenger consultation**

#### Step 1.1: Homepage Hero Section

1. Navigate to `http://localhost:3000`
2. **Verify**: Homepage loads with white/black color scheme
3. **Verify**: Hero section displays Swiper component with product carousel
4. **Verify**: Swiper navigation works (arrows/dots/touch)
5. **Verify**: Featured products display without prices

**Expected Outcome**:

- Page loads in <2 seconds
- Swiper shows minimum 3 featured products
- No pricing information visible anywhere
- Responsive design works on mobile viewport

#### Step 1.2: Product Browsing and Filtering

1. Navigate to products page or click "Browse Products"
2. **Test Filter - Category**: Select "Tumblers" category
3. **Verify**: Product list updates to show only tumbler products
4. **Test Filter - Color**: Select "White" color filter
5. **Verify**: Results further filtered to white tumblers only
6. **Test Filter - Capacity**: Select capacity range filter
7. **Verify**: Results show products within selected capacity range
8. **Test Pagination**: Navigate through product pages if >20 items

**Expected Outcome**:

- Filters apply immediately without page refresh
- URL updates to reflect filter selections
- Product grid responsive on all screen sizes
- "No products found" message when no matches

#### Step 1.3: Product Detail View

1. Click on any product from the browsing results
2. **Verify**: Product detail page loads with complete information
3. **Verify**: Product images display in gallery format
4. **Verify**: Capacity, color, category clearly shown
5. **Verify**: Product description and specifications visible
6. **Verify**: "Add to Cart" and "Product Consultation" buttons present
7. **Verify**: No pricing information displayed

**Expected Outcome**:

- Page loads with full product details
- Image gallery functional (zoom/navigation)
- Stock status shown as "In Stock" or "Out of Stock"
- Consultation buttons prominently displayed

### Scenario 2: Messenger Integration

**Test cart functionality and Messenger redirection**

#### Step 2.1: Add Products to Cart

1. From product detail page, click "Add to Cart"
2. **Verify**: Product added to cart (state management)
3. **Verify**: Cart icon updates with item count
4. Navigate to another product and add to cart
5. **Verify**: Cart maintains multiple items
6. Click cart icon to view cart contents
7. **Verify**: All selected products listed without prices

**Expected Outcome**:

- Cart state persists across page navigation
- Redux store correctly manages cart items
- Cart displays product names, quantities, images
- No pricing calculations or totals shown

#### Step 2.2: Messenger Consultation from Cart

1. In cart view, click "Request Consultation"
2. **Verify**: Messenger redirect URL generated
3. **Verify**: Pre-filled message template includes all cart products
4. **Test Message Format**:
   ```
   Tôi muốn được tư vấn các sản phẩm sau:
   - Starbucks Tumbler Classic (1x) - [product_link]
   - Travel Mug Pro (2x) - [product_link]
   ```
5. **Verify**: Messenger opens with correct recipient and message

**Expected Outcome**:

- Redirect happens smoothly without errors
- Message template properly formatted in Vietnamese
- All cart items included with quantities and links
- Messenger app opens or web version loads

#### Step 2.3: Direct Product Consultation

1. From any product detail page, click "Product Consultation"
2. **Verify**: Messenger redirect for single product
3. **Verify**: Message template for individual product consultation
4. **Test Message Format**:
   ```
   Tôi muốn được tư vấn sản phẩm: Starbucks Tumbler Classic
   Link sản phẩm: [product_link]
   ```

**Expected Outcome**:

- Single product consultation message generated
- Product link directs back to detail page
- Message template follows consistent format

### Scenario 3: Admin Panel Operations

**Test administrative functionality for customer and order management**

#### Step 3.1: Admin Authentication

1. Navigate to `http://localhost:3000/admin`
2. **Verify**: Login form displayed (not admin content)
3. Enter invalid credentials
4. **Verify**: Authentication error message shown
5. Enter valid admin credentials (username: admin)
6. **Verify**: Successful login redirects to admin dashboard
7. **Verify**: Admin navigation menu visible

**Expected Outcome**:

- Unauthorized access blocked effectively
- Login form validates input fields
- JWT token stored securely (httpOnly cookie)
- Dashboard loads with navigation sidebar

#### Step 3.2: Customer Management

1. Navigate to Customer Management section
2. **Verify**: Customer list loads with pagination
3. Click "Create Customer" button
4. **Test Required Field**: Submit form without phone number
5. **Verify**: Validation error for required phone field
6. Fill form with valid data:
   - Phone: +84901234568
   - Email: newcust@test.com
   - Name: New Test Customer
   - Address: 123 Test St, Ward 1, District 1, Ho Chi Minh City
7. **Verify**: Customer created successfully
8. **Test Search**: Search for created customer by phone
9. **Verify**: Search results show correct customer

**Expected Outcome**:

- Form validation works for all required fields
- Phone number format validation enforced
- Customer creation adds to database
- Search functionality works across name/phone/email

#### Step 3.3: Order Creation - Product Order

1. Navigate to Order Management section
2. Click "Create Order" button
3. Select "Product Order" type
4. Select test customer from customer dropdown
5. Add products to order:
   - Select "Starbucks Tumbler Classic"
   - Quantity: 2
   - Unit Price: 450000 VND
6. **Test Stock Validation**: Try to order 20 items (exceeding stock of 10)
7. **Verify**: Stock validation error displayed
8. Adjust quantity to 2 (within stock limit)
9. Add shipping cost: 30000 VND
10. Check "Free Shipping" option
11. **Verify**: Shipping cost becomes 0
12. Submit order
13. **Verify**: Order created with stock reduced

**Expected Outcome**:

- Stock validation prevents overselling
- Free shipping option overrides shipping cost
- Order number generated automatically
- Product stock decreases by ordered quantity

#### Step 3.4: Order Creation - Custom Order

1. Click "Create Order" again
2. Select "Custom Order" type
3. Select customer
4. Enter custom description: "Special engraved tumbler set"
5. Set total amount: 800000 VND
6. Set shipping: 50000 VND
7. Submit order
8. **Verify**: Custom order created without product items
9. **Verify**: Description field saved correctly

**Expected Outcome**:

- Custom orders don't require product selection
- Free-form description accepts any text
- Total amount can be manually set
- Order appears in order list with "custom" type

### Scenario 4: Analytics Dashboard

**Test reporting and analytics functionality**

#### Step 4.1: Analytics Time Periods

1. Navigate to Analytics section
2. **Test Daily View**: Select "Day" period, choose today's date
3. **Verify**: Shows today's orders and revenue
4. **Test Weekly View**: Select "Week" period for current week
5. **Verify**: Aggregated data for 7-day period
6. **Test Monthly View**: Select "Month" period for current month
7. **Verify**: Monthly totals and trends displayed
8. **Test Custom Range**: Select date range spanning multiple months
9. **Verify**: Data aggregated correctly for custom period

**Expected Outcome**:

- Each time period shows appropriate data granularity
- Charts/graphs update based on selected period
- Revenue calculations include all completed orders
- Product count reflects actual quantities sold

#### Step 4.2: Low Stock Alerts

1. In Analytics section, navigate to "Low Stock Alerts"
2. **Verify**: Products with stock < 5 displayed
3. **Verify**: "Travel Mug Pro" (stock: 3) appears in alerts
4. **Verify**: Alert shows current stock and recommended action
5. Change stock threshold to 10 in settings
6. **Verify**: More products appear in low stock list

**Expected Outcome**:

- Alert threshold configurable
- Real-time stock levels displayed
- Clear indicators for out-of-stock vs low-stock
- Links to product management for restocking

## Performance Validation

### Load Time Measurements

- **Homepage**: < 2 seconds on 3G connection
- **Product listing**: < 1.5 seconds with 20 products
- **Product detail**: < 1 second
- **Admin dashboard**: < 2 seconds after authentication

### API Response Times

- **GET /api/v1/products**: < 500ms
- **POST /api/v1/admin/orders**: < 800ms
- **GET /api/v1/admin/analytics**: < 1200ms
- **POST /api/v1/cart/messenger-redirect**: < 300ms

**Response Format Validation**:
All API responses must follow the standardized structure:

```json
{
  "success": true,
  "data": {}, // Main response data
  "meta": {}, // Metadata: pagination, timestamps, etc.
  "error": null // Error object when success is false
}
```

### Accessibility Validation

- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader**: ARIA labels present for complex UI components
- **Color Contrast**: Meets WCAG AA standards for white/black theme
- **Mobile Responsiveness**: All features functional on 320px viewport

## Troubleshooting Common Issues

### Messenger Integration Failures

- **Issue**: Redirect fails or messenger doesn't open
- **Check**: Messenger app configuration and webhook setup
- **Fix**: Verify Facebook app permissions and test environment settings

### Stock Validation Errors

- **Issue**: Orders accepted despite insufficient stock
- **Check**: Database transaction isolation and concurrent order handling
- **Fix**: Implement row-level locking on product stock updates

### Performance Issues

- **Issue**: Slow dashboard loading with large datasets
- **Check**: Database query optimization and index usage
- **Fix**: Implement data pagination and query result caching

### Authentication Problems

- **Issue**: Admin login fails or sessions expire unexpectedly
- **Check**: JWT token configuration and refresh token rotation
- **Fix**: Verify token expiration settings and cookie security flags

## Success Criteria Checklist

### Customer Experience

- [ ] Homepage loads with functional Swiper hero section
- [ ] Product browsing works with all filter combinations
- [ ] No pricing information visible to customers
- [ ] Messenger integration generates correct consultation messages
- [ ] Cart state management persists across browser sessions

### Admin Operations

- [ ] Authentication prevents unauthorized access
- [ ] Customer creation validates required phone field
- [ ] Product orders validate stock availability
- [ ] Custom orders accept free-form descriptions
- [ ] Order status updates reflect in dashboard

### Analytics & Reporting

- [ ] Daily, weekly, monthly analytics display correct data
- [ ] Low stock alerts trigger at configurable thresholds
- [ ] Revenue calculations include all order types
- [ ] Time-series data charts render correctly

### Technical Performance

- [ ] All pages load within performance targets
- [ ] API responses meet SLA requirements
- [ ] Database queries execute efficiently
- [ ] Accessibility standards met across all interfaces

---

**Quickstart Status**: ✅ Complete - All validation scenarios documented and testable
