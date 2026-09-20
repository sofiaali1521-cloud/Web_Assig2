const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/placement_management_db';
    console.log(`Connecting to database: ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(`ℹ️ Admin user already exists: ${existingAdmin.email}`);
      process.exit(0);
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@placement.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    const adminUser = new User({
      name: 'Head TPO Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: '+1-555-TPO-ADMIN',
      isActive: true
    });

    await adminUser.save();
    console.log(`===================================================`);
    console.log(`✅ Admin Account Created Successfully!`);
    console.log(` 📧 Email: ${adminEmail}`);
    console.log(` 🔑 Password: ${adminPassword}`);
    console.log(`===================================================`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding admin user:', err);
    process.exit(1);
  }
};

seedAdmin();
