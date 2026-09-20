const mongoose = require('mongoose');

let isConnected = false;

// Cloud MongoDB Atlas fallback for Vercel deployment
const CLOUD_MONGODB_FALLBACK = 'mongodb+srv://placement_demo_user:Placement2026Secure@cluster0.p7xve.mongodb.net/placement_system_db?retryWrites=true&w=majority';

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState >= 1) {
    return true;
  }

  const connStr = process.env.MONGODB_URI || CLOUD_MONGODB_FALLBACK;

  try {
    const conn = await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    mongoose.set('bufferCommands', false);
    return false;
  }
};

module.exports = connectDB;
