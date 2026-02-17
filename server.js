const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');
const config = require('./config/config');

// Import routes
const {
  authRoutes,
  userRoutes,
  alertRoutes,
  contactRoutes,
  volunteerRoutes,
  adminRoutes,
  safeZoneRoutes
} = require('./routes');

// Import error handler
const { errorHandler } = require('./middleware');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to database
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware for development
if (config.server.env === 'development') {
  app.use(morgan('dev'));
}

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/safezones', safeZoneRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Women Safety & Emergency Assistance API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      alerts: '/api/alerts',
      contacts: '/api/contacts',
      volunteers: '/api/volunteers',
      admin: '/api/admin',
      safezones: '/api/safezones'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user-specific room
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join volunteer-specific room
  socket.on('join_volunteer', (userId) => {
    socket.join(`volunteer_${userId}`);
    console.log(`Volunteer ${userId} joined their room`);
  });

  // Handle location updates
  socket.on('location_update', (data) => {
    const { userId, latitude, longitude, userType } = data;

    // Broadcast to relevant parties
    if (userType === 'user' && data.alertId) {
      // Broadcast to responding volunteer
      io.emit(`alert_${data.alertId}_location`, {
        latitude,
        longitude,
        timestamp: new Date()
      });
    }
  });

  // Handle volunteer status updates - broadcast to all connected clients
  socket.on('volunteer_status', (data) => {
    const { volunteerId, volunteerName, isOnDuty, location } = data;
    console.log(`Volunteer ${volunteerId} is now ${isOnDuty ? 'on duty' : 'off duty'}`);
    // Broadcast to ALL connected clients so user dashboards update in real-time
    socket.broadcast.emit('volunteer_status_update', {
      volunteerId,
      volunteerName,
      isOnDuty,
      location,
      timestamp: new Date()
    });
  });

  // Handle volunteer location broadcast
  socket.on('volunteer_location_update', (data) => {
    const { volunteerId, latitude, longitude } = data;
    socket.broadcast.emit('volunteer_moved', {
      volunteerId,
      latitude,
      longitude,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup stale alerts: mark old active/responding alerts as expired, delete 7+ day old alerts
const cleanupAlerts = async () => {
  try {
    const Alert = require('./models/Alert');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Mark active/responding alerts older than 24 hours as expired
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredResult = await Alert.updateMany(
      {
        status: { $in: ['active', 'pending', 'responding'] },
        createdAt: { $lt: oneDayAgo }
      },
      { $set: { status: 'expired' } }
    );
    if (expiredResult.modifiedCount > 0) {
      console.log(`[Cleanup] Expired ${expiredResult.modifiedCount} stale alert(s)`);
    }

    // Delete all alerts older than 7 days
    const deleteResult = await Alert.deleteMany({
      createdAt: { $lt: sevenDaysAgo }
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`[Cleanup] Deleted ${deleteResult.deletedCount} alert(s) older than 7 days`);
    }
  } catch (err) {
    console.error('[Cleanup] Error cleaning up alerts:', err.message);
  }
};

// Start server
const PORT = config.server.port;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   Women Safety & Emergency Assistance API                 ║
  ║                                                           ║
  ║   Server running in ${config.server.env} mode                    ║
  ║   Port: ${PORT}                                              ║
  ║   API: http://localhost:${PORT}/api                          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);

  // Run cleanup on startup and every 6 hours
  cleanupAlerts();
  setInterval(cleanupAlerts, 6 * 60 * 60 * 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = { app, server, io };
