const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech hỗ trợ Quản trị viên & Nông hộ bằng Google Gemini AI
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], userRole = 'admin' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    // 1. Thu thập dữ liệu thực tế từ Database làm Context cho Gemini
    let systemContext = '';
    try {
      const [plantsRes, farmsRes, sickRes] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM plants'),
        pool.query('SELECT COUNT(*) FROM farms'),
        pool.query("SELECT COUNT(*) FROM plants WHERE health_status IN ('Cần chú ý', 'Bệnh')")
      ]);
      const totalPlants = plantsRes.rows[0]?.count || 0;
      const totalFarms = farmsRes.rows[0]?.count || 0;
      const sickPlants = sickRes.rows[0]?.count || 0;

      systemContext = `[DỮ LIỆU THỰC TẾ HỆ THỐNG]:
- Tổng số trang trại đang quản lý: ${totalFarms} trang trại.
- Tổng số cây trồng: ${totalPlants} cây.
- Số cây cần theo dõi / sâu bệnh: ${sickPlants} cây.
- Tiêu chuẩn canh tác: VietGAP, GlobalGAP, giám sát IoT đa tầng.`;
    } catch (dbErr) {
      systemContext = '[DỮ LIỆU THỰC TẾ]: Hệ thống đang vận hành ổn định trên CSDL PostgreSQL.';
    }

    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý ảo AI thông minh, am hiểu sâu rộng về mọi lĩnh vực đời sống, lịch sử, văn hóa, khoa học và chuyên gia nông nghiệp công nghệ cao của hệ thống Tanbao AgTech.
Tính cách: Thân thiện, tôn trọng, chu đáo, xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${userRole === 'admin' ? 'Admin' : 'Bác nông hộ'}".
Nguyên tắc trả lời:
- Luôn trả lời CHÍNH XÁC, ĐẦY ĐỦ VÀ TRỰC TIẾP mọi câu hỏi của người dùng (từ kiến thức chung, nhân vật lịch sử, khoa học kỹ thuật, xã hội đến quản trị trang trại, bệnh cây, CSDL).
- Trình bày mạch lạc, định dạng markdown đẹp mắt (in đậm, gạch đầu dòng, emoji sinh động).

${systemContext}`;

    // 2. Lấy API Key Gemini
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
      const modelCandidates = [
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.7-flash',
        'gemini-pro-latest',
        'gemini-2.5-pro'
      ];
      
      // Chuẩn bị chat contents cho Gemini API
      const contents = [];
      
      // Chèn lịch sử chat trước đó (nếu có)
      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-6)) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      }
      
      // Chèn tin nhắn hiện tại
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nNgười dùng hỏi: ${message}` }]
      });

      for (const apiKey of apiKeys) {
        for (const modelName of modelCandidates) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 1200
                }
              })
            });

            clearTimeout(timeoutId);

            if (geminiRes.ok) {
              const data = await geminiRes.json();
              const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (reply && reply.trim()) {
                return res.json({
                  success: true,
                  reply: reply.trim(),
                  model: modelName,
                  source: 'gemini_ai'
                });
              }
            } else {
              const errText = await geminiRes.text();
              console.warn(`Gemini Model ${modelName} HTTP ${geminiRes.status}:`, errText.substring(0, 150));
            }
          } catch (err) {
            console.warn(`Lỗi gọi Gemini AI (${modelName}):`, err.message);
          }
        }
      }
    }

    // 3. Fallback Trả lời Thông minh
    let fallbackReply = `Chào ${userRole === 'admin' ? 'Admin' : 'Bác'}! Bé Mầm đã nhận được câu hỏi về **"${message}"**.\n\n`;
    const lower = message.toLowerCase();

    if (lower.includes('bác hồ') || lower.includes('hồ chí minh')) {
      fallbackReply = `✨ **Chủ tịch Hồ Chí Minh (Bác Hồ):**\n- Là vị Lãnh tụ vĩ đại của dân tộc Việt Nam, Người đã sáng lập Đảng Cộng sản Việt Nam và khai sinh ra nước Việt Nam Dân chủ Cộng hòa.\n- Danh nhân văn hóa thế giới được UNESCO vinh danh, người đã dành trọn cuộc đời cho độc lập tự do của Tổ quốc! 🇻🇳`;
    } else if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('sức khỏe')) {
      fallbackReply += `🌿 **Về Sức Khỏe & Sâu Bệnh:**\n- Hệ thống đang theo dõi các lô cây trồng.\n- Bác mở mục **"Danh sách cây"** để lọc trạng thái "Cần chú ý" hoặc "Bệnh" nhé!`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply += `💧 **Về Độ Ẩm & Tưới Nước:**\n- Độ ẩm đất lý tưởng duy trì từ **65% - 75%**.\n- Bác nên tưới vào sáng sớm hoặc chiều mát để tránh bốc hơi và sốc nhiệt cho rễ tơ!`;
    } else {
      fallbackReply = `Dạ ${userRole === 'admin' ? 'Admin' : 'Bác'}! Về câu hỏi **"${message}"**, Bé Mầm đã ghi nhận. Hệ thống đang đồng bộ dữ liệu CSDL và cảm biến IoT 24/7. ${userRole === 'admin' ? 'Admin' : 'Bác'} có thể hỏi Bé Mầm về bất kỳ thông số kỹ thuật hay kiến thức nào nhé! 🌱`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'fallback_engine',
      source: 'fallback'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
