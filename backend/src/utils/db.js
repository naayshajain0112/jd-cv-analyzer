const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI not set — running without database persistence');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection failed:', err.message);
    // Don't crash — app can still work, DB ops will fail gracefully
  }
}

module.exports = { connectDB };
