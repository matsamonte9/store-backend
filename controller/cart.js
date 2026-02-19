const Product = require('../models/Products');
const DailyStats = require('../models/Dashboard');
const thresholds = require('../config/threshold');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const { NotFoundError, BadRequestError } = require('../errors');
const {
  calculateValidStock,
  processProduct,
  generateCartToken,
  validateCartToken,
} = require('./utils.js');

const validateCartItems = async (req, res) => {
  const { items, forceOverride = false } = req.body;

  const validationErrors = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId });
    if (!product || !Array.isArray(product.batches)) {
      // validationErrors.push({
      //   productId: item.productId,
      //   error: 'Product not found'
      // });
      continue;
    }

    const unitDiscount = Math.min(Math.max(item.discount || 0, 0), product.price);
    totalAmount += (product.price - unitDiscount) * item.quantity;


    const processedProduct = processProduct(product.toObject(), thresholds);

    const validStock = processedProduct.validStocks;
    const expiredStock = processedProduct.expiredStocks;

    const expiringBatches = processedProduct.batches.filter(
      batch => batch.expirationStatus === 'expiring-soon'
    );

    if (expiringBatches.length > 0) {
      validationErrors.push({
        productId: processedProduct._id,
        productName: processedProduct.name,
        error: 'Item Expiring Soon',
        expiringSoonBatches: expiringBatches.map(b => ({
          batchId: b._id,
          quantity: b.quantity,
          expirationDate: b.expirationDate
        }))
      });
    }

    if (!expiredStock && item.quantity > validStock && !forceOverride) {
      validationErrors.push({
        productId: product._id,
        productName: product.name,
        error: 'Insufficient Stock',
        validStock,
        requested: item.quantity
      });
    }

    if (expiredStock && item.quantity > validStock && !forceOverride) {
      validationErrors.push({
        productId: product._id,
        productName: product.name,
        error: 'Check Expiration Date',
        validStock,
        requested: item.quantity
      });
    }
  }

  const canProceed = validationErrors.length === 0 || forceOverride;

  if (!canProceed) {
    return res.status(409).json({
      success: false,
      msg: 'Check for Errors',
      errors: validationErrors,
      requiresForceOverride: true
    });
  }

  const cartToken = generateCartToken(items);

  return res.status(StatusCodes.OK).json({
    success: true,
    errors: [],
    cartToken,
    totalAmount,
  });
};

const decreaseProductStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cartToken, cash } = req.body;
    const now = new Date();

    const items = validateCartToken(cartToken);
    if (!items) {
      return res.status(403).json({
        success: false,
        msg: 'Cart not validated or token expired'
      });
    }

    const processedItems = [];
    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId }).session(session);
      if (!product || !Array.isArray(product.batches)) {
        throw new BadRequestError(`No product with id ${item.productId}`);
      }

      const unitDiscount = Math.min(Math.max(item.discount || 0, 0), product.price);
      totalAmount += (product.price - unitDiscount) * item.quantity;
      totalCost += product.cost * item.quantity;

      let remainingQty = item.quantity;

      const batches = product.batches
        .filter(batch => {
          if (!batch.expirationDate) return true;
          return new Date(batch.expirationDate) > now;
        })
        .sort((a, b) => {
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return new Date(a.expirationDate) - new Date(b.expirationDate);
        });

      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const deduct = Math.min(batch.quantity, remainingQty);
        batch.quantity -= deduct;
        remainingQty -= deduct;
      }

      product.batches = product.batches.filter(batch => batch.quantity > 0);

      await product.save({ session });

      processedItems.push({
        productId: product._id,
        productName: product.name,
        requested: item.quantity,
        processed: item.quantity - remainingQty,
        remainingValidStock: calculateValidStock(product)
      });
    }

     if (typeof cash !== 'number' || cash < totalAmount) {
      throw new BadRequestError('Insufficient Cash');
    }

    const userId = req.user.userId;
    const today = now.toISOString().split('T')[0];
    let dailyStats = await DailyStats.findOne({ date: today, user: userId }).session(session);

    if (!dailyStats) {
      [dailyStats] = await DailyStats.create([{
        date: today,
        user: userId,
        totalMoney: 10000 + totalAmount,
        dailySales: totalAmount,
        dailyProfit: (totalAmount - totalCost),
        transactionCount: 1,
      }], { session });
    } else {
      dailyStats.totalMoney += totalAmount;
      dailyStats.dailySales += totalAmount;
      dailyStats.dailyProfit += (totalAmount - totalCost);
      dailyStats.transactionCount += 1;

      await dailyStats.save({ session });
    }

    await session.commitTransaction();

    return res.status(StatusCodes.OK).json({
      success: true,
      msg: 'Stock decreased successfully',
      totalAmount,
      cashValue: cash,
      change: cash - totalAmount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      msg: 'Transaction failed - all changes rolled back',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  validateCartItems,
  decreaseProductStock,
}

