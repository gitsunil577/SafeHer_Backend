const { Alert, Volunteer, EmergencyContact, User } = require('../models');
const { asyncHandler } = require('../middleware');
const config = require('../config/config');

// @desc    Create new alert (SOS)
// @route   POST /api/alerts
// @access  Private (User)
exports.createAlert = asyncHandler(async (req, res) => {
  const { latitude, longitude, address, message, type } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Location is required'
    });
  }

  // Create alert
  const alert = await Alert.create({
    user: req.user.id,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
      address
    },
    message,
    type: type || 'sos',
    status: 'active',
    priority: 'high',
    timeline: [{
      action: 'created',
      description: 'Emergency alert created',
      performedBy: req.user.id
    }]
  });

  // Find nearby volunteers (within 5km radius)
  const nearbyVolunteers = await Volunteer.find({
    isVerified: true,
    status: 'active',
    isOnDuty: true,
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: config.alert.searchRadius * 1000 // Convert km to meters
      }
    }
  })
    .limit(config.alert.maxVolunteersToNotify)
    .populate('user', 'name phone');

  // Add notified volunteers to alert
  const notifiedVolunteers = nearbyVolunteers.map(volunteer => ({
    volunteer: volunteer._id,
    notifiedAt: new Date(),
    distance: calculateDistance(
      latitude, longitude,
      volunteer.currentLocation.coordinates[1],
      volunteer.currentLocation.coordinates[0]
    ),
    status: 'notified'
  }));

  alert.notifiedVolunteers = notifiedVolunteers;

  // Get emergency contacts and mark as notified
  const emergencyContacts = await EmergencyContact.find({
    user: req.user.id,
    isActive: true
  });

  alert.notifiedContacts = emergencyContacts.map(contact => ({
    contact: contact._id,
    notifiedAt: new Date(),
    method: 'sms',
    status: 'sent'
  }));

  await alert.save();

  // Emit socket event for real-time notification
  if (req.io) {
    // Notify volunteers
    nearbyVolunteers.forEach(volunteer => {
      req.io.to(`volunteer_${volunteer.user._id}`).emit('new_alert', {
        alertId: alert._id,
        location: alert.location,
        distance: notifiedVolunteers.find(v => v.volunteer.equals(volunteer._id))?.distance,
        userName: req.user.name,
        message: alert.message
      });
    });

    // Notify emergency contacts (in real app, would send SMS)
    emergencyContacts.forEach(contact => {
      console.log(`Notifying contact: ${contact.name} at ${contact.phone}`);
    });
  }

  res.status(201).json({
    success: true,
    message: 'Emergency alert created successfully',
    data: {
      alertId: alert._id,
      volunteersNotified: nearbyVolunteers.length,
      contactsNotified: emergencyContacts.length
    }
  });
});

// @desc    Get alert by ID
// @route   GET /api/alerts/:id
// @access  Private
exports.getAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate('user', 'name phone')
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name phone' }
    })
    .populate('notifiedContacts.contact', 'name phone relation');

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  // Check authorization
  const isOwner = alert.user._id.equals(req.user.id);
  const isAdmin = req.user.role === 'admin';
  const isRespondingVolunteer = alert.respondingVolunteer?.volunteer?.user?._id?.equals(req.user.id);

  if (!isOwner && !isAdmin && !isRespondingVolunteer) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this alert'
    });
  }

  res.status(200).json({
    success: true,
    data: alert
  });
});

// @desc    Cancel alert
// @route   PUT /api/alerts/:id/cancel
// @access  Private (User who created it)
exports.cancelAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  if (!alert.user.equals(req.user.id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this alert'
    });
  }

  if (alert.status === 'resolved' || alert.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Alert is already closed'
    });
  }

  alert.status = 'cancelled';
  await alert.addTimelineEntry('cancelled', 'Alert cancelled by user', req.user.id);

  // Notify responding volunteer if any
  if (req.io && alert.respondingVolunteer?.volunteer) {
    const volunteer = await Volunteer.findById(alert.respondingVolunteer.volunteer).populate('user');
    req.io.to(`volunteer_${volunteer.user._id}`).emit('alert_cancelled', {
      alertId: alert._id
    });
  }

  res.status(200).json({
    success: true,
    message: 'Alert cancelled successfully'
  });
});

// @desc    Accept alert (Volunteer)
// @route   PUT /api/alerts/:id/accept
// @access  Private (Volunteer)
exports.acceptAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  if (alert.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Alert is no longer active'
    });
  }

  // Get volunteer profile
  const volunteer = await Volunteer.findOne({ user: req.user.id });

  if (!volunteer) {
    return res.status(403).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  // Check if volunteer was notified
  const notifiedEntry = alert.notifiedVolunteers.find(
    v => v.volunteer.equals(volunteer._id)
  );

  if (!notifiedEntry) {
    return res.status(403).json({
      success: false,
      message: 'You were not notified for this alert'
    });
  }

  // Update alert
  alert.status = 'responding';
  alert.respondingVolunteer = {
    volunteer: volunteer._id,
    acceptedAt: new Date(),
    distance: notifiedEntry.distance
  };
  alert.calculateResponseTime();

  // Update notified volunteer status
  notifiedEntry.status = 'accepted';

  await alert.addTimelineEntry(
    'accepted',
    `Volunteer ${req.user.name} accepted the alert`,
    req.user.id
  );

  // Notify the user
  if (req.io) {
    req.io.to(`user_${alert.user}`).emit('volunteer_responding', {
      alertId: alert._id,
      volunteerName: req.user.name,
      estimatedTime: Math.ceil(notifiedEntry.distance / 500) // Rough estimate: 500m per minute
    });
  }

  res.status(200).json({
    success: true,
    message: 'Alert accepted successfully',
    data: {
      alertId: alert._id,
      userLocation: alert.location
    }
  });
});

// @desc    Decline alert (Volunteer)
// @route   PUT /api/alerts/:id/decline
// @access  Private (Volunteer)
exports.declineAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  const volunteer = await Volunteer.findOne({ user: req.user.id });

  if (!volunteer) {
    return res.status(403).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  // Update notified volunteer status
  const notifiedEntry = alert.notifiedVolunteers.find(
    v => v.volunteer.equals(volunteer._id)
  );

  if (notifiedEntry) {
    notifiedEntry.status = 'declined';
    await alert.save();
  }

  // Update volunteer stats
  volunteer.stats.declinedAlerts += 1;
  await volunteer.save();

  res.status(200).json({
    success: true,
    message: 'Alert declined'
  });
});

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private (Volunteer or User)
exports.resolveAlert = asyncHandler(async (req, res) => {
  const { notes, rating, feedback } = req.body;
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  const isOwner = alert.user.equals(req.user.id);
  const volunteer = await Volunteer.findOne({ user: req.user.id });
  const isRespondingVolunteer = volunteer && alert.respondingVolunteer?.volunteer?.equals(volunteer._id);

  if (!isOwner && !isRespondingVolunteer && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to resolve this alert'
    });
  }

  alert.status = 'resolved';
  alert.resolution = {
    resolvedBy: req.user.id,
    resolvedAt: new Date(),
    notes,
    rating,
    feedback
  };
  alert.calculateTotalDuration();

  await alert.addTimelineEntry('resolved', 'Alert resolved', req.user.id);

  // Update volunteer stats if resolved by volunteer
  if (isRespondingVolunteer && volunteer) {
    await volunteer.updateStats(
      alert.responseTime,
      true,
      rating
    );
    await volunteer.checkBadges();
  }

  res.status(200).json({
    success: true,
    message: 'Alert resolved successfully'
  });
});

// @desc    Get nearby alerts (for volunteers)
// @route   GET /api/alerts/nearby
// @access  Private (Volunteer)
exports.getNearbyAlerts = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Location is required'
    });
  }

  const alerts = await Alert.find({
    status: 'active',
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: config.alert.searchRadius * 1000
      }
    }
  })
    .populate('user', 'name')
    .select('location message type priority createdAt');

  // Add distance to each alert
  const alertsWithDistance = alerts.map(alert => ({
    ...alert.toObject(),
    distance: calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      alert.location.coordinates[1],
      alert.location.coordinates[0]
    )
  }));

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alertsWithDistance
  });
});

// @desc    Update live location during active alert
// @route   PUT /api/alerts/:id/location
// @access  Private (User)
exports.updateAlertLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  if (!alert.user.equals(req.user.id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized'
    });
  }

  if (alert.status === 'resolved' || alert.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Alert is already closed'
    });
  }

  // Update location
  alert.location = {
    type: 'Point',
    coordinates: [longitude, latitude],
    address: alert.location.address,
    updatedAt: new Date()
  };

  // Add to location history for tracking
  if (!alert.locationHistory) {
    alert.locationHistory = [];
  }
  alert.locationHistory.push({
    coordinates: [longitude, latitude],
    timestamp: new Date()
  });

  await alert.save();

  // Notify responding volunteer of location update
  if (req.io && alert.respondingVolunteer?.volunteer) {
    const volunteer = await Volunteer.findById(alert.respondingVolunteer.volunteer).populate('user');
    if (volunteer) {
      req.io.to(`volunteer_${volunteer.user._id}`).emit('location_update', {
        alertId: alert._id,
        location: {
          lat: latitude,
          lng: longitude
        }
      });
    }
  }

  res.status(200).json({
    success: true,
    message: 'Location updated'
  });
});

// @desc    Get user's alerts
// @route   GET /api/alerts/my
// @access  Private (User)
exports.getMyAlerts = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = { user: req.user.id };
  if (status) {
    query.status = status;
  }

  const alerts = await Alert.find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name phone' }
    });

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts
  });
});

// @desc    Get user's current active alert
// @route   GET /api/alerts/active
// @access  Private (User)
exports.getActiveAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({
    user: req.user.id,
    status: { $in: ['active', 'responding'] }
  })
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name phone' }
    });

  res.status(200).json({
    success: true,
    data: alert
  });
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}
