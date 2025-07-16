import mongoose from 'mongoose';
import Order from '../models/Order';
import { IOrder, ApiResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Create a new order
 */
export const createOrder = async (orderData: Partial<IOrder>): Promise<ApiResponse<IOrder>> => {
  try {
    // Create new order
    const order = await Order.create(orderData);

    return {
      success: true,
      data: order
    };
  } catch (error: any) {
    logger.error(`Error creating order: ${error.message}`, { error });
    return {
      success: false,
      error: {
        code: 'ORDER_CREATE_ERROR',
        message: error.message,
        details: error,
        timestamp: new Date(),
        requestId: 'system'
      }
    };
  }
};

/**
 * Get order by ID
 */
export const getOrderById = async (orderId: string): Promise<ApiResponse<IOrder>> => {
  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid order ID format',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    return {
      success: true,
      data: order
    };
  } catch (error: any) {
    logger.error(`Error fetching order: ${error.message}`, { error });
    return {
      success: false,
      error: {
        code: 'ORDER_FETCH_ERROR',
        message: error.message,
        details: error,
        timestamp: new Date(),
        requestId: 'system'
      }
    };
  }
};

/**
 * Get orders with pagination and filtering
 */
export const getOrders = async (filters: any, pagination: { page: number; limit: number; sort?: string; order?: 'asc' | 'desc' }): Promise<ApiResponse<IOrder[]>> => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query = Order.find(filters)
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    // Execute query
    const [orders, total] = await Promise.all([
      query.exec(),
      Order.countDocuments(filters)
    ]);

    return {
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error: any) {
    logger.error(`Error fetching orders: ${error.message}`, { error });
    return {
      success: false,
      error: {
        code: 'ORDERS_FETCH_ERROR',
        message: error.message,
        details: error,
        timestamp: new Date(),
        requestId: 'system'
      }
    };
  }
};

/**
 * Update order
 */
export const updateOrder = async (orderId: string, updates: Partial<IOrder>): Promise<ApiResponse<IOrder>> => {
  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid order ID format',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    // Find and update order
    const order = await Order.findByIdAndUpdate(
      orderId,
      updates,
      { new: true, runValidators: true }
    );

    if (!order) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    return {
      success: true,
      data: order
    };
  } catch (error: any) {
    logger.error(`Error updating order: ${error.message}`, { error });
    return {
      success: false,
      error: {
        code: 'ORDER_UPDATE_ERROR',
        message: error.message,
        details: error,
        timestamp: new Date(),
        requestId: 'system'
      }
    };
  }
};

/**
 * Delete order
 */
export const deleteOrder = async (orderId: string): Promise<ApiResponse<null>> => {
  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid order ID format',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    // Find and delete order
    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          timestamp: new Date(),
          requestId: 'system'
        }
      };
    }

    return {
      success: true,
      data: null
    };
  } catch (error: any) {
    logger.error(`Error deleting order: ${error.message}`, { error });
    return {
      success: false,
      error: {
        code: 'ORDER_DELETE_ERROR',
        message: error.message,
        details: error,
        timestamp: new Date(),
        requestId: 'system'
      }
    };
  }
};