const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech hỗ trợ Quản trị viên & Nông hộ
 * Phân quyền dữ liệu chặt chẽ theo tài khoản đăng nhập (Per-User Scoped Data)
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentUser = req.user; // { id, email, role, name, farm_id }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const isAdmin = currentUser.role === 'admin';
    let systemContext = '';
    let userFarms = [];
    let userPlants = [];
    let userLogs = [];
    let userSuppliesCost = 0;
    let userRecentSupplies = [];

    // 1. Truy vấn Dữ liệu Theo Đúng Quyền Sở Hữu Của User Đang Đăng Nhập
    try {
      if (isAdmin) {
        // ADMIN: Toàn quyền truy cập tất cả trang trại & số liệu hệ thống
        const [farmsRes, plantsRes, sickRes, costRes] = await Promise.all([
          pool.query(`
            SELECT f.id, f.name, f.area, f.total_plants, COALESCE(u.full_name, 'Nông hộ') as owner_name 
            FROM farms f 
            LEFT JOIN users u ON f.user_id = u.id 
            WHERE (f.is_deleted IS NOT TRUE)
          `),
          pool.query(`
            SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name 
            FROM plants p 
            LEFT JOIN farms f ON p.farm_id = f.id
          `),
          pool.query("SELECT COUNT(*) as count FROM plants WHERE health_status IN ('Cần chú ý', 'Bệnh', 'Nguy cấp')"),
          pool.query("SELECT COALESCE(SUM(total_cost), 0) as total FROM supply_usages")
        ]);

        const farmMap = {};
        (farmsRes.rows || []).forEach(f => {
          farmMap[f.id] = {
            id: f.id,
            name: f.name,
            owner: f.owner_name,
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

        userFarms = Object.values(farmMap).map(f => ({
          name: f.name,
          owner: f.owner,
          area: f.area,
          total: f.plantCount || f.total || 0,
          crops: f.crops.size > 0 ? Array.from(f.crops).join(', ') : 'Đang cập nhật danh sách cây'
        }));

        const sickCount = sickRes.rows?.[0]?.count || 0;
        const totalExpense = costRes.rows?.[0]?.total || 0;

        const farmLines = userFarms.map(f => 
          `- Trang trại: "${f.name}" | Chủ hộ: ${f.owner} | Diện tích: ${f.area ? f.area + ' ha' : 'N/A'} | Cây trồng: ${f.crops} (Tổng: ${f.total} cây)`
        ).join('\n');

        systemContext = `[QUYỀN HẠN: QUẢN TRỊ VIÊN TOÀN HỆ THỐNG]:
Admin: ${currentUser.name} (${currentUser.email})
Tổng số trang trại đang quản lý: ${userFarms.length} trang trại.
${farmLines}
- Cây đang ủ bệnh/cần theo dõi: ${sickCount} cây.
- Tổng chi phí vật tư toàn hệ thống: ${Number(totalExpense).toLocaleString('vi-VN')} VNĐ.`;

      } else {
        // NÔNG HỘ / USER: CHỈ TRUY CẬP DỮ LIỆU CÁC TRANG TRẠI THUỘC SỞ HỮU CỦA USER NÀY
        const [farmsRes, plantsRes, logsRes, costRes, usagesRes] = await Promise.all([
          pool.query(`
            SELECT f.id, f.name, f.area, f.total_plants, u.full_name as owner_name 
            FROM farms f 
            LEFT JOIN users u ON f.user_id = u.id 
            WHERE (f.is_deleted IS NOT TRUE) 
              AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1))
          `, [currentUser.id]),

          pool.query(`
            SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name 
            FROM plants p 
            JOIN farms f ON p.farm_id = f.id 
            WHERE (f.is_deleted IS NOT TRUE) 
              AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1) OR p.created_by = $1 OR p.assigned_to_user_id = $1)
          `, [currentUser.id]),

          pool.query(`
            SELECT pl.log_date, pl.log_type, pl.note, p.tree_code, p.plant_type, f.name as farm_name 
            FROM plant_logs pl 
            JOIN plants p ON pl.plant_id = p.id 
            JOIN farms f ON p.farm_id = f.id 
            WHERE (f.user_id = $1 OR pl.created_by = $1) 
            ORDER BY pl.log_date DESC, pl.created_at DESC 
            LIMIT 10
          `, [currentUser.id]),

          pool.query(`
            SELECT COALESCE(SUM(su.total_cost), 0) as total 
            FROM supply_usages su 
            LEFT JOIN farms f ON su.farm_id = f.id 
            WHERE su.user_id = $1 OR f.user_id = $1
          `, [currentUser.id]),

          pool.query(`
            SELECT s.name, s.category, su.quantity, s.unit, su.unit_price, su.total_cost, su.usage_date, f.name as farm_name 
            FROM supply_usages su 
            JOIN supplies s ON su.supply_id = s.id 
            LEFT JOIN farms f ON su.farm_id = f.id 
            WHERE su.user_id = $1 OR f.user_id = $1 
            ORDER BY su.usage_date DESC 
            LIMIT 8
          `, [currentUser.id])
        ]);

        const farmMap = {};
        (farmsRes.rows || []).forEach(f => {
          farmMap[f.id] = {
            id: f.id,
            name: f.name,
            owner: f.owner_name,
            area: f.area,
            total: f.total_plants || 0,
            plantCount: 0,
            crops: new Set()
          };
        });

        userPlants = plantsRes.rows || [];
        userPlants.forEach(p => {
          if (p.farm_id && farmMap[p.farm_id]) {
            farmMap[p.farm_id].plantCount++;
            const crop = [p.plant_type, p.plant_variety].filter(Boolean).join(' - ');
            if (crop) farmMap[p.farm_id].crops.add(crop);
          }
        });

        userFarms = Object.values(farmMap).map(f => ({
          name: f.name,
          owner: f.owner,
          area: f.area,
          total: f.plantCount || f.total || 0,
          crops: f.crops.size > 0 ? Array.from(f.crops).join(', ') : 'Đang cập nhật danh sách cây'
        }));

        userLogs = logsRes.rows || [];
        userSuppliesCost = Number(costRes.rows?.[0]?.total || 0);
        userRecentSupplies = usagesRes.rows || [];

        const farmLines = userFarms.map(f => 
          `- Trang trại của Bác: "${f.name}" | Diện tích: ${f.area ? f.area + ' ha' : 'Chưa nhập'} | Cây trồng: ${f.crops} (Tổng: ${f.total} cây)`
        ).join('\n');

        const logLines = userLogs.map(l => 
          `- Ngày ${new Date(l.log_date).toLocaleDateString('vi-VN')}: [${l.log_type}] trên cây ${l.tree_code || l.plant_type} (${l.farm_name}) - Ghi chú: ${l.note || 'Bình thường'}`
        ).join('\n');

        const supplyLines = userRecentSupplies.map(s => 
          `- ${s.name} (${s.category}): ${s.quantity} ${s.unit} - Thành tiền: ${Number(s.total_cost).toLocaleString('vi-VN')} VNĐ (${s.farm_name})`
        ).join('\n');

        systemContext = `[THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP]:
- Chủ tài khoản Nông hộ: ${currentUser.name} (${currentUser.email})
- Bác đang sở hữu/quản lý: ${userFarms.length} trang trại:
${farmLines || '- Bác chưa tạo trang trại nào.'}

[NHẬT KÝ CANH TÁC & CHĂM SÓC GẦN ĐÂY]:
${logLines || '- Chưa có nhật ký chăm sóc nào gần đây.'}

[VẬT TƯ & CHI PHÍ TIÊU HAO ĐÃ DÙNG]:
- Tổng chi phí vật tư đã chi: ${userSuppliesCost.toLocaleString('vi-VN')} VNĐ.
${supplyLines || '- Chưa ghi nhận tiêu hao vật tư gần đây.'}`;
      }

    } catch (dbErr) {
      console.warn('Lỗi đọc database cho scoped AI context:', dbErr.message);
      systemContext = `[THÔNG TIN]: Đang hỗ trợ tài khoản ${currentUser.name}.`;
    }

    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý số AI chuyên gia nông nghiệp thông minh của hệ thống Tanbao AgTech.
Xưng hô: Xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${isAdmin ? 'Admin' : 'Bác ' + (currentUser.name || 'nông hộ')}".

NGUYÊN TẮC QUAN TRỌNG:
1. ĐI THẲNG VÀO CÂU TRẢ LỜI, KHÔNG CHÀO HỎI RƯỜM RÀ LẶP LẠI.
2. BẢO MẬT & ĐÚNG PHẠM VI: Chỉ truy cập và trả lời dựa trên [DỮ LIỆU CỦA USER] bên dưới. Nếu người dùng sở hữu 1 hay nhiều trang trại (ví dụ 2 trang trại), hãy trả lời đầy đủ thông tin chi tiết từng trang trại, cây trồng, chi phí, nhật ký canh tác của user đó.
3. Khi người dùng hỏi về:
   - "Tôi có mấy trang trại?" / "Trang trại của tôi trồng gì?": Liệt kê chính xác tên các trang trại và giống cây của user.
   - "Chi phí vật tư / tiêu hao?": Báo cáo tổng tiền và các đợt dùng vật tư của user.
   - "Nhật ký chăm sóc gần đây?": Tóm tắt các lần tưới/bón phân/phun thuốc gần nhất của user.
4. Với câu hỏi kỹ thuật canh tác (sâu bệnh, liều lượng tưới, NPK, cách ly PHI VietGAP), trả lời ngắn gọn, chuẩn xác.

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
        parts: [{ text: `${systemPrompt}\n\nCâu hỏi của ${currentUser.name}: ${message}` }]
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
            // Thử model kế tiếp
          }
        }
      }
    }

    // 3. Fallback Engine Thông Minh Trả Lời Chuẩn Xác Theo Dữ Liệu Của User
    const lower = message.toLowerCase();
    let fallbackReply = '';

    if (lower.includes('trang trại') || lower.includes('vườn') || lower.includes('mấy trang trại') || lower.includes('trồng cây gì') || lower.includes('trồng gì')) {
      if (userFarms.length === 0) {
        fallbackReply = `🏡 Hiện tại tài khoản của ${isAdmin ? 'Admin' : 'Bác'} chưa có trang trại nào được gán hoặc tạo mới. Bác có thể vào mục **"Trang trại"** để thêm trang trại đầu tiên nhé!`;
      } else {
        fallbackReply = `🏡 **${isAdmin ? 'Toàn bộ trang trại' : 'Danh sách các trang trại của Bác (' + userFarms.length + ' trang trại)'}:**\n` +
          userFarms.map((f, idx) => `• **${idx + 1}. ${f.name}**:\n  - Diện tích: ${f.area ? f.area + ' ha' : 'Chưa cập nhật'}\n  - Loại cây trồng: **${f.crops}** (${f.total} cây)`).join('\n\n');
      }
    } else if (lower.includes('chi phí') || lower.includes('tiền') || lower.includes('vật tư') || lower.includes('tiêu hao')) {
      fallbackReply = `💰 **Tổng hợp chi phí vật tư của ${isAdmin ? 'toàn hệ thống' : 'Bác'}:**\n` +
        `• **Tổng chi phí đã dùng:** **${userSuppliesCost.toLocaleString('vi-VN')} VNĐ**\n` +
        (userRecentSupplies.length > 0 ? `• **Các đợt dùng gần nhất:**\n` + userRecentSupplies.map(s => `  - ${s.name} (${s.category}): ${s.quantity} ${s.unit} (${Number(s.total_cost).toLocaleString('vi-VN')} đ)`).join('\n') : '');
    } else if (lower.includes('nhật ký') || lower.includes('chăm sóc') || lower.includes('canh tác') || lower.includes('lịch sử')) {
      fallbackReply = `📝 **Nhật ký canh tác gần đây của ${isAdmin ? 'hệ thống' : 'Bác'}:**\n` +
        (userLogs.length > 0 ? userLogs.map(l => `• **${new Date(l.log_date).toLocaleDateString('vi-VN')}** [${l.log_type}]: ${l.tree_code || l.plant_type} (${l.farm_name}) - ${l.note || 'Bình thường'}`).join('\n') : 'Chưa có hoạt động canh tác nào gần đây.');
    } else if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('vàng lá') || lower.includes('đốm')) {
      fallbackReply = `🌿 **Kỹ thuật xử lý bệnh hại cây trồng:**\n` +
        `• **Vàng lá thối rễ:** Giảm tưới, xới nhẹ đất quanh tán, tưới nấm đối kháng *Trichoderma* + *Metalaxyl*.\n` +
        `• **Đốm lá / Rỉ sắt:** Cắt tỉa cành thông thoáng, phun thuốc hoạt chất *Mancozeb* hoặc *Hexaconazole*.\n` +
        `• **Cách ly PHI:** Ngưng phun thuốc 7 - 14 ngày trước thu hoạch theo chuẩn VietGAP. 🩺`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply = `💧 **Hướng dẫn liều lượng tưới nước:**\n` +
        `• Giữ độ ẩm đất vùng rễ cây ở mức **65% - 75%**.\n` +
        `• Tưới vào sáng sớm hoặc chiều mát, lượng nước khoảng 20 - 40 lít/gốc tùy độ tuổi cây.`;
    } else {
      fallbackReply = `Dạ ${isAdmin ? 'Admin' : 'Bác ' + currentUser.name}! Về **"${message}"**, Bé Mầm đã nắm thông tin. Bác có thể hỏi Bé Mầm về: danh sách trang trại, các loại cây đang trồng, tổng chi phí vật tư hoặc nhật ký canh tác của mình nhé! 🌱✨`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'smart_scoped_engine',
      source: 'smart_scoped_db'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm Scoped:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
