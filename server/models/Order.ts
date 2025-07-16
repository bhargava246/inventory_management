import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus, PaymentStatus, PaymentMethod } from '../types';

// Order Item Schema (Sub-document)
const OrderItemSchema = new Schema({
  menuItemId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Menu item ID is required'],
    ref: 'MenuItem'
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Item price is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  customizations: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Notes cannot exceed 200 characters']
  }
}, { _id: true });

// Order Schema
const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    trim: true
  },
  restaurantId: {
    type: String,
    required: [true, 'Restaurant ID is required']
  },
  tableId: {
    type: Schema.Types.ObjectId,
    ref: 'Table'
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer'
  },
  items: {
    type: [OrderItemSchema],
    required: [true, 'Order must have at least one item'],
    validate: {
      validator: function(items: any[]) {
        return items.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    required: [true, 'Tax amount is required'],
    min: [0, 'Tax cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'],
      message: 'Status must be one of: pending, confirmed, preparing, ready, served, cancelled'
    },
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded', 'partial'],
      message: 'Payment status must be one of: pending, paid, failed, refunded, partial'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'card', 'upi', 'wallet', 'netbanking'],
      message: 'Payment method must be one of: cash, card, upi, wallet, netbanking'
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ restaurantId: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });

// Generate order number before saving
OrderSchema.pre('save', async function(next) {
  // Only generate order number for new documents
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get the count of orders for today to generate sequential number
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await mongoose.model('Order').countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
      restaurantId: this.restaurantId
    });
    
    // Format: YY-MM-DD-XXXX (XXXX is sequential number for the day)
    this.orderNumber = `${year}${month}${day}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Calculate total before saving
OrderSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('subtotal') || this.isModified('tax') || this.isModified('discount')) {
    // Recalculate subtotal from items if items are modified
    if (this.isModified('items')) {
      this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    
    // Calculate total
    this.total = this.subtotal + this.tax - this.discount;
  }
  next();
});

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;