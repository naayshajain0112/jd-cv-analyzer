const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;

  console.log('====================================');
  console.log('MongoDB URI exists:', !!uri);

  if (uri) {
    console.log(
      'MongoDB URI preview:',
      uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
    );
  }

  if (!uri) {
    console.log('❌ MONGODB_URI is not set');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log('✅ MongoDB connected successfully');
    logger.info('MongoDB connected');
  } catch (err) {
    console.log('❌ MongoDB connection failed');
    console.log('Error object:', err);
    console.log('Error message:', err.message);
    console.log('Error name:', err.name);

    if (err.cause) {
      console.log('Cause:', err.cause);
    }
  }

  console.log('====================================');
}

module.exports = { connectDB };