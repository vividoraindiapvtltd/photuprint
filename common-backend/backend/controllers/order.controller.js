import mongoose from "mongoose"
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import { enhanceOrderProductsWithVolumePricing } from '../utils/orderCheckoutRecalc.js';
import * as walletLedger from "../services/walletLedger.service.js"
import * as cashbackService from "../services/cashback.service.js"

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

// Get all orders
export const getOrders = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const { search, showInactive, includeDeleted, paymentStatus, orderStatus, userId } = req.query;
    let query = {
      website: req.websiteId, // Filter by tenant website
    };

    // Filter by active status
    if (showInactive !== 'true') {
      query.isActive = true;
    }

    // Filter deleted items
    if (includeDeleted !== 'true') {
      query.deleted = false;
    }

    // Filter by payment status
    if (paymentStatus && ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    // Filter by order status
    if (orderStatus && ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'].includes(orderStatus)) {
      query.orderStatus = orderStatus;
    }

    // Filter by user
    if (userId) {
      query.user = userId;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } },
        { trackingNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('products.product', 'name images price')
      .populate('couponId', 'code discountType discountValue')
      .populate('website', 'name domain')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ msg: 'Failed to fetch orders' });
  }
};

// Get current user's orders (for profile / account page)
export const getMyOrders = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return res.status(401).json({ msg: "Not authorized" })
    }
    const orders = await Order.find({
      user: userId,
      website: req.websiteId,
      deleted: false,
    })
      .populate("products.product", "name images price")
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    console.error("Error fetching my orders:", error)
    res.status(500).json({ msg: "Failed to fetch orders" })
  }
}

// Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const order = await Order.findOne({ _id: req.params.id, website: req.websiteId })
      .populate('user', 'name email phone address picture')
      .populate('products.product', 'name images price description')
      .populate('couponId', 'code discountType discountValue')
      .populate('website', 'name domain');
    
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ msg: 'Failed to fetch order' });
  }
};

// Create new order
export const createOrder = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
      user,
      products,
      subtotal,
      tax,
      shippingCharges,
      discount,
      couponCode,
      couponId,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentStatus,
      orderStatus,
      courierName,
      courierServiceType,
      trackingNumber,
      trackingUrl,
      shipmentDate,
      estimatedDeliveryDate,
      notes,
      website,
      salesAgent,
      walletAmountApplied,
      walletDebitIdempotencyKey,
      otherPaymentAmount,
    } = req.body;

    // Validation
    if (!user) {
      return res.status(400).json({ msg: 'User is required' });
    }

    // Verify user exists
    const userExists = await User.findById(user);
    if (!userExists) {
      return res.status(400).json({ msg: 'User not found' });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ msg: 'At least one product is required' });
    }

    // Validate products
    for (const item of products) {
      if (!item.product) {
        return res.status(400).json({ msg: 'Product ID is required for all items' });
      }
      if (!item.quantity || item.quantity < 1) {
        return res.status(400).json({ msg: 'Valid quantity is required for all items' });
      }
    }

    // Validate shipping address - all required fields
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.street || 
        !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode || 
        !shippingAddress.country) {
      return res.status(400).json({ 
        msg: 'Complete shipping address is required (name, street, city, state, zip code, and country)' 
      });
    }

    let enhancedProducts;
    let calculatedSubtotal;
    try {
      const vol = await enhanceOrderProductsWithVolumePricing(products, req.websiteId);
      enhancedProducts = vol.products;
      calculatedSubtotal = vol.subtotal;
    } catch (volErr) {
      console.error('Volume pricing / catalog error:', volErr);
      return res.status(400).json({ msg: volErr.message || 'Failed to price order lines' });
    }

    const finalTax = tax || 0;
    const finalShipping = shippingCharges || 0;
    const finalDiscount = discount || 0;

    const calculatedTotal = calculatedSubtotal + finalTax + finalShipping - finalDiscount;

    const wa = roundMoney(Number(walletAmountApplied) || 0)
    if (wa < 0 || wa > roundMoney(calculatedTotal)) {
      return res.status(400).json({ msg: "walletAmountApplied must be between 0 and order total" })
    }
    if (wa > 0 && !walletDebitIdempotencyKey) {
      return res.status(400).json({ msg: "walletDebitIdempotencyKey is required when using wallet" })
    }

    const orderPayload = {
      user,
      products: enhancedProducts,
      subtotal: calculatedSubtotal,
      tax: finalTax,
      shippingCharges: finalShipping,
      discount: finalDiscount,
      couponCode: couponCode || null,
      couponId: couponId || null,
      totalAmount: calculatedTotal,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod: paymentMethod || 'credit_card',
      paymentStatus: paymentStatus || 'pending',
      orderStatus: orderStatus || 'pending',
      courierName: courierName || null,
      courierServiceType: courierServiceType || null,
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingUrl || null,
      shipmentDate: shipmentDate ? new Date(shipmentDate) : null,
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
      notes: notes || null,
      isActive: true,
      deleted: false,
      website: website || req.websiteId,
      salesAgent: salesAgent || null,
      walletAmountApplied: wa,
      otherPaymentAmount: otherPaymentAmount != null ? roundMoney(otherPaymentAmount) : null,
      walletDebitIdempotencyKey: wa > 0 ? String(walletDebitIdempotencyKey) : null,
    }

    let savedOrder
    if (wa > 0) {
      const session = await mongoose.startSession()
      session.startTransaction()
      try {
        const [doc] = await Order.create([orderPayload], { session })
        await walletLedger.debitWallet({
          userId: user,
          websiteId: req.websiteId,
          amount: wa,
          idempotencyKey: String(walletDebitIdempotencyKey),
          reason: "wallet_order_payment",
          orderId: doc._id,
          session,
        })
        await session.commitTransaction()
        savedOrder = doc
      } catch (e) {
        await session.abortTransaction()
        if (e.message?.includes("Insufficient")) {
          return res.status(400).json({ msg: e.message })
        }
        throw e
      } finally {
        session.endSession()
      }
    } else {
      savedOrder = await new Order(orderPayload).save()
    }

    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('user', 'name email phone')
      .populate('products.product', 'name images price')
      .populate('couponId', 'code discountType discountValue');

    // Schedule product review email 1 day after order (non-blocking)
    const orderObj = populatedOrder?.toObject ? { ...populatedOrder.toObject(), user: populatedOrder.user } : populatedOrder
    scheduleReviewEmail(orderObj).catch((err) => console.error("[createOrder] Review email schedule error:", err.message))

    res.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    // Handle duplicate key error (orderNumber already exists for this website)
    if (error.code === 11000) {
      // Try to create again with a new order number (retry once)
      try {
        // The pre-validate hook will generate a new order number
        const retryOrder = new Order({
          user,
          products: enhancedProducts,
          subtotal: calculatedSubtotal,
          tax: finalTax,
          shippingCharges: finalShipping,
          discount: finalDiscount,
          couponCode: couponCode || null,
          couponId: couponId || null,
          totalAmount: calculatedTotal,
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          paymentMethod: paymentMethod || 'credit_card',
          paymentStatus: paymentStatus || 'pending',
          orderStatus: orderStatus || 'pending',
          courierName: courierName || null,
          courierServiceType: courierServiceType || null,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
          shipmentDate: shipmentDate ? new Date(shipmentDate) : null,
          estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
          notes: notes || null,
          isActive: true,
          deleted: false,
          website: website || req.websiteId
        });
        const savedRetryOrder = await retryOrder.save();
        const populatedRetryOrder = await Order.findById(savedRetryOrder._id)
          .populate('user', 'name email phone')
          .populate('products.product', 'name images price')
          .populate('couponId', 'code discountType discountValue');
        return res.status(201).json(populatedRetryOrder);
      } catch (retryError) {
        return res.status(400).json({ 
          msg: 'Order number conflict. Please try again.' 
        });
      }
    }
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({ 
        msg: `Order validation failed: ${validationErrors}` 
      });
    }
    res.status(500).json({ msg: `Failed to create order: ${error.message || error}` });
  }
};

// Update order
export const updateOrder = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const {
    products,
      subtotal,
      tax,
      shippingCharges,
      discount,
      couponCode,
      couponId,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentStatus,
      orderStatus,
      courierName,
      courierServiceType,
      trackingNumber,
      trackingUrl,
      shipmentDate,
      estimatedDeliveryDate,
      notes,
      adminNotes,
      isActive,
      deleted
    } = req.body;

    const order = await Order.findOne({ _id: req.params.id, website: req.websiteId });
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    const prevStatus = order.orderStatus
    const prevPayment = order.paymentStatus

    // Update products if provided
    if (products && Array.isArray(products)) {
      for (const item of products) {
        if (item.product && (!item.quantity || item.quantity < 1)) {
          return res.status(400).json({ msg: 'Valid quantity is required for all items' });
        }
      }
      try {
        const vol = await enhanceOrderProductsWithVolumePricing(products, req.websiteId);
        order.products = vol.products;
        order.subtotal = vol.subtotal;
      } catch (volErr) {
        console.error('Volume pricing / catalog error:', volErr);
        return res.status(400).json({ msg: volErr.message || 'Failed to price order lines' });
      }
    }

    // Update fields
    if (subtotal !== undefined) order.subtotal = Number(subtotal) || 0;
    if (tax !== undefined) order.tax = Number(tax) || 0;
    if (shippingCharges !== undefined) order.shippingCharges = Number(shippingCharges) || 0;
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (couponCode !== undefined) order.couponCode = couponCode || null;
    if (couponId !== undefined) order.couponId = couponId || null;
    if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;
    if (billingAddress !== undefined) order.billingAddress = billingAddress;
    if (paymentMethod !== undefined) order.paymentMethod = paymentMethod;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
    if (orderStatus !== undefined) order.orderStatus = orderStatus;
    if (courierName !== undefined) order.courierName = courierName || null;
    if (courierServiceType !== undefined) order.courierServiceType = courierServiceType || null;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber || null;
    if (trackingUrl !== undefined) order.trackingUrl = trackingUrl || null;
    if (shipmentDate !== undefined) {
      order.shipmentDate = shipmentDate ? new Date(shipmentDate) : null;
    }
    if (estimatedDeliveryDate !== undefined) {
      order.estimatedDeliveryDate = estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null;
    }
    if (notes !== undefined) order.notes = notes || null;
    if (adminNotes !== undefined) order.adminNotes = adminNotes || null;
    if (isActive !== undefined) order.isActive = Boolean(isActive);
    if (deleted !== undefined) order.deleted = Boolean(deleted);

    // Recalculate total amount
    order.totalAmount = order.subtotal + order.tax + order.shippingCharges - order.discount;

    const updatedOrder = await order.save();

    try {
      if (prevStatus !== "delivered" && order.orderStatus === "delivered") {
        await cashbackService.creditCashbackOnDelivered(order._id)
      }
      if (prevPayment !== "refunded" && order.paymentStatus === "refunded") {
        await cashbackService.reverseCashbackForOrder(order._id)
        const wa = roundMoney(order.walletAmountApplied || 0)
        if (wa > 0) {
          await walletLedger.creditWallet({
            userId: order.user,
            websiteId: order.websiteId,
            amount: wa,
            idempotencyKey: `wallet:refund:order:${order._id}`,
            reason: "wallet_order_refund",
            orderId: order._id,
          })
        }
      }
      if (prevStatus !== "returned" && order.orderStatus === "returned") {
        await cashbackService.reverseCashbackForOrder(order._id)
      }
    } catch (hookErr) {
      console.error("Wallet/cashback hook:", hookErr)
    }

    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate('user', 'name email phone')
      .populate('products.product', 'name images price')
      .populate('couponId', 'code discountType discountValue');

    res.json(populatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ msg: 'Failed to update order' });
  }
};

// Cancel own order (user can set orderStatus to cancelled if pending or confirmed)
export const cancelMyOrder = async (req, res) => {
  try {
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return res.status(401).json({ msg: "Not authorized" })
    }
    const order = await Order.findOne({
      _id: req.params.id,
      website: req.websiteId,
      user: userId,
      deleted: false,
    })
    if (!order) {
      return res.status(404).json({ msg: "Order not found" })
    }
    const allowedToCancel = ["pending", "confirmed"].includes(order.orderStatus)
    if (!allowedToCancel) {
      return res.status(400).json({
        msg: `Order cannot be cancelled. Current status: ${order.orderStatus}. Only pending or confirmed orders can be cancelled.`,
      })
    }
    order.orderStatus = "cancelled"
    order.paymentStatus = order.paymentStatus === "paid" ? "refunded" : "cancelled"
    await order.save()
    try {
      if (order.paymentStatus === "refunded") {
        await cashbackService.reverseCashbackForOrder(order._id)
        const wa = roundMoney(order.walletAmountApplied || 0)
        if (wa > 0) {
          await walletLedger.creditWallet({
            userId: order.user,
            websiteId: order.websiteId,
            amount: wa,
            idempotencyKey: `wallet:refund:order:${order._id}:cancel`,
            reason: "wallet_order_refund",
            orderId: order._id,
          })
        }
      }
    } catch (e) {
      console.error("Cancel wallet/cashback hook:", e)
    }
    const populated = await Order.findById(order._id)
      .populate("products.product", "name images price")
    res.json(populated)
  } catch (error) {
    console.error("Error cancelling order:", error)
    res.status(500).json({ msg: "Failed to cancel order" })
  }
}

// Delete order (soft delete)
export const deleteOrder = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const order = await Order.findOne({ _id: req.params.id, website: req.websiteId });
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    order.isActive = false;
    order.deleted = true;
    await order.save();

    res.json({ msg: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ msg: 'Failed to delete order' });
  }
};

// Hard delete order
export const hardDeleteOrder = async (req, res) => {
  try {
    // Multi-tenant: Validate website context
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const order = await Order.findOneAndDelete({ _id: req.params.id, website: req.websiteId });
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    res.json({ msg: 'Order permanently deleted' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ msg: 'Failed to delete order' });
  }
};
