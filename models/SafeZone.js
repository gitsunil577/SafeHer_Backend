const mongoose = require('mongoose');

const safeZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide safe zone name'],
    trim: true
  },
  type: {
    type: String,
    enum: ['police', 'hospital', 'helpdesk', 'transport', 'public', 'atm', 'other'],
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  phone: String,
  operatingHours: {
    is24Hours: { type: Boolean, default: false },
    openTime: String,
    closeTime: String,
    days: [String]
  },
  services: [String],
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for geospatial queries
safeZoneSchema.index({ location: '2dsphere' });
safeZoneSchema.index({ type: 1, isActive: 1 });

// Update timestamp
safeZoneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SafeZone', safeZoneSchema);
