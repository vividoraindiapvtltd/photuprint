import express from 'express';
import {
  getShippings,
  getShippingById,
  createShipping,
  updateShipping,
  deleteShipping,
  hardDeleteShipping
} from '../controllers/shipping.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', getShippings);
router.get('/:id', getShippingById);
router.post('/', protect, adminOnly, createShipping);
router.put('/:id', protect, adminOnly, updateShipping);
router.delete('/:id', protect, adminOnly, deleteShipping);
router.delete('/:id/hard', protect, adminOnly, hardDeleteShipping);

export default router;
