const Joi = require('joi');

const batchSchema = Joi.object({
  quantity: Joi
    .number()
    .min(1)
    .required()
    .label('Quantity'),
  expirationDate: Joi
    .date()
    .empty(["", null])
    .default(null)
    .label('Expiration Date')
})
  .messages({
    'number.base': '{#label} must be Number',
    'date.base': '{#label} must be Date',
    'number.min': '{#label} must not be 0',
    'number.max': '{#label} must be less than or equal to {#limit}',
    'any.required': '{#label} is required',
    'any.custom': '{{#message}}',
  });

const batchesSchema = Joi.object({
  batches: Joi
    .array()
    .items(batchSchema),
}).messages({
  'array.base': '{#label} must be Array',
  'any.custom': '{{#message}}',
});

const productSchema = Joi.object({
  image: Joi
    .string()
    .required()
    .label('Label'),
  imageId: Joi
    .string(),
  name: Joi
    .string()
    .trim()
    .min(4)
    .max(100)
    .required()
    .label('Name'),
  barcode: Joi
    .number()
    .required()
    .label('Barcode'),
  cost: Joi
    .number()
    .min(0)
    .max(9000)
    .required()
    .label('Cost'),
  price: Joi
    .number()
    .min(0)
    .max(9999)
    .required()
    .label('Price')
    .custom((value, helpers) => {
      const obj = helpers.state.ancestors[0];

      if (value < obj.cost) {
        return helpers.error('any.custom', { message: '"Price" is lower than cost'});
      }
      return value;
    }),
  category: Joi
    .string()
    .trim()
    .valid('groceries', 'electronics')
    .required()
    .label('Category'),
  consumptionType: Joi
    .string()
    .trim()
    .empty(["", null])
    .default('noExpiry')
    .label('Consumption Type')
    .custom((value, helpers) => {
      const obj = helpers.state.ancestors[0];

      const allowed = 
        obj.category === 'groceries'
          ? ['short', 'long', 'noExpiry']
          : ['isExpiring', 'noExpiry'];

      if (!allowed.includes(value)) {
        return helpers.error('any.custom', { message: `Invalid Consumption Type` });
      }

      return value;
    }),
  stock: Joi.forbidden(),
  stockStatus: Joi.forbidden(),
  expirationStatus: Joi.forbidden(),
}).messages({
  'string.base': '{#label} must be String',
  'number.base': '{#label} must be Number',
  'date.base': '{#label} must be Date',
  'string.min': '{#label} must be {#limit} characters',
  'string.max': '{#label} must be less than {#limit} characters',
  'number.min': '{#label} must be greater {#limit}',
  'number.max': '{#label} must be less than {#limit}',
  'any.required': '{#label} is required',
  'any.only': '{#label} is invalid',
  'any.custom': '{{#message}}',
});

const updateProductSchema = productSchema
  .fork(['name', 'barcode', 'cost', 'price', 'category', 'consumptionType'], field => field.optional());

module.exports = { productSchema, updateProductSchema, batchesSchema };