const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authController } = require('../controllers');
const { protect, validate } = require('../middleware');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').matches(/^[+]?[\d\s-]{10,15}$/).withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const volunteerRegisterValidation = [
  ...registerValidation,
  body('idType').isIn(['aadhar', 'passport', 'driving', 'voter']).withMessage('Invalid ID type'),
  body('idNumber').notEmpty().withMessage('ID number is required'),
  body('availability').optional().isIn(['fulltime', 'daytime', 'nighttime', 'weekends', 'flexible'])
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/register/volunteer', volunteerRegisterValidation, validate, authController.registerVolunteer);
router.post('/login', loginValidation, validate, authController.login);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.put('/updatedetails', protect, authController.updateDetails);
router.put('/updatepassword', protect, authController.updatePassword);
router.put('/location', protect, authController.updateLocation);

module.exports = router;
