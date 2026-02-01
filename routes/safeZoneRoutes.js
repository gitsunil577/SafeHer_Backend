const express = require('express');
const router = express.Router();
const { SafeZone } = require('../models');
const { asyncHandler, protect, optionalAuth } = require('../middleware');

// @desc    Get nearby safe zones
// @route   GET /api/safezones/nearby
// @access  Public
router.get('/nearby', optionalAuth, asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 5, type } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Please provide latitude and longitude'
    });
  }

  const query = {
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
      }
    }
  };

  if (type) {
    query.type = type;
  }

  const safeZones = await SafeZone.find(query).limit(20);

  // Calculate distance for each safe zone
  const safeZonesWithDistance = safeZones.map(zone => {
    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      zone.location.coordinates[1],
      zone.location.coordinates[0]
    );
    return {
      ...zone.toObject(),
      distance
    };
  });

  res.status(200).json({
    success: true,
    count: safeZones.length,
    data: safeZonesWithDistance
  });
}));

// @desc    Get safe zone by ID
// @route   GET /api/safezones/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const safeZone = await SafeZone.findById(req.params.id);

  if (!safeZone) {
    return res.status(404).json({
      success: false,
      message: 'Safe zone not found'
    });
  }

  res.status(200).json({
    success: true,
    data: safeZone
  });
}));

// @desc    Get all safe zones by type
// @route   GET /api/safezones
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const query = { isActive: true };

  if (type) {
    query.type = type;
  }

  const safeZones = await SafeZone.find(query).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: safeZones.length,
    data: safeZones
  });
}));

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

module.exports = router;
