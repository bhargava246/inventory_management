import express from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrdersByStatus,
  updateOrderStatus
} from '../controllers/orderController';
import { protect, authorize } from '../middleware/auth';
import { validateOrder, validateOrderUpdate } from '../middleware/validation';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create new order
router.post('/', validateOrder, createOrder);

// Get all orders (with filtering)
router.get('/', getOrders);

// Get orders by status
router.get('/status/:status', getOrdersByStatus);

// Get single order by ID
router.get('/:id', getOrderById);

// Update order
router.put('/:id', validateOrderUpdate, updateOrder);

// Update order status (kitchen staff, waiters)
router.patch('/:id/status', authorize('admin', 'manager', 'waiter', 'kitchen'), updateOrderStatus);

// Delete order (admin/manager only)
router.delete('/:id', authorize('admin', 'manager'), deleteOrder);

export default router;