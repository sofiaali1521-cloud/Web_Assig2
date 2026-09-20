const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    const connStr = process.env.MONGODB_URI;
    if (!connStr) {
      console.warn('[Database Warning] MONGODB_URI environment variable is not defined. Skipping MongoDB connection.');
      return;
    }

    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000 // 5-second connection timeout
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    // Do NOT call process.exit(1) in serverless environment to prevent FUNCTION_INVOCATION_FAILED
  }
};

module.exports = connectDB;
