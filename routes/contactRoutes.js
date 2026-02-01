const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { contactController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');

// Validation rules
const contactValidation = [
  body('name').trim().notEmpty().withMessage('Contact name is required'),
  body('phone').matches(/^[+]?[\d\s-]{10,15}$/).withMessage('Please provide a valid phone number'),
  body('relation').isIn(['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Colleague', 'Other'])
    .withMessage('Invalid relationship')
];

// All routes require authentication and user role
router.use(protect);
router.use(authorize('user'));

router.route('/')
  .get(contactController.getContacts)
  .post(contactValidation, validate, contactController.createContact);

router.route('/:id')
  .get(contactController.getContact)
  .put(contactController.updateContact)
  .delete(contactController.deleteContact);

router.put('/:id/primary', contactController.setPrimaryContact);

module.exports = router;
