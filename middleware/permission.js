const { UnauthorizedError } = require('../errors');

const authorizedPermission = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new UnauthorizedError('Unauthorized to access this route');
    }

    next();
  }
}

module.exports = authorizedPermission;