const express = require('express');
const router = express.Router();

const {
  validateCartItems,
  decreaseProductStock,
} = require('../controller/cart');

router.route('/validate-cart-items')
  .post(validateCartItems);

router.route('/decrease-product-stock')
  .post(decreaseProductStock);

module.exports = router;