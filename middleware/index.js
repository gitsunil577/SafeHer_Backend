const { protect, authorize, optionalAuth } = require('./auth');
const { errorHandler, asyncHandler } = require('./errorHandler');
const validate = require('./validate');

module.exports = {
  protect,
  authorize,
  optionalAuth,
  errorHandler,
  asyncHandler,
  validate
};
