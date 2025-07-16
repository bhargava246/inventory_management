import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { AuthService } from '../services/authService';
import authRoutes from '../routes/auth';
import { errorHandler } from '../middleware/errorHandler';
import { 
  hasPermission, 
  requirePermission, 
  requireAllPermissions, 
  requireAnyPermission,
  requireRoleLevel,
  requireOwnership,
  requireSameRestaurant,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  getUserPermissions,
  isSensitiveOperation
} from '../middleware/auth';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe('Authentication Tests', () => {
  beforeAll(async () => {
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    // Connect to MongoDB Atlas test database
    const mongoUri = process.env.MONGODB_TEST_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_TEST_URI is not defined in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas test database');

    // Set required environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
    process.env.JWT_EXPIRE = '1h';
    process.env.JWT_REFRESH_EXPIRE = '7d';
  });

  afterAll(async () => {
    // Clean up connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 Disconnected from MongoDB Atlas test database');
    }
  });

  beforeEach(async () => {
    // Clear database before each test
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({});
    }
  });

  describe('Authentication Service', () => {
    describe('User Registration', () => {
      const validUserData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'waiter' as const,
        profile: {
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890'
        },
        restaurantId: new mongoose.Types.ObjectId().toString()
      };

      it('should register a new user successfully', async () => {
        const result = await AuthService.register(validUserData);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshToken');
        expect(result).toHaveProperty('user');
        expect(result.user.email).toBe(validUserData.email);
        expect(result.user.username).toBe(validUserData.username);
        expect(result.user.role).toBe(validUserData.role);
      });

      it('should hash the password during registration', async () => {
        await AuthService.register(validUserData);
        
        const user = await User.findOne({ email: validUserData.email }).select('+password');
        expect(user?.password).not.toBe(validUserData.password);
        expect(user?.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
      });

      it('should throw error for duplicate email', async () => {
        await AuthService.register(validUserData);
        
        await expect(AuthService.register(validUserData)).rejects.toThrow(
          'User with this email or username already exists'
        );
      });

      it('should throw error for duplicate username', async () => {
        await AuthService.register(validUserData);
        
        const duplicateUsernameData = {
          ...validUserData,
          email: 'different@example.com'
        };
        
        await expect(AuthService.register(duplicateUsernameData)).rejects.toThrow(
          'User with this email or username already exists'
        );
      });
    });

    describe('User Login', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'waiter' as const,
        profile: {
          firstName: 'Test',
          lastName: 'User'
        },
        restaurantId: new mongoose.Types.ObjectId().toString()
      };

      beforeEach(async () => {
        await AuthService.register(userData);
      });

      it('should login with valid credentials', async () => {
        const credentials = {
          email: userData.email,
          password: userData.password
        };

        const result = await AuthService.login(credentials);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshToken');
        expect(result).toHaveProperty('user');
        expect(result.user.email).toBe(userData.email);
      });

      it('should update lastLogin on successful login', async () => {
        const beforeLogin = new Date();
        
        await AuthService.login({
          email: userData.email,
          password: userData.password
        });

        const user = await User.findOne({ email: userData.email });
        expect(user?.lastLogin).toBeInstanceOf(Date);
        expect(user?.lastLogin!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
      });

      it('should throw error for invalid email', async () => {
        const credentials = {
          email: 'wrong@example.com',
          password: userData.password
        };

        await expect(AuthService.login(credentials)).rejects.toThrow('Invalid credentials');
      });

      it('should throw error for invalid password', async () => {
        const credentials = {
          email: userData.email,
          password: 'wrongpassword'
        };

        await expect(AuthService.login(credentials)).rejects.toThrow('Invalid credentials');
      });

      it('should throw error for inactive user', async () => {
        // Deactivate user
        await User.findOneAndUpdate({ email: userData.email }, { isActive: false });

        const credentials = {
          email: userData.email,
          password: userData.password
        };

        await expect(AuthService.login(credentials)).rejects.toThrow('Invalid credentials');
      });

      it('should throw error for missing credentials', async () => {
        await expect(AuthService.login({ email: '', password: '' })).rejects.toThrow(
          'Email and password are required'
        );
      });
    });

    describe('Token Refresh', () => {
      let refreshToken: string;
      let userId: string;

      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'waiter' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };

        const result = await AuthService.register(userData);
        refreshToken = result.refreshToken;
        userId = result.user.id;
      });

      it('should refresh token with valid refresh token', async () => {
        const result = await AuthService.refreshToken(refreshToken);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshToken');
        expect(result).toHaveProperty('user');
        expect(result.user.id.toString()).toBe(userId.toString());
      });

      it('should throw error for invalid refresh token', async () => {
        await expect(AuthService.refreshToken('invalid-token')).rejects.toThrow();
      });

      it('should throw error for missing refresh token', async () => {
        await expect(AuthService.refreshToken('')).rejects.toThrow(
          'Refresh token is required'
        );
      });

      it('should throw error for inactive user', async () => {
        // Deactivate user
        await User.findByIdAndUpdate(userId, { isActive: false });

        await expect(AuthService.refreshToken(refreshToken)).rejects.toThrow(
          'User not found or inactive'
        );
      });
    });

    describe('Role Validation', () => {
      let token: string;

      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'manager' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };

        const result = await AuthService.register(userData);
        token = result.token;
      });

      it('should validate role correctly for exact match', () => {
        const hasRole = AuthService.validateRole(token, 'manager');
        expect(hasRole).toBe(true);
      });

      it('should validate role correctly for hierarchy (manager can access waiter functions)', () => {
        const hasRole = AuthService.validateRole(token, 'waiter');
        expect(hasRole).toBe(true);
      });

      it('should reject role for insufficient permissions', () => {
        const hasRole = AuthService.validateRole(token, 'admin');
        expect(hasRole).toBe(false);
      });

      it('should return false for invalid token', () => {
        const hasRole = AuthService.validateRole('invalid-token', 'waiter');
        expect(hasRole).toBe(false);
      });
    });

    describe('Password Change', () => {
      let userId: string;

      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'waiter' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };

        const result = await AuthService.register(userData);
        userId = result.user.id;
      });

      it('should change password with valid current password', async () => {
        await expect(
          AuthService.changePassword(userId, 'TestPass123!', 'NewPass456!')
        ).resolves.not.toThrow();

        // Verify new password works
        const loginResult = await AuthService.login({
          email: 'test@example.com',
          password: 'NewPass456!'
        });
        expect(loginResult).toHaveProperty('token');
      });

      it('should throw error for incorrect current password', async () => {
        await expect(
          AuthService.changePassword(userId, 'WrongPass123!', 'NewPass456!')
        ).rejects.toThrow('Current password is incorrect');
      });

      it('should throw error for non-existent user', async () => {
        const fakeUserId = new mongoose.Types.ObjectId().toString();
        await expect(
          AuthService.changePassword(fakeUserId, 'TestPass123!', 'NewPass456!')
        ).rejects.toThrow('User not found');
      });
    });

    describe('User Activation/Deactivation', () => {
      let userId: string;

      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'waiter' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };

        const result = await AuthService.register(userData);
        userId = result.user.id;
      });

      it('should deactivate user successfully', async () => {
        await AuthService.deactivateUser(userId);
        
        const user = await User.findById(userId);
        expect(user?.isActive).toBe(false);
      });

      it('should activate user successfully', async () => {
        await AuthService.deactivateUser(userId);
        await AuthService.activateUser(userId);
        
        const user = await User.findById(userId);
        expect(user?.isActive).toBe(true);
      });

      it('should throw error for non-existent user during deactivation', async () => {
        const fakeUserId = new mongoose.Types.ObjectId().toString();
        await expect(AuthService.deactivateUser(fakeUserId)).rejects.toThrow('User not found');
      });

      it('should throw error for non-existent user during activation', async () => {
        const fakeUserId = new mongoose.Types.ObjectId().toString();
        await expect(AuthService.activateUser(fakeUserId)).rejects.toThrow('User not found');
      });
    });

    describe('Additional Authentication Requirements', () => {
      let userId: string;

      beforeEach(async () => {
        const userData = {
          username: 'testmanager',
          email: 'manager@example.com',
          password: 'TestPass123!',
          role: 'manager' as const,
          profile: {
            firstName: 'Test',
            lastName: 'Manager'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };

        const result = await AuthService.register(userData);
        userId = result.user.id;
      });

      it('should require additional auth for sensitive actions', async () => {
        const requiresAuth = await AuthService.requireAdditionalAuth(userId, 'delete_user');
        expect(requiresAuth).toBe(true);
      });

      it('should not require additional auth for non-sensitive actions', async () => {
        const requiresAuth = await AuthService.requireAdditionalAuth(userId, 'view_menu');
        expect(requiresAuth).toBe(false);
      });

      it('should return true for non-existent user (fail-safe)', async () => {
        const fakeUserId = new mongoose.Types.ObjectId().toString();
        const requiresAuth = await AuthService.requireAdditionalAuth(fakeUserId, 'delete_user');
        expect(requiresAuth).toBe(true);
      });
    });
  });

  describe('Authentication API Routes', () => {
    beforeEach(async () => {
      await User.deleteMany({});
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'waiter' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };
        await AuthService.register(userData);
      });

      it('should login successfully with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'TestPass123!'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('user');
      });

      it('should return 400 for invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'TestPass123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for missing password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('POST /api/auth/refresh', () => {
      let refreshToken: string;

      beforeEach(async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          role: 'waiter' as const,
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          restaurantId: new mongoose.Types.ObjectId().toString()
        };
        const result = await AuthService.register(userData);
        refreshToken = result.refreshToken;
      });

      it('should refresh token successfully', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('refreshToken');
      });

      it('should return 400 for missing refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });
});