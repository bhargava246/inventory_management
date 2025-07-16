import express, { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authMiddleware, AuthRequest, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, LoginCredentials, UserRole } from '../types';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required'
  })
});

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': 'Username can only contain letters and numbers',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters',
    'any.required': 'Username is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    'any.required': 'Password is required'
  }),
  role: Joi.string().valid('admin', 'manager', 'waiter', 'kitchen', 'customer').default('waiter'),
  profile: Joi.object({
    firstName: Joi.string().max(50).required().messages({
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().max(50).required().messages({
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional().messages({
      'string.pattern.base': 'Please provide a valid phone number'
    })
  }).required(),
  restaurantId: Joi.string().optional(),
  permissions: Joi.array().items(Joi.string()).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
    'string.min': 'New password must be at least 8 characters',
    'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    'any.required': 'New password is required'
  })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateRequest(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const credentials: LoginCredentials = req.body;
  
  const authResponse = await AuthService.login(credentials);
  
  const response: ApiResponse = {
    success: true,
    data: authResponse
  };
  
  res.status(200).json(response);
}));

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Private (Admin/Manager only)
 */
router.post('/register', 
  authMiddleware, 
  authorize('admin', 'manager'), 
  validateRequest(registerSchema), 
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userData = req.body;
    
    // If not admin, set restaurantId to current user's restaurant
    if (req.user?.role !== 'admin' && !userData.restaurantId) {
      userData.restaurantId = req.user.restaurantId;
    }
    
    const authResponse = await AuthService.register(userData);
    
    const response: ApiResponse = {
      success: true,
      data: authResponse
    };
    
    res.status(201).json(response);
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    await AuthService.logout(token);
  }
  
  const response: ApiResponse = {
    success: true,
    data: { message: 'Logged out successfully' }
  };
  
  res.status(200).json(response);
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validateRequest(refreshTokenSchema), asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  const authResponse = await AuthService.refreshToken(refreshToken);
  
  const response: ApiResponse = {
    success: true,
    data: authResponse
  };
  
  res.status(200).json(response);
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      user: req.user
    }
  };
  
  res.status(200).json(response);
}));

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', 
  authMiddleware, 
  validateRequest(changePasswordSchema), 
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    
    await AuthService.changePassword(req.user._id, currentPassword, newPassword);
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'Password changed successfully' }
    };
    
    res.status(200).json(response);
  })
);

/**
 * @route   PUT /api/auth/users/:userId/deactivate
 * @desc    Deactivate user account
 * @access  Private (Admin/Manager only)
 */
router.put('/users/:userId/deactivate', 
  authMiddleware, 
  authorize('admin', 'manager'), 
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    
    await AuthService.deactivateUser(userId);
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'User deactivated successfully' }
    };
    
    res.status(200).json(response);
  })
);

/**
 * @route   PUT /api/auth/users/:userId/activate
 * @desc    Activate user account
 * @access  Private (Admin/Manager only)
 */
router.put('/users/:userId/activate', 
  authMiddleware, 
  authorize('admin', 'manager'), 
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    
    await AuthService.activateUser(userId);
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'User activated successfully' }
    };
    
    res.status(200).json(response);
  })
);

/**
 * @route   GET /api/auth/validate-role/:role
 * @desc    Validate if current user has required role
 * @access  Private
 */
router.get('/validate-role/:role', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'No token provided',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  const hasRole = AuthService.validateRole(token, role as UserRole);
  
  const response: ApiResponse = {
    success: true,
    data: { hasRole }
  };
  
  return res.status(200).json(response);
}));

/**
 * @route   GET /api/auth/require-additional-auth/:action
 * @desc    Check if action requires additional authentication
 * @access  Private
 */
router.get('/require-additional-auth/:action', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action } = req.params;
  
  const requiresAuth = await AuthService.requireAdditionalAuth(req.user._id, action);
  
  const response: ApiResponse = {
    success: true,
    data: { requiresAdditionalAuth: requiresAuth }
  };
  
  res.status(200).json(response);
}));

export = router;