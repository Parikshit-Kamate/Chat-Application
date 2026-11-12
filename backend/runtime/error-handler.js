module.exports = function installErrorHandler(app) {
  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request payload is too large.' });
      return;
    }
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      res.status(400).json({ error: 'Malformed JSON request.' });
      return;
    }
    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  });
};
