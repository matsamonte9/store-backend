const jwt = require('jsonwebtoken');
const { UnauthenticatedError } = require('../errors');

const authenticateUser = async (req, res, next) => {
  // const authHeader = req.headers.authorization;

  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   throw new UnauthenticatedError('Authentication Invalid');
  // }

  // const token = authHeader.split(' ')[1];

  const token = req.cookies?.token;
  
  try {
    const payload = jwt.verify(token, process.env.JWT_KEY);

    const { userId, role, name, email } = payload;

    req.user = { userId, role, name, email };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentication Invalid');
  }
}

module.exports = authenticateUser;