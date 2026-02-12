const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide contact name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Please provide contact phone number'],
    match: [/^[+]?[\d\s-]{10,15}$/, 'Please provide a valid phone number']
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  relation: {
    type: String,
    required: [true, 'Please provide relationship'],
    enum: ['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Colleague', 'Other']
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  notificationPreferences: {
    sms: { type: Boolean, default: true },
    call: { type: Boolean, default: true },
    email: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
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

// Index
emergencyContactSchema.index({ user: 1 });

// Limit contacts per user to 5
emergencyContactSchema.pre('save', async function() {
  if (this.isNew) {
    const count = await this.constructor.countDocuments({ user: this.user });
    if (count >= 5) {
      const error = new Error('Maximum 5 emergency contacts allowed');
      error.statusCode = 400;
      throw error;
    }
  }
  this.updatedAt = Date.now();
});

// Ensure only one primary contact per user
emergencyContactSchema.pre('save', async function() {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
});

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
