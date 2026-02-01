const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    address: String,
    landmark: String,
    updatedAt: Date
  },
  locationHistory: [{
    coordinates: {
      type: [Number],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  liveLocationEnabled: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'responding', 'resolved', 'cancelled', 'expired'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high'
  },
  type: {
    type: String,
    enum: ['sos', 'medical', 'accident', 'harassment', 'other'],
    default: 'sos'
  },
  message: String,
  audioRecording: String, // URL to audio file
  images: [String], // URLs to images
  notifiedVolunteers: [{
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Volunteer'
    },
    notifiedAt: Date,
    distance: Number, // in meters
    status: {
      type: String,
      enum: ['notified', 'accepted', 'declined', 'no_response'],
      default: 'notified'
    }
  }],
  respondingVolunteer: {
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Volunteer'
    },
    acceptedAt: Date,
    arrivedAt: Date,
    distance: Number
  },
  notifiedContacts: [{
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyContact'
    },
    notifiedAt: Date,
    method: {
      type: String,
      enum: ['sms', 'call', 'push', 'email'],
      default: 'sms'
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent'
    }
  }],
  timeline: [{
    action: String,
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    notes: String,
    rating: Number,
    feedback: String
  },
  responseTime: Number, // Time until first volunteer accepted (in seconds)
  totalDuration: Number, // Total time from creation to resolution (in seconds)
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  }
});

// Index for geospatial queries
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ user: 1, createdAt: -1 });

// Update timestamp
alertSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Add timeline entry
alertSchema.methods.addTimelineEntry = async function(action, description, performedBy) {
  this.timeline.push({
    action,
    description,
    performedBy,
    timestamp: new Date()
  });
  await this.save();
};

// Calculate response time when volunteer accepts
alertSchema.methods.calculateResponseTime = function() {
  if (this.respondingVolunteer && this.respondingVolunteer.acceptedAt) {
    this.responseTime = Math.floor(
      (this.respondingVolunteer.acceptedAt - this.createdAt) / 1000
    );
  }
};

// Calculate total duration when resolved
alertSchema.methods.calculateTotalDuration = function() {
  if (this.resolution && this.resolution.resolvedAt) {
    this.totalDuration = Math.floor(
      (this.resolution.resolvedAt - this.createdAt) / 1000
    );
  }
};

module.exports = mongoose.model('Alert', alertSchema);
