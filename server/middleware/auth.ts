import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { asyncHandler } from './errorHandler';
import { UserRole, ApiResponse } from '../types';

export interface AuthRequest extends Request {
  user?: any;
}

// Define role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 1,
  kitchen: 2,
  waiter: 3,
  manager: 4,
  admin: 5
};

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  customer: [
    'order:create',
    'order:view:own',
    'menu:view',
    'profile:view:own',
    'profile:update:own'
  ],
  kitchen: [
    'order:view',
    'order:update:status',
    'kitchen:view',
    'kitchen:update',
    'menu:view',
    'inventory:view'
  ],
  waiter: [
    'order:create',
    'order:view',
    'order:update',
    'order:delete',
    'table:view',
    'table:update',
    'menu:view',
    'customer:view',
    'customer:create',
    'payment:process',
    'inventory:view'
  ],
  manager: [
    'order:*',
    'table:*',
    'menu:*',
    'customer:*',
    'payment:*',
    'inventory:*',
    'employee:view',
    'employee:create',
    'employee:update',
    'analytics:view',
    'reports:view',
    'settings:view',
    'settings:update'
  ],
  admin: [
    '*' // Admin has all permissions
  ]
};

// Define sensitive operations that require additional authentication
export const SENSITIVE_OPERATIONS = [
  'user:delete',
  'payment:refund',
  'inventory:delete',
  'settings:security',
  'data:export',
  'system:backup'
];

export const authMiddleware = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Not authorized to access this route',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is inactive',
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Not authorized to access this route',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `User role ${req.user.role} is not authorized to access this route`,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (userRole: UserRole, permission: string, userPermissions?: string[]): boolean => {
  // Admin has all permissions
  if (userRole === 'admin') {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  
  // Check for wildcard permissions
  if (rolePermissions.includes('*')) {
    return true;
  }

  // Check for exact permission match
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // Check for wildcard resource permissions (e.g., 'order:*' matches 'order:create')
  const [resource] = permission.split(':');
  if (rolePermissions.includes(`${resource}:*`)) {
    return true;
  }

  // Check user-specific permissions if provided
  if (userPermissions && userPermissions.includes(permission)) {
    return true;
  }

  return false;
};

/**
 * Middleware to check specific permissions
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!hasPermission(req.user.role, permission, req.user.permissions)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required to access this resource`,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Middleware to check multiple permissions (user must have ALL)
 */
export const requireAllPermissions = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    const missingPermissions = permissions.filter(
      permission => !hasPermission(req.user.role, permission, req.user.permissions)
    );

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Missing required permissions: ${missingPermissions.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Middleware to check multiple permissions (user must have ANY)
 */
export const requireAnyPermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    const hasAnyPermission = permissions.some(
      permission => hasPermission(req.user.role, permission, req.user.permissions)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `One of the following permissions required: ${permissions.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Middleware to check role hierarchy (user must have role level >= required level)
 */
export const requireRoleLevel = (minimumRole: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role as UserRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE_LEVEL',
          message: `Role '${minimumRole}' or higher required to access this resource`,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Middleware to check resource ownership (for operations on own resources)
 */
export const requireOwnership = (resourceIdParam: string = 'id', userIdField: string = '_id') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Admin and manager can access any resource
    if (['admin', 'manager'].includes(req.user.role)) {
      return next();
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user[userIdField]?.toString();

    if (resourceId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'You can only access your own resources',
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  };
};

/**
 * Middleware to check restaurant scope (users can only access resources from their restaurant)
 */
export const requireSameRestaurant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_USER',
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Admin can access any restaurant
  if (req.user.role === 'admin') {
    return next();
  }

  // Add restaurant filter to query for non-admin users
  if (req.query) {
    req.query.restaurantId = req.user.restaurantId;
  }

  return next();
};

/**
 * Middleware for sensitive operations that require additional authentication
 */
export const requireAdditionalAuth = (operation: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (SENSITIVE_OPERATIONS.includes(operation)) {
      // Check if additional auth token is provided
      const additionalAuthToken = req.headers['x-additional-auth'] as string;
      
      if (!additionalAuthToken) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ADDITIONAL_AUTH_REQUIRED',
            message: 'This operation requires additional authentication',
            timestamp: new Date().toISOString()
          }
        });
      }

      try {
        // Verify additional auth token (could be a short-lived token or password confirmation)
        const decoded = jwt.verify(additionalAuthToken, process.env.JWT_SECRET!) as any;
        
        if (decoded.userId !== req.user._id.toString() || decoded.operation !== operation) {
          throw new Error('Invalid additional auth token');
        }

        // Check if token is recent (within 5 minutes)
        const tokenAge = Date.now() - decoded.iat * 1000;
        if (tokenAge > 5 * 60 * 1000) { // 5 minutes
          throw new Error('Additional auth token expired');
        }

      } catch (error) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_ADDITIONAL_AUTH',
            message: 'Invalid or expired additional authentication token',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    return next();
  };
};

/**
 * Utility function to get user permissions
 */
export const getUserPermissions = (userRole: UserRole, userPermissions?: string[]): string[] => {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  const customPermissions = userPermissions || [];
  
  return [...new Set([...rolePermissions, ...customPermissions])];
};

/**
 * Utility function to check if operation is sensitive
 */
export const isSensitiveOperation = (operation: string): boolean => {
  return SENSITIVE_OPERATIONS.includes(operation);
};