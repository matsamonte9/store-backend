const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

/************************************* CALCULATION FOR ADDED OBJECTS IN PRODUCTS *************************************/

const calculateValidStock = (product) => {
  const now = new Date();

  return product.batches.reduce((sum, batch) => {
    const expired = batch.expirationDate && new Date(batch.expirationDate) <= now;
    return expired ? sum : sum + batch.quantity
  }, 0);
}

const calculateExpiredStock = (product) => {
  const now = new Date();

  return product.batches.reduce((sum, batch) => {
    const expired = batch.expirationDate && new Date(batch.expirationDate) <= now;
    return expired ? sum + batch.quantity : sum
  }, 0);
}

const calculateBatchStockStatus = (product, batch, thresholds) => {
  const categoryThreshold = thresholds[product.category].stock;
  return batch.quantity <= categoryThreshold ? 'low-stock' : 'high-stock';
}

const calculateProductStockStatus = (product, thresholds) => {
  const validStock = calculateValidStock(product);
  
  if (validStock === 0) {
    return 'out-of-stock';
  }
  
  const categoryThreshold = thresholds[product.category]?.stock || 10;
  return validStock <= categoryThreshold ? 'low-stock' : 'high-stock';
};

const calculateExpirationStatus = (product, batch, thresholds) => {
  const now = new Date();
  const expirationDate = new Date(batch.expirationDate);

  if (!batch.expirationDate) {
    return '';
  }

  const daysLeft = Math.floor((expirationDate - now) / (1000 * 60 * 60 *24));

  if (daysLeft <= 0) return 'expired';
  
  const thresholdDays = thresholds[product.category].expiration[product.consumptionType];
  if (daysLeft <= thresholdDays) return 'expiring-soon';

  return 'fresh';
}

const processBatch = (product, thresholds) => {
  if (!Array.isArray(product.batches) || product.batches.length === 0) return [];

  return product.batches.map(batch => {
    let expirationStatus = '';

    if (product.consumptionType !== 'noExpiry' && batch.expirationDate) {
      expirationStatus = calculateExpirationStatus(product, batch, thresholds);
    }

    return {
      ...batch,
      expirationStatus
    };
  });
}

const processProduct = (product, thresholds) => {
  product.validStocks = calculateValidStock(product);
  product.expiredStocks = calculateExpiredStock(product);

  product.stockStatus = calculateProductStockStatus(product, thresholds);

  product.batches = processBatch(product, thresholds);

  return product;
}


/************************************* FILTER *************************************/

const productMatchesFilter = (product, filter) => {
  switch(filter) {
    case 'expired':
      return product.batches.some(batch => 
        batch.expirationStatus === 'expired'
      );
    case 'expiring-soon':
      return product.batches.some(batch => 
        batch.expirationStatus === 'expiring-soon'
      );
    case 'out-of-stock':
      return product.stockStatus === 'out-of-stock';
    case 'low-stock':
      return product.stockStatus === 'low-stock';
    case 'high-stock':
      return product.stockStatus === 'high-stock';
    case 'fresh':
      return product.batches.some(batch => 
        batch.expirationStatus === 'fresh'
      );
    default:
      return true;
  }
};

/************************************* SORT *************************************/

function getEarliestExpirationDate(product) {
  if (!product.batches || product.batches.length === 0) {
    return null;
  }

  const now = new Date();
  const validBatches = product.batches.filter(batch => {
    if (!batch.expirationDate) return false;
    return new Date(batch.expirationDate) > now;
  });
  
  if (validBatches.length === 0) {
    const expiredBatches = product.batches.filter(batch => batch.expirationDate);
    if (expiredBatches.length === 0) return null;
    
    return new Date(Math.min(...expiredBatches.map(b => new Date(b.expirationDate).getTime())));
  }
  
  return new Date(Math.min(...validBatches.map(b => new Date(b.expirationDate).getTime())));
}

/************************************* FETCH COUNT (PAGINATION) *************************************/

const calculateProductCounts = (products) => {
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let nearExpirationCount = 0;
  let expiredCount = 0;

  products.forEach(product => {
    if (product.stockStatus === 'low-stock') {
      lowStockCount++;
    } else if (product.stockStatus === 'out-of-stock') {
      outOfStockCount++;
    }

    product.batches.forEach(batch => {
      if (batch.expirationStatus === 'expired') {
        expiredCount += batch.quantity;
      } else if (batch.expirationStatus === 'expiring-soon') {
        nearExpirationCount += batch.quantity;
      }
    });
  });

  return {
    lowStockCount,
    outOfStockCount,
    nearExpirationCount,
    expiredCount
  };
};

/************************************* CART TOKEN *************************************/

const validatedCartTokens = {};

const generateCartToken = (items) => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  validatedCartTokens[token] = { items, expiresAt };
  return token;
};                                     

const validateCartToken = (token) => {
  const data = validatedCartTokens[token];
  if (!data) return null;
  if (new Date() > data.expiresAt) {
    delete validatedCartTokens[token];
    return null;
  }
  return data.items;
};

setInterval(() => {
  const now = new Date();
  for (const token in validatedCartTokens) {
    if (validatedCartTokens[token].expiresAt < now) {
      delete validatedCartTokens[token];
    }
  }
}, 60 * 1000);

// Delete Image

function deleteImage(filePath) {
  if (!filePath) return;

  const fullPath = path.join(__dirname, '../uploads/products', path.basename(filePath));
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, err => {
      if (err) console.log('Error deleting product image:', err);
    });
  }
}


module.exports = {
  calculateValidStock,
  calculateExpiredStock,
  calculateBatchStockStatus,
  calculateProductStockStatus,
  calculateExpirationStatus,
  processBatch,
  processProduct,
  productMatchesFilter,
  getEarliestExpirationDate,
  calculateProductCounts,
  generateCartToken,
  validateCartToken,
  deleteImage,
}