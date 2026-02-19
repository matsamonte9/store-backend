const DailyStats = require('../models/Dashboard');
const { StatusCodes } = require('http-status-codes');

const getDailyStats = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { userId, role } = req.user;

  const stats = await DailyStats.findOne({ date: today, user: userId });
  
  res.status(StatusCodes.OK).json({ 
    stats : stats || {
      totalMoney: 10000,
      dailySales: 0,
      dailyProfit: 0,
      transactionCount: 0, 
    }
  });
}

const getGlobalStats = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const statsArray = await DailyStats.find({ date: today });

  const globalStats = statsArray.reduce((acc, stat) => {
    acc.totalMoney += stat.totalMoney;
    acc.dailySales += stat.dailySales;
    acc.dailyProfit += stat.dailyProfit;
    acc.transactionCount += stat.transactionCount;
  }, {totalMoney: 0, dailySales: 0, dailyProfit: 0, transactionCount: 0, });

  res.status(StatusCodes.OK).json({ stats: globalStats });
}

module.exports = {
  getDailyStats,
  getGlobalStats,
}