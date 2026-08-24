const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech hỗ trợ Quản trị viên & Nông hộ bằng Google Gemini AI + Realtime DB Context
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], userRole = 'user' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    // 1. Thu thập dữ liệu thực tế chuyên sâu từ Database làm Realtime Context
    let systemContext = '';
    let rawFarmsData = [];
    let rawPlantsData = [];

    try {
      const [farmsRes, plantsRes, sickRes] = await Promise.all([
        pool.query(`
          SELECT 
            f.id as farm_id, 
            f.name as farm_name, 
            f.area, 
            f.total_plants,
            COALESCE(u.full_name, 'Nông hộ') as owner_name,
            COALESCE(STRING_AGG(DISTINCT NULLIF(TRIM(p.plant_type || ' ' || COALESCE(p.plant_variety, '')), ''), ', '), 'Chưa có dữ liệu cây cụ thể') as crop_types,
            COUNT(p.id) as actual_plant_count
          FROM farms f
          LEFT JOIN users u ON f.user_id = u.id
          LEFT JOIN plants p ON p.farm_id = f.id
          WHERE f.is_deleted = false OR f.is_deleted IS NULL
          GROUP BY f.id, f.name, f.area, f.total_plants, u.full_name
        `),
        pool.query(`
          SELECT plant_type, plant_variety, health_status, COUNT(*) as count
          FROM plants
          GROUP BY plant_type, plant_variety, health_status
        `),
        pool.query(`
          SELECT COUNT(*) as count FROM plants WHERE health_status IN ('Cần chú ý', 'Bệnh', 'Nguy cấp')
        `)
      ]);

      rawFarmsData = farmsRes.rows || [];
      rawPlantsData = plantsRes.rows || [];
      const sickCount = sickRes.rows[0]?.count || 0;

      let farmsSummary = rawFarmsData.map(f => 
        `- Trang trại: "${f.farm_name}" (Chủ hộ: ${f.owner_name}, Diện tích: ${f.area ? f.area + ' ha' : 'Chưa nhập'}, Tổng số cây: ${f.actual_plant_count || f.total_plants || 0} cây) -> Các loại cây/giống đang trồng: ${f.crop_types}`
      ).join('\n');

      let plantsSummary = rawPlantsData.map(p => 
        `- ${p.plant_type || 'Cây trồng'} (${p.plant_variety || 'Giống chuẩn'}): ${p.count} cây - Sức khỏe: ${p.health_status}`
      ).join('\n');

      systemContext = `[DỮ LIỆU THỰC TẾ TRANG TRẠI & CÂY TRỒNG TRÊN HỆ THỐNG]:
${farmsSummary || '- Chưa có dữ liệu trang trại.'}

[THỐNG KÊ CÂY TRỒNG]:
${plantsSummary || '- Chưa có dữ liệu cây trồng.'}
- Số cây cần theo dõi / sâu bệnh: ${sickCount} cây.`;

    } catch (dbErr) {
      console.warn('Lỗi đọc context database cho AI:', dbErr.message);
      systemContext = '[DỮ LIỆU THỰC TẾ]: Hệ thống Tanbao AgTech đang quản lý các trang trại công nghệ cao.';
    }

    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý số AI thông minh, am hiểu sâu sắc về nông nghiệp công nghệ cao và dữ liệu thực địa của hệ thống Tanbao AgTech.
Xưng hô: Xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${userRole === 'admin' ? 'Admin' : 'Bác nông hộ'}".

NGUYÊN TẮC PHẢN HỒI:
1. ĐI THẲNG VÀO CÂU TRẢ LỜI, KHÔNG CHÀO HỎI DÀI DÒNG LẶP LẠI MỖI TIN NHẮN.
2. Trả lời CHÍNH XÁC 100% dựa trên [DỮ LIỆU THỰC TẾ TRANG TRẠI & CÂY TRỒNG] bên dưới khi người dùng hỏi về trang trại, người sở hữu, loại cây, số lượng hay tình trạng sức khỏe.
3. Đối với các câu hỏi về kỹ thuật (trị sâu bệnh, liều lượng tưới, phân bón NPK, thời gian cách ly PHI VietGAP), hãy đưa ra hướng dẫn cụ thể, dễ hiểu, chuẩn kỹ thuật nông nghiệp.
4. Trình bày bằng markdown rõ ràng (gạch đầu dòng, in đậm tên trang trại và giống cây, emoji sinh động).

${systemContext}`;

    // 2. Lấy API Key Gemini
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
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.4,
                  maxOutputTokens: 1500
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
              console.warn(`Gemini Model ${modelName} HTTP ${geminiRes.status}:`, errText.substring(0, 120));
            }
          } catch (err) {
            console.warn(`Lỗi gọi Gemini AI (${modelName}):`, err.message);
          }
        }
      }
    }

    // 3. Fallback Engine Thông Minh: Tra Cứu Trực Tiếp Dữ Liệu DB Khớp Chính Xác Câu Hỏi
    const lower = message.toLowerCase();
    let fallbackReply = '';

    // Kiểm tra xem người dùng có hỏi về 1 trang trại cụ thể nào không
    const matchedFarm = rawFarmsData.find(f => 
      lower.includes(f.farm_name.toLowerCase()) || 
      lower.includes(f.owner_name.toLowerCase())
    );

    if (matchedFarm) {
      fallbackReply = `🏡 **Thông tin trang trại "${matchedFarm.farm_name}":**\n` +
        `- **Chủ hộ quản lý:** ${matchedFarm.owner_name}\n` +
        `- **Diện tích:** ${matchedFarm.area ? matchedFarm.area + ' ha' : 'Chưa cập nhật'}\n` +
        `- **Tổng số cây trồng:** ${matchedFarm.actual_plant_count || matchedFarm.total_plants || 0} cây\n` +
        `- **Loại cây / Giống đang trồng:** ${matchedFarm.crop_types || 'Đang cập nhật'}\n\n` +
        `💡 ${userRole === 'admin' ? 'Admin' : 'Bác'} có thể vào tab **"Trang trại"** để xem vị trí GPS và chi tiết từng lô cây nhé! 🌱`;
    } else if (lower.includes('trang trại') || lower.includes('vườn')) {
      fallbackReply = `🏡 **Danh sách các trang trại trong hệ thống hiện tại:**\n` +
        rawFarmsData.map(f => `• **${f.farm_name}** (${f.owner_name}): Trồng **${f.crop_types}** (${f.actual_plant_count || f.total_plants || 0} cây)`).join('\n') +
        `\n\n${userRole === 'admin' ? 'Admin' : 'Bác'} muốn hỏi chi tiết về trang trại nào cứ nhắn cho Bé Mầm nhé!`;
    } else if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('vàng lá') || lower.includes('đốm')) {
      fallbackReply = `🌿 **Kỹ thuật xử lý bệnh hại trên cây trồng:**\n` +
        `- **Vàng lá thối rễ:** Kiểm tra độ ẩm đất, xới nhẹ gốc, tưới nấm đối kháng *Trichoderma* kết hợp hoạt chất trừ nấm sinh học.\n` +
        `- **Đốm lá / Rỉ sắt:** Phun luân phiên thuốc gốc Đồng hoặc *Mancozeb*, cắt tỉa cành thông thoáng.\n` +
        `- **Cách ly PHI:** Tuân thủ thời gian cách ly từ 7 - 14 ngày trước khi thu hoạch theo chuẩn VietGAP! 🩺`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply = `💧 **Hướng dẫn liều lượng tưới nước:**\n` +
        `- Duy trì độ ẩm đất tầng rễ (20 - 40cm) ở mức **65% - 75%**.\n` +
        `- Mùa nắng: Tưới vào sáng sớm (6h - 8h) hoặc chiều mát (16h - 18h), khoảng 20 - 40 lít/gốc tùy độ tuổi của cây.\n` +
        `- Tránh tưới đẫm vào giữa trưa nắng gắt để không làm sốc nhiệt rễ non!`;
    } else if (lower.includes('phân') || lower.includes('npk') || lower.includes('bón')) {
      fallbackReply = `🌾 **Kinh nghiệm bón phân cho cây trồng:**\n` +
        `- **Giai đoạn kiến thiết / phát đọt:** Bón NPK giàu Đạm (ví dụ NPK 20-10-10, 30-10-10) kết hợp phân hữu cơ hoai mục.\n` +
        `- **Giai đoạn làm bông / nuôi trái:** Chuyển sang NPK cân đối và giàu Kali (ví dụ NPK 15-15-15, NPK 12-12-17 + TE) để trái ngọt, chắc cơm, vỏ bóng đẹp!`;
    } else {
      fallbackReply = `Dạ ${userRole === 'admin' ? 'Admin' : 'Bác'}! Về câu hỏi **"${message}"**, Bé Mầm đã ghi nhận. Hiện hệ thống đang quản lý ${rawFarmsData.length} trang trại và theo dõi cảm biến vi khí hậu 24/7. ${userRole === 'admin' ? 'Admin' : 'Bác'} có thể hỏi Bé Mầm về bất kỳ trang trại, kỹ thuật cây trồng hay dịch hại nào nhé! 🌱✨`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'smart_farm_engine',
      source: 'smart_farm_db'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
