import express from 'express';
import {
  getSalesSummary,
  getOrderWiseSales,
  getProductWiseSales,
  getCategoryWiseSales,
  getCustomerOverview,
  getCustomerPurchaseReport,
  getCustomerLifetimeValue,
  getInventoryStockReport,
  getInventoryValuation,
  getPaymentMethodReport,
  getRefundCancellationReport,
  getTaxReport,
  getCouponUsageReport,
  getShippingPerformanceReport,
  getAdminActivityReport,
} from '../controllers/report.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';
import { resolveTenantFromHeader, requireTenant } from '../middlewares/tenant.middleware.js';

const router = express.Router();

router.use(protect);
router.use(resolveTenantFromHeader);
router.use(requireTenant);
router.use(adminOnly);

// Sales & Revenue
router.get('/sales-summary', getSalesSummary);
router.get('/order-wise-sales', getOrderWiseSales);
router.get('/product-wise-sales', getProductWiseSales);
router.get('/category-wise-sales', getCategoryWiseSales);

// Customer
router.get('/customer-overview', getCustomerOverview);
router.get('/customer-purchase', getCustomerPurchaseReport);
router.get('/customer-lifetime-value', getCustomerLifetimeValue);

// Product & Inventory
router.get('/inventory-stock', getInventoryStockReport);
router.get('/inventory-valuation', getInventoryValuation);

// Payment & Finance
router.get('/payment-method', getPaymentMethodReport);
router.get('/refund-cancellation', getRefundCancellationReport);
router.get('/tax', getTaxReport);

// Marketing
router.get('/coupon-usage', getCouponUsageReport);

// Shipping
router.get('/shipping-performance', getShippingPerformanceReport);

// Admin Activity
router.get('/admin-activity', getAdminActivityReport);

export default router;
