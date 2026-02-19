const express = require('express');
const router = express.Router();
const authenticateUser = require('../middleware/auth');

const {
  login,
  logout,
  currentUser,
} = require('../controller/auth');

router.post('/login', login);

router.post('/logout', logout);

router.get('/current-user', authenticateUser, currentUser);

module.exports = router;