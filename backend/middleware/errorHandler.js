// Centralized Express Error Handler
module.exports = function errorHandler(err, req, res, next) {
  console.error('🔥 Centralized API Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau.';

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
};
