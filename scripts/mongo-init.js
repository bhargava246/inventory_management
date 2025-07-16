// MongoDB initialization script
db = db.getSiblingDB('smartdine');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password', 'role'],
      properties: {
        username: {
          bsonType: 'string',
          description: 'Username is required and must be a string'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Password must be at least 6 characters'
        },
        role: {
          bsonType: 'string',
          enum: ['admin', 'manager', 'waiter', 'kitchen', 'customer'],
          description: 'Role must be one of the predefined values'
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ restaurantId: 1 });

// Create orders collection
db.createCollection('orders');
db.orders.createIndex({ restaurantId: 1, createdAt: -1 });
db.orders.createIndex({ orderNumber: 1 }, { unique: true });
db.orders.createIndex({ customerId: 1 });
db.orders.createIndex({ status: 1 });

// Create menu items collection
db.createCollection('menuitems');
db.menuitems.createIndex({ restaurantId: 1, isAvailable: 1 });
db.menuitems.createIndex({ category: 1 });
db.menuitems.createIndex({ name: 'text', description: 'text' });

// Create inventory collection
db.createCollection('inventoryitems');
db.inventoryitems.createIndex({ locationId: 1, sku: 1 }, { unique: true });
db.inventoryitems.createIndex({ expiryDate: 1 });
db.inventoryitems.createIndex({ currentStock: 1 });

// Create customers collection
db.createCollection('customers');
db.customers.createIndex({ phone: 1 }, { unique: true });
db.customers.createIndex({ email: 1 }, { sparse: true });

print('SmartDine database initialized successfully!');