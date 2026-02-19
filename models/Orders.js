const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: String,
  quantity: {
    type: Number,
    min: 1,
    required: function() {
      return this.itemType === 'adding';
    }
  }, 
  unitPrice: Number,
  consumptionType: String,
  expirationDate: {
    type: Date,
    default: null,
  },
  itemType: {
    type: String,
    enum: ['adding', 'replacement'],
    default: 'adding',
  },
  replacements: {
    type: [{
      batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product.batches",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      expirationDate: {
        type: Date,
        default: null
      }
    }],
    required: function() {
      return this.itemType === 'replacement';
    }
  },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  status: {
    type: String,
    trim: true,
    default: 'draft',
    enum: ['draft', 'pending', 'completed'],
  },
  supplierName: {
    type: String,
    trim: true,
    default: null,
    minlength: 2,
  },
  orderType: {
    type: String,
    trim: true,
    default: 'personal',
    enum: ['personal', 'pickup', 'delivery'],
  },
  deliveryDate: {
    type: Date,
    default: null
  },
  items: {
    type: [OrderItemSchema],
    default: [],
  },
}, { timestamps: true });

OrderSchema.pre('save', function(next) {
  this.items.forEach(item => {
    if (item.unitPrice && item.quantity != null) {
      item.totalPrice = item.unitPrice * item.quantity;
    }
  });
  next();
});

module.exports = mongoose.model("Order", OrderSchema);