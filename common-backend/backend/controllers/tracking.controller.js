import Tracking from '../models/tracking.model.js';
import Order from '../models/order.model.js';

// Add tracking update
export const addTracking = async (req, res) => {
  try {
    const { orderId, status, location, description } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({ msg: 'Order ID is required' });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({ msg: 'Status is required' });
    }

    if (!location || !location.trim()) {
      return res.status(400).json({ msg: 'Location is required' });
    }

    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Create tracking entry
    const tracking = new Tracking({
      orderId,
      status: status.trim(),
      location: location.trim(),
      description: description?.trim() || null,
      updatedBy: req.user?._id || null,
      updatedAt: new Date()
    });

    const savedTracking = await tracking.save();

    // Populate user info if available
    await savedTracking.populate('updatedBy', 'name email');

    // Emit Socket.io event to order room
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`order-${orderId}`).emit('trackingUpdated', {
        tracking: savedTracking,
        orderId: orderId.toString()
      });
    }

    res.status(201).json({
      msg: 'Tracking update added successfully',
      tracking: savedTracking
    });
  } catch (error) {
    console.error('Error adding tracking:', error);
    res.status(500).json({ 
      msg: 'Failed to add tracking update',
      error: error.message 
    });
  }
};

// Get tracking history by order ID
export const getTrackingByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ msg: 'Order ID is required' });
    }

    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Get all tracking updates for this order, sorted by most recent first
    const trackingHistory = await Tracking.find({ orderId })
      .populate('updatedBy', 'name email')
      .sort({ updatedAt: -1 });

    res.json({
      orderId,
      orderNumber: order.orderNumber,
      trackingHistory,
      count: trackingHistory.length
    });
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({ 
      msg: 'Failed to fetch tracking history',
      error: error.message 
    });
  }
};

// Get latest tracking status for an order
export const getLatestTracking = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ msg: 'Order ID is required' });
    }

    // Get the most recent tracking update
    const latestTracking = await Tracking.findOne({ orderId })
      .populate('updatedBy', 'name email')
      .sort({ updatedAt: -1 });

    if (!latestTracking) {
      return res.status(404).json({ msg: 'No tracking information found for this order' });
    }

    res.json({
      orderId,
      latestTracking
    });
  } catch (error) {
    console.error('Error fetching latest tracking:', error);
    res.status(500).json({ 
      msg: 'Failed to fetch latest tracking',
      error: error.message 
    });
  }
};
