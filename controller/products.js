const Product = require('../models/Products');
const { productSchema, updateProductSchema, batchesSchema } = require('../config/validator');
const thresholds = require('../config/threshold');
const { StatusCodes } = require('http-status-codes');
const { NotFoundError, BadRequestError } = require('../errors');
const {
  calculateValidStock,
  calculateExpiredStock,
  calculateBatchStockStatus,
  calculateExpirationStatus,
  processBatch,
  processProduct,
  productMatchesFilter,
  getEarliestExpirationDate,
  calculateProductCounts,
  deleteImage,
} = require('./utils.js');
const cloudinary = require('../config/cloudinary');

const getAllProducts = async (req, res) => {
  const { sort, filter, name } = req.query;
  let limit = Number(req.query.limit) || 10;
  let page = Number(req.query.page) || 1;

  let queryObject = {};

  const totalProductCount = await Product.countDocuments();

  if (name) {
    queryObject.$or = [];
    
    queryObject.$or.push({ name: {$regex: name, $options: 'i'} });
    
    const barcodeNumber = Number(name);
    if (!isNaN(barcodeNumber) && isFinite(barcodeNumber)) {
      queryObject.$or.push({ barcode: barcodeNumber });
    }
  }

  let result = Product.find(queryObject);
  let products = await result;

  products = products.map(product => {
    return processProduct(product.toObject(), thresholds);
  });

  const counts = calculateProductCounts(products);

  if (filter) {
    products = products.filter(product => productMatchesFilter(product, filter));
  }

if (sort) {
  const sortField = sort.replace('-', '');
  const sortDirection = sort.startsWith('-') ? 'desc' : 'asc';
  
  products.sort((a, b) => {
    let aValue, bValue;
    
    switch(sortField) {
      case 'name':
      case 'barcode':
      case 'category':
      case 'consumptionType':
        aValue = a[sortField];
        bValue = b[sortField];
        break;
        
      case 'cost':
      case 'price':
        aValue = Number(a[sortField]) || 0;
        bValue = Number(b[sortField]) || 0;
        break;
        
      case 'stock':
        aValue = a.validStocks || 0;
        bValue = b.validStocks || 0; 
        break;
        
      case 'stockStatus':
        const stockStatusOrder = {
          'out-of-stock': 0,    
          'low-stock': 1,         
          'high-stock': 2         
        };
        aValue = stockStatusOrder[a.stockStatus] || 0;
        bValue = stockStatusOrder[b.stockStatus] || 0;
        break;
        
      case 'expirationStatus':
        const expirationStatusOrder = {
          'expired': 0,
          'expiring-soon': 1,
          'fresh': 2
        };
        aValue = expirationStatusOrder[a.expirationStatus] || 0;
        bValue = expirationStatusOrder[b.expirationStatus] || 0;
        break;
        
      case 'expirationDate':
        aValue = getEarliestExpirationDate(a);
        bValue = getEarliestExpirationDate(b);
        break;
        
      default:
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
    }
    
    if (aValue == null) aValue = sortDirection === 'asc' ? Infinity : -Infinity;
    if (bValue == null) bValue = sortDirection === 'asc' ? Infinity : -Infinity;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue instanceof Date && bValue instanceof Date) {
      aValue = aValue.getTime();
      bValue = bValue.getTime();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

  const totalItemsFetch = products.length;
  const totalPagesCount = Math.ceil(totalItemsFetch / limit);

  if (page > totalPagesCount) {
    page = totalPagesCount;
  }

  const start = (page - 1) * limit;
  const end = start + limit;

  products = products.slice(start, end);

  res.status(StatusCodes.OK).json({ 
    products, 
    totalProductCount,
    ...counts,
    totalItemsFetch,
    totalPagesCount
  });
}

const getAllProductBatch = async (req, res) => {
  const { filter } = req.query;
  const { id: productId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  let batches = product.batches || [];

  batches = processBatch(product.toObject(), thresholds);

  if (filter && ['expired', 'expiring-soon', 'fresh'].includes(filter)) {
    batches = batches.filter(batch => batch.expirationStatus === filter);
  }

  batches = batches.map(batch => {
    batch.stockStatus = calculateBatchStockStatus(product, batch, thresholds);
    return batch;
  });

  res.status(StatusCodes.OK).json({ batches });
}

const getProduct = async (req, res) => {
  const { id:productId } = req.params;

  let product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  product = processProduct(product.toObject(), thresholds);

  res.status(StatusCodes.OK).json({ product });
}

const getProductBatch = async (req, res) => {
  const { id:productId, batchId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id with ${productId}`);
  }

  let batch = product.batches.find(batch => {
    return batch._id.toString() === batchId
  });
  if (!batch) {
    throw new NotFoundError(`No batch with id with ${batchId}`);
  }

  batch = batch.toObject();

  if  (product.consumptionType !== 'noExpiry' && batch.expirationDate) {
    batch.expirationStatus = calculateExpirationStatus(product.toObject(), batch, thresholds);
  } else {
    batch.expirationStatus = 'fresh';
  }

  const productToReturn = {
    _id: product._id,
    name: product.name,
    barcode: product.barcode,
    batches: [batch]
  }

  res.status(StatusCodes.OK).json({ product: productToReturn });
}

const createProduct = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('"Image" is required', "image");
  }

  const toValidate = {
    ...req.body,
    image: req.file.path,
    imageId: req.file.filename,
  }
  const { error, value } = productSchema.validate(toValidate);
  if (error) {
    throw new BadRequestError(error.details[0].message, error.details[0].path[0]);
  }

  let product = await Product.create(value);

  product = processProduct(product.toObject(), thresholds);

  res.status(StatusCodes.CREATED).json({ msg: 'Product is added successfully!' });
}

const addProductBatch = async (req, res) => {
  const { id:productId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  const { error, value } = batchesSchema.validate({ batches: [req.body]});
  if (error) {
    throw new BadRequestError(error.details[0].message, error.details[0].path);
  }

  const validatedBatch = value.batches[0];

  if (['short', 'long', 'isExpiring'].includes(product.consumptionType) && !validatedBatch.expirationDate) {
    throw new BadRequestError(`Expiration Date is required`, 'expirationDate');
  }

  if (product.consumptionType === 'noExpiry' && validatedBatch.expirationDate) {
    throw new BadRequestError(`Expiration Date is not allowed`, 'expirationDate');
  }

  const existingBatch = product.batches.find(batch => {
    const batchDate = batch.expirationDate ? batch.expirationDate.toISOString() : null;
    const validatedDate = validatedBatch.expirationDate ? validatedBatch.expirationDate.toISOString() : null;
    return batchDate === validatedDate;
  });

  if (existingBatch) {
    existingBatch.quantity += validatedBatch.quantity;
  } else {
    product.batches.push({
      quantity: validatedBatch.quantity,
      expirationDate: validatedBatch.expirationDate || null,
    });
  }

  await product.save();

  res.status(StatusCodes.OK).json({ msg: 'Batch is added successfully' });
}

const updateProduct = async (req, res) => {
  const { id:productId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  const { batches: _ignoreBatches, ...removedBatches } = req.body;

  const { _id,
     __v, 
     batches, 
     stock, 
     stockStatus, 
     expirationStatus, 
     ...cleanData 
  } = product.toObject();

  const mergedData = { ...cleanData, ...removedBatches };
  
  if (req.file) {
    if (product.imageId) {
      await cloudinary.uploader.destroy(product.imageId);
    }

    mergedData.image = req.file.path;
    mergedData.imageId = req.file.filename;
  }

  const { error, value } = updateProductSchema.validate(mergedData);
  if (error) {
    throw new BadRequestError(error.details[0].message, error.details[0].path);
  }
  
  Object.assign(product, value);
  await product.save();

  res.status(StatusCodes.OK).json({ msg: 'Product is updated successfully' });
}

const updateProductBatch = async (req, res) => {
  const { id:productId, batchId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  const batch = product.batches.find(batch => {
    return batch._id.toString() === batchId;
  });
  if (!batch) {
    throw new NotFoundError(`No batch with id ${batchId}`);
  }

  const { 
    name: _ignoreName, 
    barcode: _ignoreBarcode, 
    cost: _ignoreCode, 
    price: _ignorePrice,
    category: _ignoreCategory,
    consumptionType: _ignoreConsumptionType,
    ...retainedBatches
  } = req.body;

  const {
    _id,
    ...cleanData
  } = batch.toObject();

  const mergedData = { ...cleanData, ...retainedBatches };

  const { error, value } = batchesSchema.validate({ batches: [mergedData] });
  if (error) {
    throw new BadRequestError(error.details[0].message, error.details[0].path);
  }

  const validatedBatch = value.batches[0];

  if (['short', 'long', 'isExpiring'].includes(product.consumptionType) && !validatedBatch.expirationDate) {
    throw new BadRequestError(`Expiration Date is required`, 'expirationDate');
  }

  if (product.consumptionType === 'noExpiry' && validatedBatch.expirationDate) {
    throw new BadRequestError(`Expiration Date is not allowed`, 'expirationDate');
  }

  if (product.expirationDate && validatedBatch.quantity < 1) {
    throw new BadRequestError("Quantity can't be zero Product has Expiration Date");
  }

  batch.quantity = validatedBatch.quantity;
  batch.expirationDate = validatedBatch.expirationDate ?? batch.expirationDate;

  await product.save();

  res.status(StatusCodes.OK).json({ msg: "Batch updated successfully" });
}

const deleteProduct = async (req, res) => {
  const { id:productId } = req.params;

  const product = await Product.findOneAndDelete({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

 if (product.imageId) {
    await cloudinary.uploader.destroy(product.imageId);
  }

  res.status(StatusCodes.OK).json({ msg: `Product is deleted successfully!` });
}

const deleteProductBatch = async (req, res) => {
  const { id:productId, batchId } = req.params;

  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(`No product with id ${productId}`);
  }

  product.batches = product.batches.filter(batch => {
    return batch._id.toString() !== batchId;
  });

  await product.save();

  res.status(StatusCodes.OK).json({ msg: `Product is deleted successfully!` });
}

const getProductByBarcode = async (req, res) => {
  const { barcode } = req.query;
  
  const barcodeNumber = Number(barcode);

  let product = await Product.findOne({ barcode: barcodeNumber });
  if (!product) {
    throw new NotFoundError(`No product with barcode ${barcode}`);
  }

  product = processProduct(product.toObject(), thresholds);

  res.status(StatusCodes.OK).json({ product });
}

module.exports = {
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
}