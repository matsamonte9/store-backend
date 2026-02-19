const express = require('express');
const router = express.Router();

const authorizedPermission = require('../middleware/permission');

const {
  getAllProducts,
  getProduct,
  getAllProductBatch,
  getProductBatch,
  createProduct,
  addProductBatch,
  updateProduct,
  updateProductBatch,
  deleteProduct,
  deleteProductBatch,
  getProductByBarcode,
} = require('../controller/products');

const uploadProductImage = require('../middleware/upload-product-image');

router.route('/')
  .get(authorizedPermission('admin', 'inventory', 'cashier'), getAllProducts)
  .post(authorizedPermission('admin', 'inventory'), uploadProductImage.single("image"), createProduct);

router.get('/check-price', authorizedPermission('admin', 'inventory', 'cashier'), getProductByBarcode);
  
router.route('/:id')
  .get(authorizedPermission('admin', 'inventory', 'cashier'), getProduct)
  .patch(authorizedPermission('admin', 'inventory'), uploadProductImage.single("image"), updateProduct)
  .delete(authorizedPermission('admin', 'inventory'), deleteProduct);

router.route('/:id/batches', authorizedPermission('admin', 'inventory', 'cashier'))
  .get(getAllProductBatch);

router.route('/:id/batch', authorizedPermission('admin', 'inventory'))
  .post(addProductBatch)

router.route('/:id/batch/:batchId', authorizedPermission('admin', 'inventory'),)
  .get(getProductBatch)
  .patch(updateProductBatch)
  .delete(deleteProductBatch);

module.exports = router;