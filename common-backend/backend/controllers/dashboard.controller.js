import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import Testimonial from '../models/testimonial.model.js';
import HomepageSection from '../models/homepageSection.model.js';
import Client from '../models/client.model.js';
import Interaction from '../models/interaction.model.js';

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    // Multi-tenant: Filter by website
    if (!req.websiteId) {
      return res.status(400).json({ msg: "Website context is required" })
    }

    const websiteId = req.websiteId;

    // Get current date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(now.getMonth() - 1);
    const yearStart = new Date(now);
    yearStart.setFullYear(now.getFullYear() - 1);

    // Base query for active, non-deleted items
    const baseQuery = {
      website: websiteId,
      isActive: true,
      deleted: false
    };

    // Orders Statistics
    const ordersStats = {
      today: await Order.countDocuments({
        ...baseQuery,
        createdAt: { $gte: todayStart }
      }),
      pending: await Order.countDocuments({
        ...baseQuery,
        orderStatus: 'pending'
      }),
      processing: await Order.countDocuments({
        ...baseQuery,
        orderStatus: { $in: ['confirmed', 'processing'] }
      }),
      shipped: await Order.countDocuments({
        ...baseQuery,
        orderStatus: 'shipped'
      }),
      delivered: await Order.countDocuments({
        ...baseQuery,
        orderStatus: 'delivered'
      }),
      cancelled: await Order.countDocuments({
        ...baseQuery,
        orderStatus: 'cancelled'
      }),
      total: await Order.countDocuments(baseQuery),
      weekly: await Order.countDocuments({
        ...baseQuery,
        createdAt: { $gte: weekStart }
      }),
      monthly: await Order.countDocuments({
        ...baseQuery,
        createdAt: { $gte: monthStart }
      }),
      yearly: await Order.countDocuments({
        ...baseQuery,
        createdAt: { $gte: yearStart }
      })
    };

    // Calculate total revenue
    const revenueStats = {
      today: await Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: todayStart },
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]).then(result => result[0]?.total || 0),
      weekly: await Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: weekStart },
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]).then(result => result[0]?.total || 0),
      monthly: await Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: monthStart },
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]).then(result => result[0]?.total || 0),
      total: await Order.aggregate([
        {
          $match: {
            ...baseQuery,
            paymentStatus: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]).then(result => result[0]?.total || 0)
    };

    // Users Statistics
    const usersStats = {
      today: await User.countDocuments({
        website: websiteId,
        isActive: true,
        deleted: false,
        createdAt: { $gte: todayStart }
      }),
      weekly: await User.countDocuments({
        website: websiteId,
        isActive: true,
        deleted: false,
        createdAt: { $gte: weekStart }
      }),
      monthly: await User.countDocuments({
        website: websiteId,
        isActive: true,
        deleted: false,
        createdAt: { $gte: monthStart }
      }),
      total: await User.countDocuments({
        website: websiteId,
        isActive: true,
        deleted: false
      })
    };

    // Products Statistics
    const productsStats = {
      total: await Product.countDocuments(baseQuery),
      active: await Product.countDocuments({
        ...baseQuery,
        isActive: true
      }),
      lowStock: await Product.countDocuments({
        ...baseQuery,
        stock: { $lte: 10, $gt: 0, $ne: -1 } // Exclude unlimited stock (-1) and out of stock (0)
      }),
      outOfStock: await Product.countDocuments({
        ...baseQuery,
        stock: 0 // Only count products with exactly 0 stock (exclude unlimited -1)
      })
    };

    // Reviews Statistics
    const reviewsStats = {
      total: await Review.countDocuments(baseQuery),
      pending: await Review.countDocuments({
        ...baseQuery,
        status: 'pending'
      }),
      approved: await Review.countDocuments({
        ...baseQuery,
        status: 'approved'
      }),
      rejected: await Review.countDocuments({
        ...baseQuery,
        status: 'rejected'
      }),
      today: await Review.countDocuments({
        ...baseQuery,
        createdAt: { $gte: todayStart }
      }),
      weekly: await Review.countDocuments({
        ...baseQuery,
        createdAt: { $gte: weekStart }
      }),
      monthly: await Review.countDocuments({
        ...baseQuery,
        createdAt: { $gte: monthStart }
      }),
      fromUsers: await Review.countDocuments({
        ...baseQuery,
        source: 'user'
      }),
      fromAdmin: await Review.countDocuments({
        ...baseQuery,
        source: 'admin'
      })
    };

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
        }
      }
    ]);

    const ratingData = ratingStats[0] || {
      averageRating: 0,
      totalRatings: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0
    };

    reviewsStats.averageRating = ratingData.averageRating ? parseFloat(ratingData.averageRating.toFixed(2)) : 0;
    reviewsStats.ratingBreakdown = {
      '5': ratingData.rating5,
      '4': ratingData.rating4,
      '3': ratingData.rating3,
      '2': ratingData.rating2,
      '1': ratingData.rating1
    };

    // Testimonials Statistics
    const testimonialsStats = {
      total: await Testimonial.countDocuments(baseQuery),
      pending: await Testimonial.countDocuments({
        ...baseQuery,
        status: 'pending'
      }),
      approved: await Testimonial.countDocuments({
        ...baseQuery,
        status: 'approved'
      }),
      rejected: await Testimonial.countDocuments({
        ...baseQuery,
        status: 'rejected'
      }),
      featured: await Testimonial.countDocuments({
        ...baseQuery,
        isFeatured: true
      }),
      today: await Testimonial.countDocuments({
        ...baseQuery,
        createdAt: { $gte: todayStart }
      }),
      weekly: await Testimonial.countDocuments({
        ...baseQuery,
        createdAt: { $gte: weekStart }
      }),
      monthly: await Testimonial.countDocuments({
        ...baseQuery,
        createdAt: { $gte: monthStart }
      })
    };

    // Calculate average rating for testimonials
    const testimonialRatingStats = await Testimonial.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
        }
      }
    ]);

    const testimonialRatingData = testimonialRatingStats[0] || {
      averageRating: 0,
      totalRatings: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0
    };

    testimonialsStats.averageRating = testimonialRatingData.averageRating ? parseFloat(testimonialRatingData.averageRating.toFixed(2)) : 0;
    testimonialsStats.ratingBreakdown = {
      '5': testimonialRatingData.rating5,
      '4': testimonialRatingData.rating4,
      '3': testimonialRatingData.rating3,
      '2': testimonialRatingData.rating2,
      '1': testimonialRatingData.rating1
    };

    // Get category breakdown for testimonials
    const categoryBreakdown = await Testimonial.aggregate([
      {
        $match: baseQuery
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    testimonialsStats.categoryBreakdown = {};
    categoryBreakdown.forEach(item => {
      testimonialsStats.categoryBreakdown[item._id || 'general'] = item.count;
    });

    // Get source breakdown for testimonials
    const sourceBreakdown = await Testimonial.aggregate([
      {
        $match: baseQuery
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    testimonialsStats.sourceBreakdown = {};
    sourceBreakdown.forEach(item => {
      testimonialsStats.sourceBreakdown[item._id || 'other'] = item.count;
    });

    // Homepage Sections Statistics
    const homepageSectionsStats = {
      total: await HomepageSection.countDocuments({
        website: websiteId,
        deleted: false
      }),
      active: await HomepageSection.countDocuments({
        website: websiteId,
        status: 'active',
        isActive: true,
        deleted: false
      }),
      draft: await HomepageSection.countDocuments({
        website: websiteId,
        status: 'draft',
        deleted: false
      }),
      scheduled: await HomepageSection.countDocuments({
        website: websiteId,
        status: 'scheduled',
        deleted: false
      }),
      inactive: await HomepageSection.countDocuments({
        website: websiteId,
        isActive: false,
        deleted: false
      })
    };

    // Get section type breakdown
    const sectionTypeBreakdown = await HomepageSection.aggregate([
      {
        $match: {
          website: websiteId,
          deleted: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    homepageSectionsStats.byType = {};
    sectionTypeBreakdown.forEach(item => {
      homepageSectionsStats.byType[item._id || 'custom'] = item.count;
    });

    // Products with homepage tags
    const productTagsStats = {
      featured: await Product.countDocuments({
        ...baseQuery,
        'homepageTags.featured': true
      }),
      hot: await Product.countDocuments({
        ...baseQuery,
        'homepageTags.hot': true
      }),
      newArrival: await Product.countDocuments({
        ...baseQuery,
        'homepageTags.newArrival': true
      }),
      bestseller: await Product.countDocuments({
        ...baseQuery,
        'homepageTags.bestseller': true
      }),
      onSale: await Product.countDocuments({
        ...baseQuery,
        'homepageTags.onSale': true
      })
    };

    homepageSectionsStats.productTags = productTagsStats;

    // Client Management Statistics
    const clientBaseQuery = {
      website: websiteId,
      deleted: false
    };

    const clientsStats = {
      total: await Client.countDocuments(clientBaseQuery),
      active: await Client.countDocuments({ ...clientBaseQuery, isActive: true }),
      leads: await Client.countDocuments({ ...clientBaseQuery, status: 'lead' }),
      prospects: await Client.countDocuments({ ...clientBaseQuery, status: 'prospect' }),
      activeClients: await Client.countDocuments({ ...clientBaseQuery, status: 'active' }),
      inactive: await Client.countDocuments({ ...clientBaseQuery, status: 'inactive' }),
      closed: await Client.countDocuments({ ...clientBaseQuery, status: 'closed' }),
      lost: await Client.countDocuments({ ...clientBaseQuery, status: 'lost' }),
      today: await Client.countDocuments({
        ...clientBaseQuery,
        createdAt: { $gte: todayStart }
      }),
      thisWeek: await Client.countDocuments({
        ...clientBaseQuery,
        createdAt: { $gte: weekStart }
      }),
      thisMonth: await Client.countDocuments({
        ...clientBaseQuery,
        createdAt: { $gte: monthStart }
      }),
      upcomingFollowUps: await Client.countDocuments({
        ...clientBaseQuery,
        nextFollowUp: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
      })
    };

    // Client priority breakdown
    const clientPriorityBreakdown = await Client.aggregate([
      { $match: clientBaseQuery },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    clientsStats.byPriority = {};
    clientPriorityBreakdown.forEach(item => {
      clientsStats.byPriority[item._id || 'medium'] = item.count;
    });

    // Interaction Statistics
    const interactionsStats = {
      total: await Interaction.countDocuments({ website: websiteId, deleted: false }),
      today: await Interaction.countDocuments({
        website: websiteId,
        deleted: false,
        createdAt: { $gte: todayStart }
      }),
      thisWeek: await Interaction.countDocuments({
        website: websiteId,
        deleted: false,
        createdAt: { $gte: weekStart }
      }),
      upcoming: await Interaction.countDocuments({
        website: websiteId,
        deleted: false,
        status: 'scheduled',
        $or: [
          { dueDate: { $gte: now } },
          { scheduledAt: { $gte: now } }
        ]
      }),
      overdue: await Interaction.countDocuments({
        website: websiteId,
        deleted: false,
        status: { $in: ['scheduled', 'in_progress'] },
        $or: [
          { dueDate: { $lt: now } },
          { scheduledAt: { $lt: now } }
        ]
      })
    };

    res.json({
      orders: ordersStats,
      revenue: revenueStats,
      users: usersStats,
      products: productsStats,
      reviews: reviewsStats,
      testimonials: testimonialsStats,
      homepageSections: homepageSectionsStats,
      clients: clientsStats,
      interactions: interactionsStats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ msg: 'Failed to fetch dashboard statistics', error: error.message });
  }
};
