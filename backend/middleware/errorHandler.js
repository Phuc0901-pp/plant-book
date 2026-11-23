module.exports = function errorHandler(err, req, res, next) {
  console.error('🔥 Centralized API Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = (isProd && statusCode >= 500)
    ? 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau.'
    : (err.message || 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau.');

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
};
