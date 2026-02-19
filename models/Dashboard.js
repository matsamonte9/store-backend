const mongoose = require('mongoose');

const DailyStatsSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  totalMoney: {
    type: Number,
    default: 10000,
  },
  dailySales: {
    type: Number,
    default: 0,
  },
  dailyProfit: {
    type: Number,
    default: 0,
  },
  transactionCount: {
    type: Number,
    default: 0,
  }
});

module.exports = mongoose.model('DailyStats', DailyStatsSchema);

