const express = require('express');
const router = express.Router();
const { volunteerController } = require('../controllers');
const { protect, authorize } = require('../middleware');

// Public routes - get nearby volunteers (for map display)
router.get('/nearby', protect, volunteerController.getNearbyVolunteers);
router.get('/list', volunteerController.getVolunteersList);

// Protected routes - require authentication and volunteer role
router.use(protect);
router.use(authorize('volunteer'));

// Profile routes
router.get('/profile', volunteerController.getProfile);
router.put('/profile', volunteerController.updateProfile);

// Duty status
router.put('/duty', volunteerController.toggleDuty);

// Location
router.put('/location', volunteerController.updateLocation);

// Dashboard
router.get('/dashboard', volunteerController.getDashboard);

// History
router.get('/history', volunteerController.getResponseHistory);

// Badges
router.get('/badges', volunteerController.getBadges);

module.exports = router;
