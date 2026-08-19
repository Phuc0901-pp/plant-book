const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa xác thực. Vui lòng đăng nhập.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch latest user details (farm_id, role, permissions) from DB
    const userRes = await pool.query(
      `SELECT id, email, role, full_name, farm_id, 
              view_plants_scope, view_history_from_date, allow_shared_history, allow_view_supplies 
       FROM users WHERE id=$1`, 
      [decoded.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản không còn tồn tại.' });
    }

    const u = userRes.rows[0];
    req.user = {
      id: u.id,
      email: u.email,
      role: u.role,
      name: u.full_name,
      farm_id: u.farm_id,
      view_plants_scope: u.view_plants_scope || 'all',
      view_history_from_date: u.view_history_from_date ? u.view_history_from_date.toISOString().split('T')[0] : null,
      allow_shared_history: u.allow_shared_history !== false,
      allow_view_supplies: u.allow_view_supplies !== false
    };


    // Update user active status in the background (non-blocking)
    pool.query(
      'UPDATE users SET last_active_at = NOW(), is_online = true WHERE id = $1',
      [u.id]
    ).catch(err => console.error('Error updating active status:', err));

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}


module.exports = authMiddleware;
