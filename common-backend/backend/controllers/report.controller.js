/**
 * Ecommerce Reports Controller
 * Production-ready report endpoints using MongoDB aggregations.
 * All reports are scoped by req.websiteId (multi-tenant).
 * Date filters: startDate, endDate (ISO string). Pagination: page, limit.
 */
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import Coupon from '../models/coupon.model.js';
import Tracking from '../models/tracking.model.js';

const getBaseOrderMatch = (websiteId, options = {}) => {
  const match = {
    website: websiteId,
    deleted: false,
    isActive: options.includeInactive !== true,
  };
  if (options.startDate || options.endDate) {
    match.createdAt = {};
    if (options.startDate) match.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) match.createdAt.$lte = new Date(options.endDate);
  }
  if (options.orderStatus) match.orderStatus = options.orderStatus;
  if (options.paymentStatus) match.paymentStatus = options.paymentStatus;
  if (options.paymentMethod) match.paymentMethod = options.paymentMethod;
  return match;
};

const parsePagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

// ---------- 1. Sales & Revenue ----------

/**
 * 1. Overall Sales Summary
 * Metrics: total revenue, total orders, AOV, total discounts, total tax, net revenue.
 */
export const getSalesSummary = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    // Paid orders only for revenue; include cancelled/refunded for counts if needed
    const paidMatch = { ...match, paymentStatus: 'paid' };

    const [summary] = await Order.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: '$discount' },
          totalTax: { $sum: '$tax' },
          totalShipping: { $sum: '$shippingCharges' },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalOrders: 1,
          totalDiscount: 1,
          totalTax: 1,
          totalShipping: 1,
          averageOrderValue: { $cond: [{ $eq: ['$totalOrders', 0] }, 0, { $divide: ['$totalRevenue', '$totalOrders'] }] },
        },
      },
    ]);

    const allOrdersCount = await Order.countDocuments(match);
    const refundedMatch = { ...match, paymentStatus: 'refunded' };
    const refundedAgg = await Order.aggregate([
      { $match: refundedMatch },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRefunded = refundedAgg[0]?.total ?? 0;

    res.json({
      totalRevenue: summary?.totalRevenue ?? 0,
      totalOrders: summary?.totalOrders ?? 0,
      averageOrderValue: summary?.averageOrderValue ?? 0,
      totalDiscounts: summary?.totalDiscount ?? 0,
      totalTax: summary?.totalTax ?? 0,
      totalShipping: summary?.totalShipping ?? 0,
      totalRefunded,
      netRevenue: (summary?.totalRevenue ?? 0) - totalRefunded,
      allOrdersCount,
    });
  } catch (error) {
    console.error('Report getSalesSummary error:', error);
    res.status(500).json({ msg: 'Failed to fetch sales summary' });
  }
};

/**
 * 2. Order-wise Sales Report (paginated)
 * Filters: date range, orderStatus, paymentStatus, paymentMethod.
 */
export const getOrderWiseSales = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate, orderStatus, paymentStatus, paymentMethod } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const match = getBaseOrderMatch(websiteId, { startDate, endDate, orderStatus, paymentStatus, paymentMethod });

    const [result] = await Order.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDoc',
                pipeline: [{ $project: { name: 1, email: 1 } }],
              },
            },
            { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                orderId: '$_id',
                orderNumber: 1,
                customerName: '$userDoc.name',
                customerEmail: '$userDoc.email',
                totalAmount: 1,
                orderStatus: 1,
                paymentMethod: 1,
                paymentStatus: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const totalCount = result.totalCount[0]?.count ?? 0;
    res.json({
      data: result.data,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Report getOrderWiseSales error:', error);
    res.status(500).json({ msg: 'Failed to fetch order-wise sales' });
  }
};

/**
 * 3. Product-wise Sales Report
 * From order line items: units sold, revenue, return count (orders with orderStatus returned).
 */
export const getProductWiseSales = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    match.paymentStatus = 'paid';
    const returnMatch = { ...match, orderStatus: 'returned' };

    const productSales = await Order.aggregate([
      { $match: match },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          unitsSold: { $sum: '$products.quantity' },
          revenue: { $sum: '$products.subtotal' },
        },
      },
      { $match: { _id: { $ne: null } } },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDoc',
          pipeline: [{ $project: { name: 1, sku: 1 } }],
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      { $sort: { revenue: -1 } },
      {
        $project: {
          productId: '$_id',
          productName: '$productDoc.name',
          sku: '$productDoc.sku',
          unitsSold: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    const returnCounts = await Order.aggregate([
      { $match: returnMatch },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', returnQty: { $sum: '$products.quantity' } } },
    ]);
    const returnMap = Object.fromEntries(returnCounts.map((r) => [r._id?.toString(), r.returnQty]));

    const withReturns = productSales.map((row) => ({
      ...row,
      productId: row.productId?.toString?.() ?? row.productId,
      returnCount: returnMap[row.productId?.toString?.() ?? row.productId] ?? 0,
    }));

    res.json({ data: withReturns });
  } catch (error) {
    console.error('Report getProductWiseSales error:', error);
    res.status(500).json({ msg: 'Failed to fetch product-wise sales' });
  }
};

/**
 * 4. Category-wise Sales Report
 * Aggregation by category, % contribution to total sales.
 */
export const getCategoryWiseSales = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    match.paymentStatus = 'paid';

    const withProduct = await Order.aggregate([
      { $match: match },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'p',
          pipeline: [{ $project: { category: 1 } }],
        },
      },
      { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$p.category',
          revenue: { $sum: '$products.subtotal' },
          unitsSold: { $sum: '$products.quantity' },
        },
      },
      { $match: { _id: { $ne: null } } },
    ]);

    const totalRevenue = withProduct.reduce((s, r) => s + r.revenue, 0);
    const withCategoryName = await Promise.all(
      withProduct.map(async (row) => {
        const cat = await Category.findById(row._id).select('name').lean();
        return {
          categoryId: row._id,
          categoryName: cat?.name ?? 'Unknown',
          revenue: row.revenue,
          unitsSold: row.unitsSold,
          contributionPercent: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
        };
      })
    );
    withCategoryName.sort((a, b) => b.revenue - a.revenue);
    res.json({ data: withCategoryName, totalRevenue });
  } catch (error) {
    console.error('Report getCategoryWiseSales error:', error);
    res.status(500).json({ msg: 'Failed to fetch category-wise sales' });
  }
};

// ---------- 2. Customer Reports ----------

/**
 * 5. Customer Overview Report
 * Total customers, new (in period), returning (more than one order).
 */
export const getCustomerOverview = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const baseUserQuery = { website: websiteId, deleted: false, role: 'customer' };
    const totalCustomers = await User.countDocuments(baseUserQuery);

    let newCustomers = totalCustomers;
    if (startDate || endDate) {
      const dateQ = {};
      if (startDate) dateQ.$gte = new Date(startDate);
      if (endDate) dateQ.$lte = new Date(endDate);
      newCustomers = await User.countDocuments({ ...baseUserQuery, createdAt: dateQ });
    }

    const orderCounts = await Order.aggregate([
      { $match: { website: websiteId, deleted: false } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'returning' },
    ]);
    const returningCustomers = orderCounts[0]?.returning ?? 0;

    res.json({
      totalCustomers,
      newCustomers: startDate || endDate ? newCustomers : undefined,
      returningCustomers,
    });
  } catch (error) {
    console.error('Report getCustomerOverview error:', error);
    res.status(500).json({ msg: 'Failed to fetch customer overview' });
  }
};

/**
 * 6. Customer Purchase Report
 * Per-customer: total spend, total orders, last order date, AOV.
 */
export const getCustomerPurchaseReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    match.paymentStatus = 'paid';

    const [facetResult] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$user',
          totalSpend: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          lastOrderDate: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          totalSpend: 1,
          totalOrders: 1,
          lastOrderDate: 1,
          averageOrderValue: { $divide: ['$totalSpend', '$totalOrders'] },
        },
      },
      { $sort: { totalSpend: -1 } },
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const totalCount = facetResult.totalCount[0]?.count ?? 0;
    const userIds = (facetResult.data ?? []).map((d) => d._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const data = (facetResult.data ?? []).map((row) => ({
      userId: row._id,
      customerName: userMap[row._id?.toString()]?.name,
      customerEmail: userMap[row._id?.toString()]?.email,
      totalSpend: row.totalSpend,
      totalOrders: row.totalOrders,
      lastOrderDate: row.lastOrderDate,
      averageOrderValue: row.averageOrderValue,
    }));

    res.json({
      data,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Report getCustomerPurchaseReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch customer purchase report' });
  }
};

/**
 * 7. Customer Lifetime Value (CLV)
 * CLV = total spend per customer (we use sum of paid order totals).
 */
export const getCustomerLifetimeValue = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const match = getBaseOrderMatch(websiteId);
    match.paymentStatus = 'paid';

    const clvAgg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$user',
          totalSpend: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 500 },
    ]);

    const userIds = clvAgg.map((r) => r._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const data = clvAgg.map((row) => ({
      userId: row._id,
      customerName: userMap[row._id?.toString()]?.name,
      customerEmail: userMap[row._id?.toString()]?.email,
      clv: row.totalSpend,
      orderCount: row.orderCount,
      averageOrderValue: row.avgOrderValue,
    }));

    res.json({ data, description: 'CLV = total spend (paid orders) per customer' });
  } catch (error) {
    console.error('Report getCustomerLifetimeValue error:', error);
    res.status(500).json({ msg: 'Failed to fetch CLV report' });
  }
};

// ---------- 3. Product & Inventory ----------

/**
 * 8. Inventory Stock Report
 * Current stock, low stock flag (stock <= threshold), reorder alert.
 */
export const getInventoryStockReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const reorderLevel = Math.max(0, parseInt(req.query.reorderLevel, 10) || 10);

    const products = await Product.find({
      website: websiteId,
      deleted: false,
      $or: [{ stock: { $exists: true } }, { stock: 0 }],
    })
      .select('name sku stock')
      .sort({ stock: 1 })
      .lean();

    const data = products.map((p) => ({
      productId: p._id,
      name: p.name,
      sku: p.sku,
      currentStock: p.stock ?? 0,
      lowStock: (p.stock ?? 0) <= reorderLevel,
      reorderAlert: (p.stock ?? 0) <= reorderLevel,
      reorderLevel,
    }));

    res.json({ data, reorderLevel });
  } catch (error) {
    console.error('Report getInventoryStockReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch inventory stock report' });
  }
};

/**
 * 9. Inventory Valuation Report
 * Total inventory value (stock * price), product-wise. Product model has no cost_price.
 */
export const getInventoryValuation = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;

    const products = await Product.find({
      website: websiteId,
      deleted: false,
    })
      .select('name sku price stock')
      .lean();

    const data = products.map((p) => {
      const stock = p.stock ?? 0;
      const price = p.price ?? 0;
      return {
        productId: p._id,
        name: p.name,
        sku: p.sku,
        stock,
        unitPrice: price,
        valuation: stock * price,
      };
    });
    const totalValuation = data.reduce((s, r) => s + r.valuation, 0);
    data.sort((a, b) => b.valuation - a.valuation);

    res.json({ data, totalValuation });
  } catch (error) {
    console.error('Report getInventoryValuation error:', error);
    res.status(500).json({ msg: 'Failed to fetch inventory valuation' });
  }
};

// ---------- 4. Payment & Finance ----------

/**
 * 10. Payment Method Report
 * Transactions per payment method, success vs failed (paid vs failed/refunded/cancelled).
 */
export const getPaymentMethodReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });

    const byMethod = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          totalCount: { $sum: 1 },
          successfulCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $in: ['$paymentStatus', ['failed', 'cancelled']] }, 1, 0] } },
          refundedCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, 1, 0] } },
          totalAmount: { $sum: '$totalAmount' },
          successfulAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
        },
      },
      { $sort: { totalCount: -1 } },
    ]);

    res.json({
      data: byMethod.map((r) => ({
        paymentMethod: r._id ?? 'other',
        totalTransactions: r.totalCount,
        successfulTransactions: r.successfulCount,
        failedTransactions: r.failedCount,
        refundedTransactions: r.refundedCount,
        totalAmount: r.totalAmount,
        successfulAmount: r.successfulAmount,
      })),
    });
  } catch (error) {
    console.error('Report getPaymentMethodReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch payment method report' });
  }
};

/**
 * 11. Refund & Cancellation Report
 * Refund amount, reason (we use paymentStatus/orderStatus), impact on revenue.
 */
export const getRefundCancellationReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });

    const refunded = await Order.aggregate([
      { $match: { ...match, paymentStatus: 'refunded' } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const cancelled = await Order.aggregate([
      { $match: { ...match, orderStatus: 'cancelled' } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const returned = await Order.aggregate([
      { $match: { ...match, orderStatus: 'returned' } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    const paidRevenue = await Order.aggregate([
      { $match: { ...match, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalPaidRevenue = paidRevenue[0]?.total ?? 0;
    const totalRefunded = refunded[0]?.totalAmount ?? 0;
    const totalCancelled = cancelled[0]?.totalAmount ?? 0;

    res.json({
      refunded: {
        count: refunded[0]?.count ?? 0,
        totalAmount: totalRefunded,
      },
      cancelled: {
        count: cancelled[0]?.count ?? 0,
        totalAmount: totalCancelled,
      },
      returned: {
        count: returned[0]?.count ?? 0,
        totalAmount: returned[0]?.totalAmount ?? 0,
      },
      totalPaidRevenue,
      netRevenueAfterRefunds: totalPaidRevenue - totalRefunded,
      impactNote: 'Refunds reduce net revenue. Cancelled orders are not paid.',
    });
  } catch (error) {
    console.error('Report getRefundCancellationReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch refund report' });
  }
};

/**
 * 12. Tax Report
 * Tax collected by date (daily), order-level optional.
 */
export const getTaxReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    match.paymentStatus = 'paid';

    const byDate = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          taxCollected: { $sum: '$tax' },
          orderCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalTax = byDate.reduce((s, r) => s + r.taxCollected, 0);
    res.json({ data: byDate, totalTax });
  } catch (error) {
    console.error('Report getTaxReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch tax report' });
  }
};

// ---------- 5. Marketing ----------

/**
 * 13. Coupon Usage Report
 * Coupon usage count, revenue from orders using coupon, discount amount.
 */
export const getCouponUsageReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const { startDate, endDate } = req.query;
    const match = getBaseOrderMatch(websiteId, { startDate, endDate });
    match.paymentStatus = 'paid';
    match.couponId = { $ne: null };

    const byCoupon = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$couponId',
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discount' },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { usageCount: -1 } },
    ]);

    const couponIds = byCoupon.map((r) => r._id).filter(Boolean);
    const coupons = await Coupon.find({ _id: { $in: couponIds } }).select('code discountType discountValue').lean();
    const couponMap = Object.fromEntries(coupons.map((c) => [c._id.toString(), c]));

    const data = byCoupon.map((r) => ({
      couponId: r._id,
      code: couponMap[r._id?.toString()]?.code,
      discountType: couponMap[r._id?.toString()]?.discountType,
      discountValue: couponMap[r._id?.toString()]?.discountValue,
      usageCount: r.usageCount,
      revenueGenerated: r.totalRevenue,
      totalDiscountAmount: r.totalDiscount,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Report getCouponUsageReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch coupon usage report' });
  }
};

// ---------- 6. Shipping & Fulfillment ----------

/**
 * 14. Shipping Performance Report
 * Average delivery time (shipmentDate to delivered or estimatedDeliveryDate), courier-wise, delayed count.
 */
export const getShippingPerformanceReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    const websiteId = req.websiteId;
    const match = getBaseOrderMatch(websiteId);
    match.orderStatus = 'delivered';
    match.shipmentDate = { $ne: null };

    const orders = await Order.find(match)
      .select('shipmentDate estimatedDeliveryDate courierName createdAt orderStatus')
      .lean();

    const withDeliveryDays = orders.map((o) => {
      const shipped = o.shipmentDate ? new Date(o.shipmentDate) : null;
      const delivered = o.estimatedDeliveryDate ? new Date(o.estimatedDeliveryDate) : null;
      const days = shipped && delivered ? (delivered - shipped) / (24 * 60 * 60 * 1000) : null;
      return {
        orderId: o._id,
        courierName: o.courierName ?? 'Unknown',
        shipmentDate: o.shipmentDate,
        estimatedDeliveryDate: o.estimatedDeliveryDate,
        deliveryDays: days != null ? Math.round(days * 10) / 10 : null,
      };
    });

    const byCourier = {};
    withDeliveryDays.forEach((row) => {
      const c = row.courierName;
      if (!byCourier[c]) byCourier[c] = { courierName: c, orders: 0, totalDays: 0, delayed: 0 };
      byCourier[c].orders += 1;
      if (row.deliveryDays != null) {
        byCourier[c].totalDays += row.deliveryDays;
      }
      if (row.deliveryDays != null && row.deliveryDays > 7) byCourier[c].delayed += 1;
    });

    const data = Object.values(byCourier).map((r) => ({
      courierName: r.courierName,
      orderCount: r.orders,
      averageDeliveryDays: r.orders ? Math.round((r.totalDays / r.orders) * 10) / 10 : null,
      delayedShipments: r.delayed,
    }));

    const overallAvg =
      withDeliveryDays.filter((r) => r.deliveryDays != null).length > 0
        ? withDeliveryDays.reduce((s, r) => s + (r.deliveryDays ?? 0), 0) /
          withDeliveryDays.filter((r) => r.deliveryDays != null).length
        : null;

    res.json({
      data,
      averageDeliveryTimeDays: overallAvg != null ? Math.round(overallAvg * 10) / 10 : null,
      totalDeliveredOrders: orders.length,
    });
  } catch (error) {
    console.error('Report getShippingPerformanceReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch shipping performance report' });
  }
};

// ---------- 7. Admin Activity ----------

/**
 * 15. Admin Activity Report
 * No admin_logs collection in current schema; return placeholder. Can be extended when audit log is added.
 */
export const getAdminActivityReport = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: 'Website context is required' });
    res.json({
      data: [],
      message: 'Admin activity audit log is not implemented. Add an AdminLog model and record actions to enable this report.',
    });
  } catch (error) {
    console.error('Report getAdminActivityReport error:', error);
    res.status(500).json({ msg: 'Failed to fetch admin activity report' });
  }
};
