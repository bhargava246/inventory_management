import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

beforeAll(async () => {
  // Set test timeout
  jest.setTimeout(30000);
});

afterAll(async () => {
  // Ensure all connections are closed
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

afterEach(async () => {
  // Clean up after each test if connected
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});