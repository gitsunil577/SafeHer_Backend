/**
 * Logger utility for consistent console logging with colors and timestamps
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Text colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

const getTimestamp = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
};

const logger = {
  // Info - General information (cyan)
  info: (message, data = null) => {
    const timestamp = getTimestamp();
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.cyan}INFO${colors.reset}  ${message}`);
    if (data) console.log(`${colors.gray}         Data:${colors.reset}`, data);
  },

  // Success - Operation successful (green)
  success: (message, data = null) => {
    const timestamp = getTimestamp();
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.green}OK${colors.reset}    ${message}`);
    if (data) console.log(`${colors.gray}         Data:${colors.reset}`, data);
  },

  // Warning - Non-critical issues (yellow)
  warn: (message, data = null) => {
    const timestamp = getTimestamp();
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`);
    if (data) console.log(`${colors.gray}         Data:${colors.reset}`, data);
  },

  // Error - Critical failures (red)
  error: (message, error = null) => {
    const timestamp = getTimestamp();
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`);
    if (error) {
      if (error.stack) {
        console.log(`${colors.red}         Stack:${colors.reset}`, error.stack);
      } else {
        console.log(`${colors.red}         Details:${colors.reset}`, error);
      }
    }
  },

  // Database operations (magenta)
  db: (message, data = null) => {
    const timestamp = getTimestamp();
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.magenta}DB${colors.reset}    ${message}`);
    if (data) console.log(`${colors.gray}         Data:${colors.reset}`, data);
  },

  // HTTP Request logging (blue)
  request: (method, path, userId = null) => {
    const timestamp = getTimestamp();
    const methodColor = {
      GET: colors.green,
      POST: colors.blue,
      PUT: colors.yellow,
      DELETE: colors.red,
      PATCH: colors.cyan
    }[method] || colors.white;

    const userInfo = userId ? ` ${colors.gray}[User: ${userId}]${colors.reset}` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${methodColor}${method.padEnd(6)}${colors.reset} ${path}${userInfo}`);
  },

  // Auth events (yellow)
  auth: (action, email = null, success = true) => {
    const timestamp = getTimestamp();
    const status = success ? `${colors.green}SUCCESS${colors.reset}` : `${colors.red}FAILED${colors.reset}`;
    const userInfo = email ? ` - ${email}` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.yellow}AUTH${colors.reset}  ${action}${userInfo} [${status}]`);
  },

  // Alert/SOS events (red background for critical)
  alert: (action, alertId = null, userId = null) => {
    const timestamp = getTimestamp();
    const alertInfo = alertId ? ` [Alert: ${alertId}]` : '';
    const userInfo = userId ? ` [User: ${userId}]` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.bgRed}${colors.white} SOS ${colors.reset} ${action}${alertInfo}${userInfo}`);
  },

  // Socket events (cyan)
  socket: (event, socketId = null, data = null) => {
    const timestamp = getTimestamp();
    const socketInfo = socketId ? ` [${socketId}]` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.cyan}SOCKET${colors.reset} ${event}${socketInfo}`);
    if (data) console.log(`${colors.gray}         Data:${colors.reset}`, data);
  },

  // Volunteer actions (green)
  volunteer: (action, volunteerId = null) => {
    const timestamp = getTimestamp();
    const volunteerInfo = volunteerId ? ` [Volunteer: ${volunteerId}]` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.green}VOLUNTEER${colors.reset} ${action}${volunteerInfo}`);
  },

  // Admin actions (magenta)
  admin: (action, adminId = null) => {
    const timestamp = getTimestamp();
    const adminInfo = adminId ? ` [Admin: ${adminId}]` : '';
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors.magenta}ADMIN${colors.reset} ${action}${adminInfo}`);
  },

  // Divider for readability
  divider: () => {
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
  }
};

module.exports = logger;
