const notFoundMiddleware = (req, res) => {
  return res.status(404).send('Page not Found');
}

module.exports = notFoundMiddleware;