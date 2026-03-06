import express from 'express';
import { getSystemStatus, healthCheck } from '../controllers/status.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/health', healthCheck);
router.get('/', getSystemStatus);

export default router; 