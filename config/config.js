module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development'
  },

  // CORS Configuration
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  },

  // Alert Configuration
  alert: {
    // Radius in kilometers to find nearby volunteers
    searchRadius: 5,
    // Maximum volunteers to notify per alert
    maxVolunteersToNotify: 10,
    // Alert expiry time in minutes
    expiryTime: 30
  },

  // User Roles
  roles: {
    USER: 'user',
    VOLUNTEER: 'volunteer',
    ADMIN: 'admin'
  },

  // Alert Status
  alertStatus: {
    PENDING: 'pending',
    ACTIVE: 'active',
    RESPONDING: 'responding',
    RESOLVED: 'resolved',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    defaultCountryCode: process.env.TWILIO_DEFAULT_COUNTRY_CODE || '+91'
  },

  // Volunteer Status
  volunteerStatus: {
    PENDING: 'pending',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended'
  }
};
