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
const {
  encryptAgentPayload,
  redactPiiForLlm,
  scanAndSanitizeAgentOutput,
  verifyAgronomySafetyReply,
  AgentRateLimiter,
  AgentBulkhead,
  ModelCircuitBreaker,
  trimHistoryToBudget,
  buildSemanticCacheKey
} = require('../services/aiAgentSecurity');
const {
  AGENT_TOOL_DECLARATIONS,
  executeToolCallsParallel
} = require('../services/beMamAgentTools');

const agentRateLimiter = new AgentRateLimiter();
const agentBulkhead = new AgentBulkhead({ maxConcurrent: 25 });
const modelCircuitBreaker = new ModelCircuitBreaker({ failureThreshold: 3, cooldownMs: 60000 });

function classifyQueryComplexity(message) {
  const lower = String(message || '').toLowerCase().trim();

  const complexKeywords = [
    'nguyên nhân', 'tại sao', 'phác đồ', 'kết hợp', 'ra hoa nghịch vụ', 'trái vụ',
    'cháy múi', 'sượng cơm', 'vừa bị', 'triệu chứng', 'phèn mặn', 'hoạt chất',
    'nồng độ', 'kế hoạch', 'tối ưu', 'phân tích', 'xuất khẩu', 'globalgap', 'lập bảng',
    'tính toán', 'phối trộn', 'ủ phân', 'ức chế đọt', 'nứt thân xì mủ diện rộng', 'vàng lá'
  ];
  const hasComplexKeywords = complexKeywords.some(k => lower.includes(k));
  const isLongQuery = lower.split(/\s+/).length >= 18;

  if (hasComplexKeywords || isLongQuery) {
    return 'complex';
  }

  return 'standard';
}

function isFarmSpecificQuery(message, activeFarmId, activePlantId) {
  if (activeFarmId || activePlantId) return true;
  const lower = String(message || '').toLowerCase();
  return /(\bvườn\s*(của\s*)?(tôi|mình|nhà|a|b|c)\b|\bcây\s*#|\bcây\s*\d+\b|\btồn\s*kho\b|\bchi\s*phí\b|\bnhật\s*ký\b|\bhôm\s*nay\b|\bthời\s*tiết\b|\btrang\s*trại\b|\bbao\s*nhiêu\s*cây\b)/i.test(lower);
}

async function loadAllowedFarmScope(poolConn, currentUser, isAdmin) {
  const scopeCacheKey = `ai_scope_v3_${currentUser.id}_${isAdmin ? 'adm' : 'usr'}`;
  const cached = memoryCache.get(scopeCacheKey);
  if (cached) return cached;

  const execRead = typeof poolConn.readQuery === 'function'
    ? poolConn.readQuery.bind(poolConn)
    : poolConn.query.bind(poolConn);

  let farmsRows = [];
  try {
    if (isAdmin) {
      const res = await execRead(
        `SELECT f.id, f.name, f.area, f.latitude, f.longitude, f.total_plants
         FROM farms f
         WHERE COALESCE(f.is_deleted, false) = false
         ORDER BY f.id ASC
         LIMIT 100`
      );
      farmsRows = res.rows || [];
    } else {
      const res = await execRead(
        `SELECT f.id, f.name, f.area, f.latitude, f.longitude, f.total_plants
         FROM farms f
         WHERE COALESCE(f.is_deleted, false) = false
           AND (f.user_id = $1 OR f.created_by = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1))
         ORDER BY f.id ASC
         LIMIT 50`,
        [currentUser.id]
      );
      farmsRows = res.rows || [];
    }
  } catch (err) {
    console.warn('AI scope load warning:', err.message);
  }

  const scopeData = {
    farms: farmsRows,
    allowedFarmIds: farmsRows.map(f => Number(f.id)).filter(Number.isFinite)
  };
  memoryCache.set(scopeCacheKey, scopeData, 60);
  return scopeData;
}

function buildSystemInstruction({ isAdmin, currentUser, scopeData, activeFarmId, activePlantId, hideFinance, ragResult, matchedQAResult }) {
  const trainedKnowledgeText = ragResult && Array.isArray(ragResult.topArticles) && ragResult.topArticles.length > 0
    ? `\n[TÀI LIỆU TRI THỨC ĐỘC QUYỀN TÂN BẢO]:\n` +
      ragResult.topArticles.map((a, i) => `--- Tài liệu ${i + 1}: ${a.title} (${a.category} | BM25: ${a.matchScore}) ---\n${a.content}`).join('\n\n')
    : '';

  const farmPreview = (scopeData.farms || []).slice(0, 15).map(f =>
    `- ID ${f.id}: ${f.name} (${f.total_plants || 0} cây)`
  ).join('\n');

  const activeHint = [
    activeFarmId ? `active_farm_id=${activeFarmId}` : '',
    activePlantId ? `active_plant_id=${activePlantId}` : ''
  ].filter(Boolean).join(', ');

  return `Bạn là "Bé Mầm AgTech" - Chuyên gia AI Nông nghiệp Thông minh (chuẩn ISO/IEC 42001 & ISO/IEC 27001) của hệ thống Sổ Nông Tân Bảo AgTech.
Xưng hô: Xưng "Bé Mầm" hoặc "em", gọi người dùng là "${isAdmin ? 'Admin' : 'Bác ' + (currentUser.name || currentUser.full_name || 'nông hộ')}".

[GIAO THỨC VẤN ĐÁP CHẨN ĐOÁN 3 BƯỚC BẮT BUỘC]:
- Bước 1 (Đối chiếu thực địa trước khi phán): Luôn ưu tiên gọi các công cụ (tools) như get_farm_overview, get_plant_dossier, get_care_history, check_supply_inventory, get_farm_weather_forecast, calculate_agro_dosage, search_agronomy_kb để kiểm tra dữ liệu thật của vườn trước khi tư vấn.
- Bước 2 (Vấn đáp chẩn đoán khi thiếu triệu chứng): Nếu người dùng mô tả triệu chứng mơ hồ hoặc có nhiều nguyên nhân khả dĩ (ví dụ: vàng lá, thối rễ, rụng trái non), phải nêu ngay bước sơ cứu an toàn tức thời, rồi HỎI NGƯỢC 2-3 câu trắc nghiệm ngắn để khoanh vùng đúng nguyên nhân trước khi chốt đơn thuốc.
- Bước 3 (Phác đồ hành động chuẩn VietGAP): Khi đủ thông tin, trình bày rõ 3 phần: (1) Chẩn đoán & căn cứ dữ liệu vườn, (2) Phác đồ xử lý theo ngày (ưu tiên thuốc/phân sẵn có trong kho qua check_supply_inventory), (3) Cảnh báo An toàn sinh học & PHI.

[NGUYÊN TẮC BẮT BUỘC - ZERO HALLUCINATION & VIETGAP]:
1. Mọi con số (số cây, diện tích, tồn kho, ngày phun, liều lượng) CHỈ ĐƯỢC lấy từ kết quả công cụ trả về hoặc tài liệu được cung cấp. Nếu công cụ không có dữ liệu, phải nói rõ "Chưa có dữ liệu trong sổ vườn", tuyệt đối không tự bịa.
2. Khi dùng Thuốc BVTV hóa học, BẮT BUỘC nhắc cách ly ít nhất 10 - 15 ngày trước khi dùng chế phẩm vi sinh (Trichoderma, Bacillus, men EM).
3. Kiểm tra trạng thái phi_status của cây trước khi khuyến nghị thu hoạch.
4. ${hideFinance ? 'Tài khoản này bị hạn chế quyền tài chính: tuyệt đối không hiển thị đơn giá hoặc chi phí.' : 'Được phép phân tích định mức và chi phí vật tư.'}

[PHẠM VI VƯỜN ĐƯỢC PHÉP]:
${farmPreview || '- Chưa có dữ liệu trang trại trong phạm vi.'}
${activeHint ? `[NGỮ CẢNH ĐANG MỞ TRÊN MÀN HÌNH]: ${activeHint}` : ''}
${trainedKnowledgeText}
${matchedQAResult ? `\n[CẶP Q&A ĐÃ HUẤN LUỆN LIÊN QUAN]:\n${matchedQAResult.qa.expected_answer}\n` : ''}`;
}

async function runFallbackEngine({ message, isAdmin, currentUser, scopeData, activeFarmId, hideFinance, matchedQAResult, ragResult, extraFlags = [] }) {
  const execRead = typeof pool.readQuery === 'function'
    ? pool.readQuery.bind(pool)
    : pool.query.bind(pool);

  let userPlants = [];
  let userLogs = [];
  let userSuppliesInventory = [];

  try {
    const allowedIds = scopeData.allowedFarmIds || [];
    const targetFarmId = activeFarmId ? parseInt(activeFarmId, 10) : null;
    if (isAdmin || allowedIds.length > 0) {
      const [pRes, lRes, sRes] = await Promise.all([
        execRead(
          `SELECT p.id, p.tree_code, p.nfc_uid, p.plot_code, p.plant_type, p.plant_variety, p.health_status, p.farm_id, f.name as farm_name
           FROM plants p
           LEFT JOIN farms f ON p.farm_id = f.id
           WHERE p.deleted_at IS NULL AND COALESCE(p.is_deleted, false) = false
             AND ($1::int IS NULL OR p.farm_id = $1)
             AND ($2::int[] IS NULL OR p.farm_id = ANY($2::int[]))
           LIMIT 200`,
          [targetFarmId, isAdmin ? null : allowedIds]
        ).catch(() => ({ rows: [] })),
        execRead(
          `SELECT pl.log_date, pl.log_type, pl.note, pl.details, p.tree_code, p.plant_type, f.name as farm_name
           FROM plant_logs pl
           JOIN plants p ON pl.plant_id = p.id
           LEFT JOIN farms f ON p.farm_id = f.id
           WHERE (pl.is_deleted IS NOT TRUE) AND p.deleted_at IS NULL
             AND ($1::int IS NULL OR p.farm_id = $1)
             AND ($2::int[] IS NULL OR p.farm_id = ANY($2::int[]))
           ORDER BY pl.log_date DESC, pl.created_at DESC
           LIMIT 15`,
          [targetFarmId, isAdmin ? null : allowedIds]
        ).catch(() => ({ rows: [] })),
        execRead(
          `SELECT s.id, s.name, s.category, s.stock_quantity, s.unit, s.package_price, s.unit_price, f.name as farm_name
           FROM supplies s
           LEFT JOIN farms f ON s.farm_id = f.id
           WHERE ($1::int IS NULL OR s.farm_id = $1)
             AND ($2::int[] IS NULL OR s.farm_id = ANY($2::int[]))
           LIMIT 30`,
          [targetFarmId, isAdmin ? null : allowedIds]
        ).catch(() => ({ rows: [] }))
      ]);
      userPlants = pRes.rows || [];
      userLogs = lRes.rows || [];
      userSuppliesInventory = hideFinance
        ? (sRes.rows || []).map(s => ({ ...s, package_price: 0, unit_price: 0, finance_redacted: true }))
        : (sRes.rows || []);
    }
  } catch (_) {}

  const normalizedFarms = (scopeData.farms || []).map(f => ({
    id: f.id,
    name: f.name,
    area: f.area,
    total: f.total_plants || 0,
    crops: 'Đang cập nhật'
  }));

  const toolExecResult = executeAgentTools(message, {
    isAdmin,
    currentUser,
    userFarms: normalizedFarms,
    userPlants,
    userLogs,
    userSuppliesCost: 0,
    userRecentSupplies: [],
    userSuppliesInventory,
    userIotSensors: []
  });

  const synthesized = synthesizeGroundedAgentReply({
    rawQuery: message,
    isAdmin,
    userName: currentUser.name || currentUser.full_name || 'Nông hộ',
    matchedQAResult,
    ragResult,
    toolExecResult
  });

  const dlpOut = scanAndSanitizeAgentOutput(synthesized.reply);
  const safeOut = verifyAgronomySafetyReply(dlpOut.reply, message, userPlants);

  if (synthesized.needsAutoLearning && pool && typeof pool.query === 'function') {
    const redactedForDb = redactPiiForLlm(message.trim().slice(0, 500)).sanitizedText;
    const encryptedEnvelope = encryptAgentPayload({
      query: redactedForDb,
      userId: currentUser.id || null,
      ts: new Date().toISOString()
    });
    pool.query(
      `INSERT INTO ai_unanswered_queries (user_id, user_query, bot_response, user_feedback, status)
       VALUES ($1, $2, $3, 'unanswered', 'pending')`,
      [currentUser.id || null, redactedForDb, safeOut.reply.slice(0, 1000)]
    ).catch(() => {});
    synthesized.agentMetadata.encryptedAuditRef = encryptedEnvelope.slice(0, 32);
  }

  return {
    reply: safeOut.reply,
    source: matchedQAResult ? 'trained_qa' : 'grounded_agent_engine',
    agentMetadata: {
      ...synthesized.agentMetadata,
      leakedPatterns: dlpOut.leakedPatterns,
      safetyFlags: [...safeOut.safetyFlags, ...extraFlags]
    }
  };
}

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [], active_farm_id = null, active_plant_id = null } = req.body || {};
    const currentUser = req.user || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }
    const cleanMessage = String(message).trim();
    if (cleanMessage.length > 2000) {
      return res.status(400).json({ error: 'Tin nhắn quá dài (tối đa 2000 ký tự).' });
    }

    const isAdmin = currentUser.role === 'admin';
    const rateTier = isAdmin ? 'admin' : (currentUser.account_tier === 'pro' ? 'pro' : 'normal');
    const rateStatus = agentRateLimiter.check(currentUser.id || req.ip, rateTier);
    if (!rateStatus.allowed) {
      res.setHeader('Retry-After', String(rateStatus.retryAfterSec));
      return res.status(429).json({
        error: `Bạn đã vượt giới hạn hỏi AI (${rateStatus.limitType}). Vui lòng thử lại sau ${rateStatus.retryAfterSec} giây.`,
        code: rateStatus.limitType,
        retryAfterSec: rateStatus.retryAfterSec
      });
    }

    const guardCheck = checkPromptInjection(cleanMessage);
    if (!guardCheck.safe) {
      return res.json({
        success: true,
        reply: guardCheck.safeReply,
        model: 'owasp_llm01_guardrail',
        source: 'security_guardrail',
        agentMetadata: { blockedReason: guardCheck.reason }
      });
    }

    const hideFinance = !isAdmin && (currentUser.allow_view_finance === false || ['care_worker', 'auditor_readonly'].includes(currentUser.sub_role));
    const scopeData = await loadAllowedFarmScope(pool, currentUser, isAdmin);

    let kbBundle = { qaRows: [], articleRows: [] };
    let matchedQAResult = null;
    let ragResult = { topArticles: [], matchedSynonyms: [], maxScore: 0 };

    try {
      kbBundle = await loadKnowledgeBaseCached(pool);
      matchedQAResult = matchTrainingQA(cleanMessage, kbBundle.qaRows);
      ragResult = rankKnowledgeArticles(cleanMessage, kbBundle.articleRows);
    } catch (ragErr) {
      console.warn('Lỗi tra cứu RAG KB:', ragErr.message);
    }

    const personalOrScoped = isFarmSpecificQuery(cleanMessage, active_farm_id, active_plant_id);
    const cacheKeyL0 = !personalOrScoped
      ? buildSemanticCacheKey(cleanMessage, isAdmin ? 'adm' : (hideFinance ? 'red' : 'usr'))
      : null;

    if (cacheKeyL0) {
      const cachedL0 = memoryCache.get(cacheKeyL0);
      if (cachedL0 && cachedL0.reply) {
        return res.json({
          success: true,
          reply: cachedL0.reply,
          model: cachedL0.model,
          source: 'semantic_l0_cache',
          agentMetadata: {
            ...(cachedL0.agentMetadata || {}),
            cacheHit: true
          }
        });
      }
    }

    if (matchedQAResult && matchedQAResult.score >= 0.85 && !personalOrScoped) {
      const qaSafe = verifyAgronomySafetyReply(matchedQAResult.qa.expected_answer, cleanMessage, []);
      return res.json({
        success: true,
        reply: qaSafe.reply,
        source: 'trained_qa',
        model: 'trained-qa-instant',
        modelUsed: 'trained-qa-instant',
        agentMetadata: {
          confidenceScore: matchedQAResult.score,
          matchedQAId: matchedQAResult.qa.id,
          toolsTriggered: [],
          safetyFlags: qaSafe.safetyFlags,
          cacheHit: false
        }
      });
    }

    const redactionResult = redactPiiForLlm(cleanMessage);
    const redactedUserMsg = redactionResult.sanitizedText;
    const trimmedHistory = trimHistoryToBudget(history, 10, 4000);
    const systemInstructionText = buildSystemInstruction({
      isAdmin,
      currentUser,
      scopeData,
      activeFarmId: active_farm_id,
      activePlantId: active_plant_id,
      hideFinance,
      ragResult,
      matchedQAResult
    });

    const queryComplexity = classifyQueryComplexity(cleanMessage);
    const modelCandidates = queryComplexity === 'complex'
      ? ['gemini-2.5-pro', 'gemini-2.5-flash']
      : ['gemini-2.5-flash', 'gemini-2.5-pro'];

    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const apiKeys = rawKeys.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
      if (!agentBulkhead.acquire()) {
        const degraded = await runFallbackEngine({
          message: cleanMessage,
          isAdmin,
          currentUser,
          scopeData,
          activeFarmId: active_farm_id,
          hideFinance,
          matchedQAResult,
          ragResult,
          extraFlags: ['BULKHEAD_DEGRADED']
        });
        return res.json({
          success: true,
          reply: degraded.reply,
          model: 'be_mam_hybrid_agent_v2',
          source: degraded.source,
          agentMetadata: {
            ...degraded.agentMetadata,
            bulkheadDegraded: true,
            redactionCount: redactionResult.redactionCount
          }
        });
      }

      try {
        const baseContents = trimmedHistory.map(h => ({
          role: h.role,
          parts: [{ text: redactPiiForLlm(h.text).sanitizedText }]
        }));
        baseContents.push({
          role: 'user',
          parts: [{ text: redactedUserMsg }]
        });

        const toolCtx = {
          pool,
          isAdmin,
          currentUser,
          allowedFarmIds: scopeData.allowedFarmIds,
          activeFarmId: active_farm_id,
          hideFinance,
          kbBundle
        };

        const MAX_REACT_ROUNDS = 3;

        for (const apiKey of apiKeys) {
          for (const modelName of modelCandidates) {
            if (!modelCircuitBreaker.canAttempt(modelName)) {
              continue;
            }

            const loopContents = baseContents.map(turn => ({ role: turn.role, parts: [...turn.parts] }));
            const triggeredTools = [];
            const collectedToolContexts = [];
            let reactRounds = 0;

            for (let round = 0; round < MAX_REACT_ROUNDS; round++) {
              reactRounds += 1;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 20000);
              let geminiRes = null;
              try {
                geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstructionText }] },
                    contents: loopContents,
                    tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
                    generationConfig: {
                      temperature: queryComplexity === 'complex' ? 0.25 : 0.15,
                      maxOutputTokens: 2500
                    }
                  })
                });
              } catch (_) {
                modelCircuitBreaker.recordFailure(modelName);
                break;
              } finally {
                clearTimeout(timeoutId);
              }

              if (!geminiRes || !geminiRes.ok) {
                if (!geminiRes || geminiRes.status === 429 || geminiRes.status >= 500) {
                  modelCircuitBreaker.recordFailure(modelName);
                }
                break;
              }

              const data = await geminiRes.json();
              const parts = data.candidates?.[0]?.content?.parts || [];
              const functionCallParts = parts.filter(p => p && p.functionCall);

              if (functionCallParts.length > 0 && round < MAX_REACT_ROUNDS - 1) {
                const calls = functionCallParts.map(p => ({
                  name: p.functionCall.name,
                  args: p.functionCall.args || {}
                }));
                const execResults = await executeToolCallsParallel(calls, toolCtx);
                execResults.forEach(r => {
                  if (!triggeredTools.includes(r.name)) triggeredTools.push(r.name);
                  collectedToolContexts.push(r.response);
                });

                loopContents.push({ role: 'model', parts });
                loopContents.push({
                  role: 'user',
                  parts: execResults.map(r => ({
                    functionResponse: {
                      name: r.name,
                      response: { result: r.response }
                    }
                  }))
                });
                continue;
              }

              const rawReply = parts
                .filter(p => p && typeof p.text === 'string')
                .map(p => p.text)
                .join('\n')
                .trim();

              if (rawReply) {
                modelCircuitBreaker.recordSuccess(modelName);
                const dlpOut = scanAndSanitizeAgentOutput(rawReply);
                const safeOut = verifyAgronomySafetyReply(dlpOut.reply, redactedUserMsg, collectedToolContexts);

                const responsePayload = {
                  success: true,
                  reply: safeOut.reply,
                  model: `${modelName} (${queryComplexity})`,
                  source: 'gemini_ai_agent',
                  agentMetadata: {
                    toolsTriggered: triggeredTools,
                    matchedArticles: (ragResult.topArticles || []).map(a => a.title),
                    redactionCount: redactionResult.redactionCount,
                    leakedPatterns: dlpOut.leakedPatterns,
                    safetyFlags: safeOut.safetyFlags,
                    reactRounds,
                    cacheHit: false
                  }
                };

                const isOnlyGlobalTools = triggeredTools.every(t => t === 'search_agronomy_kb');
                if (cacheKeyL0 && isOnlyGlobalTools) {
                  memoryCache.set(cacheKeyL0, {
                    reply: responsePayload.reply,
                    model: responsePayload.model,
                    agentMetadata: responsePayload.agentMetadata
                  }, 300);
                }

                return res.json(responsePayload);
              }
              break;
            }
          }
        }
      } finally {
        agentBulkhead.release();
      }
    }

    const fallbackResult = await runFallbackEngine({
      message: cleanMessage,
      isAdmin,
      currentUser,
      scopeData,
      activeFarmId: active_farm_id,
      hideFinance,
      matchedQAResult,
      ragResult
    });

    if (cacheKeyL0) {
      memoryCache.set(cacheKeyL0, {
        reply: fallbackResult.reply,
        model: 'be_mam_hybrid_agent_v2',
        agentMetadata: fallbackResult.agentMetadata
      }, 300);
    }

    return res.json({
      success: true,
      reply: fallbackResult.reply,
      model: 'be_mam_hybrid_agent_v2',
      source: fallbackResult.source,
      agentMetadata: {
        ...fallbackResult.agentMetadata,
        redactionCount: redactionResult.redactionCount,
        cacheHit: false
      }
    });
  } catch (err) {
    console.error('Lỗi API Chat Bé Mầm Agent:', err);
    res.status(500).json({ error: 'Lỗi máy chủ AI: ' + err.message });
  }
});

router._agentInternals = {
  agentRateLimiter,
  agentBulkhead,
  modelCircuitBreaker
};

module.exports = router;
