require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN = {
  name: 'Admin',
  email: 'admin@safeher.com',
  phone: '9999999999',
  password: 'Admin@123',
  role: 'admin',
  isActive: true,
  isVerified: true
};

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log(`Admin already exists (${existing.email}). No action taken.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    await User.create(ADMIN);

    console.log('\nAdmin user created successfully!');
    console.log('----------------------------------');
    console.log(`  Email:    ${ADMIN.email}`);
    console.log(`  Password: ${ADMIN.password}`);
    console.log('----------------------------------');
    console.log('Use these credentials to log in.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();
