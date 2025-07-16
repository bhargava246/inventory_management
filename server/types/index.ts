import { Document } from 'mongoose';

// User Types
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  profile: IUserProfile;
  permissions: string[];
  restaurantId: string;
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
  getRefreshToken(): string;
}

export interface IUserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  address?: string;
}

export type UserRole = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'customer';

// Order Types
export interface IOrder extends Document {
  orderNumber: string;
  restaurantId: string;
  tableId?: string;
  customerId?: string;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: string[];
  notes?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'netbanking';

// Menu Types
export interface IMenuItem extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  ingredients: IIngredientUsage[];
  allergens: string[];
  nutritionalInfo: INutritionalInfo;
  images: string[];
  isAvailable: boolean;
  preparationTime: number;
  restaurantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IIngredientUsage {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface INutritionalInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

// Inventory Types
export interface IInventoryItem extends Document {
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  costPrice: number;
  supplier: string;
  expiryDate?: Date;
  locationId: string;
  lastUpdated: Date;
  createdAt: Date;
}

// Customer Types
export interface ICustomer extends Document {
  name: string;
  email?: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  preferences: ICustomerPreferences;
  orderHistory: string[];
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerPreferences {
  dietaryRestrictions?: string[];
  favoriteItems?: string[];
  spiceLevel?: 'mild' | 'medium' | 'hot';
  communicationPreference?: 'sms' | 'email' | 'whatsapp';
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
    requestId: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Authentication Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Partial<IUser>;
  expiresIn: string;
}

// Payment Types
export interface PaymentRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  currency?: string;
  customerDetails?: {
    name: string;
    email?: string;
    phone: string;
  };
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  paymentId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method: PaymentMethod;
  timestamp: Date;
}

// Socket Events
export interface SocketEvents {
  'order-created': IOrder;
  'order-updated': IOrder;
  'payment-completed': PaymentResponse;
  'inventory-updated': IInventoryItem;
  'kitchen-order': IOrder;
}