/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   routes/notifications.js — Autonomous In-App & Web Push Alerts
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET /api/notifications — Fetch user notifications list
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Auto check & generate initial notifications if empty
    const checkRes = await pool.query('SELECT COUNT(*)::int as count FROM user_notifications WHERE user_id = $1', [userId]);
    if (checkRes.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO user_notifications (user_id, title, message, type, is_read)
        VALUES 
          ($1, '🚨 Cảnh báo Độ ẩm Đất Tầng 20cm', 'Độ ẩm đất tại vườn giảm xuống 42% (Dưới ngưỡng 50%). Khuyến nghị bật hệ thống tưới rễ buổi sáng!', 'danger', false),
          ($1, '🌦️ Cảnh báo Khí tượng Nông nghiệp', 'Chiều nay có khả năng mưa rào rải rác 65%. Hạn chế phun thuốc sâu tránh bị rửa trôi.', 'warning', false),
          ($1, '🌱 Lịch trình Chăm sóc Cây trồng', 'Đã đến chu kỳ bón bổ sung phân hữu cơ vi sinh cho cây trồng trong tuần này.', 'info', true)
      `, [userId]);
    }

    const result = await pool.query(`
      SELECT * FROM user_notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 30
    `, [userId]);

    const unreadRes = await pool.query('SELECT COUNT(*)::int as count FROM user_notifications WHERE user_id = $1 AND is_read = false', [userId]);

    res.json({
      success: true,
      unread_count: unreadRes.rows[0].count,
      notifications: result.rows
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Lỗi server khi tải thông báo.' });
  }
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật thông báo.' });
  }
});

// PUT /api/notifications/:id/read — Mark single notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Đã đọc thông báo.' });
  } catch (err) {
    console.error('Error reading single notification:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

module.exports = router;
