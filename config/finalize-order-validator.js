const Joi = require('joi');

const orderSchema = Joi.object({
  supplierName: Joi.string().trim().min(4).max(50).required().label('Supplier Name'),
  orderType: Joi.string().valid('personal', 'pickup', 'delivery').required().label('Order Type'),
  deliveryDate: Joi.date().allow(null, '').label('Delivery Date'),
});

module.exports = orderSchema;