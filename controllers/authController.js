const { User, Volunteer } = require('../models');
const { asyncHandler } = require('../middleware');
const logger = require('../utils/logger');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, address, bloodGroup } = req.body;

  logger.info(`Registration attempt for email: ${email}`);

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    logger.auth('Registration failed - Email exists', email, false);
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    address: { fullAddress: address },
    bloodGroup,
    role: 'user'
  });

  logger.auth('User registered successfully', email, true);
  sendTokenResponse(user, 201, res);
});

// @desc    Register volunteer
// @route   POST /api/auth/register/volunteer
// @access  Public
exports.registerVolunteer = asyncHandler(async (req, res) => {
  const {
    name, email, phone, password, address,
    idType, idNumber, occupation, experience, availability, skills
  } = req.body;

  logger.info(`Volunteer registration attempt for email: ${email}`);

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    logger.auth('Volunteer registration failed - Email exists', email, false);
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }

  // Create user with volunteer role
  const user = await User.create({
    name,
    email,
    phone,
    password,
    address: { fullAddress: address },
    role: 'volunteer'
  });

  // Create volunteer profile
  await Volunteer.create({
    user: user._id,
    idType,
    idNumber,
    occupation,
    experience,
    availability,
    skills: skills ? skills.split(',').map(s => s.trim()) : []
  });

  logger.auth('Volunteer registered successfully', email, true);
  logger.volunteer(`New volunteer profile created`, user._id);
  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  logger.info(`Login attempt for email: ${email}`);

  // Validate email & password
  if (!email || !password) {
    logger.auth('Login failed - Missing credentials', email, false);
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    logger.auth('Login failed - User not found', email, false);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    logger.auth('Login failed - Account deactivated', email, false);
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact support.'
    });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    logger.auth('Login failed - Wrong password', email, false);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  logger.auth(`Login successful (${user.role})`, email, true);
  sendTokenResponse(user, 200, res);
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  logger.auth('User logged out', req.user.email, true);

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  logger.info(`Fetching profile for user: ${req.user.email}`);

  const user = await User.findById(req.user.id);

  let volunteerData = null;
  if (user.role === 'volunteer') {
    volunteerData = await Volunteer.findOne({ user: user._id });
  }

  res.status(200).json({
    success: true,
    data: {
      user,
      volunteer: volunteerData
    }
  });
});

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res) => {
  logger.info(`Updating profile for user: ${req.user.email}`);

  const fieldsToUpdate = {
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
    bloodGroup: req.body.bloodGroup,
    medicalConditions: req.body.medicalConditions,
    allergies: req.body.allergies,
    emergencyMessage: req.body.emergencyMessage,
    settings: req.body.settings
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key =>
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  logger.success(`Profile updated for user: ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  logger.info(`Password update attempt for user: ${req.user.email}`);

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.matchPassword(req.body.currentPassword);
  if (!isMatch) {
    logger.auth('Password update failed - Wrong current password', req.user.email, false);
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  user.password = req.body.newPassword;
  await user.save();

  logger.auth('Password updated successfully', req.user.email, true);
  sendTokenResponse(user, 200, res);
});

// @desc    Update user location
// @route   PUT /api/auth/location
// @access  Private
exports.updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Please provide latitude and longitude'
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      lastLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
        updatedAt: new Date()
      }
    },
    { new: true }
  );

  // If volunteer, also update volunteer location
  if (user.role === 'volunteer') {
    await Volunteer.findOneAndUpdate(
      { user: user._id },
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
          updatedAt: new Date()
        }
      }
    );
    logger.volunteer(`Location updated [${latitude}, ${longitude}]`, user._id);
  }

  res.status(200).json({
    success: true,
    message: 'Location updated successfully'
  });
});

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified
      }
    });
};
