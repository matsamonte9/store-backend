const thresholds = {
  groceries: {
    stock: 5,
    expiration: {
      short: 3,
      long: 30,
    },
  },
  electronics: {
    stock: 2,
    expiration: {
      isExpiring:  30,
    }
  }
}

module.exports = thresholds;