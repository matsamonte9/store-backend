const mongoose = require('mongoose');
// const thresholds = require('../config/threshold');

const BatchesSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    default: 0,
  },
  expirationDate: {
    type: Date,
    default: null,
  },
}, {
  toJSON: { 
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v
      return ret;
    }
  },
});

const ProductSchema = new mongoose.Schema({
  image: {
    type: String,
    required: [true, 'Please provide image']
  },
  imageId: {
    type: String,
  },
  name: {
    type: String,
    required: [true, 'Please provide name'],
    minlength: 4,
    maxlength: 100,
  },
  barcode: {
    type: Number,
    required: [true, 'Please provide barcode'],
    unique: true,
  },
  cost: {
    type: Number,
    required: [true, 'Please provide cost'],
    min: [0, 'Price must be positive'],
    max: 9999,
  },
  price: {
    type: Number,
    required: [true, 'Please provide price'],
    min: [0, 'Price must be positive'],
    max: 9999,
  },
  category: {
    type: String,
    enum: ['groceries', 'electronics'],
    required: true,
  },
  consumptionType: {
    type: String,
    enum: ['long', 'short', 'isExpiring', 'noExpiry'],
  },
  batches: [BatchesSchema],
  stock: {
    type: Number,
    default: 0,
  }
}, {
  toJSON: { 
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v
      return ret;
    }
  },
});

ProductSchema.pre('save', function () {
  if (this.batches && this.batches.length > 0) {
    this.stock = this.batches.reduce((sum, batch) => sum + batch.quantity, 0);
  } else {
    this.stock = 0;
  }

  // const stockLimit = thresholds[this.category].stock;
  // if (this.stock === 0) this.stockStatus = 'out of stock';
  // else if (this.stock <= stockLimit) this.stockStatus = 'low stock';
  // else this.stockStatus = 'high stock';


  // if (this.consumptionType === 'noExpiry' || !this.batches || this.batches.length === 0) {
  //   this.expirationStatus = 'no expiration';
  //   return;
  // } else {
  //   const category = thresholds[this.category];
  //   const consumptionDays = category?.expiration?.[this.consumptionType];

  //   const soonestExp = this.batches
  //     .filter(batch => batch.expirationDate)
  //     .map(batch => batch.expirationDate)
  //     .sort((a, b) => a - b)[0];

  //   if (!soonestExp) {
  //     this.expirationStatus = 'no expiration';
  //     return;
  //   } 

  //   const daysLeft = Math.ceil((soonestExp - new Date()) / (1000 * 60 * 60 * 24));

  //   if (daysLeft <= 0) this.expirationStatus = 'expired';
  //   else if (daysLeft <= consumptionDays) this.expirationStatus = 'expiring soon';
  //   else if (daysLeft > consumptionDays) this.expirationStatus = 'fresh';
  //   else this.expirationStatus = '';
  // }
});

// ProductSchema.post('save', function () {
//   const stockCount = this.stock 
// })


module.exports = mongoose.model('Product', ProductSchema);