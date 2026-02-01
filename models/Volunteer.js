const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  idType: {
    type: String,
    enum: ['aadhar', 'passport', 'driving', 'voter'],
    required: [true, 'Please provide ID type']
  },
  idNumber: {
    type: String,
    required: [true, 'Please provide ID number']
  },
  idDocument: String, // URL to uploaded document
  occupation: String,
  organization: String,
  experience: String,
  skills: [String],
  availability: {
    type: String,
    enum: ['fulltime', 'daytime', 'nighttime', 'weekends', 'flexible'],
    default: 'flexible'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'suspended'],
    default: 'pending'
  },
  isOnDuty: {
    type: Boolean,
    default: false
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    updatedAt: Date
  },
  stats: {
    totalResponses: { type: Number, default: 0 },
    successfulAssists: { type: Number, default: 0 },
    declinedAlerts: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }, // in seconds
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 }
  },
  badges: [{
    name: String,
    icon: String,
    earnedAt: Date
  }],
  responseHistory: [{
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    },
    action: {
      type: String,
      enum: ['accepted', 'declined', 'completed', 'cancelled']
    },
    responseTime: Number, // in seconds
    rating: Number,
    feedback: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
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
volunteerSchema.index({ currentLocation: '2dsphere' });
volunteerSchema.index({ status: 1, isOnDuty: 1, isVerified: 1 });

// Update timestamp
volunteerSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Method to update stats after response
volunteerSchema.methods.updateStats = async function(responseTime, wasSuccessful, rating) {
  this.stats.totalResponses += 1;

  if (wasSuccessful) {
    this.stats.successfulAssists += 1;
  }

  // Update average response time
  const totalTime = this.stats.avgResponseTime * (this.stats.totalResponses - 1) + responseTime;
  this.stats.avgResponseTime = totalTime / this.stats.totalResponses;

  // Update rating
  if (rating) {
    const totalRating = this.stats.rating * this.stats.totalRatings + rating;
    this.stats.totalRatings += 1;
    this.stats.rating = totalRating / this.stats.totalRatings;
  }

  await this.save();
};

// Method to check and award badges
volunteerSchema.methods.checkBadges = async function() {
  const badgesToAward = [];

  // First Responder badge
  if (this.stats.totalResponses >= 1 && !this.badges.find(b => b.name === 'First Responder')) {
    badgesToAward.push({ name: 'First Responder', icon: '🏅', earnedAt: new Date() });
  }

  // 10 Assists badge
  if (this.stats.successfulAssists >= 10 && !this.badges.find(b => b.name === '10 Assists')) {
    badgesToAward.push({ name: '10 Assists', icon: '⭐', earnedAt: new Date() });
  }

  // 25 Assists badge
  if (this.stats.successfulAssists >= 25 && !this.badges.find(b => b.name === '25 Assists')) {
    badgesToAward.push({ name: '25 Assists', icon: '🌟', earnedAt: new Date() });
  }

  // 50 Assists badge
  if (this.stats.successfulAssists >= 50 && !this.badges.find(b => b.name === '50 Assists')) {
    badgesToAward.push({ name: '50 Assists', icon: '🏆', earnedAt: new Date() });
  }

  // Quick Responder badge (avg response time < 3 minutes)
  if (this.stats.avgResponseTime < 180 && this.stats.totalResponses >= 5 && !this.badges.find(b => b.name === 'Quick Responder')) {
    badgesToAward.push({ name: 'Quick Responder', icon: '⚡', earnedAt: new Date() });
  }

  if (badgesToAward.length > 0) {
    this.badges.push(...badgesToAward);
    await this.save();
  }

  return badgesToAward;
};

module.exports = mongoose.model('Volunteer', volunteerSchema);
