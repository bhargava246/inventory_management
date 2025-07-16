import { Request, Response, NextFunction } from 'express';
import Order from '../models/Order';
import { ApiResponse, IOrder, OrderStatus } from '../types';
import { asyncHandler } from '../middleware/asyncHandler';
import { ErrorResponse } from '../utils/errorResponse';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const orderData = {
    ...req.body,
    createdBy: req.user.id,
    restaurantId: req.user.restaurantId
  };

  const order = await Order.create(orderData);
  
  // Populate related fields
  await order.populate([
    { path: 'createdBy', select: 'username profile' },
    { path: 'customerId', select: 'name phone email' }
  ]);

  const response: ApiResponse<IOrder> = {
    success: true,
    data: order
  };

  res.status(201).json(response);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter: any = { restaurantId: req.user.restaurantId };
  
  // Add status filter if provided
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  // Add payment status filter if provided
  if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }
  
  // Add date range filter if provided
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) {
      filter.createdAt.$gte = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filter.createdAt.$lte = new Date(req.query.endDate as string);
    }
  }
  
  // Add customer filter if provided
  if (req.query.customerId) {
    filter.customerId = req.query.customerId;
  }

  const orders = await Order.find(filter)
    .populate([
      { path: 'createdBy', select: 'username profile' },
      { path: 'customerId', select: 'name phone email' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);
  const pages = Math.ceil(total / limit);

  const response: ApiResponse<IOrder[]> = {
    success: true,
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages
    }
  };

  res.status(200).json(response);
});

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const order = await Order.findOne({
    _id: req.params.id,
    restaurantId: req.user.restaurantId
  }).populate([
    { path: 'createdBy', select: 'username profile' },
    { path: 'customerId', select: 'name phone email loyaltyPoints loyaltyTier' }
  ]);

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  const response: ApiResponse<IOrder> = {
    success: true,
    data: order
  };

  res.status(200).json(response);
});

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let order = await Order.findOne({
    _id: req.params.id,
    restaurantId: req.user.restaurantId
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Check if order can be updated (not served or cancelled)
  if (order.status === 'served' || order.status === 'cancelled') {
    return next(new ErrorResponse('Cannot update served or cancelled orders', 400));
  }

  // Update order
  order = await Order.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate([
    { path: 'createdBy', select: 'username profile' },
    { path: 'customerId', select: 'name phone email' }
  ]);

  const response: ApiResponse<IOrder> = {
    success: true,
    data: order
  };

  res.status(200).json(response);
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Kitchen staff, Waiters, Managers)
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { status } = req.body;

  if (!status) {
    return next(new ErrorResponse('Status is required', 400));
  }

  const order = await Order.findOne({
    _id: req.params.id,
    restaurantId: req.user.restaurantId
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Validate status transition
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['preparing', 'cancelled'],
    'preparing': ['ready', 'cancelled'],
    'ready': ['served'],
    'served': [], // Cannot change from served
    'cancelled': [] // Cannot change from cancelled
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(new ErrorResponse(`Cannot change status from ${order.status} to ${status}`, 400));
  }

  order.status = status;
  await order.save();

  await order.populate([
    { path: 'createdBy', select: 'username profile' },
    { path: 'customerId', select: 'name phone email' }
  ]);

  const response: ApiResponse<IOrder> = {
    success: true,
    data: order
  };

  res.status(200).json(response);
});

// @desc    Get orders by status
// @route   GET /api/orders/status/:status
// @access  Private
export const getOrdersByStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { status } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter = {
    restaurantId: req.user.restaurantId,
    status: status
  };

  const orders = await Order.find(filter)
    .populate([
      { path: 'createdBy', select: 'username profile' },
      { path: 'customerId', select: 'name phone email' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);
  const pages = Math.ceil(total / limit);

  const response: ApiResponse<IOrder[]> = {
    success: true,
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages
    }
  };

  res.status(200).json(response);
});

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private (Admin/Manager only)
export const deleteOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const order = await Order.findOne({
    _id: req.params.id,
    restaurantId: req.user.restaurantId
  });

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Only allow deletion of pending or cancelled orders
  if (order.status !== 'pending' && order.status !== 'cancelled') {
    return next(new ErrorResponse('Can only delete pending or cancelled orders', 400));
  }

  await Order.findByIdAndDelete(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: {}
  };

  res.status(200).json(response);
});