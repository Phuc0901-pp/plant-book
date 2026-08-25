const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech hỗ trợ Quản trị viên & Nông hộ bằng Google Gemini AI + In-Memory Realtime Aggregation
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], userRole = 'user' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    // 1. Thu thập dữ liệu thực tế từ Database an toàn tuyệt đối
    let farmsList = [];
    let systemContext = '';

    try {
      const [farmsRes, plantsRes, sickRes] = await Promise.all([
        pool.query('SELECT f.id, f.name, f.area, f.total_plants, u.full_name as owner_name FROM farms f LEFT JOIN users u ON f.user_id = u.id WHERE (f.is_deleted IS NOT TRUE)'),
        pool.query('SELECT p.id, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name FROM plants p LEFT JOIN farms f ON p.farm_id = f.id'),
        pool.query("SELECT COUNT(*) as count FROM plants WHERE health_status IN ('Cần chú ý', 'Bệnh', 'Nguy cấp')")
      ]);

      const farmMap = {};
      (farmsRes.rows || []).forEach(f => {
        farmMap[f.id] = {
          id: f.id,
          name: f.name,
          owner: f.owner_name || 'Nông hộ',
          area: f.area,
          total: f.total_plants || 0,
          plantCount: 0,
          crops: new Set()
        };
      });

      (plantsRes.rows || []).forEach(p => {
        if (p.farm_id && farmMap[p.farm_id]) {
          farmMap[p.farm_id].plantCount++;
          const crop = [p.plant_type, p.plant_variety].filter(Boolean).join(' - ');
          if (crop) farmMap[p.farm_id].crops.add(crop);
        }
      });

      farmsList = Object.values(farmMap).map(f => ({
        name: f.name,
        owner: f.owner,
        area: f.area,
        total: f.plantCount || f.total || 0,
        crops: f.crops.size > 0 ? Array.from(f.crops).join(', ') : 'Đang cập nhật danh sách cây'
      }));

      const sickCount = sickRes.rows?.[0]?.count || 0;

      const farmLines = farmsList.map(f => 
        `- Trang trại: "${f.name}" | Chủ hộ: ${f.owner} | Diện tích: ${f.area ? f.area + ' ha' : 'N/A'} | Cây trồng: ${f.crops} (Tổng: ${f.total} cây)`
      ).join('\n');

      systemContext = `[DỮ LIỆU THỰC TẾ TRANG TRẠI & CÂY TRỒNG HIỆN CÓ]:
${farmLines || '- Chưa có dữ liệu trang trại.'}
- Tổng số cây đang ủ bệnh/cần theo dõi: ${sickCount} cây.`;

    } catch (dbErr) {
      console.warn('Lỗi đọc database cho AI context:', dbErr.message);
      systemContext = '[DỮ LIỆU THỰC TẾ]: Hệ thống Tanbao AgTech đang quản lý các trang trại công nghệ cao.';
    }

    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý số AI chuyên gia nông nghiệp thông minh của hệ thống Tanbao AgTech.
Xưng hô: Xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${userRole === 'admin' ? 'Admin' : 'Bác nông hộ'}".

NGUYÊN TẮC QUAN TRỌNG:
1. ĐI THẲNG VÀO CÂU TRẢ LỜI, KHÔNG CHÀO HỎI RƯỜM RÀ LẶP LẠI.
2. Trả lời CHÍNH XÁC 100% dựa trên [DỮ LIỆU THỰC TẾ TRANG TRẠI & CÂY TRỒNG HIỆN CÓ] khi người dùng hỏi về bất kỳ trang trại nào (ví dụ: Nhà anh Hiếu, Vũ Minh Dưỡng Farm...).
3. Với câu hỏi kỹ thuật canh tác (sâu bệnh, liều lượng tưới, phân bón NPK, cách ly PHI VietGAP), trả lời ngắn gọn, chuẩn xác, định dạng gạch đầu dòng rõ ràng.

${systemContext}`;

    // 2. Gọi Google Gemini AI
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
      const modelCandidates = [
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.7-flash',
        'gemini-pro-latest'
      ];
      
      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-4)) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      }
      
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nCâu hỏi: ${message}` }]
      });

      for (const apiKey of apiKeys) {
        for (const modelName of modelCandidates) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.3,
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
            }
          } catch (err) {
            // Thử model tiếp theo
          }
        }
      }
    }

    // 3. Fallback Engine Thông Minh: Tự động tra cứu trực tiếp dữ liệu DB
    const lower = message.toLowerCase();
    let fallbackReply = '';

    const matchedFarm = farmsList.find(f => 
      lower.includes(f.name.toLowerCase()) || 
      (f.owner && lower.includes(f.owner.toLowerCase()))
    );

    if (matchedFarm) {
      fallbackReply = `🏡 **Trang trại "${matchedFarm.name}":**\n` +
        `• **Chủ hộ quản lý:** ${matchedFarm.owner}\n` +
        `• **Diện tích:** ${matchedFarm.area ? matchedFarm.area + ' ha' : 'Chưa cập nhật'}\n` +
        `• **Loại cây đang trồng:** **${matchedFarm.crops}**\n` +
        `• **Tổng số cây:** ${matchedFarm.total} cây`;
    } else if (lower.includes('trang trại') || lower.includes('vườn')) {
      fallbackReply = `🏡 **Danh sách các trang trại và loại cây hiện tại:**\n` +
        farmsList.map(f => `• **${f.name}** (${f.owner}): Trồng **${f.crops}** (${f.total} cây)`).join('\n');
    } else if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('vàng lá') || lower.includes('đốm')) {
      fallbackReply = `🌿 **Kỹ thuật xử lý bệnh hại cây trồng:**\n` +
        `• **Vàng lá thối rễ:** Giảm tưới, xới thoáng gốc, tưới đối kháng *Trichoderma* + *Metalaxyl*.\n` +
        `• **Đốm lá / Rỉ sắt:** Tỉa cành thoáng, phun hoạt chất *Mancozeb* hoặc *Hexaconazole*.\n` +
        `• **Cách ly PHI:** Ngưng phun thuốc 7 - 14 ngày trước khi thu hoạch theo chuẩn VietGAP. 🩺`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply = `💧 **Hướng dẫn liều lượng tưới nước:**\n` +
        `• Duy trì độ ẩm đất vùng rễ ở mức **65% - 75%**.\n` +
        `• Tưới vào sáng sớm hoặc chiều mát, lượng nước 20 - 40 lít/gốc tùy tuổi cây.\n` +
        `• Không tưới đẫm khi trời đang nắng gắt giữa trưa.`;
    } else if (lower.includes('phân') || lower.includes('npk') || lower.includes('bón')) {
      fallbackReply = `🌾 **Kinh nghiệm bón phân:**\n` +
        `• **Giai đoạn đâm chồi / phát đọt:** Bón NPK 20-10-10 hoặc 30-10-10 + Hữu cơ hoai mục.\n` +
        `• **Giai đoạn nuôi trái:** Chuyển sang NPK 15-15-15 hoặc NPK 12-12-17 + TE để trái to, ngọt cơm, bóng vỏ!`;
    } else {
      fallbackReply = `Dạ ${userRole === 'admin' ? 'Admin' : 'Bác'}! Về **"${message}"**, Bé Mầm đã ghi nhận. Hiện hệ thống đang quản lý ${farmsList.length} trang trại và giám sát cảm biến IoT 24/7. ${userRole === 'admin' ? 'Admin' : 'Bác'} muốn hỏi chi tiết về trang trại hay kỹ thuật nào cứ nhắn em nhé! 🌱✨`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'smart_inmemory_engine',
      source: 'smart_db_cache'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
