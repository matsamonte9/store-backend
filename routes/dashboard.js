const express = require('express');
const router = express.Router();

const {
  getDailyStats,
  getGlobalStats,
} = require('../controller/dashboard');
const authorizedPermission = require('../middleware/permission');

router.route('/', authorizedPermission('admin', 'cashier'))
  .get(getDailyStats);

router.get('/global-stats', authorizedPermission('admin'), getGlobalStats)

module.exports = router;