const CustomAPIError = require('./custom-api');
const { StatusCodes } = require('http-status-codes');

class BadRequestError extends CustomAPIError {
  constructor(message, path) {
    super(message);
    this.path = path;
    this.statusCode = StatusCodes.BAD_REQUEST;
  }
}

module.exports = BadRequestError;