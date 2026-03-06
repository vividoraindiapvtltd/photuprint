import express from 'express';
import { 
  getProductAttributes, 
  getProductAttributeById, 
  createProductAttribute, 
  updateProductAttribute, 
  deleteProductAttribute, 
  hardDeleteProductAttribute 
} from '../controllers/productAttribute.controller.js';

const router = express.Router();

// Public routes
router.get('/', getProductAttributes);
router.get('/:id', getProductAttributeById);

// Protected routes (require authentication)
router.post('/', createProductAttribute);
router.put('/:id', updateProductAttribute);
router.delete('/:id', deleteProductAttribute);
router.delete('/:id/hard', hardDeleteProductAttribute);

export default router; 