const { NotFoundError, BadRequestError } = require('../errors');
const { StatusCodes } = require('http-status-codes');
const Order = require('../models/Orders');
const Product = require('../models/Products');
const orderSchema = require('../config/finalize-order-validator');
const mongoose = require('mongoose');

const getAllOrders = async (req, res) => {
  const { status } = req.query;
  const queryObject = {};

  if (status) {
    if (status === 'drafts') queryObject.status = 'draft';
    else if (status === 'pendings') queryObject.status = 'pending';
    else queryObject.status = 'completed';
  }

  const orders = await Order.find(queryObject);
  res.status(StatusCodes.OK).json({ orders });
}

const createOrder = async (req, res) => {
  const newOrder = await Order.create({
    status: 'draft',
    supplierName: null,
    orderType: 'personal',
    deliveryDate: null,
    items: [],
  });

  res.status(StatusCodes.CREATED).json({ newOrder });
}

const getOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`No order with id ${orderId}`);
  }

  res.status(StatusCodes.OK).json({ order });
}

const finalizeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new NotFoundError(`No order with id ${orderId}`);
    }

    if (order.status === 'completed') {
      throw new BadRequestError('Order already completed', "order-status");
    }

    if (order.items.length === 0) {
      throw new BadRequestError('Cannot save an empty order', "orders-length");
    }

    const orderDataToValidate = {
      supplierName: req.body.supplierName ?? order.supplierName,
      orderType: req.body.orderType ?? order.orderType,
      deliveryDate: req.body.deliveryDate ?? order.deliveryDate,
    };

    const { error, value } = orderSchema.validate(orderDataToValidate);
    if (error) {
      throw new BadRequestError(error.details[0].message, error.details[0].path[0]);
    }

    Object.assign(order, value);

    if (order.status === 'draft') {
      order.status = 'pending';
      await order.save({ session });
      await session.commitTransaction();
      return res.status(StatusCodes.OK).json({ msg: 'Order created succesfully' });
    }

    if (order.status !== 'pending') {
      throw new BadRequestError('Invalid order state', 'order-status');
    }

    const now = new Date();

    for (const item of order.items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) continue;

      if (item.itemType === 'replacement') {
        const batchesToAdd = new Map();

        for (const replacement of item.replacements) {
          const existingBatch = product.batches.find(
            b => b._id.toString() === replacement.batchId.toString()
          );
          if (!existingBatch) continue;

          if (product.consumptionType !== 'noExpiry' && !replacement.expirationDate) {
            throw new BadRequestError(
              `Expiration date is required for replacement batch ${replacement.batchId} of ${product.name}`
            );
          }
          if (product.consumptionType === 'noExpiry' && replacement.expirationDate) {
            throw new BadRequestError(
              `Replacement batch ${replacement.batchId} of ${product.name} must not have expiration date`
            );
          }

          if (existingBatch.quantity < replacement.quantity) {
            throw new BadRequestError(
              `Insufficient stock in batch ${replacement.batchId}. Available: ${existingBatch.quantity}, Requested: ${replacement.quantity}`
            );
          }

          existingBatch.quantity -= replacement.quantity;

          if (replacement.quantity > 0) {
            const expKey =
              replacement.expirationDate ? new Date(replacement.expirationDate).toISOString() : 'no-expiry';
            batchesToAdd.set(expKey, (batchesToAdd.get(expKey) || 0) + replacement.quantity);
          }
        }

        for (const [expKey, totalQuantity] of batchesToAdd) {
          const expirationDate = expKey === 'no-expiry' ? null : new Date(expKey);
          const existingBatchWithSameExp = product.batches.find(b => {
            if (product.consumptionType === 'noExpiry') return !b.expirationDate && !expirationDate;
            const bDate = b.expirationDate ? b.expirationDate.toISOString() : null;
            const rDate = expirationDate ? expirationDate.toISOString() : null;
            return bDate === rDate;
          });

          if (existingBatchWithSameExp) {
            existingBatchWithSameExp.quantity += totalQuantity;
          } else {
            product.batches.push({ quantity: totalQuantity, expirationDate });
          }
        }

        product.batches = product.batches.filter(batch => batch.quantity > 0);
      } else {
        if (product.consumptionType !== 'noExpiry' && !item.expirationDate) {
          throw new BadRequestError(`Expiration date is required for ${product.name}`);
        }
        if (product.consumptionType === 'noExpiry' && item.expirationDate) {
          throw new BadRequestError(`${product.name} must not have expiration date`);
        }

        const existingBatch = product.batches.find(b => {
          if (product.consumptionType === 'noExpiry') return !b.expirationDate && !item.expirationDate;
          const bDate = b.expirationDate ? b.expirationDate.toISOString() : null;
          const iDate = item.expirationDate ? new Date(item.expirationDate).toISOString() : null;
          return bDate === iDate;
        });

        if (existingBatch) {
          existingBatch.quantity += item.quantity;
        } else {
          product.batches.push({
            quantity: item.quantity,
            expirationDate: item.expirationDate || null,
          });
        }
      }

      await product.save({ session });
    }

    order.status = 'completed';
    await order.save({ session });

    await session.commitTransaction();

    res.status(StatusCodes.OK).json({
      msg: 'Order Successfully Added',
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const deleteOrder = async (req, res) => {
  const { params: { orderId } } = req;

  const order = await Order.findOneAndDelete({ _id: orderId });
  if (!order) {
    throw new NotFoundError(`No order with id ${orderId}`);
  }

  res.status(StatusCodes.OK).json({ msg: 'Order successfully deleted'});
}

function sanitizeItem(item) {
  if (item.itemType === 'adding') item.replacements = undefined;
  if (item.itemType === 'replacement') {
    item.quantity = undefined;
    item.expirationDate = undefined;
  }
  return item;
}

const addOrReplaceItem = async (req, res) => {
  const { body: { productId, quantity, itemType, replacements }, params: { orderId }} = req;
  const type = itemType || 'adding';

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`No order with id ${orderId}`);
  }

  if (order.status !== 'draft') {
    throw new BadRequestError("Cannot modify anymore, you are not creating order");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  if (type === 'replacement') {
    if (!replacements || !replacements.batchId) {
      throw new BadRequestError('Replacement must include a batchId');
    }
    if (quantity) throw new BadRequestError('Cannot include quantity when replacing items');

    const existingItem = order.items.find(i => i.productId.toString() === productId && i.itemType === 'replacement');

    const batch = product.batches.find(batch => batch._id.toString() === replacements.batchId);
    if (!batch) throw new NotFoundError(`No product with id ${replacements.batchId}`);

    if (existingItem) {
      const existingBatch = existingItem.replacements.find(r => r.batchId.toString() === replacements.batchId);

      if (existingBatch) throw new BadRequestError(`Batch ${replacements.batchId} is already in the order`);

      existingItem.replacements.push({
        batchId: batch._id,
        quantity: batch.quantity,
      });

      existingItem.quantity = existingItem.replacements.reduce((sum, r) => sum + r.quantity, 0);
    } else {
      const newItem = {
        productId: product._id,
        productName: product.name,
        unitPrice: product.cost,
        consumptionType: product.consumptionType,
        itemType: 'replacement',
        replacements: [{
          batchId: batch._id,
          quantity: batch.quantity
        }]
      }
      order.items.push(newItem);
    }
  } else {
    if (replacements) throw new BadRequestError('Cannot include replacements when adding items');

    const existingItem = order.items.find(i => i.productId.toString() === productId && i.itemType === 'adding');
     
    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      const newItem = {
        productId: product._id,
        productName: product.name,
        quantity: quantity || 1,
        unitPrice: product.cost,
        consumptionType: product.consumptionType,
      }
      order.items.push(newItem);
    }
  }
  
  order.items = order.items.map(item => sanitizeItem(item));

  await order.save();
  res.status(StatusCodes.OK).json({ order });
}

const editCreatingOrderItem = async (req, res) => {
  const { body: { quantity }, params: { productId, orderId }, query: { itemType, batchId } } = req;
  const type = itemType || 'adding';

  if (quantity <= 0) {
    throw new BadRequestError(`Quantity can't be 0`)
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`No order with id ${orderId}`);
  }

  if (order.status !== 'draft') throw new BadRequestError(`Cannot modify anymore, you are not creating order`);

  const item = order.items.find(i => i.productId.toString() === productId && i.itemType === type);
  if (!item) {
    throw new NotFoundError(`Product ${productId} not found in the order`);
  }
  
  if (item.itemType === 'replacement') {
    if (!batchId) throw new BadRequestError('Replacement edit requires batchId');
    const replacementItem = item.replacements.find(r => r.batchId.toString() === batchId);
    if (!replacementItem) throw new NotFoundError(`Replacement batch ${batchId} not found`);

    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError(`No product with id ${productId}`);
    }

    const batch = product.batches.find(batch => {
      return batch._id.toString() === batchId;
    });
    if (!batch) throw new NotFoundError(`Batch ${batchId} not found in product`);

    if (quantity > batch.quantity) {
      throw new BadRequestError(`Can't be greater than stock`);
    }

    replacementItem.quantity = quantity;
  } else {
    item.quantity = quantity;
  }

  order.items = order.items.map(item => sanitizeItem(item));
  
  await order.save();
  res.status(StatusCodes.OK).json({ order });
}

const editOrderedItem = async (req, res) => {
  const { body: { quantity, expirationDate }, params: { productId, orderId }, query: { itemType, batchId } } = req;
  const type = itemType || 'adding';

  if (quantity <= 0) {
    throw new BadRequestError(`Quantity can't be 0`)
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`No order with id ${orderId}`);
  }

  if (order.status !== 'pending') {
    throw new BadRequestError("Order status should be pending");
  }

  const item = order.items.find(i => i.productId.toString() === productId && i.itemType === type);
  if (!item) {
    throw new NotFoundError(`Product ${productId} not found in the order`);
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }
  
  if (item.itemType === 'replacement') {
    if (!batchId) throw new BadRequestError('Replacement edit requires batchId');
    const replacementItem = item.replacements.find(r => r.batchId.toString() === batchId);
    if (!replacementItem) throw new NotFoundError(`Replacement batch ${batchId} not found`);

    const batch = product.batches.find(batch => {
      return batch._id.toString() === batchId;
    });
    if (!batch) throw new NotFoundError(`Batch ${batchId} not found in product`);

    if (quantity > batch.quantity) {
      throw new BadRequestError(`Can't be greater than stock`);
    }

    if (expirationDate && product.consumptionType === 'noExpiry') {
      throw new BadRequestError(`Batch ${batchId} of product "${product.name}" must not have expiration date`);
    }
    if (!expirationDate && product.consumptionType !== 'noExpiry') {
      throw new BadRequestError(`Expiration date is required for batch ${batchId} of product "${product.name}"`);
    }

    replacementItem.quantity = quantity;
    replacementItem.expirationDate = expirationDate ? new Date(expirationDate) : null;
  } else {
    if (expirationDate && product.consumptionType === 'noExpiry') {
      throw new BadRequestError(`This product must not have expiration date`);
    }
    if (!expirationDate && product.consumptionType !== 'noExpiry') {
      throw new BadRequestError(`Expiration date is required for ${product.name}`);
    }

    item.quantity = quantity;
    item.expirationDate = expirationDate ? new Date(expirationDate) : null;
  }
  
  order.items = order.items.map(item => sanitizeItem(item));

  await order.save();
  res.status(StatusCodes.OK).json({ order });
}

const deleteItem = async (req, res) => {
  const { orderId, productId } = req.params;
  const { itemType, batchId } = req.query;

  const type = itemType || 'adding';

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError(`No order with id ${orderId}`);

  if (order.status === 'completed') {
    throw new BadRequestError("Cannot modify a completed order");
  }

  if (itemType === 'adding') {
    order.items = order.items.filter(
      i => !(i.productId.toString() === productId && i.itemType === 'adding')
    );
  }

  if (itemType === 'replacement') {
    const item = order.items.find(
      i => i.productId.toString() === productId && i.itemType === 'replacement'
    );

    if (!item) throw new NotFoundError('Replacement item not found');

    item.replacements = item.replacements.filter(
      r => r.batchId.toString() !== batchId
    );

    if (item.replacements.length === 0) {
      order.items = order.items.filter(i => i !== item);
    }
  }

  await order.save();

  res.status(StatusCodes.OK).json({ order, msg: `Product is deleted successfully!` });
}

module.exports = {
  getAllOrders,
  createOrder,
  getOrder,
  finalizeOrder,
  deleteOrder,
  addOrReplaceItem,
  editCreatingOrderItem,
  editOrderedItem,
  deleteItem,
}