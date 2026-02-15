const { User, Volunteer, Alert, SafeZone, EmergencyContact } = require('../models');
const { asyncHandler } = require('../middleware');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboard = asyncHandler(async (req, res) => {
  // User stats
  const totalUsers = await User.countDocuments({ role: 'user' });
  const activeUsers = await User.countDocuments({ role: 'user', isActive: true });
  const newUsersToday = await User.countDocuments({
    role: 'user',
    createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
  });

  // Volunteer stats
  const totalVolunteers = await Volunteer.countDocuments();
  const activeVolunteers = await Volunteer.countDocuments({ status: 'active', isVerified: true });
  const pendingVerifications = await Volunteer.countDocuments({ isVerified: false, status: 'pending' });
  const onDutyVolunteers = await Volunteer.countDocuments({ isOnDuty: true, isVerified: true });

  // Alert stats
  const totalAlerts = await Alert.countDocuments();
  const activeAlerts = await Alert.countDocuments({ status: { $in: ['active', 'responding'] } });
  const resolvedToday = await Alert.countDocuments({
    status: 'resolved',
    'resolution.resolvedAt': { $gte: new Date().setHours(0, 0, 0, 0) }
  });

  // Calculate average response time
  const avgResponseTimeResult = await Alert.aggregate([
    { $match: { responseTime: { $exists: true, $gt: 0 } } },
    { $group: { _id: null, avgTime: { $avg: '$responseTime' } } }
  ]);
  const avgResponseTime = avgResponseTimeResult[0]?.avgTime || 0;

  // Calculate success rate
  const resolvedAlerts = await Alert.countDocuments({ status: 'resolved' });
  const cancelledAlerts = await Alert.countDocuments({ status: 'cancelled' });
  const successRate = totalAlerts > 0
    ? ((resolvedAlerts / (totalAlerts - cancelledAlerts)) * 100).toFixed(1)
    : 0;

  // Recent alerts
  const recentAlerts = await Alert.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'name')
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name' }
    })
    .select('status location type createdAt');

  res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday
      },
      volunteers: {
        total: totalVolunteers,
        active: activeVolunteers,
        onDuty: onDutyVolunteers,
        pendingVerification: pendingVerifications
      },
      alerts: {
        total: totalAlerts,
        active: activeAlerts,
        resolvedToday,
        avgResponseTime: Math.round(avgResponseTime),
        successRate
      },
      recentAlerts
    }
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const query = { role: 'user' };

  // Filter by status
  if (req.query.status === 'active') {
    query.isActive = true;
  } else if (req.query.status === 'inactive') {
    query.isActive = false;
  }

  // Search by name or email
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-password');

  // Get alert counts for each user
  const usersWithStats = await Promise.all(users.map(async (user) => {
    const alertCount = await Alert.countDocuments({ user: user._id });
    return {
      ...user.toObject(),
      alertCount
    };
  }));

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: usersWithStats
  });
});

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: user
  });
});

// @desc    Get all volunteers
// @route   GET /api/admin/volunteers
// @access  Private (Admin)
exports.getVolunteers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const query = {};

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by verification
  if (req.query.verified === 'true') {
    query.isVerified = true;
  } else if (req.query.verified === 'false') {
    query.isVerified = false;
  }

  const volunteers = await Volunteer.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name email phone');

  const total = await Volunteer.countDocuments(query);

  res.status(200).json({
    success: true,
    count: volunteers.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: volunteers
  });
});

// @desc    Verify volunteer
// @route   PUT /api/admin/volunteers/:id/verify
// @access  Private (Admin)
exports.verifyVolunteer = asyncHandler(async (req, res) => {
  const volunteer = await Volunteer.findByIdAndUpdate(
    req.params.id,
    {
      isVerified: true,
      status: 'active',
      verifiedAt: new Date(),
      verifiedBy: req.user.id
    },
    { new: true }
  ).populate('user', 'name email');

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer not found'
    });
  }

  // Update user verification status
  await User.findByIdAndUpdate(volunteer.user._id, { isVerified: true });

  res.status(200).json({
    success: true,
    message: 'Volunteer verified successfully',
    data: volunteer
  });
});

// @desc    Reject/Suspend volunteer
// @route   PUT /api/admin/volunteers/:id/status
// @access  Private (Admin)
exports.updateVolunteerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['active', 'inactive', 'suspended', 'pending'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  const volunteer = await Volunteer.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate('user', 'name email');

  if (!volunteer) {
    return res.status(404).json({
      success: false,
      message: 'Volunteer not found'
    });
  }

  res.status(200).json({
    success: true,
    message: `Volunteer status updated to ${status}`,
    data: volunteer
  });
});

// @desc    Get all alerts
// @route   GET /api/admin/alerts
// @access  Private (Admin)
exports.getAlerts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const query = {};

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by date range
  if (req.query.startDate && req.query.endDate) {
    query.createdAt = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate)
    };
  }

  const alerts = await Alert.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name phone')
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name phone' }
    });

  const total = await Alert.countDocuments(query);

  res.status(200).json({
    success: true,
    count: alerts.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: alerts
  });
});

// @desc    Get reports/analytics
// @route   GET /api/admin/reports
// @access  Private (Admin)
exports.getReports = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Alerts by day
  const alertsByDay = await Alert.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Alerts by location (top 10)
  const alertsByLocation = await Alert.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$location.address',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Top volunteers
  const topVolunteers = await Volunteer.find({ isVerified: true })
    .sort({ 'stats.successfulAssists': -1 })
    .limit(10)
    .populate('user', 'name')
    .select('stats user');

  // Response time distribution
  const responseTimeStats = await Alert.aggregate([
    { $match: { responseTime: { $exists: true, $gt: 0 } } },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$responseTime' },
        minTime: { $min: '$responseTime' },
        maxTime: { $max: '$responseTime' }
      }
    }
  ]);

  // User growth
  const userGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: startDate }, role: 'user' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      alertsByDay,
      alertsByLocation,
      topVolunteers,
      responseTimeStats: responseTimeStats[0] || {},
      userGrowth
    }
  });
});

// @desc    Create safe zone
// @route   POST /api/admin/safezones
// @access  Private (Admin)
exports.createSafeZone = asyncHandler(async (req, res) => {
  const { name, type, latitude, longitude, address, phone, operatingHours, services } = req.body;

  const safeZone = await SafeZone.create({
    name,
    type,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
      address
    },
    phone,
    operatingHours,
    services,
    isVerified: true,
    addedBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Safe zone created successfully',
    data: safeZone
  });
});

// @desc    Get all safe zones
// @route   GET /api/admin/safezones
// @access  Private (Admin)
exports.getSafeZones = asyncHandler(async (req, res) => {
  const safeZones = await SafeZone.find()
    .sort({ createdAt: -1 })
    .populate('addedBy', 'name');

  res.status(200).json({
    success: true,
    count: safeZones.length,
    data: safeZones
  });
});

// @desc    Update safe zone
// @route   PUT /api/admin/safezones/:id
// @access  Private (Admin)
exports.updateSafeZone = asyncHandler(async (req, res) => {
  const { name, type, latitude, longitude, address, phone, operatingHours, services } = req.body;

  const updateData = { name, type, phone, operatingHours, services };
  if (latitude !== undefined && longitude !== undefined) {
    updateData.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
      address: address || ''
    };
  } else if (address !== undefined) {
    updateData['location.address'] = address;
  }

  const safeZone = await SafeZone.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!safeZone) {
    return res.status(404).json({
      success: false,
      message: 'Safe zone not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Safe zone updated successfully',
    data: safeZone
  });
});

// @desc    Delete safe zone
// @route   DELETE /api/admin/safezones/:id
// @access  Private (Admin)
exports.deleteSafeZone = asyncHandler(async (req, res) => {
  const safeZone = await SafeZone.findByIdAndDelete(req.params.id);

  if (!safeZone) {
    return res.status(404).json({
      success: false,
      message: 'Safe zone not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Safe zone deleted successfully'
  });
});
