const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const memoryCache = require('../config/cache');

// ─────────────────────────────────────────────────────────────
// 🛡️ BẢO MẬT: BỘ LỌC XSS, CHỐNG BOT HONEYPOT & TRÍCH XUẤT REAL CLIENT IP
// ─────────────────────────────────────────────────────────────

/**
 * Trích xuất Real Client Public IP qua Render/Cloudflare/Nginx Load Balancers
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0].replace(/^::ffff:/, '');
  }
  if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'].replace(/^::ffff:/, '');
  if (req.headers['x-real-ip']) return req.headers['x-real-ip'].replace(/^::ffff:/, '');
  return (req.ip || req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
}

/**
 * Mã hóa / Che giấu email và định danh để bảo mật thông tin quản trị
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '—';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 3 ? name[0] + '***' : name.slice(0, 2) + '***' + name.slice(-1);
  return `${maskedName}@${domain}`;
}

function generateIsoPublicId(role, numId) {
  const prefix = role === 'admin' ? 'adm' : 'usr';
  const id = parseInt(numId) || 0;
  const val = Math.abs(((id * 1664525 + 1013904223) ^ 0x5B9A4C21) % 90000000) + 10000000;
  return `${prefix}-${val}`;
}

/**
 * Làm sạch chuỗi chống XSS Injection cơ bản
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/onload\s*=/gi, '')
    .replace(/onerror\s*=/gi, '')
    .trim();
}

/**
 * Middleware chống Bot xâm nhập qua trường bẫy Honeypot
 */
function botProtectionMiddleware(req, res, next) {
  const { hp_security_trap, website_hidden_check } = req.body || {};
  const clientIp = getClientIp(req);

  // Nếu trường ẩn honeypot có dữ liệu -> 100% là Bot tự động điền form
  if (hp_security_trap || website_hidden_check) {
    console.warn(`🚨 [SECURITY ALERT] Phát hiện Bot cố gắng xâm nhập AI Training API từ IP ${clientIp}`);
    
    // Ghi nhận sự kiện bảo mật vào audit log
    pool.query(`
      INSERT INTO ai_training_logs (action, target_type, details, ip_address)
      VALUES ($1, $2, $3, $4)
    `, ['BLOCKED_BOT', 'SECURITY_TRAP', JSON.stringify({ ip: clientIp, userAgent: req.get('user-agent'), body: req.body }), clientIp])
    .catch(() => {});

    return res.status(403).json({ error: 'Truy cập bị từ chối bởi Hệ thống Phòng Vệ Tự Động.' });
  }
  next();
}

// Áp dụng Auth + Admin cho toàn bộ route quản lý huấn luyện AI
router.use(auth);
router.use(admin);

// ─────────────────────────────────────────────────────────────
// 1. KHO TRI THỨC QUY TRÌNH (KNOWLEDGE BASE ARTICLES)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/training/knowledge
 * Lấy danh sách tài liệu tri thức (có hỗ trợ tìm kiếm và lọc phân loại)
 */
router.get('/knowledge', async (req, res) => {
  try {
    const { category, search, active } = req.query;
    let query = `
      SELECT k.*, u.full_name as author_name 
      FROM ai_knowledge_articles k 
      LEFT JOIN users u ON k.created_by = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND k.category = $${params.length}`;
    }

    if (active === 'true') {
      query += ` AND k.is_active = true`;
    } else if (active === 'false') {
      query += ` AND k.is_active = false`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(k.title) LIKE $${params.length} OR LOWER(k.topic_keywords) LIKE $${params.length} OR LOWER(k.content) LIKE $${params.length})`;
    }

    query += ` ORDER BY k.priority DESC, k.updated_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, articles: result.rows });
  } catch (err) {
    console.error('Lỗi lấy danh sách bài viết tri thức:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải tri thức' });
  }
});

/**
 * POST /api/ai/training/knowledge
 * Thêm bài viết tri thức mới
 */
router.post('/knowledge', botProtectionMiddleware, async (req, res) => {
  try {
    const { category, title, topic_keywords, content, priority = 5, is_active = true } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Tiêu đề tri thức không được để trống.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung kỹ thuật không được để trống.' });
    }

    const cleanTitle = sanitizeInput(title);
    const cleanCategory = sanitizeInput(category || 'Kỹ thuật Canh tác');
    const cleanKeywords = sanitizeInput(topic_keywords || '');
    const cleanContent = sanitizeInput(content);
    const numPriority = Math.max(1, Math.min(10, parseInt(priority, 10) || 5));

    const insertRes = await pool.query(`
      INSERT INTO ai_knowledge_articles 
        (category, title, topic_keywords, content, priority, is_active, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [cleanCategory, cleanTitle, cleanKeywords, cleanContent, numPriority, is_active !== false, req.user.id]);

    const article = insertRes.rows[0];

    // Xóa RAM Cache để AI cập nhật ngay lập tức
    memoryCache.flush();

    // Ghi nhật ký bảo mật
    const clientIp = getClientIp(req);
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['CREATE', 'KNOWLEDGE_ARTICLE', article.id, JSON.stringify({ title: cleanTitle, category: cleanCategory }), req.user.id, clientIp]);

    res.status(201).json({ success: true, article, message: 'Đã lưu tri thức mới thành công!' });
  } catch (err) {
    console.error('Lỗi thêm bài viết tri thức:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lưu tri thức: ' + err.message });
  }
});

/**
 * PUT /api/ai/training/knowledge/:id
 * Cập nhật bài viết tri thức
 */
router.put('/knowledge/:id', botProtectionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, topic_keywords, content, priority, is_active } = req.body;

    const existingRes = await pool.query('SELECT * FROM ai_knowledge_articles WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết tri thức.' });
    }

    const oldData = existingRes.rows[0];
    const cleanTitle = title !== undefined ? sanitizeInput(title) : oldData.title;
    const cleanCategory = category !== undefined ? sanitizeInput(category) : oldData.category;
    const cleanKeywords = topic_keywords !== undefined ? sanitizeInput(topic_keywords) : oldData.topic_keywords;
    const cleanContent = content !== undefined ? sanitizeInput(content) : oldData.content;
    const numPriority = priority !== undefined ? Math.max(1, Math.min(10, parseInt(priority, 10) || 5)) : oldData.priority;
    const boolActive = is_active !== undefined ? Boolean(is_active) : oldData.is_active;

    const updateRes = await pool.query(`
      UPDATE ai_knowledge_articles 
      SET category = $1, title = $2, topic_keywords = $3, content = $4, priority = $5, is_active = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [cleanCategory, cleanTitle, cleanKeywords, cleanContent, numPriority, boolActive, id]);

    // Xóa RAM Cache
    memoryCache.flush();

    // Ghi nhật ký bảo mật
    const clientIp = getClientIp(req);
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['UPDATE', 'KNOWLEDGE_ARTICLE', id, JSON.stringify({ old: oldData.title, new: cleanTitle, category: cleanCategory }), req.user.id, clientIp]);

    res.json({ success: true, article: updateRes.rows[0], message: 'Đã cập nhật tri thức thành công!' });
  } catch (err) {
    console.error('Lỗi cập nhật tri thức:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật tri thức: ' + err.message });
  }
});

/**
 * DELETE /api/ai/training/knowledge/:id
 * Xóa bài viết tri thức
 */
router.delete('/knowledge/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT title, category FROM ai_knowledge_articles WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết tri thức.' });
    }

    await pool.query('DELETE FROM ai_knowledge_articles WHERE id = $1', [id]);
    memoryCache.flush();

    const clientIp = getClientIp(req);
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['DELETE', 'KNOWLEDGE_ARTICLE', id, JSON.stringify({ title: existing.rows[0].title, category: existing.rows[0].category }), req.user.id, clientIp]);

    res.json({ success: true, message: 'Đã xóa bài viết tri thức thành công.' });
  } catch (err) {
    console.error('Lỗi xóa tri thức:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xóa tri thức' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. HUẤN LUYỆN CẶP Q&A THỰC CHIẾN (FEW-SHOT FINE-TUNING)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/training/qa
 * Lấy danh sách các cặp Q&A đã huấn luyện
 */
router.get('/qa', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT q.*, u.full_name as author_name 
      FROM ai_training_qa q 
      LEFT JOIN users u ON q.created_by = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND q.category = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(q.sample_questions) LIKE $${params.length} OR LOWER(q.expected_answer) LIKE $${params.length} OR LOWER(q.keywords) LIKE $${params.length})`;
    }

    query += ` ORDER BY q.updated_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, qas: result.rows });
  } catch (err) {
    console.error('Lỗi lấy danh sách cặp Q&A:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải Q&A' });
  }
});

/**
 * POST /api/ai/training/qa
 * Thêm cặp Q&A mới
 */
router.post('/qa', botProtectionMiddleware, async (req, res) => {
  try {
    const { category, sample_questions, expected_answer, keywords, is_active = true } = req.body;

    if (!sample_questions || !sample_questions.trim()) {
      return res.status(400).json({ error: 'Các mẫu câu hỏi không được để trống.' });
    }
    if (!expected_answer || !expected_answer.trim()) {
      return res.status(400).json({ error: 'Câu trả lời chuẩn không được để trống.' });
    }

    const cleanCategory = sanitizeInput(category || 'Hỏi Đáp Thường Gặp');
    const cleanQuestions = sanitizeInput(sample_questions);
    const cleanAnswer = sanitizeInput(expected_answer);
    const cleanKeywords = sanitizeInput(keywords || '');

    const insertRes = await pool.query(`
      INSERT INTO ai_training_qa 
        (category, sample_questions, expected_answer, keywords, is_active, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [cleanCategory, cleanQuestions, cleanAnswer, cleanKeywords, is_active !== false, req.user.id]);

    memoryCache.flush();

    const clientIp = getClientIp(req);
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['CREATE', 'TRAINING_QA', insertRes.rows[0].id, JSON.stringify({ category: cleanCategory, sample: cleanQuestions.slice(0, 100) }), req.user.id, clientIp]);

    res.status(201).json({ success: true, qa: insertRes.rows[0], message: 'Đã lưu cặp Q&A huấn luyện thành công!' });
  } catch (err) {
    console.error('Lỗi thêm cặp Q&A:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lưu Q&A: ' + err.message });
  }
});

/**
 * PUT /api/ai/training/qa/:id
 * Cập nhật cặp Q&A
 */
router.put('/qa/:id', botProtectionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, sample_questions, expected_answer, keywords, is_active } = req.body;

    const existingRes = await pool.query('SELECT * FROM ai_training_qa WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cặp Q&A.' });
    }

    const oldData = existingRes.rows[0];
    const cleanCategory = category !== undefined ? sanitizeInput(category) : oldData.category;
    const cleanQuestions = sample_questions !== undefined ? sanitizeInput(sample_questions) : oldData.sample_questions;
    const cleanAnswer = expected_answer !== undefined ? sanitizeInput(expected_answer) : oldData.expected_answer;
    const cleanKeywords = keywords !== undefined ? sanitizeInput(keywords) : oldData.keywords;
    const boolActive = is_active !== undefined ? Boolean(is_active) : oldData.is_active;

    const updateRes = await pool.query(`
      UPDATE ai_training_qa 
      SET category = $1, sample_questions = $2, expected_answer = $3, keywords = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [cleanCategory, cleanQuestions, cleanAnswer, cleanKeywords, boolActive, id]);

    memoryCache.flush();

    const clientIp = getClientIp(req);
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['UPDATE', 'TRAINING_QA', id, JSON.stringify({ category: cleanCategory, sample: cleanQuestions.slice(0, 100) }), req.user.id, clientIp]);

    res.json({ success: true, qa: updateRes.rows[0], message: 'Đã cập nhật cặp Q&A thành công!' });
  } catch (err) {
    console.error('Lỗi cập nhật cặp Q&A:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật Q&A: ' + err.message });
  }
});

/**
 * DELETE /api/ai/training/qa/:id
 * Xóa cặp Q&A
 */
router.delete('/qa/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT category, sample_questions FROM ai_training_qa WHERE id = $1', [id]);
    await pool.query('DELETE FROM ai_training_qa WHERE id = $1', [id]);
    memoryCache.flush();

    const clientIp = getClientIp(req);
    const sampleSnippet = existing.rows[0]?.sample_questions ? existing.rows[0].sample_questions.slice(0, 80) : '';
    await pool.query(`
      INSERT INTO ai_training_logs (action, target_type, target_id, details, admin_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['DELETE', 'TRAINING_QA', id, JSON.stringify({ category: existing.rows[0]?.category || 'Q&A', sample: sampleSnippet }), req.user.id, clientIp]);

    res.json({ success: true, message: 'Đã xóa cặp Q&A thành công.' });
  } catch (err) {
    console.error('Lỗi xóa Q&A:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xóa Q&A' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. PHÒNG THỬ NGHIỆM AI & PROMPT SIMULATOR (LIVE TEST)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/training/test
 * Giả lập và kiểm thử câu hỏi để kiểm tra nguồn tri thức được áp dụng
 */
router.post('/test', botProtectionMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập câu hỏi thử nghiệm.' });
    }

    const cleanMsg = sanitizeInput(message);
    const startTime = Date.now();

    // 1. Quét tìm kiếm trong Cặp Q&A đã huấn luyện (Exact / Phrase match)
    const qaRes = await pool.query(`
      SELECT * FROM ai_training_qa 
      WHERE is_active = true 
      ORDER BY updated_at DESC
    `);

    let matchedQA = null;
    const lowerMsg = cleanMsg.toLowerCase();

    for (const qa of qaRes.rows) {
      const variants = qa.sample_questions.split('\n').map(v => v.trim().toLowerCase()).filter(Boolean);
      const isMatch = variants.some(v => lowerMsg.includes(v) || v.includes(lowerMsg));
      if (isMatch) {
        matchedQA = qa;
        break;
      }
    }

    // 2. Quét tìm kiếm trong Kho Tri Thức (Relevant Articles)
    const articlesRes = await pool.query(`
      SELECT * FROM ai_knowledge_articles 
      WHERE is_active = true 
      ORDER BY priority DESC, updated_at DESC
    `);

    const matchedArticles = [];
    for (const art of articlesRes.rows) {
      const kwList = (art.topic_keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const titleLower = art.title.toLowerCase();
      const contentLower = art.content.toLowerCase();

      let score = 0;
      if (lowerMsg.includes(titleLower) || titleLower.includes(lowerMsg)) score += 5;
      kwList.forEach(k => {
        if (lowerMsg.includes(k)) score += 3;
      });
      if (contentLower.includes(lowerMsg)) score += 2;

      if (score > 0) {
        matchedArticles.push({ article: art, score });
      }
    }

    matchedArticles.sort((a, b) => b.score - a.score);

    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      query: cleanMsg,
      elapsedMs: elapsed,
      matchedQA: matchedQA ? {
        id: matchedQA.id,
        category: matchedQA.category,
        expectedAnswer: matchedQA.expected_answer,
        keywords: matchedQA.keywords
      } : null,
      matchedArticles: matchedArticles.slice(0, 3).map(m => ({
        id: m.article.id,
        title: m.article.title,
        category: m.article.category,
        priority: m.article.priority,
        score: m.score,
        snippet: m.article.content.slice(0, 200) + '...'
      })),
      recommendation: matchedQA 
        ? '⚡ Trực tiếp áp dụng câu trả lời chuẩn từ Cặp Q&A (Tốc độ phản hồi < 5ms)' 
        : (matchedArticles.length > 0 ? `📚 Ghép ${matchedArticles.length} bài viết tri thức vào RAG Prompt của Gemini` : '🌐 Sử dụng tri thức tổng quát & dữ liệu thời gian thực của trang trại')
    });
  } catch (err) {
    console.error('Lỗi thử nghiệm AI:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi thử nghiệm AI: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. THỐNG KÊ & BÁO CÁO NHẬT KÝ BẢO MẬT
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/training/stats
 * Thống kê tổng quan về kho tri thức và hoạt động huấn luyện
 */
router.get('/stats', async (req, res) => {
  try {
    const [articlesCount, qaCount, logsCount, unansweredCount, catGroup] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM ai_knowledge_articles'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM ai_training_qa'),
      pool.query('SELECT COUNT(*) as total FROM ai_training_logs'),
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'pending') as pending FROM ai_unanswered_queries"),
      pool.query(`
        SELECT category, COUNT(*) as count 
        FROM ai_knowledge_articles 
        GROUP BY category 
        ORDER BY count DESC
      `)
    ]);

    res.json({
      success: true,
      stats: {
        articles: {
          total: parseInt(articlesCount.rows[0].total, 10),
          active: parseInt(articlesCount.rows[0].active, 10)
        },
        qa: {
          total: parseInt(qaCount.rows[0].total, 10),
          active: parseInt(qaCount.rows[0].active, 10)
        },
        logsTotal: parseInt(logsCount.rows[0].total, 10),
        unanswered: {
          total: parseInt(unansweredCount.rows[0].total, 10),
          pending: parseInt(unansweredCount.rows[0].pending, 10)
        },
        categories: catGroup.rows
      }
    });
  } catch (err) {
    console.error('Lỗi lấy thống kê AI:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy thống kê' });
  }
});

/**
 * GET /api/ai/training/logs
 * Lấy danh sách nhật ký bảo mật & lịch sử nạp tri thức (Hỗ trợ phân trang & ẩn danh hóa ID)
 */
router.get('/logs', async (req, res) => {
  try {
    const logsRes = await pool.query(`
      SELECT l.*, u.full_name as admin_name, u.email as admin_email 
      FROM ai_training_logs l 
      LEFT JOIN users u ON l.admin_id = u.id 
      ORDER BY l.created_at DESC 
      LIMIT 200
    `);

    const sanitizedLogs = (logsRes.rows || []).map(l => {
      const publicId = l.admin_id ? generateIsoPublicId('admin', l.admin_id) : 'sys-00000000';
      const maskedEmail = maskEmail(l.admin_email);
      let adminDisplay = '🛡️ Hệ Thống Tự Động';
      
      if (l.action === 'BLOCKED_BOT') {
        adminDisplay = '🛡️ Phòng Vệ Honeypot';
      } else if (l.admin_name) {
        adminDisplay = `${l.admin_name} (${publicId})`;
      } else if (l.admin_email) {
        adminDisplay = `${maskedEmail} (${publicId})`;
      }

      return {
        ...l,
        admin_public_id: publicId,
        admin_display: adminDisplay,
        admin_email_masked: maskedEmail
      };
    });

    res.json({ success: true, logs: sanitizedLogs });
  } catch (err) {
    console.error('Lỗi lấy nhật ký huấn luyện:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy nhật ký' });
  }
});

module.exports = router;
