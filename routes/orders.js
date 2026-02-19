const express = require('express');
const router = express.Router();

const {
  getAllOrders,
  createOrder,
  getOrder,
  finalizeOrder,
  deleteOrder,
  addOrReplaceItem,
  editCreatingOrderItem,
  editOrderedItem,
  deleteItem,
} = require('../controller/orders');

router.route('/')
  .post(createOrder)
  .get(getAllOrders);

router.route('/:orderId')
  .get(getOrder)
  .patch(finalizeOrder)
  .delete(deleteOrder);

router.route('/:orderId/items')
  .post(addOrReplaceItem);

router.route('/:orderId/create-order/items/:productId')
  .patch(editCreatingOrderItem);

router.route('/:orderId/ordered/items/:productId')
  .patch(editOrderedItem);

router.route('/:orderId/items/:productId')
  .delete(deleteItem);

// router.route('/:id/items/replace')
//   .post(replaceItem);

module.exports = router;