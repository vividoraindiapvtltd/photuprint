import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { 
  addTracking, 
  getTrackingByOrder, 
  getLatestTracking 
} from '../controllers/tracking.controller.js';

const router = express.Router();

// All routes are protected (require JWT authentication)
router.post('/add', protect, addTracking);
router.get('/:orderId', protect, getTrackingByOrder);
router.get('/:orderId/latest', protect, getLatestTracking);

export default router;
