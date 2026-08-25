const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

/**
 * Phân loại độ khó câu hỏi (Smart Dynamic Model Routing)
 * - Câu hỏi dễ/tra cứu dữ liệu/thao tác app: Dùng Model Tiêu Chuẩn (2.5 Flash Lite / 2.0 Flash) -> Quota 1.500 lượt/ngày!
 * - Câu hỏi khó/phân tích sâu/bệnh hại phức tạp: Kích hoạt Model Siêu Cấp (Gemini 3.7 / 3.5 / Pro)
 */
function classifyQueryComplexity(message) {
  const lower = message.toLowerCase().trim();

  // Dấu hiệu câu hỏi phức tạp (chuyên sâu, phác đồ, lập kế hoạch, triệu chứng lạ)
  const complexKeywords = [
    'nguyên nhân', 'tại sao', 'phác đồ', 'kết hợp', 'ra hoa nghịch vụ', 'trái vụ',
    'cháy múi', 'sượng cơm', 'vừa bị', 'triệu chứng', 'phèn mặn', 'hoạt chất', 
    'nồng độ', 'kế hoạch', 'tối ưu', 'phân tích', 'xuất khẩu', 'globalgap', 'lập bảng',
    'tính toán', 'phối trộn', 'ủ phân', 'ức chế đọt', 'nứt thân xì mủ diện rộng'
  ];
  const hasComplexKeywords = complexKeywords.some(k => lower.includes(k));
  const isLongQuery = lower.split(/\s+/).length >= 18;

  if (hasComplexKeywords || isLongQuery) {
    return 'complex'; // -> Route tới Flagship Models
  }

  return 'standard'; // -> Route tới Standard / Light Models (tiết kiệm quota)
}

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech - Điều hướng mô hình thông minh (Dynamic Multi-Tier Router)
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
${farmLines || '- Bác chưa tạo trang trại nào (Tài khoản mới).'}

[NHẬT KÝ CANH TÁC & CHĂM SÓC GẦN ĐÂY]:
${logLines || '- Chưa có nhật ký chăm sóc nào gần đây.'}

[VẬT TƯ & CHI PHÍ TIÊU HAO ĐÃ DÙNG]:
- Tổng chi phí vật tư đã chi: ${userSuppliesCost.toLocaleString('vi-VN')} VNĐ.
${supplyLines || '- Chưa ghi nhận tiêuaho vật tư gần đây.'}`;
      }

    } catch (dbErr) {
      console.warn('Lỗi đọc database cho scoped AI context:', dbErr.message);
      systemContext = `[THÔNG TIN]: Đang hỗ trợ tài khoản ${currentUser.name}.`;
    }

    // 2. TẬP HUẤN TOÀN BỘ KIẾN THỨC NÔNG NGHIỆP & CẨM NANG HỆ THỐNG
    const systemPrompt = `Bạn là "Bé Mầm AgTech" - Trợ lý số AI chuyên gia nông nghiệp thông minh của hệ thống Sổ Nông Tân Bảo AgTech.
Xưng hô: Xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${isAdmin ? 'Admin' : 'Bác ' + (currentUser.name || 'nông hộ')}".

📘 [BỘ KIẾN THỨC CẨM NANG HỆ THỐNG SỔ NÔNG TÂN BẢO]:
Khi người dùng hỏi "App này sài sao?", "Chưa biết dùng", "Hướng dẫn sử dụng", "Tạo trang trại như thế nào", hãy hướng dẫn chuẩn xác 4 bước sau:
- Bước 1: Tạo Trang Trại Mới: Vào menu "Trang trại" (bên trái) -> Bấm "+ Khởi tạo Trang trại mới (GPS)" -> Điền tên vườn, diện tích và nhấn "Lấy vị trí GPS" để hệ thống tự động ghim vị trí vệ tinh và kết nối trạm dự báo thời tiết 6 ngày.
- Bước 2: Thêm Cây Trồng & Gán Mã Cây: Vào trang trại -> Bấm "+ Thêm cây" -> Nhập loại cây (Sầu riêng, Bưởi...), mã cây (SR-001) và định vị cây trên bản đồ GIS hoặc quét thẻ NFC/QR.
- Bước 3: Ghi Nhật Ký Canh Tác: Bấm vào Bé Mầm Ôm Nút (+) ở góc dưới màn hình -> Chọn "📝 Ghi nhật ký chăm sóc" -> Chọn hoạt động Tưới nước (số lít/gốc), Bón phân NPK, Phun thuốc BVTV hoặc Chụp ảnh đính kèm.
- Bước 4: Quản Lý Vật Tư & Chi Phí: Vào mục "Vật tư" -> Chụp ảnh bao bì phân bón/thuốc để AI quét OCR bóc tách giá tiền và tự động tính toán tổng chi phí mùa vụ.

🌿 [BỘ KIẾN THỨC KỸ THUẬT NÔNG NGHIỆP & VIETGAP]:
- Sầu riêng: Giai đoạn nuôi đọt (NPK 30-10-10), làm bông (xiết nước 15-20 ngày + NPK 10-50-10), nuôi trái (NPK 12-12-17 hoặc NPK 15-5-25 để cơm vàng ngọt dẻo).
- Bệnh hại: Vàng lá thối rễ / Xì mủ nứt thân (quét Metalaxyl/Fosetyl-Al, tưới nấm Trichoderma). Rầy xanh (phun Imidacloprid/Emamectin khi đọt le mũi giáo).
- Nguyên tắc VietGAP: Cách ly thuốc BVTV (PHI) tối thiểu 7 - 14 ngày trước thu hoạch.

⚠️ NGUYÊN TẮC QUAN TRỌNG:
1. TRẢ LỜI ĐẦY ĐỦ, MẠCH LẠC, TUYỆT ĐỐI KHÔNG ĐƯỢC CẮT CỤT CÂU GIỮA CHỪNG.
2. Trình bày bằng markdown rõ ràng (tiêu đề, gạch đầu dòng, in đậm tên nút bấm).
3. ĐI THẲNG VÀO TRỌNG TÂM câu hỏi của người dùng.

${systemContext}`;

    // 3. ĐIỀU HƯỚNG MÔ HÌNH THÔNG MINH (DYNAMIC MODEL ROUTER)
    const queryComplexity = classifyQueryComplexity(message);
    let modelCandidates = [];

    if (queryComplexity === 'complex') {
      // 🌟 Câu hỏi khó/chuyên sâu: Ưu tiên Model Siêu Cấp (3.7 / 3.5 / Pro)
      modelCandidates = [
        'gemini-3.7-flash',
        'gemini-3.5-flash',
        'gemini-pro-latest',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash'
      ];
    } else {
      // ⚡ Câu hỏi dễ/tra cứu/thường ngày: Ưu tiên Model Standard/Lite (Quota lớn 1.500 RPD, phản hồi siêu tốc)
      modelCandidates = [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-1.5-flash',
        'gemini-3.5-flash'
      ];
    }

    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
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
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: queryComplexity === 'complex' ? 0.3 : 0.15,
                  maxOutputTokens: 2500
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
                  model: `${modelName} (${queryComplexity})`,
                  source: 'gemini_ai'
                });
              }
            }
          } catch (err) {
            // Tự động chuyển tiếp sang model kế tiếp trong danh sách phân tầng
          }
        }
      }
    }

    // 4. Fallback Knowledge Engine Hoàn Chỉnh (Đầy Đủ Không Bao Giờ Cụt)
    const lower = message.toLowerCase();
    let fallbackReply = '';

    if (lower.includes('sài sao') || lower.includes('dùng sao') || lower.includes('hướng dẫn') || lower.includes('tạo trang trại') || lower.includes('chưa biết sài') || lower.includes('chưa biết dùng') || lower.includes('bắt đầu')) {
      fallbackReply = `🌱 **Chào mừng Bác đến với Sổ Nông Tân Bảo AgTech! Bé Mầm xin hướng dẫn quy trình 4 bước sử dụng cực kỳ đơn giản sau đây:**\n\n` +
        `📍 **Bước 1: Khởi tạo Trang Trại Đầu Tiên:**\n` +
        `- Vào menu **"Trang trại"** ở thanh điều hướng bên trái.\n` +
        `- Nhấn nút xanh **"+ Khởi tạo Trang trại mới (GPS)"**.\n` +
        `- Nhập tên vườn, diện tích (ha) và nhấn **"Lấy GPS"** để hệ thống tự động ghim vị trí vệ tinh và kết nối trạm dự báo thời tiết 6 ngày.\n\n` +
        `🌳 **Bước 2: Thêm Cây Trồng & Gán Mã Cây:**\n` +
        `- Mở trang trại vừa tạo, bấm nút **"+ Thêm cây"**.\n` +
        `- Chọn loại cây (Sầu riêng, Bưởi, Mít...), gán mã cây (ví dụ: **SR-001**) và định vị cây trên bản đồ GIS hoặc quét thẻ NFC/QR thực địa.\n\n` +
        `📝 **Bước 3: Ghi Nhật Ký Canh Tác Hàng Ngày:**\n` +
        `- Bấm trực tiếp vào **Bé Mầm Ôm Nút Dấu Cộng (+)** ở góc dưới bên phải màn hình bất cứ lúc nào.\n` +
        `- Chọn **"📝 Ghi nhật ký chăm sóc"** để lưu lại hoạt động: Tưới nước (lít/gốc), bón phân NPK, phun thuốc BVTV hoặc chụp ảnh kiểm tra vườn.\n\n` +
        `📦 **Bước 4: Quản Lý Kho Vật Tư & Chi Phí Tiêu Hao:**\n` +
        `- Vào mục **"Vật tư"**, chụp ảnh bao bì phân bón/thuốc để AI tự động quét OCR bóc tách giá tiền và tự động tính toán chi phí theo mùa vụ cho Bác!\n\n` +
        `💡 *Trong quá trình canh tác, Bác cần hỏi bất kỳ kỹ thuật trị bệnh hay tra cứu gì cứ nhấn vào em (Bé Mầm) nhé! ✨*`;
    } else if (lower.includes('trang trại') || lower.includes('vườn') || lower.includes('mấy trang trại') || lower.includes('trồng cây gì') || lower.includes('trồng gì')) {
      if (userFarms.length === 0) {
        fallbackReply = `🏡 Bác chưa tạo trang trại nào. Bác hãy vào mục **"Trang trại"** ➔ bấm **"+ Khởi tạo Trang trại mới (GPS)"** để tạo trang trại đầu tiên nhé!`;
      } else {
        fallbackReply = `🏡 **${isAdmin ? 'Toàn bộ trang trại trong hệ thống' : 'Danh sách các trang trại của Bác (' + userFarms.length + ' trang trại)'}:**\n` +
          userFarms.map((f, idx) => `• **${idx + 1}. ${f.name}**:\n  - Diện tích: ${f.area ? f.area + ' ha' : 'Chưa cập nhật'}\n  - Loại cây trồng: **${f.crops}** (${f.total} cây)`).join('\n\n');
      }
    } else if (lower.includes('chi phí') || lower.includes('tiền') || lower.includes('vật tư') || lower.includes('tiêu hao')) {
      fallbackReply = `💰 **Tổng hợp chi phí vật tư của ${isAdmin ? 'toàn hệ thống' : 'Bác ' + currentUser.name}:**\n` +
        `• **Tổng chi phí đã dùng:** **${userSuppliesCost.toLocaleString('vi-VN')} VNĐ**\n` +
        (userRecentSupplies.length > 0 ? `• **Các đợt dùng gần nhất:**\n` + userRecentSupplies.map(s => `  - ${s.name} (${s.category}): ${s.quantity} ${s.unit} (${Number(s.total_cost).toLocaleString('vi-VN')} đ) -> ${s.farm_name}`).join('\n') : '  - Chưa ghi nhận đợt dùng vật tư nào.');
    } else if (lower.includes('nhật ký') || lower.includes('chăm sóc') || lower.includes('canh tác') || lower.includes('lịch sử')) {
      fallbackReply = `📝 **Nhật ký canh tác gần đây của ${isAdmin ? 'hệ thống' : 'Bác'}:**\n` +
        (userLogs.length > 0 ? userLogs.map(l => `• **${new Date(l.log_date).toLocaleDateString('vi-VN')}** [${l.log_type}]: ${l.tree_code || l.plant_type} (${l.farm_name}) - ${l.note || 'Bình thường'}`).join('\n') : 'Chưa có hoạt động canh tác nào gần đây.');
    } else if (lower.includes('bệnh') || lower.includes('sâu') || lower.includes('vàng lá') || lower.includes('đốm') || lower.includes('thối rễ')) {
      fallbackReply = `🌿 **Kỹ thuật xử lý bệnh hại cây trồng chuẩn VietGAP:**\n` +
        `• **Bệnh Vàng lá thối rễ:** Giảm lượng nước tưới, xới nhẹ đất quanh tán cây, tưới thuốc hoạt chất *Metalaxyl* hoặc *Dimethomorph*, kết hợp bổ sung nấm đối kháng *Trichoderma* để phục hồi rễ tơ.\n` +
        `• **Bệnh Đốm lá / Rỉ sắt / Thán thư:** Cắt tỉa cành thông thoáng, phun thuốc hoạt chất *Mancozeb*, *Hexaconazole* hoặc *Azoxystrobin*.\n` +
        `• **Thời gian cách ly (PHI):** Ngưng phun thuốc BVTV tối thiểu 7 - 14 ngày trước khi thu hoạch để đảm bảo an toàn nông sản! 🩺`;
    } else if (lower.includes('tưới') || lower.includes('nước') || lower.includes('ẩm')) {
      fallbackReply = `💧 **Hướng dẫn liều lượng tưới nước:**\n` +
        `• Giữ độ ẩm đất vùng rễ cây ở mức **65% - 75%**.\n` +
        `• Tưới vào sáng sớm hoặc chiều mát, lượng nước khoảng 20 - 40 lít/gốc tùy độ tuổi cây và mùa vụ.`;
    } else {
      fallbackReply = `Dạ ${isAdmin ? 'Admin' : 'Bác ' + currentUser.name}! Về **"${message}"**, Bé Mầm đã nắm thông tin. Bác có thể hỏi Bé Mầm về: hướng dẫn sử dụng app, tạo trang trại mới, kỹ thuật trị sâu bệnh, tổng chi phí vật tư hoặc nhật ký chăm sóc của vườn nhé! 🌱✨`;
    }

    return res.json({
      success: true,
      reply: fallbackReply,
      model: 'trained_expert_engine',
      source: 'trained_knowledge_base'
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm Scoped:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
