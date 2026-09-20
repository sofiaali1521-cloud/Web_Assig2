const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState >= 1) {
    return true;
  }

  const connStr = process.env.MONGODB_URI;
  
  if (!connStr) {
    console.warn('[Database Warning] MONGODB_URI is not set in environment variables.');
    // Disable buffering when no connection string is present to avoid 10s timeout
    mongoose.set('bufferCommands', false);
    return false;
  }

  try {
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000, // 5s connection timeout
      connectTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    // Disable buffering on failed connection so queries fail fast with clear message
    mongoose.set('bufferCommands', false);
    return false;
  }
};

module.exports = connectDB;
