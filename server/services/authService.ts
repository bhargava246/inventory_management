import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { IUser, LoginCredentials, AuthResponse, UserRole } from '../types';
import { logger } from '../utils/logger';

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user and check credentials
      const user = await (User as any).findByCredentials(email, password);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const token = user.getSignedJwtToken();
      const refreshToken = user.getRefreshToken();

      // Prepare user data (exclude sensitive information)
      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
        restaurantId: user.restaurantId,
        permissions: user.permissions,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      };

      logger.info(`User ${user.email} logged in successfully`);

      return {
        token,
        refreshToken,
        user: userData,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout user by invalidating token (in a real implementation, you'd maintain a blacklist)
   */
  static async logout(token: string): Promise<void> {
    try {
      // In a production environment, you would:
      // 1. Add token to a blacklist/redis cache
      // 2. Set expiration time for the blacklist entry
      // For now, we'll just log the logout
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      logger.info(`User ${decoded.email} logged out successfully`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const newToken = user.getSignedJwtToken();
      const newRefreshToken = user.getRefreshToken();

      // Prepare user data
      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
        restaurantId: user.restaurantId,
        permissions: user.permissions,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      };

      logger.info(`Token refreshed for user ${user.email}`);

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user: userData,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Validate user role against required role
   */
  static validateRole(token: string, requiredRole: UserRole): boolean {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Define role hierarchy (higher number = more permissions)
      const roleHierarchy: Record<UserRole, number> = {
        customer: 1,
        kitchen: 2,
        waiter: 3,
        manager: 4,
        admin: 5
      };

      const userRoleLevel = roleHierarchy[decoded.role as UserRole];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      return userRoleLevel >= requiredRoleLevel;
    } catch (error) {
      logger.error('Role validation failed:', error);
      return false;
    }
  }

  /**
   * Check if user requires additional authentication for sensitive operations
   */
  static async requireAdditionalAuth(userId: string, action: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Define actions that require additional authentication
      const sensitiveActions = [
        'delete_user',
        'modify_permissions',
        'access_financial_reports',
        'modify_system_settings',
        'export_customer_data'
      ];

      // Admin and Manager roles require additional auth for sensitive actions
      if (sensitiveActions.includes(action) && ['admin', 'manager'].includes(user.role)) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Additional auth check failed:', error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Create a new user (registration)
   */
  static async register(userData: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
    };
    restaurantId?: string;
    permissions?: string[];
  }): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });

      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = new User({
        username: userData.username,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        profile: userData.profile,
        restaurantId: userData.restaurantId,
        permissions: userData.permissions || [],
        isActive: true
      });

      await user.save();

      // Generate tokens
      const token = user.getSignedJwtToken();
      const refreshToken = user.getRefreshToken();

      // Prepare user data
      const userResponse = {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
        restaurantId: user.restaurantId,
        permissions: user.permissions,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      };

      logger.info(`New user registered: ${user.email}`);

      return {
        token,
        refreshToken,
        user: userResponse,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      };
    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token and return user data
   */
  static async verifyToken(token: string): Promise<IUser | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      logger.info(`Password changed for user ${user.email}`);
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = false;
      await user.save();

      logger.info(`User ${user.email} deactivated`);
    } catch (error) {
      logger.error('User deactivation failed:', error);
      throw error;
    }
  }

  /**
   * Activate user account
   */
  static async activateUser(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = true;
      await user.save();

      logger.info(`User ${user.email} activated`);
    } catch (error) {
      logger.error('User activation failed:', error);
      throw error;
    }
  }
}