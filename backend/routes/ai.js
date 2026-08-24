const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

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

    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý ảo AI thông minh, dễ thương và am hiểu nông nghiệp công nghệ cao của hệ thống Tanbao AgTech.
Tính cách: Thân thiện, chu đáo, xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${userRole === 'admin' ? 'Admin' : 'Bác nông hộ'}".
Kiến thức chuyên môn:
- Hướng dẫn quản trị trang trại, quản lý cây trồng, phân loại giống cây, theo dõi nhật ký VietGAP.
- Chẩn đoán bệnh cây, kỹ thuật tưới nước, bón phân NPK, thời gian cách ly thuốc BVTV (PHI).
- Phân tích chỉ số cảm biến IoT (độ ẩm đất, EC, pH, nhiệt độ), dự báo khí tượng và tối ưu chi phí canh tác.
- Giải đáp cấu trúc cơ sở dữ liệu, bản đồ GIS và các quy trình vận hành hệ thống.
Phong cách trả lời: Ngắn gọn, súc tích, định dạng markdown đẹp mắt (gạch đầu dòng, in đậm, emoji sinh động).

${systemContext}`;

    // 2. Lấy API Key Gemini
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
      const modelCandidates = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];
      
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
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 1000
                }
              })
            });

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
            }
          } catch (err) {
            console.warn(`Lỗi gọi Gemini AI (${modelName}):`, err.message);
          }
        }
      }
    }

    // 3. Fallback Trả lời Thông minh Dựa trên Heuristic Nông nghiệp & Database Context
    let fallbackReply = `Chào ${userRole === 'admin' ? 'Admin' : 'Bác'}! Bé Mầm đã nhận được câu hỏi về **"${message}"**.\n\n`;
    const lower = message.toLowerCase();

    if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('sức khỏe')) {
      fallbackReply += `🌿 **Về Sức Khỏe & Sâu Bệnh:**\n- Hiện hệ thống ghi nhận các cây đang được giám sát sức khỏe.\n- Bé Mầm khuyến nghị bác mở mục **"Danh sách cây"** để lọc trạng thái "Cần chú ý" hoặc "Bệnh".\n- Luôn đảm bảo tuân thủ thời gian cách ly thuốc (PHI) theo tiêu chuẩn VietGAP nhé!`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply += `💧 **Về Độ Ẩm & Tưới Nước:**\n- Độ ẩm đất lý tưởng cho hầu hết cây ăn trái duy trì từ **65% - 75%**.\n- Bác nên duy trì tưới vào sáng sớm hoặc chiều mát để tránh bốc hơi nước và sốc nhiệt cho rễ tơ!`;
    } else if (lower.includes('chi phí') || lower.includes('tiền') || lower.includes('kho')) {
      fallbackReply += `💰 **Về Quản Trị Chi Phí & Vật Tư:**\n- Hệ thống đã tích hợp tính toán tự động khấu hao tiền phân bón, thuốc BVTV và tiền nước m³.\n- Bác có thể vào mục **"Quản trị Chi phí"** để xem biểu đồ chi tiêu chi tiết theo từng mùa vụ!`;
    } else if (lower.includes('thời tiết') || lower.includes('mưa') || lower.includes('nắng')) {
      fallbackReply += `🌦️ **Về Khí Tượng & Thời Tiết:**\n- Trạm vệ tinh GPS Open-Meteo đang cập nhật dự báo 6 ngày liên tục.\n- Nếu dự báo mưa trên 60%, hãy tạm hoãn bón phân để tránh bị rửa trôi chất dinh dưỡng nhé!`;
    } else {
      fallbackReply += `✨ **Bé Mầm luôn sẵn sàng hỗ trợ:**\n- Giám sát cảm biến IoT và cảnh báo độ ẩm đất 24/7.\n- Hỗ trợ ghi nhật ký VietGAP và chẩn đoán cây trồng.\n- ${userRole === 'admin' ? 'Quản lý phân quyền nông hộ và CSDL trang trại.' : 'Nhắc việc chăm sóc mùa vụ thông minh.'}\n\nBác cần Bé Mầm tra cứu thêm mục nào không ạ? 🌱`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'smart_heuristic_engine',
      source: 'heuristic_backup'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
