const mongoose = require('mongoose');
require('dotenv').config();

async function testRealDatabase() {
  try {
    // Connect to your MongoDB Atlas TEST database
    await mongoose.connect(process.env.MONGODB_TEST_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Check if users collection exists and count documents
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📁 Available collections:', collections.map(c => c.name));
    
    // Try to count users
    try {
      const userCount = await db.collection('users').countDocuments();
      console.log(`👥 Users in database: ${userCount}`);
      
      // Show first few users (without passwords)
      const users = await db.collection('users').find({}, { 
        projection: { password: 0 } 
      }).limit(3).toArray();
      console.log('📋 Sample users:', JSON.stringify(users, null, 2));
    } catch (err) {
      console.log('ℹ️  No users collection found yet');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testRealDatabase();