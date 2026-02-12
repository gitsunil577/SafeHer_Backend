const { Volunteer, Alert, User } = require('../models');
const { asyncHandler } = require('../middleware');

// @desc    Get nearby active volunteers (for users to see on map)
// @route   GET /api/volunteers/nearby
// @access  Private (User)
exports.getNearbyVolunteers = asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 5000 } = req.query; // radius in meters, default 5km

  let query = {
    isVerified: true,
    status: 'active',
    isOnDuty: true
  };

  let volunteers;

  // If location provided, use geospatial query
  if (latitude && longitude) {
    volunteers = await Volunteer.find({
      ...query,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    })
    .populate('user', 'name phone')
    .select('user isOnDuty currentLocation stats.rating stats.successfulAssists availability skills')
    .limit(20);
  } else {
    // Without location, just get active volunteers
    volunteers = await Volunteer.find(query)
      .populate('user', 'name phone')
      .select('user isOnDuty currentLocation stats.rating stats.successfulAssists availability skills')
      .limit(20);
  }

  // Format response with distance calculation
  const formattedVolunteers = volunteers.map(vol => {
    let distance = null;
    if (latitude && longitude && vol.currentLocation?.coordinates) {
      distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        vol.currentLocation.coordinates[1],
        vol.currentLocation.coordinates[0]
      );
    }

    return {
      id: vol._id,
      name: vol.user?.name || 'SafeHer Volunteer',
      phone: vol.user?.phone,
      isOnDuty: vol.isOnDuty,
      position: vol.currentLocation?.coordinates ? {
        lat: vol.currentLocation.coordinates[1],
        lng: vol.currentLocation.coordinates[0]
      } : null,
      distance: distance ? `${distance.toFixed(1)} km` : null,
      distanceValue: distance,
      rating: vol.stats?.rating || 0,
      successfulAssists: vol.stats?.successfulAssists || 0,
      availability: vol.availability,
      skills: vol.skills || []
    };
  });

  // Sort by distance if available
  if (latitude && longitude) {
    formattedVolunteers.sort((a, b) => (a.distanceValue || 999) - (b.distanceValue || 999));
  }

  res.status(200).json({
    success: true,
    count: formattedVolunteers.length,
    data: formattedVolunteers
  });
});

// @desc    Get all volunteers list (for admin/public view)
// @route   GET /api/volunteers/list
// @access  Public
exports.getVolunteersList = asyncHandler(async (req, res) => {
  const volunteers = await Volunteer.find({
    isVerified: true,
    status: 'active'
  })
  .populate('user', 'name')
  .select('user isOnDuty currentLocation stats.rating stats.successfulAssists availability');

  const formattedVolunteers = volunteers.map(vol => ({
    id: vol._id,
    name: vol.user?.name || 'SafeHer Volunteer',
    isOnDuty: vol.isOnDuty,
    position: vol.currentLocation?.coordinates ? {
      lat: vol.currentLocation.coordinates[1],
      lng: vol.currentLocation.coordinates[0]
    } : null,
    rating: vol.stats?.rating || 0,
    successfulAssists: vol.stats?.successfulAssists || 0,
    availability: vol.availability
  }));

  res.status(200).json({
    success: true,
    count: formattedVolunteers.length,
    data: formattedVolunteers
  });
});

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// @desc    Get volunteer profile
// @route   GET /api/volunteers/profile
// @access  Private (Volunteer)
exports.getProfile = asyncHandler(async (req, res) => {
  const volunteer = await Volunteer.findOne({ user: req.user.id })
    .populate('user', 'name email phone');

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: volunteer
  });
});

// @desc    Update volunteer profile
// @route   PUT /api/volunteers/profile
// @access  Private (Volunteer)
exports.updateProfile = asyncHandler(async (req, res) => {
  const { availability, skills, occupation, organization } = req.body;

  const volunteer = await Volunteer.findOneAndUpdate(
    { user: req.user.id },
    {
      availability,
      skills,
      occupation,
      organization
    },
    { new: true, runValidators: true }
  );

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: volunteer
  });
});

// @desc    Toggle on-duty status
// @route   PUT /api/volunteers/duty
// @access  Private (Volunteer)
exports.toggleDuty = asyncHandler(async (req, res) => {
  const volunteer = await Volunteer.findOne({ user: req.user.id });

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  if (!volunteer.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending verification'
    });
  }

  volunteer.isOnDuty = !volunteer.isOnDuty;
  await volunteer.save();

  // Broadcast duty change to all connected clients via Socket.IO
  if (req.io) {
    req.io.emit('volunteer_status_update', {
      volunteerId: volunteer._id,
      volunteerName: req.user.name,
      isOnDuty: volunteer.isOnDuty,
      location: volunteer.currentLocation?.coordinates ? {
        lat: volunteer.currentLocation.coordinates[1],
        lng: volunteer.currentLocation.coordinates[0]
      } : null,
      timestamp: new Date()
    });
  }

  res.status(200).json({
    success: true,
    message: `You are now ${volunteer.isOnDuty ? 'on duty' : 'off duty'}`,
    data: { isOnDuty: volunteer.isOnDuty }
  });
});

// @desc    Update volunteer location
// @route   PUT /api/volunteers/location
// @access  Private (Volunteer)
exports.updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Please provide latitude and longitude'
    });
  }

  const volunteer = await Volunteer.findOneAndUpdate(
    { user: req.user.id },
    {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
        updatedAt: new Date()
      }
    },
    { new: true }
  );

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Location updated'
  });
});

// @desc    Get volunteer dashboard stats
// @route   GET /api/volunteers/dashboard
// @access  Private (Volunteer)
exports.getDashboard = asyncHandler(async (req, res) => {
  const volunteer = await Volunteer.findOne({ user: req.user.id })
    .populate('user', 'name email phone');

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  // Get recent response history
  const recentHistory = volunteer.responseHistory
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  // Get active alerts count (ones the volunteer is responding to)
  const activeAlerts = await Alert.countDocuments({
    'respondingVolunteer.volunteer': volunteer._id,
    status: 'responding'
  });

  res.status(200).json({
    success: true,
    data: {
      volunteer: {
        name: volunteer.user.name,
        email: volunteer.user.email,
        isVerified: volunteer.isVerified,
        isOnDuty: volunteer.isOnDuty,
        status: volunteer.status
      },
      stats: volunteer.stats,
      badges: volunteer.badges,
      recentHistory,
      activeAlerts
    }
  });
});

// @desc    Get volunteer response history
// @route   GET /api/volunteers/history
// @access  Private (Volunteer)
exports.getResponseHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const volunteer = await Volunteer.findOne({ user: req.user.id });

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  // Get alerts where volunteer responded
  const alerts = await Alert.find({
    'notifiedVolunteers.volunteer': volunteer._id
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user', 'name')
    .select('location status type createdAt resolution responseTime');

  const total = await Alert.countDocuments({
    'notifiedVolunteers.volunteer': volunteer._id
  });

  res.status(200).json({
    success: true,
    count: alerts.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: alerts
  });
});

// @desc    Get volunteer badges
// @route   GET /api/volunteers/badges
// @access  Private (Volunteer)
exports.getBadges = asyncHandler(async (req, res) => {
  const volunteer = await Volunteer.findOne({ user: req.user.id })
    .select('badges stats');

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer profile not found'
    });
  }

  // All possible badges
  const allBadges = [
    { name: 'First Responder', icon: '🏅', requirement: '1 response', required: 1, field: 'totalResponses' },
    { name: '10 Assists', icon: '⭐', requirement: '10 successful assists', required: 10, field: 'successfulAssists' },
    { name: '25 Assists', icon: '🌟', requirement: '25 successful assists', required: 25, field: 'successfulAssists' },
    { name: '50 Assists', icon: '🏆', requirement: '50 successful assists', required: 50, field: 'successfulAssists' },
    { name: 'Quick Responder', icon: '⚡', requirement: 'Avg response < 3 min', required: 180, field: 'avgResponseTime' },
    { name: 'Community Hero', icon: '🦸', requirement: '100 successful assists', required: 100, field: 'successfulAssists' }
  ];

  const badgesWithStatus = allBadges.map(badge => {
    const earned = volunteer.badges.find(b => b.name === badge.name);
    return {
      ...badge,
      earned: !!earned,
      earnedAt: earned?.earnedAt,
      progress: Math.min(volunteer.stats[badge.field] / badge.required * 100, 100)
    };
  });

  res.status(200).json({
    success: true,
    data: {
      earned: badgesWithStatus.filter(b => b.earned),
      locked: badgesWithStatus.filter(b => !b.earned)
    }
  });
});
