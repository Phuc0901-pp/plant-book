const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const memoryCache = require('../config/cache');
const {
  checkPromptInjection,
  loadKnowledgeBaseCached,
  matchTrainingQA,
  rankKnowledgeArticles,
  executeAgentTools,
  synthesizeGroundedAgentReply
} = require('../services/beMamAgentEngine');

/**
 * Phân loại độ khó câu hỏi (Smart Dynamic Model Routing)
 * - Câu hỏi dễ/tra cứu dữ liệu/thao tác app: Dùng Model Tiêu Chuẩn (2.5 Flash Lite / 2.0 Flash) -> Quota 1.500 lượt/ngày!
 * - Câu hỏi khó/phân tích sâu/bệnh hại phức tạp: Kích hoạt Model Siêu Cấp (Gemini 3.7 / 3.5 / Pro)
 */
function classifyQueryComplexity(message) {
  const lower = message.toLowerCase().trim();

  const complexKeywords = [
    'nguyên nhân', 'tại sao', 'phác đồ', 'kết hợp', 'ra hoa nghịch vụ', 'trái vụ',
    'cháy múi', 'sượng cơm', 'vừa bị', 'triệu chứng', 'phèn mặn', 'hoạt chất', 
    'nồng độ', 'kế hoạch', 'tối ưu', 'phân tích', 'xuất khẩu', 'globalgap', 'lập bảng',
    'tính toán', 'phối trộn', 'ủ phân', 'ức chế đọt', 'nứt thân xì mủ diện rộng'
  ];
  const hasComplexKeywords = complexKeywords.some(k => lower.includes(k));
  const isLongQuery = lower.split(/\s+/).length >= 18;

  if (hasComplexKeywords || isLongQuery) {
    return 'complex'; // -> Route tới Flagship Models trước
  }

  return 'standard'; // -> Route tới Standard / Light Models trước
}

/**
 * POST /api/ai/chat
 * Trợ lý ảo AI Bé Mầm AgTech - Tự động nhảy model khi hết quota & Cache RAM Scoped Context ($0)
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const currentUser = req.user; // { id, email, role, name, farm_id }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    // 0. OWASP LLM01 Prompt Injection Guardrail
    const guardCheck = checkPromptInjection(message);
    if (!guardCheck.safe) {
      return res.json({
        success: true,
        reply: guardCheck.safeReply,
        model: 'owasp_llm01_guardrail',
        source: 'security_guardrail',
        agentMetadata: { blockedReason: guardCheck.reason }
      });
    }

    const isAdmin = currentUser.role === 'admin';
    const cacheKey = `ai_context_${currentUser.id}_${isAdmin ? 'adm' : 'usr'}`;
    
    // 1. Kiểm tra RAM Cache trước (Độ trễ <0.1ms)
    let cachedContextData = memoryCache.get(cacheKey);
    let systemContext = '';
    let userFarms = [];
    let userPlants = [];
    let userLogs = [];
    let userSuppliesCost = 0;
    let userRecentSupplies = [];

    if (cachedContextData) {
      systemContext = cachedContextData.systemContext;
      userFarms = cachedContextData.userFarms || [];
      userPlants = cachedContextData.userPlants || [];
      userSuppliesCost = cachedContextData.userSuppliesCost || 0;
      userRecentSupplies = cachedContextData.userRecentSupplies || [];
      userLogs = cachedContextData.userLogs || [];
    } else {
      // 2. Truy vấn từ Read Replica Pool (Tách tải khỏi Master)
      try {
        if (isAdmin) {
          const [farmsRes, plantsRes, sickRes, costRes] = await Promise.all([
            pool.readQuery(`
              SELECT f.id, f.name, f.area, f.total_plants, COALESCE(u.full_name, 'Nông hộ') as owner_name 
              FROM farms f 
              LEFT JOIN users u ON f.user_id = u.id 
              WHERE (f.is_deleted IS NOT TRUE)
            `),
            pool.readQuery(`
              SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name 
              FROM plants p 
              LEFT JOIN farms f ON p.farm_id = f.id
            `),
            pool.readQuery("SELECT COUNT(*) as count FROM plants WHERE health_status IN ('Cần chú ý', 'Bệnh', 'Nguy cấp')"),
            pool.readQuery("SELECT COALESCE(SUM(total_cost), 0) as total FROM supply_usages")
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
            pool.readQuery(`
              SELECT f.id, f.name, f.area, f.total_plants, u.full_name as owner_name 
              FROM farms f 
              LEFT JOIN users u ON f.user_id = u.id 
              WHERE (f.is_deleted IS NOT TRUE) 
                AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1))
            `, [currentUser.id]),

            pool.readQuery(`
              SELECT p.id, p.tree_code, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name 
              FROM plants p 
              JOIN farms f ON p.farm_id = f.id 
              WHERE (f.is_deleted IS NOT TRUE) 
                AND (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1) OR p.created_by = $1 OR p.assigned_to_user_id = $1)
            `, [currentUser.id]),

            pool.readQuery(`
              SELECT pl.log_date, pl.log_type, pl.note, p.tree_code, p.plant_type, f.name as farm_name 
              FROM plant_logs pl 
              JOIN plants p ON pl.plant_id = p.id 
              JOIN farms f ON p.farm_id = f.id 
              WHERE (f.user_id = $1 OR pl.created_by = $1) 
              ORDER BY pl.log_date DESC, pl.created_at DESC 
              LIMIT 10
            `, [currentUser.id]),

            pool.readQuery(`
              SELECT COALESCE(SUM(su.total_cost), 0) as total 
              FROM supply_usages su 
              LEFT JOIN farms f ON su.farm_id = f.id 
              WHERE su.user_id = $1 OR f.user_id = $1
            `, [currentUser.id]),

            pool.readQuery(`
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
${supplyLines || '- Chưa ghi nhận tiêu hao vật tư gần đây.'}`;
        }

        // Lưu vào RAM Cache trong 45 giây để phục vụ các câu chat tiếp theo tức thì
        memoryCache.set(cacheKey, {
          systemContext,
          userFarms,
          userPlants,
          userSuppliesCost,
          userRecentSupplies,
          userLogs
        }, 45);

      } catch (dbErr) {
        console.warn('Lỗi đọc database cho scoped AI context:', dbErr.message);
        systemContext = `[THÔNG TIN]: Đang hỗ trợ tài khoản ${currentUser.name}.`;
      }
    }

    // 2. HYBRID BM25 RAG & 8 AGENTIC TOOLS EXECUTION (ISO/IEC 42001 & 23053)
    // Quét toàn bộ ai_training_qa & ai_knowledge_articles trong RAM Cache (xóa bỏ giới hạn LIMIT 30)
    let trainedKnowledgeText = '';
    let matchedQAResult = null;
    let ragResult = { topArticles: [], matchedSynonyms: [], maxScore: 0 };
    let toolExecResult = { triggeredTools: [], toolSections: [], suggestedActions: [] };

    try {
      const kbBundle = await loadKnowledgeBaseCached(pool);
      matchedQAResult = matchTrainingQA(message, kbBundle.qaRows);
      ragResult = rankKnowledgeArticles(message, kbBundle.articleRows);
      toolExecResult = executeAgentTools(message, {
        isAdmin,
        currentUser,
        userFarms,
        userPlants,
        userLogs,
        userSuppliesCost,
        userRecentSupplies
      });

      // Nếu khớp Cặp Q&A độ tin cậy cao (>= 0.85) và không yêu cầu tính toán phức tạp -> Phản xạ tức thì (< 5ms, $0 Token)
      if (matchedQAResult && matchedQAResult.score >= 0.85 && toolExecResult.triggeredTools.length === 0) {
        return res.json({
          success: true,
          reply: matchedQAResult.qa.expected_answer,
          source: 'trained_qa',
          model: 'trained-qa-instant',
          modelUsed: 'trained-qa-instant',
          agentMetadata: {
            confidenceScore: matchedQAResult.score,
            matchedQAId: matchedQAResult.qa.id,
            toolsTriggered: []
          }
        });
      }

      if (ragResult.topArticles.length > 0) {
        trainedKnowledgeText = `\n[TÀI LIỆU TRI THỨC ĐỘC QUYỀN TÂN BẢO ĐÃ HUẤN LUYỆN CHO BÉ MẦM]:\n` +
          ragResult.topArticles.map((a, i) => `--- Tài liệu ${i + 1}: ${a.title} (${a.category} | Điểm BM25: ${a.matchScore}) ---\n${a.content}`).join('\n\n');
      }
    } catch (ragErr) {
      console.warn('Lỗi tra cứu RAG & Agent Tools:', ragErr.message);
    }

    const agentToolsContextText = toolExecResult.toolSections.length > 0
      ? `\n[KẾT QUẢ THỰC THI CÔNG CỤ AGENT TRÊN DỮ LIỆU THẬT CỦA VƯỜN]:\n${toolExecResult.toolSections.join('\n\n')}\n`
      : '';

    // 3. TẬP HUẤN TOÀN BỘ KIẾN THỨC NÔNG NGHIỆP & CẨM NANG HỆ THỐNG
    const systemPrompt = `Bạn là "Bé Mầm AgTech" - AI Agent chuyên gia nông nghiệp thông minh (chuẩn ISO/IEC 42001) của hệ thống Sổ Nông Tân Bảo AgTech.
Xưng hô: Xưng là "Bé Mầm" hoặc "em", gọi người dùng là "${isAdmin ? 'Admin' : 'Bác ' + (currentUser.name || 'nông hộ')}".

📘 [BỘ KIẾN THỨC CẨM NANG HỆ THỐNG SỔ NÔNG TÂN BẢO]:
- Bước 1: Tạo Trang Trại Mới: Vào menu "Trang trại" -> Bấm "+ Khởi tạo Trang trại mới (GPS)" -> Nhập tên vườn, diện tích và lấy vị trí GPS vệ tinh.
- Bước 2: Thêm Cây & Định danh NFC (/sub): Bấm "+ Thêm cây" hoặc vào cổng /sub để gán thẻ NFC NTAG213.
- Bước 3: Ghi Nhật Ký Canh Tác: Chọn 1 trong 6 thao tác Chibi ISO (Tưới nước, Bón phân, Phun thuốc, Thuê nhân công, Bệnh cây, Thu hoạch).
- Bước 4: Quản Lý Vật Tư & Xuất Báo Cáo VietGAP: Tự động khấu trừ tồn kho, hạch toán chi phí và niêm phong chuỗi băm SHA-256.

🌿 [NGUYÊN TẮC AN TOÀN SINH HỌC & VIETGAP BẮT BUỘC]:
- Khi sử dụng Thuốc BVTV (hóa học) BẮT BUỘC phải cách 10 - 15 ngày sau mới được dùng Chế phẩm vi sinh (Trichoderma, Bacillus, men EM) để tránh diệt chết vi sinh vật có lợi.
${agentToolsContextText}
${trainedKnowledgeText}
${matchedQAResult ? `\n[CẶP Q&A ĐÃ HUẤN LUYỆN LIÊN QUAN]:\n${matchedQAResult.qa.expected_answer}\n` : ''}

⚠️ NGUYÊN TẮC TRẢ LỜI CỦA AGENT:
1. Trả lời đầy đủ, mạch lạc, bám sát 100% số liệu từ [KẾT QUẢ THỰC THI CÔNG CỤ AGENT] và [TÀI LIỆU TRI THỨC].
2. Trình bày bằng markdown rõ ràng (tiêu đề, gạch đầu dòng, in đậm con số và hoạt chất).

${systemContext}`;

    // 4. ĐIỀU HƯỚNG MÔ HÌNH CHUẨN & TỰ ĐỘNG CHUYỂN TIẾP (AUTO FAILOVER LOOP)
    const queryComplexity = classifyQueryComplexity(message);
    const modelCandidates = queryComplexity === 'complex'
      ? ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash-lite']
      : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

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
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: queryComplexity === 'complex' ? 0.25 : 0.15,
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
                  source: 'gemini_ai_agent',
                  agentMetadata: {
                    toolsTriggered: toolExecResult.triggeredTools,
                    matchedArticles: ragResult.topArticles.map(a => a.title),
                    suggestedActions: toolExecResult.suggestedActions
                  }
                });
              }
            } else {
              console.warn(`[AI Agent Router] Model ${modelName} trả về HTTP ${geminiRes.status} -> Chuyển model kế tiếp...`);
            }
          } catch (_) {
            // Timeout hoặc lỗi mạng -> Chuyển tiếp
          }
        }
      }
    }

    // 5. GROUNDED NEURO-SYMBOLIC AGENT SYNTHESIZER (Hoạt động 100% bất tử kể cả khi không có Gemini API Key)
    const synthesized = synthesizeGroundedAgentReply({
      rawQuery: message,
      isAdmin,
      userName: currentUser.name || 'Nông hộ',
      matchedQAResult,
      ragResult,
      toolExecResult
    });

    // 6. AUTO-LEARNING LOOP: Ghi nhận tự động các câu hỏi lạ (confidence < 0.35) vào ai_unanswered_queries
    if (synthesized.needsAutoLearning && pool && typeof pool.query === 'function') {
      pool.query(
        `INSERT INTO ai_unanswered_queries (user_id, user_query, bot_response, user_feedback, status)
         VALUES ($1, $2, $3, 'unanswered', 'pending')`,
        [currentUser.id || null, message.trim().slice(0, 500), synthesized.reply.slice(0, 1000)]
      ).catch(() => {});
    }

    return res.json({
      success: true,
      reply: synthesized.reply,
      model: 'be_mam_hybrid_agent_v2',
      source: matchedQAResult ? 'trained_qa' : 'grounded_agent_engine',
      agentMetadata: synthesized.agentMetadata
    });

  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm Agent:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

module.exports = router;
