const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { UnauthenticatedError } = require('../errors');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthenticatedError('Invalid Credentials');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid Credentials')
  }

  const token = user.createJWT();

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(StatusCodes.OK).json({ user: { userId: user._id, name: user.name, role: user.role, email: user.email } });
}

const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(200).json({ msg: 'Logged out successfully' });
}

const currentUser = async (req, res) => {
  const { _id, name, email, role } = req.user;
  res.status(200).json({ user: { userId: _id, name, email, role } });
}

module.exports = {
  login,
  logout,
  currentUser,
}