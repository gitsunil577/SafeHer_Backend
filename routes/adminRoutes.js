const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { adminController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// User management
router.get('/users', adminController.getUsers);
router.put('/users/:id/status', adminController.updateUserStatus);

// Volunteer management
router.get('/volunteers', adminController.getVolunteers);
router.put('/volunteers/:id/verify', adminController.verifyVolunteer);
router.put('/volunteers/:id/status', adminController.updateVolunteerStatus);

// Alert management
router.get('/alerts', adminController.getAlerts);

// Reports
router.get('/reports', adminController.getReports);

// Safe zones
router.get('/safezones', adminController.getSafeZones);
router.post('/safezones', [
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['police', 'hospital', 'helpdesk', 'transport', 'public', 'atm', 'other']),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 })
], validate, adminController.createSafeZone);
router.put('/safezones/:id', adminController.updateSafeZone);
router.delete('/safezones/:id', adminController.deleteSafeZone);

module.exports = router;
