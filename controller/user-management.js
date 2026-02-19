const mongoose = require("mongoose");

const User = require('../models/User');
const DailyStats = require('../models/Dashboard');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');

const getAllUsers = async (req, res) => {
  const { filter } = req.query;

  let queryObject = {};

  if (filter) {
    if (filter === 'admin') queryObject.role = 'admin';
    if (filter === 'cashier') queryObject.role = 'cashier';
    if (filter === 'inventory') queryObject.role = 'inventory';
  }

  const result = User.find(queryObject).select('-password').sort('name');

  const users = await result;

  const today = new Date().toISOString().split('T')[0];

  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      const userObj = user.toObject();
      if (['cashier', 'admin'].includes(user.role)) {
        const stats = await DailyStats.findOne({ user: user._id, date: today });
        userObj.dailyStats = stats || {
          totalMoney: 10000,
          dailySales: 0,
          dailyProfit: 0,
          transactionCount: 0
        };
      }

      return userObj;
    })
  );

  res.status(StatusCodes.OK).json({ users: usersWithStats });
}

const getUser = async (req, res) => {
  const { targetUserId } = req.params;

  const user = await User.findById(targetUserId).select('-password');
  if (!user) {
    throw new NotFoundError('User Not Found');
  }

  const today = new Date().toISOString().split('T')[0];

  let stats = null;
  if (['admin', 'cashier'].includes(user.role)) {
    stats = await DailyStats.findOne({ user: user._id, date: today });
  }

  const userWithStats = {
    ...user.toObject(),
    dailyStats: stats || {
      totalMoney: 10000,
      dailySales: 0,
      dailyProfit: 0,
      transactionCount: 0
    }
  };

  res.status(StatusCodes.OK).json({ user: userWithStats });
}

const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    let errorName;
    let path;

    if (!name) {
      path = 'name';
      errorName = `"Name"`;
    } else if (!email) {
      path = 'email';
      errorName = `"Email"`;
    } else if (!password) {
      path = 'password';
      errorName = `"Password"`;
    } else if (!role) {
      path = 'role';
      errorName = `"Role"`;
    } 

    throw new BadRequestError(`${errorName} is required`, path);
  }

  if (!['cashier', 'inventory', 'admin'].includes(role)) {
    throw new BadRequestError('"Role" is invalid', 'role');
  } 

  await User.create({
    name,
    email,
    password,
    role,
  });

  res.status(StatusCodes.CREATED).json({ msg: 'User Created Successfully' });
}

const updateUser = async (req, res) => {
  const { name, role, dailyStats } = req.body;
  const { targetUserId } = req.params;
  const { userId } = req.user;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userDoc = await User.findById(targetUserId).session(session);
    if (!userDoc) {
      throw new NotFoundError("User not Found");
    }

    if (role && userId === targetUserId && role !== userDoc.role) {
      throw new BadRequestError('Not allowed to edit your own role');
    }

    const previousRole = userDoc.role;

    if (name !== undefined) userDoc.name = name;

    if (role !== undefined) {
      if (!["admin", "cashier", "inventory"].includes(role)) {
        throw new BadRequestError('Invalid Role', 'role');
      }
      userDoc.role = role;
    }

    await userDoc.save({ session });

    const today = new Date().toISOString().split('T')[0];

    if (
      ['admin', 'cashier'].includes(previousRole) &&
      userDoc.role === 'inventory'
    ) {
      await DailyStats.deleteMany(
        { user: userDoc._id },
        { session }
      );
    }
    
    if (dailyStats) {
      if (previousRole === 'inventory') {
        throw new BadRequestError(`Not allowed to send stats`);
      }
      
      if (dailyStats && ['admin', 'cashier'].includes(userDoc.role)) {
        const { totalMoney, dailySales, dailyProfit, transactionCount } = dailyStats;

        if (
          totalMoney < 0 || dailySales < 0 || dailyProfit < 0 || transactionCount < 0
        ) {
          let errorName;
          let path;
          if (totalMoney < 0) {
            path = 'totalMoney';
            errorName = '"Total Money"';
          } else if (dailySales < 0){
            path = 'dailySales';
            errorName = '"Daily Sales"';
          } else if (dailyProfit < 0) {
            path = 'dailyProfit';
            errorName = '"Daily Profit"';
          } else if (transactionCount < 0) {
            path = 'transactionCount';
            errorName = '"Transaction Count"';
          }

          throw new BadRequestError(`${errorName} values can't be negative`, path);
        }

        if (dailyProfit > dailySales) {
          throw new BadRequestError(`"Daily Profit" can't exceed Daily Sales`, 'dailyProfit');
        }
        if (dailySales > totalMoney) {
          throw new BadRequestError(`"Daily Sales" can't exceed Total Money`, 'dailySales');
        }

        if (dailyProfit && transactionCount < 1) {
          throw new BadRequestError(`"Transaction Count" can't be 0`, 'transactionCount')
        }

        if ((dailyProfit === 0 || dailySales === 0) && transactionCount > 0) {
          throw new BadRequestError(`"Transaction Count" is not needed`, 'transactionCount');
        }

        let stats = await DailyStats.findOne({
          date: today,
          user: userDoc._id
        }).session(session);

        if (!stats) {
          stats = await DailyStats.create([{
            date: today,
            user: userDoc._id,
            totalMoney: totalMoney,
            dailySales: dailySales,
            dailyProfit: dailyProfit,
            transactionCount: transactionCount,
          }], { session });
        } else {
          const statsUpdate = {};
          ['totalMoney', 'dailySales', 'dailyProfit', 'transactionCount']
            .forEach(key => {
              if (dailyStats[key] !== undefined) {
                statsUpdate[key] = dailyStats[key];
              }
            });

          Object.assign(stats, statsUpdate);
          await stats.save({ session });
        }
      }
    }

    await session.commitTransaction();

    res.status(StatusCodes.OK).json({
      msg: "User Updated Successfully"
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const deleteUser = async (req, res) => {
  const { targetUserId } = req.params;
  const { userId } = req.user;

  if ( userId === targetUserId ) {
    throw new BadRequestError('Not allowed to delete yourself');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findByIdAndDelete(targetUserId, { session });

    if (!user) {
      throw new NotFoundError('User Not Found');
    }

    await DailyStats.deleteMany({ user: targetUserId }, { session });

    await session.commitTransaction();

    res.status(StatusCodes.OK).json({ msg: "User Deleted Successfully "});
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
}