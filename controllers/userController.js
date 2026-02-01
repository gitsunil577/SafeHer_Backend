const { User, Alert, EmergencyContact } = require('../models');
const { asyncHandler } = require('../middleware');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = [
    'name', 'phone', 'address', 'bloodGroup',
    'medicalConditions', 'allergies', 'emergencyMessage', 'settings'
  ];

  const updates = {};
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Get user's alert history
// @route   GET /api/users/alerts
// @access  Private
exports.getAlertHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const alerts = await Alert.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('respondingVolunteer.volunteer', 'user')
    .populate({
      path: 'respondingVolunteer.volunteer',
      populate: { path: 'user', select: 'name' }
    });

  const total = await Alert.countDocuments({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: alerts.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
    data: alerts
  });
});

// @desc    Get user dashboard stats
// @route   GET /api/users/dashboard
// @access  Private
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get alert counts
  const totalAlerts = await Alert.countDocuments({ user: userId });
  const resolvedAlerts = await Alert.countDocuments({ user: userId, status: 'resolved' });
  const activeAlerts = await Alert.countDocuments({
    user: userId,
    status: { $in: ['active', 'responding'] }
  });

  // Get emergency contacts count
  const contactsCount = await EmergencyContact.countDocuments({ user: userId });

  // Get recent alerts
  const recentAlerts = await Alert.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('status type location createdAt');

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalAlerts,
        resolvedAlerts,
        activeAlerts,
        contactsCount
      },
      recentAlerts
    }
  });
});

// @desc    Get user settings
// @route   GET /api/users/settings
// @access  Private
exports.getSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('settings');

  res.status(200).json({
    success: true,
    data: user.settings
  });
});

// @desc    Update user settings
// @route   PUT /api/users/settings
// @access  Private
exports.updateSettings = asyncHandler(async (req, res) => {
  const { autoShareLocation, notifyContacts, silentMode, shakeToSOS } = req.body;

  const settings = {};
  if (autoShareLocation !== undefined) settings['settings.autoShareLocation'] = autoShareLocation;
  if (notifyContacts !== undefined) settings['settings.notifyContacts'] = notifyContacts;
  if (silentMode !== undefined) settings['settings.silentMode'] = silentMode;
  if (shakeToSOS !== undefined) settings['settings.shakeToSOS'] = shakeToSOS;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: settings },
    { new: true }
  ).select('settings');

  res.status(200).json({
    success: true,
    data: user.settings
  });
});
