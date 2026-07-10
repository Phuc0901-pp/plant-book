const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa xác thực. Vui lòng đăng nhập.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Update user active status in the background (non-blocking)
    pool.query(
      'UPDATE users SET last_active_at = NOW(), is_online = true WHERE id = $1',
      [decoded.id]
    ).catch(err => console.error('Error updating active status:', err));

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = authMiddleware;
