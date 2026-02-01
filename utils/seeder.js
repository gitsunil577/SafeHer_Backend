const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { User, Volunteer, SafeZone, EmergencyContact } = require('../models');

// Connect to database
mongoose.connect(process.env.MONGODB_URI);

// Sample data
const users = [
  {
    name: 'Admin User',
    email: 'admin@safeher.com',
    phone: '+91-9999999999',
    password: 'admin123',
    role: 'admin',
    isVerified: true,
    isActive: true
  },
  {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    phone: '+91-9876543210',
    password: 'password123',
    role: 'user',
    bloodGroup: 'B+',
    isVerified: true,
    isActive: true,
    address: { fullAddress: 'MG Road, Bangalore' }
  },
  {
    name: 'Anjali Gupta',
    email: 'anjali@example.com',
    phone: '+91-9876543211',
    password: 'password123',
    role: 'user',
    bloodGroup: 'A+',
    isVerified: true,
    isActive: true,
    address: { fullAddress: 'Koramangala, Bangalore' }
  }
];

const volunteerUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+91-9876543220',
    password: 'password123',
    role: 'volunteer',
    isVerified: true,
    isActive: true
  },
  {
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    phone: '+91-9876543221',
    password: 'password123',
    role: 'volunteer',
    isVerified: true,
    isActive: true
  }
];

const safeZones = [
  {
    name: 'City Police Station',
    type: 'police',
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
      address: 'MG Road, Bangalore'
    },
    phone: '100',
    operatingHours: { is24Hours: true },
    isVerified: true,
    isActive: true
  },
  {
    name: 'Women Helpdesk - MG Road',
    type: 'helpdesk',
    location: {
      type: 'Point',
      coordinates: [77.5950, 12.9720],
      address: 'Near Metro Station, MG Road'
    },
    phone: '1091',
    operatingHours: { is24Hours: true },
    isVerified: true,
    isActive: true
  },
  {
    name: 'City Hospital',
    type: 'hospital',
    location: {
      type: 'Point',
      coordinates: [77.5900, 12.9700],
      address: 'Hospital Road, Bangalore'
    },
    phone: '102',
    operatingHours: { is24Hours: true },
    isVerified: true,
    isActive: true
  },
  {
    name: 'Metro Station - MG Road',
    type: 'transport',
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9750],
      address: 'MG Road Metro Station'
    },
    operatingHours: {
      is24Hours: false,
      openTime: '05:00',
      closeTime: '23:00'
    },
    isVerified: true,
    isActive: true
  }
];

const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Volunteer.deleteMany();
    await SafeZone.deleteMany();
    await EmergencyContact.deleteMany();

    console.log('Cleared existing data');

    // Create regular users and admin
    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`Created user: ${user.name}`);
    }

    // Create volunteer users and their volunteer profiles
    for (const volunteerData of volunteerUsers) {
      const user = await User.create(volunteerData);

      const volunteer = await Volunteer.create({
        user: user._id,
        idType: 'aadhar',
        idNumber: '1234-5678-9012',
        occupation: 'Social Worker',
        availability: 'flexible',
        isVerified: true,
        status: 'active',
        isOnDuty: true,
        currentLocation: {
          type: 'Point',
          coordinates: [77.5946 + Math.random() * 0.01, 12.9716 + Math.random() * 0.01],
          updatedAt: new Date()
        },
        stats: {
          totalResponses: Math.floor(Math.random() * 50),
          successfulAssists: Math.floor(Math.random() * 45),
          avgResponseTime: Math.floor(Math.random() * 300) + 60,
          rating: (Math.random() * 1 + 4).toFixed(1),
          totalRatings: Math.floor(Math.random() * 30)
        }
      });

      console.log(`Created volunteer: ${user.name}`);
    }

    // Create safe zones
    for (const zoneData of safeZones) {
      await SafeZone.create(zoneData);
      console.log(`Created safe zone: ${zoneData.name}`);
    }

    // Create emergency contacts for the first user
    const regularUser = createdUsers.find(u => u.role === 'user');
    if (regularUser) {
      await EmergencyContact.create({
        user: regularUser._id,
        name: 'Mom',
        phone: '+91-9876500001',
        relation: 'Mother',
        isPrimary: true
      });

      await EmergencyContact.create({
        user: regularUser._id,
        name: 'Dad',
        phone: '+91-9876500002',
        relation: 'Father',
        isPrimary: false
      });

      console.log('Created emergency contacts');
    }

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Test Credentials:');
    console.log('═══════════════════════════════════════');
    console.log('Admin:     admin@safeher.com / admin123');
    console.log('User:      priya@example.com / password123');
    console.log('Volunteer: john@example.com / password123');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();
