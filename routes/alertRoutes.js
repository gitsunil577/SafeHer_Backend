const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { alertController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');

// Validation rules
const createAlertValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

const locationUpdateValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

// All routes require authentication
router.use(protect);

// User routes - Get user's alerts and active alert
router.get('/my', authorize('user'), alertController.getMyAlerts);
router.get('/active', authorize('user'), alertController.getActiveAlert);

// Create new alert
router.post('/',
  authorize('user'),
  createAlertValidation,
  validate,
  alertController.createAlert
);

// Get alert by ID
router.get('/:id', alertController.getAlert);

// Update live location during alert
router.put('/:id/location',
  authorize('user'),
  locationUpdateValidation,
  validate,
  alertController.updateAlertLocation
);

// Cancel alert
router.put('/:id/cancel',
  authorize('user'),
  alertController.cancelAlert
);

// Resolve alert
router.put('/:id/resolve',
  authorize('user', 'volunteer', 'admin'),
  alertController.resolveAlert
);

// Volunteer routes
router.get('/nearby/active',
  authorize('volunteer'),
  alertController.getNearbyAlerts
);

router.put('/:id/accept',
  authorize('volunteer'),
  alertController.acceptAlert
);

router.put('/:id/decline',
  authorize('volunteer'),
  alertController.declineAlert
);

module.exports = router;
