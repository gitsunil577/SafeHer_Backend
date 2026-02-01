const express = require('express');
const router = express.Router();
const { userController } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require authentication
router.use(protect);
router.use(authorize('user'));

// User profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// User alerts
router.get('/alerts', userController.getAlertHistory);

// Dashboard
router.get('/dashboard', userController.getDashboardStats);

// Settings
router.get('/settings', userController.getSettings);
router.put('/settings', userController.updateSettings);

module.exports = router;
