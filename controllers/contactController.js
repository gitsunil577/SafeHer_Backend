const { EmergencyContact } = require('../models');
const { asyncHandler } = require('../middleware');

// @desc    Get all emergency contacts
// @route   GET /api/contacts
// @access  Private
exports.getContacts = asyncHandler(async (req, res) => {
  const contacts = await EmergencyContact.find({ user: req.user.id, isActive: true })
    .sort({ isPrimary: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: contacts.length,
    data: contacts
  });
});

// @desc    Get single contact
// @route   GET /api/contacts/:id
// @access  Private
exports.getContact = asyncHandler(async (req, res) => {
  const contact = await EmergencyContact.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  res.status(200).json({
    success: true,
    data: contact
  });
});

// @desc    Create emergency contact
// @route   POST /api/contacts
// @access  Private
exports.createContact = asyncHandler(async (req, res) => {
  const { name, phone, email, relation, isPrimary } = req.body;

  // Check contact limit
  const count = await EmergencyContact.countDocuments({ user: req.user.id, isActive: true });
  if (count >= 5) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 5 emergency contacts allowed'
    });
  }

  // Check for duplicate phone
  const existingContact = await EmergencyContact.findOne({
    user: req.user.id,
    phone,
    isActive: true
  });

  if (existingContact) {
    return res.status(400).json({
      success: false,
      message: 'Contact with this phone number already exists'
    });
  }

  // If this is the first contact or marked as primary, set isPrimary
  const shouldBePrimary = isPrimary || count === 0;

  const contact = await EmergencyContact.create({
    user: req.user.id,
    name,
    phone,
    email,
    relation,
    isPrimary: shouldBePrimary
  });

  res.status(201).json({
    success: true,
    message: 'Emergency contact added successfully',
    data: contact
  });
});

// @desc    Update emergency contact
// @route   PUT /api/contacts/:id
// @access  Private
exports.updateContact = asyncHandler(async (req, res) => {
  let contact = await EmergencyContact.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  const { name, phone, email, relation, isPrimary, notificationPreferences } = req.body;

  // Check for duplicate phone if phone is being changed
  if (phone && phone !== contact.phone) {
    const existingContact = await EmergencyContact.findOne({
      user: req.user.id,
      phone,
      isActive: true,
      _id: { $ne: req.params.id }
    });

    if (existingContact) {
      return res.status(400).json({
        success: false,
        message: 'Contact with this phone number already exists'
      });
    }
  }

  contact = await EmergencyContact.findByIdAndUpdate(
    req.params.id,
    { name, phone, email, relation, isPrimary, notificationPreferences },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Contact updated successfully',
    data: contact
  });
});

// @desc    Delete emergency contact
// @route   DELETE /api/contacts/:id
// @access  Private
exports.deleteContact = asyncHandler(async (req, res) => {
  const contact = await EmergencyContact.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  // Soft delete
  contact.isActive = false;
  await contact.save();

  // If deleted contact was primary, set another contact as primary
  if (contact.isPrimary) {
    const nextContact = await EmergencyContact.findOne({
      user: req.user.id,
      isActive: true
    });

    if (nextContact) {
      nextContact.isPrimary = true;
      await nextContact.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'Contact deleted successfully'
  });
});

// @desc    Set contact as primary
// @route   PUT /api/contacts/:id/primary
// @access  Private
exports.setPrimaryContact = asyncHandler(async (req, res) => {
  const contact = await EmergencyContact.findOne({
    _id: req.params.id,
    user: req.user.id,
    isActive: true
  });

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  // Remove primary from all other contacts
  await EmergencyContact.updateMany(
    { user: req.user.id, _id: { $ne: req.params.id } },
    { isPrimary: false }
  );

  // Set this contact as primary
  contact.isPrimary = true;
  await contact.save();

  res.status(200).json({
    success: true,
    message: 'Primary contact updated',
    data: contact
  });
});
