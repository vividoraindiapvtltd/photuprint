# Ecommerce Admin CMS Reports

Production-ready report endpoints. All reports are scoped by `X-Website-Id` (multi-tenant).  
**Base path:** `GET /api/reports/:reportId` with auth and tenant headers.

---

## Indexes (existing / recommended)

Ensure these exist for performance (Order model already has most):

- **Order:** `{ website: 1 }`, `{ createdAt: -1 }`, `{ paymentStatus: 1 }`, `{ orderStatus: 1 }`, `{ user: 1 }`, `{ deleted: 1, isActive: 1 }`
- **Order compound for report filters:** `{ website: 1, createdAt: -1, paymentStatus: 1 }`
- **User:** `{ website: 1, role: 1 }`, `{ createdAt: -1 }`
- **Product:** `{ website: 1 }`, `{ category: 1 }`
- **Category:** `{ website: 1 }`
- **Coupon:** `{ website: 1 }`

---

## 1. Sales & Revenue

### 1.1 Overall Sales Summary
- **Endpoint:** `GET /api/reports/sales-summary`
- **Query:** `startDate`, `endDate` (ISO)
- **Response:**
```json
{
  "totalRevenue": 125000.50,
  "totalOrders": 342,
  "averageOrderValue": 365.50,
  "totalDiscounts": 8200,
  "totalTax": 11250,
  "totalShipping": 5400,
  "totalRefunded": 2000,
  "netRevenue": 123000.50,
  "allOrdersCount": 350
}
```
- **Notes:** Revenue from `paymentStatus: 'paid'` only. Refunded deducted for net revenue.

### 1.2 Order-wise Sales (paginated)
- **Endpoint:** `GET /api/reports/order-wise-sales`
- **Query:** `startDate`, `endDate`, `orderStatus`, `paymentStatus`, `paymentMethod`, `page`, `limit`
- **Response:**
```json
{
  "data": [
    {
      "orderId": "...",
      "orderNumber": "ORD-12345678-0001",
      "customerName": "John",
      "customerEmail": "john@example.com",
      "totalAmount": 1999,
      "orderStatus": "delivered",
      "paymentMethod": "credit_card",
      "paymentStatus": "paid",
      "createdAt": "2025-02-01T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "totalCount": 100, "totalPages": 5 }
}
```

### 1.3 Product-wise Sales
- **Endpoint:** `GET /api/reports/product-wise-sales`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "data": [ { "productId", "productName", "sku", "unitsSold", "revenue", "returnCount" } ] }`
- **Notes:** From order line items; returns from orders with `orderStatus: 'returned'`.

### 1.4 Category-wise Sales
- **Endpoint:** `GET /api/reports/category-wise-sales`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "data": [ { "categoryId", "categoryName", "revenue", "unitsSold", "contributionPercent" } ], "totalRevenue" }`

---

## 2. Customer Reports

### 2.1 Customer Overview
- **Endpoint:** `GET /api/reports/customer-overview`
- **Query:** `startDate`, `endDate` (for new customers in period)
- **Response:** `{ "totalCustomers", "newCustomers?", "returningCustomers" }`

### 2.2 Customer Purchase Report (paginated)
- **Endpoint:** `GET /api/reports/customer-purchase`
- **Query:** `startDate`, `endDate`, `page`, `limit`
- **Response:** `{ "data": [ { "userId", "customerName", "customerEmail", "totalSpend", "totalOrders", "lastOrderDate", "averageOrderValue" } ], "pagination" }`

### 2.3 Customer Lifetime Value (CLV)
- **Endpoint:** `GET /api/reports/customer-lifetime-value`
- **Response:** `{ "data": [ { "userId", "customerName", "customerEmail", "clv", "orderCount", "averageOrderValue" } ], "description" }`
- **Notes:** CLV = sum of paid order totals per customer.

---

## 3. Product & Inventory

### 3.1 Inventory Stock Report
- **Endpoint:** `GET /api/reports/inventory-stock`
- **Query:** `reorderLevel` (default 10)
- **Response:** `{ "data": [ { "productId", "name", "sku", "currentStock", "lowStock", "reorderAlert", "reorderLevel" } ], "reorderLevel" }`

### 3.2 Inventory Valuation
- **Endpoint:** `GET /api/reports/inventory-valuation`
- **Response:** `{ "data": [ { "productId", "name", "sku", "stock", "unitPrice", "valuation" } ], "totalValuation" }`

---

## 4. Payment & Finance

### 4.1 Payment Method Report
- **Endpoint:** `GET /api/reports/payment-method`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "data": [ { "paymentMethod", "totalTransactions", "successfulTransactions", "failedTransactions", "refundedTransactions", "totalAmount", "successfulAmount" } ] }`

### 4.2 Refund & Cancellation
- **Endpoint:** `GET /api/reports/refund-cancellation`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "refunded": { "count", "totalAmount" }, "cancelled": { ... }, "returned": { ... }, "totalPaidRevenue", "netRevenueAfterRefunds", "impactNote" }`

### 4.3 Tax Report
- **Endpoint:** `GET /api/reports/tax`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "data": [ { "_id": "YYYY-MM-DD", "taxCollected", "orderCount", "totalAmount" } ], "totalTax" }`

---

## 5. Marketing

### 5.1 Coupon Usage
- **Endpoint:** `GET /api/reports/coupon-usage`
- **Query:** `startDate`, `endDate`
- **Response:** `{ "data": [ { "couponId", "code", "discountType", "discountValue", "usageCount", "revenueGenerated", "totalDiscountAmount" } ] }`

---

## 6. Shipping & Fulfillment

### 6.1 Shipping Performance
- **Endpoint:** `GET /api/reports/shipping-performance`
- **Response:** `{ "data": [ { "courierName", "orderCount", "averageDeliveryDays", "delayedShipments" } ], "averageDeliveryTimeDays", "totalDeliveredOrders" }`
- **Notes:** Uses `shipmentDate` and `estimatedDeliveryDate` on Order; delayed = delivery days > 7.

---

## 7. Admin Activity

### 7.1 Admin Activity Report
- **Endpoint:** `GET /api/reports/admin-activity`
- **Response:** Placeholder; returns `{ "data": [], "message": "..." }` until an AdminLog model is added.

---

## Performance Notes

- All report handlers use `req.websiteId` and exclude `deleted: true` (and `isActive: false` for orders where applicable).
- Date filters use `createdAt` on Order; indexes on `(website, createdAt)` keep aggregations fast.
- Paginated endpoints cap `limit` at 100; order-wise and customer-purchase use `$facet` for count + data in one round-trip.
- Product/category reports join with products/categories in aggregation or follow-up lookups; for very large datasets consider caching or materialized collections.
