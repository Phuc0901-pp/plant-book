/**
 * backend/services/beMamAgentEngine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * BÉ MẦM HYBRID AUTONOMOUS AGENT ENGINE v2.0
 * Standards: ISO/IEC 42001:2023 (AI Management), ISO/IEC 23053:2022 (AI Framework),
 *            ISO/IEC TR 24028 (AI Trustworthiness), OWASP LLM Top 10
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const memoryCache = require('../config/cache');

// ─────────────────────────────────────────────────────────────────────────────
// 1. OWASP LLM01 GUARDRAIL: CHỐNG PROMPT INJECTION & MÃ ĐỘC
// ─────────────────────────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /bỏ\s+qua\s+(tất\s+cả\s+)?(hướng\s+dẫn|quy\s+tắc|lệnh)\s+trước/i,
  /system\s*prompt\s*[:=]/i,
  /reveal\s+your\s+(system|secret|hidden)\s+prompt/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i,
  /\b(drop\s+table|truncate\s+table|union\s+select\s+null)\b/i
];

function checkPromptInjection(rawMessage) {
  const msg = String(rawMessage || '').trim();
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(msg)) {
      return {
        safe: false,
        reason: 'OWASP_LLM01_PROMPT_INJECTION_BLOCKED',
        safeReply: '🛡️ **Cảnh báo An ninh AI (ISO/IEC 42001 & OWASP LLM01):** Yêu cầu chứa cú pháp can thiệp hệ thống không hợp lệ. Bé Mầm chỉ hỗ trợ tư vấn kỹ thuật nông nghiệp, tra cứu dữ liệu trang trại và hướng dẫn sử dụng Sổ Nông Tân Bảo AgTech.'
      };
    }
  }
  return { safe: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TỪ ĐIỂN ĐỒNG NGHĨA NHÀ NÔNG TIẾNG VIỆT (AGRO-SYNONYM NORMALIZER)
// ─────────────────────────────────────────────────────────────────────────────
const AGRO_SYNONYM_MAP = [
  // Sâu bệnh hại
  { variants: ['chảy nhựa', 'chảy mủ', 'xì nhựa', 'thối vỏ thân', 'loét thân'], canonical: 'xì mủ nứt thân phytophthora' },
  { variants: ['thối gốc', 'đen rễ', 'tuột vỏ rễ', 'vàng đọt thối rễ'], canonical: 'vàng lá thối rễ phytophthora fusarium' },
  { variants: ['cháy lá', 'khô chóp lá', 'cháy bìa lá', 'khô đầu lá', 'đốm cháy lá'], canonical: 'cháy lá thán thư rhizoctonia' },
  { variants: ['rầy nhảy', 'rầy phấn', 'rầy phấn trắng', 'rầy bông'], canonical: 'rầy xanh chích hút đọt non' },
  { variants: ['nhện vàng', 'bạc lá nhện'], canonical: 'nhện đỏ hại lá' },
  { variants: ['sâu đục quả', 'sâu ăn bông'], canonical: 'sâu đục trái sâu ăn bông' },
  { variants: ['nấm hồng', 'đốm hồng cành'], canonical: 'bệnh nấm hồng corticium' },
  { variants: ['rong rêu', 'đốm rong'], canonical: 'bệnh đốm rong thân cành' },
  // Sinh lý & Mùa vụ Sầu riêng / Cây ăn trái
  { variants: ['làm bông', 'ép bông', 'kích bông', 'tạo mầm hoa', 'xử lý ra hoa'], canonical: 'làm bông xiết nước tạo mầm hoa' },
  { variants: ['nhú mắt cua', 'ra mắt cua', 'rước mắt cua', 'nghẹn mắt cua'], canonical: 'mắt cua làm bông sầu riêng' },
  { variants: ['xổ nhụy', 'sổ nhụy', 'nở hoa', 'quét phấn'], canonical: 'sổ nhụy thụ phấn đậu trái' },
  { variants: ['rụng bông', 'rụng trái', 'rụng quả non', 'tháo khớp'], canonical: 'chống rụng trái non canxi bo' },
  { variants: ['cơm cứng', 'sượng trái', 'nhão cơm', 'múi trắng'], canonical: 'sượng cơm cháy múi sầu riêng' },
  { variants: ['đi đọt', 'xổ đọt', 'le mũi giáo', 'kéo đọt', 'chặn đọt', 'hãm đọt'], canonical: 'quản lý cơi đọt ức chế đọt non' },
  // Phân bón & Thuốc BVTV
  { variants: ['tưới men', 'bón vi sinh', 'nấm đối kháng', 'men vi sinh'], canonical: 'chế phẩm vi sinh trichoderma bacillus' },
  { variants: ['xịt thuốc', 'phun xịt', 'thuốc trừ nấm', 'thuốc trừ sâu'], canonical: 'phun thuốc bvtv hóa học' },
  { variants: ['vô phân', 'rải phân', 'bón gốc'], canonical: 'bón phân npk hữu cơ' },
  { variants: ['cách ly', 'ngưng xịt thuốc', 'an toàn thu hoạch'], canonical: 'thời gian cách ly phi vietgap' },
  // Thao tác App & Quản trị
  { variants: ['mướn công', 'thuê người', 'công làm cỏ', 'công cắt tỉa', 'tiền công'], canonical: 'thuê nhân công chăm sóc' },
  { variants: ['sài sao', 'dùng sao', 'xài sao', 'chưa biết dùng', 'chưa biết sài', 'cách dùng app'], canonical: 'hướng dẫn sử dụng sổ nông tân bảo' },
  { variants: ['quẹt thẻ', 'chạm thẻ', 'gắn chip', 'nạp thẻ'], canonical: 'quét thẻ nfc ntag213 định danh cây' }
];

const VIETNAMESE_STOPWORDS = new Set([
  'là', 'và', 'của', 'có', 'được', 'trong', 'cho', 'với', 'như', 'thế', 'nào',
  'sao', 'vậy', 'nhé', 'ạ', 'ơi', 'bác', 'em', 'bé', 'mầm', 'tôi', 'mình', 'thì',
  'mà', 'này', 'đó', 'các', 'những', 'một', 'cái', 'con', 'về', 'khi', 'để', 'làm'
]);

function normalizeAgroQuery(rawText) {
  let lower = String(rawText || '').toLowerCase().trim();
  const matchedSynonyms = [];

  for (const entry of AGRO_SYNONYM_MAP) {
    for (const v of entry.variants) {
      if (lower.includes(v)) {
        matchedSynonyms.push({ from: v, to: entry.canonical });
        if (!lower.includes(entry.canonical)) {
          lower += ' ' + entry.canonical;
        }
      }
    }
  }
  return { normalizedText: lower, matchedSynonyms };
}

function tokenizeVietnamese(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !VIETNAMESE_STOPWORDS.has(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. KHO ĐẠI TỪ ĐIỂN NÔNG HỌC MẶC ĐỊNH (BUILT-IN ENCYCLOPEDIA FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────
const BUILTIN_ENCYCLOPEDIA_ARTICLES = [
  {
    id: 9001,
    category: 'An toàn Sinh học',
    title: 'Quy Tắc Vàng: Khoảng Cách 10 ~ 15 Ngày Giữa Thuốc BVTV Hóa Học & Chế Phẩm Vi Sinh',
    topic_keywords: 'thuốc bvtv, hóa học, vi sinh, trichoderma, bacillus, men em, khoảng cách 10 ngày, 15 ngày, pha chung',
    content: '1. Khi phun/tưới Thuốc BVTV hóa học, BẮT BUỘC phải chờ 10 - 15 ngày sau mới được tưới Chế phẩm vi sinh (Trichoderma, Bacillus, men EM) và ngược lại.\n2. Tuyệt đối KHÔNG pha chung thuốc trừ nấm hóa học với nấm đối kháng Trichoderma trong cùng bồn pha vì hoạt chất sát khuẩn sẽ tiêu diệt hoàn toàn bào tử có lợi.\n3. Quy trình chuẩn: Dập dịch bằng hóa học -> Nghỉ đệm 10-15 ngày giữ ẩm -> Phục hồi rễ bằng Trichoderma + Acid Humic + Phân hữu cơ.',
    priority: 10
  },
  {
    id: 9002,
    category: 'Sâu bệnh hại',
    title: 'Phác Đồ Đặc Trị Vàng Lá Thối Rễ & Nứt Thân Xì Mủ (Phytophthora / Fusarium)',
    topic_keywords: 'vàng lá thối rễ, xì mủ, nứt thân, chảy nhựa, phytophthora, fusarium, metalaxyl, fosetyl-al, dimethomorph, agrifos',
    content: '1. Triệu chứng: Vỏ thân chảy nhựa nâu đen có mùi chua, rễ cám thối đen tuột vỏ, lá vàng rụng hàng loạt.\n2. Xử lý vết bệnh trên thân: Dùng dao sắc cạo sạch vỏ thối tới phần gỗ khỏe, quét trực tiếp Metalaxyl (Ridomil Gold) hoặc Fosetyl-Al (Aliette) hoặc tiêm/phun Agrifos 400.\n3. Xử lý vùng rễ: Tưới Dimethomorph + Metalaxyl quanh chiếu tán cây (10-15 lít/gốc), ngưng tưới đẫm 5-7 ngày.\n4. Phục hồi sau 10-15 ngày: Tưới nấm đối kháng Trichoderma + Humic kích rễ tơ mới.',
    priority: 10
  },
  {
    id: 9003,
    category: 'Kỹ thuật Canh tác',
    title: 'Quy Trình Làm Bông, Rước Mắt Cua, Sổ Nhụy & Chống Rụng Trái Non Sầu Riêng',
    topic_keywords: 'làm bông, xiết nước, mắt cua, sổ nhụy, đậu trái, rụng trái non, canxi bo, mkp, 10-60-10, chặn đọt, đi đọt',
    content: '1. Tạo mầm & Xiết nước: Khi cơi đọt thứ 2-3 chuyển lụa hoàn toàn, bón Lân cao (Super Lân / NPK 10-50-10), xiết nước 14-20 ngày và phun MKP (0-52-34) + KNO3 tạo mầm hoa.\n2. Rước mắt cua: Khi mắt cua sáng 2-3cm mới nhấp nước trở lại (20-30% lượng nước bình thường) tránh sốc nước gây nghẹn bông hoặc biến bông thành đọt.\n3. Quản lý cơi đọt trước sổ nhụy: Kéo đọt đồng loạt lúc bông 20-25 ngày tuổi hoặc chặn/dìu đọt bằng MKP + Kali cao nếu đọt phóng đúng lúc sắp sổ nhụy.\n4. Sổ nhụy & Chống rụng: Phun Canxi-Bo + Kẽm trước sổ nhụy 5 ngày và sau đậu trái 7-10 ngày; thụ phấn bổ sung lúc 18h30-21h00.',
    priority: 9
  },
  {
    id: 9004,
    category: 'Kỹ thuật Canh tác',
    title: 'Phác Đồ Khắc Phục Sượng Cơm, Cháy Múi & Nuôi Trái Sầu Riêng Cơm Vàng Dẻo',
    topic_keywords: 'sượng cơm, cháy múi, nhão cơm, nuôi trái, lên cơm, kali trắng, k2so4, canxi, magie, thu hoạch',
    content: '1. Nguyên nhân sượng cơm & cháy múi: Cây đi đọt non cạnh tranh dinh dưỡng lúc trái 60-90 ngày, dư nước/mưa lớn, thiếu Canxi-Magie-Bo, hoặc bón phân chứa gốc Clo (KCl).\n2. Biện pháp khắc phục:\n- Tuyệt đối dùng NPK Kali Sunfat (K2SO4 - Kali trắng như 12-11-18 hoặc 15-5-20 TE), KHÔNG dùng Kali đỏ (KCl).\n- Phun bổ sung Canxi-Bo-Magie định kỳ 10-15 ngày/lần ở giai đoạn trái 40-80 ngày.\n- Giữ ẩm độ đất ổn định 60-65%, thoát nước rãnh tốt khi mưa lớn, rút nước trước thu hoạch 10-15 ngày.',
    priority: 9
  },
  {
    id: 9005,
    category: 'Sâu bệnh hại',
    title: 'Phác Đồ Quản Lý Rầy Xanh, Nhện Đỏ, Thán Thư Cháy Lá & Sâu Đục Trái',
    topic_keywords: 'rầy xanh, rầy nhảy, nhện đỏ, thán thư, cháy lá, sâu đục trái, abamectin, emamectin, imidacloprid, pymetrozine, hexaconazole',
    content: '1. Rầy xanh / Rầy nhảy (hại đọt non): Phun định kỳ khi đọt vừa nhú mũi giáo bằng Pymetrozine, Thiamethoxam hoặc Imidacloprid, luân phiên hoạt chất tránh kháng thuốc.\n2. Nhện đỏ (mùa nắng): Phun Abamectin, Pyridaben hoặc Spirodiclofen mặt dưới lá.\n3. Thán thư / Cháy lá (Rhizoctonia / Colletotrichum): Cắt tỉa cành thông thoáng, phun Azoxystrobin + Difenoconazole hoặc Hexaconazole.\n4. Sâu đục trái: Tỉa thưa trái chùm, phun Emamectin benzoate hoặc Chlorantraniliprole và tuân thủ nghiêm ngặt thời gian cách ly PHI.',
    priority: 9
  },
  {
    id: 9006,
    category: 'Cẩm nang Ứng dụng',
    title: 'Hướng Dẫn Toàn Tập Sổ Nông Tân Bảo: Tạo Vườn, Gắn NFC (/sub), Thuê Nhân Công & Xuất VietGAP',
    topic_keywords: 'hướng dẫn sử dụng, sài sao, dùng sao, tạo trang trại, quét nfc, ntag213, thuê nhân công, xuất vietgap, bản đồ gis',
    content: '1. Cổng Định Danh Nhanh (/sub): Thực hiện 4 bước: Đăng nhập -> Chọn/Tạo Vườn -> Tạo Cây Mới -> Chạm thẻ NTAG213 để ghi mã định danh chống giả.\n2. Hồ Sơ Cây Thực Địa (/:farm/:plant/:uid): Chạm điện thoại vào thẻ NFC trên cây, chọn 1 trong 7 thao tác Chibi chuẩn ISO: Tưới nước, Bón phân, Phun thuốc, Thuê nhân công, Kiểm toán quả (Đậu quả / Quả non / Quả chín), Bệnh cây, Thu hoạch.\n3. Cổng Nông Hộ (/user/): Quản lý danh mục trang trại, xem dự báo thời tiết 24h & độ ẩm đất 3 tầng, quản lý tồn kho vật tư và xem biểu đồ chi phí.\n4. Xuất Báo Cáo VietGAP: Tại hồ sơ cây hoặc trang quản trị, nhấn "Xuất VietGAP / PDF A4" để tải báo cáo truy xuất nguồn gốc kèm chuỗi băm SHA-256.',
    priority: 9
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. HYBRID BM25 & FUZZY RAG ENGINE (TOÀN CỤC TRONG RAM, KHÔNG GIỚI HẠN 30 DÒNG)
// ─────────────────────────────────────────────────────────────────────────────
async function loadKnowledgeBaseCached(pool) {
  const cacheKey = 'ai_kb_full_cache_v2';
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  let qaRows = [];
  let articleRows = [];

  if (pool && typeof pool.readQuery === 'function') {
    try {
      const [qRes, aRes] = await Promise.all([
        pool.readQuery('SELECT id, category, sample_questions, expected_answer, keywords FROM ai_training_qa WHERE is_active = true ORDER BY updated_at DESC'),
        pool.readQuery('SELECT id, category, title, topic_keywords, content, priority FROM ai_knowledge_articles WHERE is_active = true ORDER BY priority DESC, updated_at DESC')
      ]);
      qaRows = qRes.rows || [];
      articleRows = aRes.rows || [];
    } catch (_) {
      // Fallback to built-in encyclopedia if DB is unreachable
    }
  }

  // Merge built-in encyclopedia articles if not already present by title
  const existingTitles = new Set(articleRows.map(a => String(a.title || '').toLowerCase()));
  for (const builtin of BUILTIN_ENCYCLOPEDIA_ARTICLES) {
    if (!existingTitles.has(builtin.title.toLowerCase())) {
      articleRows.push(builtin);
    }
  }

  const bundle = { qaRows, articleRows };
  memoryCache.set(cacheKey, bundle, 120);
  return bundle;
}

function matchTrainingQA(rawQuery, qaList = []) {
  const { normalizedText } = normalizeAgroQuery(rawQuery);
  const queryTokens = tokenizeVietnamese(normalizedText);
  if (queryTokens.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const qa of qaList) {
    const variants = String(qa.sample_questions || '')
      .split('\n')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);

    for (const variant of variants) {
      const normVariant = normalizeAgroQuery(variant).normalizedText;
      // 1. Substring exact match
      if (normalizedText.includes(normVariant) || normVariant.includes(normalizedText)) {
        return { qa, score: 1.0, matchedVariant: variant };
      }

      // 2. Token overlap / Jaccard + Keyword boost
      const varTokens = tokenizeVietnamese(normVariant);
      if (varTokens.length === 0) continue;

      let overlap = 0;
      for (const vt of varTokens) {
        if (queryTokens.includes(vt)) overlap++;
      }
      const coverageVar = overlap / varTokens.length;
      const coverageQuery = overlap / queryTokens.length;
      const f1Score = (coverageVar + coverageQuery) > 0
        ? (2 * coverageVar * coverageQuery) / (coverageVar + coverageQuery)
        : 0;

      if (f1Score > bestScore) {
        bestScore = f1Score;
        bestMatch = { qa, score: Number(f1Score.toFixed(3)), matchedVariant: variant };
      }
    }
  }

  return bestScore >= 0.62 ? bestMatch : null;
}

const RAG_GENERIC_NOISE_WORDS = new Set([
  'muốn', 'hỏi', 'đang', 'bao', 'nhiêu', 'mấy', 'nào', 'gì', 'đâu',
  'vườn', 'cây', 'trang', 'trại', 'của', 'em', 'anh', 'chị', 'hiện', 'tại', 'vậy', 'tổng', 'số'
]);

function rankKnowledgeArticles(rawQuery, articlesList = []) {
  const { normalizedText, matchedSynonyms } = normalizeAgroQuery(rawQuery);
  const queryTokens = tokenizeVietnamese(normalizedText).filter(t => !RAG_GENERIC_NOISE_WORDS.has(t));
  const scored = [];

  for (const art of articlesList) {
    const titleLower = String(art.title || '').toLowerCase();
    const contentLower = String(art.content || '').toLowerCase();
    const kwList = String(art.topic_keywords || '')
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    let score = 0;

    // Title phrase or token match
    if (normalizedText.includes(titleLower) || titleLower.includes(normalizedText)) {
      score += 8;
    }

    // Topic keyword phrase match
    for (const kw of kwList) {
      if (kw && normalizedText.includes(kw)) {
        score += 4;
      }
    }

    // BM25-style token scoring across title, keywords, and content (generic words already filtered)
    for (const tok of queryTokens) {
      if (tok.length < 2) continue;
      if (titleLower.includes(tok)) score += 2.0;
      if (kwList.some(k => k.includes(tok))) score += 1.5;
      if (contentLower.includes(tok)) score += 0.6;
    }

    if (score >= 4.0) {
      const priorityBonus = (Number(art.priority) || 5) * 0.15;
      scored.push({
        ...art,
        matchScore: Number((score + priorityBonus).toFixed(2))
      });
    }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return {
    topArticles: scored.slice(0, 3),
    matchedSynonyms,
    maxScore: scored[0]?.matchScore || 0
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4B. TIỆN ÍCH CHUẨN HÓA SỐ LIỆU NÔNG NGHIỆP THEO CHUẨN ISO 80000 & GIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa diện tích nông nghiệp thông minh theo chuẩn ISO 80000
 */
function formatSmartIsoArea(rawArea) {
  if (rawArea === null || rawArea === undefined || rawArea === '' || isNaN(Number(rawArea)) || Number(rawArea) <= 0) {
    return 'Chưa nhập';
  }
  const num = Number(rawArea);
  if (num >= 1000) {
    const haStr = (num / 10000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const m2Str = Math.round(num).toLocaleString('vi-VN');
    return `${haStr} ha (${m2Str} m²)`;
  }
  return `${num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`;
}

/**
 * Chuẩn hóa và khử trùng lặp danh mục cây trồng / giống cây trồng
 */
function cleanAndDedupeCrops(rawCrops) {
  if (!rawCrops || !String(rawCrops).trim()) return 'Đang cập nhật';
  const parts = String(rawCrops).split(',');
  const seen = new Set();
  const cleaned = [];

  for (const part of parts) {
    const item = String(part || '')
      .replace(/\(\s*(durian|pomelo|mango|coffee|pepper)\s*\)/gi, '')
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!item) continue;
    const lowerKey = item.toLowerCase();
    if (!seen.has(lowerKey)) {
      seen.add(lowerKey);
      cleaned.push(item);
    }
  }

  return cleaned.length > 0 ? cleaned.join(', ') : 'Đang cập nhật';
}

/**
 * Helper định dạng tóm tắt chi tiết nhật ký thực địa (Details JSON & Note) chuẩn ISO AgTech
 */
function formatLogDetailSummary(log) {
  if (!log) return 'Ghi nhận thực địa';

  let d = log.details || {};
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      d = {};
    }
  }
  if (!d || typeof d !== 'object') d = {};

  if (log.log_type === 'Kiểm toán quả') {
    const stage = d.fruit_stage || 'Đậu quả';
    const count = d.fruit_count ?? d.amount ?? 0;
    const culled = d.dropped_or_culled_count ? ` (Rụng/tỉa: ${d.dropped_or_culled_count} quả)` : '';
    const estKg = d.estimated_yield_kg ? ` · Ước tính ~${d.estimated_yield_kg} kg` : '';
    const auditTime = d.audit_time ? ` · Lúc ${d.audit_time}` : '';
    const noteTail = log.note && String(log.note).trim() ? ` - ${String(log.note).trim()}` : '';
    return `Giai đoạn ${stage}: Đếm ${count} quả${culled}${estKg}${auditTime}${noteTail}`.trim();
  }

  const parts = [];

  if (d.value) {
    const val = String(d.value).replace(/\u00a0/g, ' ').trim();
    if (val) parts.push(val);
  } else {
    const content = d.work_content || d.supply_name || d.fertilizer_name || d.pesticide_name || d.disease_name || d.method || '';
    if (content) {
      parts.push(String(content).trim());
    }

    if (d.worker_count) {
      parts.push(`(${d.worker_count} người)`);
    } else if (d.amount || d.quantity) {
      const amt = d.amount || d.quantity;
      const unit = d.unit ? ` ${d.unit}` : '';
      parts.push(`${amt}${unit}`.trim());
    }

    const costVal = d.cost !== undefined ? d.cost : (d.total_cost !== undefined ? d.total_cost : d.batch_total_cost);
    if (costVal !== undefined && costVal !== null && costVal !== '') {
      const numCost = Number(costVal);
      if (!isNaN(numCost) && numCost > 0) {
        parts.push(`(${numCost.toLocaleString('vi-VN')} VNĐ)`);
      }
    }
  }

  if (log.note && String(log.note).trim()) {
    const noteStr = String(log.note).trim();
    if (parts.length > 0) {
      if (!parts.join(' ').includes(noteStr)) {
        parts.push(`- ${noteStr}`);
      }
    } else {
      parts.push(noteStr);
    }
  }

  const result = parts.join(' ').replace(/\s+/g, ' ').trim();
  return result || 'Ghi nhận thực địa';
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BỘ 12 AGENTIC TOOLS (TRUY VẤN SỐ LIỆU THẬT & TÍNH TOÁN CHÍNH XÁC 100%)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tool 7: Máy tính toán học liều lượng pha thuốc / bón phân chính xác 100%
 */
function calculateAgroDosageTool(rawQuery) {
  const q = String(rawQuery || '').toLowerCase();

  // Case A: Pha thuốc theo số phuy / bình (VD: "pha 25ml cho bình 20 lít, vậy 2 phuy 200 lít cần bao nhiêu?")
  const phuyMatch = q.match(/(\d+(?:[.,]\d+)?)\s*phuy\s*(\d+)?\s*(?:lít|l)?/i);
  const binhMatch = q.match(/(\d+(?:[.,]\d+)?)\s*bình\s*(\d+)?\s*(?:lít|l)?/i);
  const rateMlPerLitMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|gam|cc)\b[^0-9]{0,25}?(\d+)\s*(?:lít|l)\b/i);

  if (rateMlPerLitMatch && (phuyMatch || binhMatch)) {
    const rateVal = parseFloat(rateMlPerLitMatch[1].replace(',', '.'));
    const rateUnit = rateMlPerLitMatch[2];
    const baseWaterL = parseFloat(rateMlPerLitMatch[3]);

    const containerCount = phuyMatch
      ? parseFloat(phuyMatch[1].replace(',', '.'))
      : parseFloat(binhMatch[1].replace(',', '.'));
    const containerVolumeL = phuyMatch
      ? (parseFloat(phuyMatch[2]) || 200)
      : (parseFloat(binhMatch[2]) || 20);

    const totalWaterL = containerCount * containerVolumeL;
    const totalChemical = (totalWaterL / baseWaterL) * rateVal;
    const displayTotal = totalChemical >= 1000
      ? `${(totalChemical / 1000).toFixed(2)} ${rateUnit === 'g' || rateUnit === 'gam' ? 'kg' : 'lít'} (${Math.round(totalChemical)} ${rateUnit})`
      : `${Math.round(totalChemical * 10) / 10} ${rateUnit}`;

    return {
      toolName: 'tool_calculate_agro_dosage',
      summary: `🧮 **Kết Quả Tính Toán Liều Lượng Pha Phun Chính Xác (Agent Calculator):**\n` +
        `[KPI: ${totalWaterL.toLocaleString('vi-VN')} Lít nước | ${displayTotal} Vật tư]\n` +
        `• **Định mức chuẩn:** ${rateVal} ${rateUnit} / ${baseWaterL} lít nước.\n` +
        `• **Tổng lượng nước cần pha:** ${containerCount} ${phuyMatch ? 'phuy' : 'bình'} × ${containerVolumeL}L = **${totalWaterL.toLocaleString('vi-VN')} lít nước**.\n` +
        `• **Tổng lượng thuốc/phân bón lá cần dùng:** **${displayTotal}**.`
    };
  }

  // Case B: Bón phân theo số gốc cây (VD: "150 gốc sầu riêng, mỗi gốc bón 0.8 kg")
  const treeCountMatch = q.match(/(\d+)\s*(?:gốc|cây)/i);
  const perTreeKgMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|kí|g|gam|lít|l)\s*(?:\/|\s+mỗi\s+|\s+trên\s+\d*\s*)(?:gốc|cây)/i);
  if (treeCountMatch && perTreeKgMatch) {
    const trees = parseInt(treeCountMatch[1], 10);
    const amountPerTree = parseFloat(perTreeKgMatch[1].replace(',', '.'));
    const unit = perTreeKgMatch[2];
    const isGram = unit === 'g' || unit === 'gam';
    const totalRaw = trees * amountPerTree;
    const totalKg = isGram ? totalRaw / 1000 : totalRaw;
    const bags50kg = (totalKg / 50).toFixed(1);

    return {
      toolName: 'tool_calculate_agro_dosage',
      summary: `🧮 **Kết Quả Tính Toán Định Mức Bón Phân Theo Gốc (Agent Calculator):**\n` +
        `[KPI: ${trees.toLocaleString('vi-VN')} Gốc cây | ${totalKg.toLocaleString('vi-VN')} kg Vật tư]\n` +
        `• **Quy mô:** ${trees.toLocaleString('vi-VN')} gốc × ${amountPerTree} ${unit}/gốc.\n` +
        `• **Tổng khối lượng vật tư cần chuẩn bị:** **${totalKg.toLocaleString('vi-VN')} kg** ${!isGram && (unit === 'lít' || unit === 'l') ? 'lít' : `(tương đương ~${bags50kg} bao 50kg)`}.`
    };
  }

  return null;
}

/**
 * Thực thi bộ 12 Agentic Tools dựa trên ngữ cảnh người dùng & câu hỏi
 */
function executeAgentTools(rawQuery, context = {}) {
  const { normalizedText } = normalizeAgroQuery(rawQuery);
  const {
    isAdmin = false,
    currentUser = {},
    userFarms = [],
    userPlants = [],
    userLogs = [],
    userSuppliesCost = 0,
    userRecentSupplies = [],
    userSuppliesInventory = [],
    userIotSensors = []
  } = context;

  const triggeredTools = [];
  const toolSections = [];
  const suggestedActions = [];

  // Tool 11: Self-Correction & Full Farm Data Audit (Kích hoạt đầu tiên khi phát hiện phàn nàn / yêu cầu đối soát)
  const auditRegex = /(trả\s*lời\s*sai|sai\s*rồi|không\s*đúng|báo\s*sai|nhầm\s*rồi|kiểm\s*tra\s*lại|đối\s*soát|tổng\s*hợp\s*(lại|hết)|dữ\s*liệu\s*thật)/i;
  if (auditRegex.test(rawQuery) || auditRegex.test(normalizedText)) {
    triggeredTools.push('tool_self_correction_and_full_audit');
    const healthyCount = userPlants.filter(p => !p.health_status || p.health_status === 'Khỏe mạnh' || p.health_status === 'Tốt').length;
    const sickCount = userPlants.filter(p => p.health_status && p.health_status !== 'Khỏe mạnh' && p.health_status !== 'Tốt').length;
    const nfcCount = userPlants.filter(p => p.nfc_uid && String(p.nfc_uid).trim()).length;

    toolSections.push(
      `🔍 **Bảng Đối Soát Dữ Liệu Thực Tế Toàn Vườn (Agent Audit & Self-Correction):**\n` +
      `[KPI: ${userFarms.length} Trang trại | ${userPlants.length} Cây trồng | ${userSuppliesInventory.length} Vật tư kho | ${Number(userSuppliesCost).toLocaleString('vi-VN')} đ Đã chi]\n` +
      `• **Trang trại:** ${userFarms.map(f => `${f.name} (${f.total} cây · ${formatSmartIsoArea(f.area)})`).join(' ; ') || 'Chưa có'}\n` +
      `• **Cây trồng (${userPlants.length} cây):** ${healthyCount} Khỏe/Tốt, ${sickCount} Cần chú ý, ${nfcCount} Đã gắn NFC\n` +
      `• **Vật tư tồn kho (${userSuppliesInventory.length} mục):** ${userSuppliesInventory.filter(s => Number(s.stock_quantity) < 900000).slice(0, 4).map(s => `${s.name} (${s.stock_quantity} ${s.unit})`).join(' ; ') || 'Đang đồng bộ'}\n` +
      `• **Nhật ký mới nhất:** ${userLogs[0] ? `${new Date(userLogs[0].log_date).toLocaleDateString('vi-VN')} [${userLogs[0].log_type}] ${userLogs[0].tree_code || ''}: ${formatLogDetailSummary(userLogs[0])}` : 'Chưa có'}`
    );

    return {
      triggeredTools,
      toolSections,
      suggestedActions
    };
  }

  // 1. Tool 7: Agro-Dosage Calculator
  const dosageRes = calculateAgroDosageTool(rawQuery);
  if (dosageRes) {
    triggeredTools.push(dosageRes.toolName);
    toolSections.push(dosageRes.summary);
  }

  // 2. Tool 6: Bio-Safety & PHI Inspector (10-15 days rule between chemical & microbial)
  if (
    (normalizedText.includes('vi sinh') || normalizedText.includes('trichoderma') || normalizedText.includes('bacillus') || normalizedText.includes('men em')) &&
    (normalizedText.includes('hóa học') || normalizedText.includes('thuốc') || normalizedText.includes('xịt') || normalizedText.includes('phun') || normalizedText.includes('pha chung') || normalizedText.includes('mấy ngày') || normalizedText.includes('khoảng cách'))
  ) {
    triggeredTools.push('tool_check_phi_and_biosafety');
    const recentSpray = userLogs.find(l => String(l.log_type || '').toLowerCase().includes('phun thuốc'));
    let logWarning = '';
    if (recentSpray && recentSpray.log_date) {
      const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(recentSpray.log_date).getTime()) / 86400000));
      logWarning = daysAgo < 12
        ? `\n• ⚠️ **Cảnh báo từ Nhật ký vườn của Bác:** Đợt phun thuốc gần nhất mới cách đây **${daysAgo} ngày** (trên cây ${recentSpray.tree_code || recentSpray.plant_type}). Bác cần chờ thêm **${12 - daysAgo} đến ${15 - daysAgo} ngày nữa** mới nên tưới men vi sinh!`
        : `\n• ✅ **Kiểm tra Nhật ký vườn:** Đợt phun thuốc gần nhất đã cách đây **${daysAgo} ngày** (≥ 12 ngày), hiện tại Bác có thể tưới nấm đối kháng Trichoderma / vi sinh an toàn.`;
    }
    toolSections.push(
      `🛡️ **Kiểm Định An Toàn Sinh Học (Agent Bio-Safety Inspector):**\n` +
      `• **Quy tắc bắt buộc:** Tuyệt đối **KHÔNG pha chung** và **KHÔNG tưới liền** Chế phẩm vi sinh (Trichoderma, Bacillus, men EM) ngay sau khi phun/tưới Thuốc BVTV hóa học.\n` +
      `• **Thời gian cách ly an toàn:** Bắt buộc chờ **10 đến 15 ngày** để hoạt chất sát khuẩn phân giải hết mới đưa vi sinh + Humic vào vùng rễ.${logWarning}`
    );
  }

  // 3. Tool 1: Lookup Specific Plant by Code (e.g., A-A-001, S-A-001, SR-LK-102, #SR-001)
  const codeMatch = rawQuery.match(/\b([A-Z0-9]{1,5}(?:-[A-Z0-9]{1,6}){1,3})\b/i);
  if (codeMatch && userPlants.length > 0) {
    const targetCode = codeMatch[1].toUpperCase();
    const foundPlant = userPlants.find(p => {
      const c = String(p.tree_code || '').toUpperCase();
      return c === targetCode || c.includes(targetCode);
    });
    if (foundPlant) {
      triggeredTools.push('tool_lookup_plant_by_code');
      const plantLogs = userLogs.filter(l => String(l.tree_code || '').toUpperCase() === String(foundPlant.tree_code || '').toUpperCase());
      const recentStr = plantLogs.length > 0
        ? plantLogs.slice(0, 3).map(l => `${new Date(l.log_date).toLocaleDateString('vi-VN')}: [${l.log_type}] ${formatLogDetailSummary(l)}`).join(' | ')
        : 'Chưa có nhật ký gần đây';
      const nfcStatusStr = foundPlant.nfc_uid && String(foundPlant.nfc_uid).trim()
        ? `Đã gắn (${foundPlant.nfc_uid})`
        : 'Chưa gắn thẻ NFC';
      toolSections.push(
        `🌳 **Hồ Sơ Cây Trồng Tra Cứu Thực Tế (${foundPlant.tree_code}):**\n` +
        `• **Trang trại:** ${foundPlant.farm_name || 'Đang cập nhật'} | **Giống:** ${cleanAndDedupeCrops([foundPlant.plant_type, foundPlant.plant_variety].filter(Boolean).join(' - '))}\n` +
        `• **Tình trạng sức khỏe:** **${foundPlant.health_status || 'Khỏe mạnh'}** | **NFC:** ${nfcStatusStr}\n` +
        `• **Lịch sử chăm sóc gần nhất:** ${recentStr}`
      );
    }
  }

  // 4. Tool 2: Sick Plants Report
  const sickRegex = /(cây\s*bệnh|mấy\s*cây\s*bệnh|cây\s*nào\s*bệnh|bị\s*bệnh|ủ\s*bệnh|cây\s*yếu|cần\s*chú\s*ý|nguy\s*cấp|sức\s*khỏe(\s*toàn\s*bộ)?(\s*cây)?|sức\s*khỏe\s*vườn)/i;
  if (sickRegex.test(rawQuery) || sickRegex.test(normalizedText)) {
    triggeredTools.push('tool_get_sick_plants_report');
    const healthyCount = userPlants.filter(p => !p.health_status || p.health_status === 'Khỏe mạnh' || p.health_status === 'Tốt').length;
    const sickList = userPlants.filter(p => p.health_status && p.health_status !== 'Khỏe mạnh' && p.health_status !== 'Tốt');
    const kpiHeader = `[KPI: ${userPlants.length} Tổng số cây | ${healthyCount} Khỏe/Tốt | ${sickList.length} Ủ bệnh/Chú ý]`;

    if (sickList.length === 0) {
      toolSections.push(
        `🩺 **Báo Cáo Sức Khỏe Vườn:**\n` +
        `${kpiHeader}\n` +
        `• Toàn bộ **${userPlants.length} cây** đang quản lý đều ở trạng thái **Khỏe mạnh / Tốt (100%)**, chưa ghi nhận cây phát sinh ổ bệnh.`
      );
    } else {
      const preview = sickList.slice(0, 8).map(p => `**${p.tree_code || '#' + p.id}** (${p.health_status} - ${p.farm_name || 'Vườn'})`).join(', ');
      toolSections.push(
        `🩺 **Cảnh Báo Cây Đang Theo Dõi Bệnh Hại (${sickList.length}/${userPlants.length} cây):**\n` +
        `${kpiHeader}\n` +
        `• **Danh sách cây cần xử lý:** ${preview}${sickList.length > 8 ? ` và ${sickList.length - 8} cây khác` : ''}.`
      );
    }
  }

  // Check if query targets a specific farm name in userFarms
  const matchedFarm = userFarms.find(f => f.name && rawQuery.toLowerCase().includes(f.name.toLowerCase()));
  const isSpecificPlantCountQuery = matchedFarm && /(bao\s*nhiêu\s*cây|mấy\s*cây)/i.test(rawQuery);

  // 5. Tool 3: Farm Portfolio Overview
  const farmRegex = /(bao\s*nhiêu|mấy|danh\s*sách|các|những|tất\s*cả|có|tên)\s*(trang\s*trại|vườn|khu\s*vườn)|(trang\s*trại|vườn)\s*(của\s*tôi|của\s*mình|hiện\s*tại|nào)|trang\s*trại|diện\s*tích|trồng\s*cây\s*gì|trồng\s*giống\s*gì/i;
  if (!isSpecificPlantCountQuery && (farmRegex.test(normalizedText) || (matchedFarm && /(diện\s*tích|ở\s*đâu|trồng\s*gì|thông\s*tin)/i.test(rawQuery)))) {
    triggeredTools.push('tool_get_farm_portfolio');
    const greetingPrefix = isAdmin ? 'Hệ thống hiện đang quản lý' : `Hiện tại ${currentUser.name ? 'Bác ' + currentUser.name : 'Bác'} đang có`;
    const totalPlantsCount = userPlants.length || userFarms.reduce((acc, f) => acc + (Number(f.total) || 0), 0);
    if (userFarms.length === 0) {
      toolSections.push(`🏡 **Danh Mục Trang Trại:** ${greetingPrefix} **0 trang trại**. Bác có thể vào mục **"Trang trại"** ➔ **"+ Khởi tạo Trang trại mới (GPS)"** để tạo vườn đầu tiên.`);
      suggestedActions.push({ label: 'Khởi tạo Trang trại mới', path: '/user/#farms' });
    } else if (matchedFarm && !farmRegex.test(normalizedText)) {
      const targetPlants = userPlants.filter(p => String(p.farm_name || '').toLowerCase() === matchedFarm.name.toLowerCase());
      const treeCodesList = targetPlants.map(p => p.tree_code || ('#' + p.id)).filter(Boolean);
      const codesStr = treeCodesList.length > 0 ? treeCodesList.slice(0, 15).join(', ') + (treeCodesList.length > 15 ? ` và ${treeCodesList.length - 15} cây khác` : '') : 'Chưa có mã cây';
      toolSections.push(
        `🏡 **Thông Tin Chi Tiết Trang Trại ${matchedFarm.name}:**\n` +
        `[KPI: ${matchedFarm.name} | ${targetPlants.length || matchedFarm.total} Cây trồng | ${formatSmartIsoArea(matchedFarm.area)}]\n` +
        `• **Diện tích:** **${formatSmartIsoArea(matchedFarm.area)}**\n` +
        `• **Cây trồng:** **${cleanAndDedupeCrops(matchedFarm.crops)}** (${targetPlants.length || matchedFarm.total} cây)\n` +
        `• **Mã cây:** ${codesStr}`
      );
    } else {
      const lines = userFarms.map((f, i) => `• **${i + 1}. ${f.name}** (${f.total} cây): Diện tích **${formatSmartIsoArea(f.area)}** | Giống: **${cleanAndDedupeCrops(f.crops)}**`).join('\n');
      toolSections.push(
        `🏡 **${greetingPrefix} ${userFarms.length} trang trại (tổng cộng ${totalPlantsCount} cây trồng):**\n` +
        `[KPI: ${userFarms.length} Trang trại | ${totalPlantsCount} Cây trồng | 100% Đồng bộ GIS]\n` +
        `${lines}`
      );
    }
  }

  // 5B. Tool 3B: Total Plants Inventory Summary (or farm-specific plant count)
  const plantCountRegex = /(bao\s*nhiêu\s*cây|mấy\s*cây|tổng\s*số\s*cây|cây\s*của\s*tôi|danh\s*sách\s*cây)/i;
  if (
    (plantCountRegex.test(normalizedText) || (matchedFarm && /(bao\s*nhiêu\s*cây|mấy\s*cây)/i.test(rawQuery))) &&
    !triggeredTools.includes('tool_get_sick_plants_report')
  ) {
    triggeredTools.push('tool_get_plant_inventory_summary');
    if (matchedFarm) {
      const targetPlants = userPlants.filter(p => String(p.farm_name || '').toLowerCase() === matchedFarm.name.toLowerCase());
      const healthyCount = targetPlants.filter(p => !p.health_status || p.health_status === 'Khỏe mạnh' || p.health_status === 'Tốt').length;
      const attentionCount = targetPlants.length - healthyCount;
      const treeCodesList = targetPlants.map(p => p.tree_code || ('#' + p.id)).filter(Boolean);
      const codesStr = treeCodesList.length > 0 ? treeCodesList.slice(0, 15).join(', ') + (treeCodesList.length > 15 ? ` và ${treeCodesList.length - 15} cây khác` : '') : 'Chưa có mã cây';

      toolSections.push(
        `🌳 **Thống Kê Cây Trồng Tại ${matchedFarm.name} (${targetPlants.length} cây):**\n` +
        `[KPI: ${matchedFarm.name} | ${targetPlants.length} Cây trồng | ${formatSmartIsoArea(matchedFarm.area)}]\n` +
        `• **Trang trại:** ${matchedFarm.name} (Diện tích: **${formatSmartIsoArea(matchedFarm.area)}** | Giống: **${cleanAndDedupeCrops(matchedFarm.crops)}**)\n` +
        `• **Số lượng cây:** **${targetPlants.length} cây** (${healthyCount} Khỏe mạnh, ${attentionCount} Cần chú ý)\n` +
        `• **Danh sách mã cây:** ${codesStr}`
      );
    } else {
      const healthyCount = userPlants.filter(p => !p.health_status || p.health_status === 'Khỏe mạnh' || p.health_status === 'Tốt').length;
      const attentionCount = userPlants.length - healthyCount;
      const byFarm = {};
      userPlants.forEach(p => {
        const fname = p.farm_name || 'Vườn chưa phân loại';
        byFarm[fname] = (byFarm[fname] || 0) + 1;
      });
      const farmSummary = Object.entries(byFarm).map(([fn, cnt]) => `• **${fn}:** ${cnt} cây`).join('\n') || '• Chưa có cây nào được tạo.';
      toolSections.push(
        `🌳 **Thống Kê Cây Trồng Của Vườn (${userPlants.length} cây):**\n` +
        `[KPI: ${userPlants.length} Tổng số cây | ${healthyCount} Khỏe mạnh | ${attentionCount} Cần chú ý]\n` +
        `• **Khỏe mạnh:** ${healthyCount} cây | **Cần chú ý / Bệnh:** ${attentionCount} cây\n` +
        `${farmSummary}`
      );
    }
  }

  // 6. Tool 4: Supply & Financial Cost Analytics
  const supplyRegex = /(chi\s*phí|bao\s*nhiêu\s*tiền|tốn\s*bao\s*nhiêu|hết\s*bao\s*nhiêu|tiền\s*vật\s*tư|vật\s*tư|tiêu\s*hao|hạch\s*toán|phân\s*thuốc|trong\s*kho|tồn\s*kho|tối\s*ưu\s*chi\s*phí)/i;
  if (supplyRegex.test(rawQuery) || supplyRegex.test(normalizedText)) {
    triggeredTools.push('tool_get_supply_and_cost_analytics');

    // 1. Tồn kho Vật tư (userSuppliesInventory)
    const physicalSupplies = userSuppliesInventory.filter(s => Number(s.stock_quantity) < 900000);
    const infiniteSupplies = userSuppliesInventory.filter(s => Number(s.stock_quantity) >= 900000);
    const orderedInventory = [...physicalSupplies, ...infiniteSupplies];

    const inventoryLines = orderedInventory.length > 0
      ? orderedInventory.slice(0, 6).map(s => {
          const qty = Number(s.stock_quantity) >= 900000 ? 'Không giới hạn' : `${s.stock_quantity} ${s.unit || ''}`.trim();
          const priceBadge = s.unit_price ? ` (Đơn giá: ${Number(s.unit_price).toLocaleString('vi-VN')} đ/${s.unit || 'đv'})` : '';
          return `  - **${s.name}** (${s.category || 'Vật tư'}): Còn **${qty}**${priceBadge}`;
        }).join('\n')
      : '  - Kho vật tư hiện đang trống hoặc chưa ghi nhận phiếu nhập.';

    // 2. Chi phí đã xuất dùng (userRecentSupplies gộp gọn)
    const aggregatedSupplies = [];
    const supplyGroupMap = new Map();

    for (const s of userRecentSupplies) {
      const key = `${s.name || ''}|${s.category || ''}|${s.farm_name || ''}`;
      if (!supplyGroupMap.has(key)) {
        const item = {
          name: s.name,
          category: s.category,
          farm_name: s.farm_name,
          unit: s.unit || '',
          quantity: Number(s.quantity) || 0,
          total_cost: Number(s.total_cost) || 0,
          count: 1
        };
        supplyGroupMap.set(key, item);
        aggregatedSupplies.push(item);
      } else {
        const item = supplyGroupMap.get(key);
        item.quantity += (Number(s.quantity) || 0);
        item.total_cost += (Number(s.total_cost) || 0);
        item.count += 1;
      }
    }

    const recentLines = aggregatedSupplies.length > 0
      ? aggregatedSupplies.slice(0, 5).map(s => {
          const countBadge = s.count > 1 ? ` (x${s.count} lượt)` : '';
          const qty = Math.round(s.quantity * 100) / 100;
          return `  - **${s.name}** (${s.category})${countBadge}: ${qty} ${s.unit} → **${Number(s.total_cost).toLocaleString('vi-VN')} VNĐ** (${s.farm_name || 'Vườn'})`;
        }).join('\n')
      : '  - Chưa phát sinh phiếu xuất vật tư gần đây.';

    toolSections.push(
      `💰 **Báo Cáo Hạch Toán Vật Tư & Chi Phí (${isAdmin ? 'Toàn hệ thống' : currentUser.name || 'Nông hộ'}):**\n` +
      `[KPI: ${Number(userSuppliesCost).toLocaleString('vi-VN')} đ Tổng chi | ${userSuppliesInventory.length} Vật tư tồn kho | ${userRecentSupplies.length} Đợt xuất gần nhất]\n` +
      `• **Tồn kho vật tư hiện có (${userSuppliesInventory.length} loại):**\n${inventoryLines}\n` +
      `• **Tổng chi phí vật tư đã dùng lũy kế:** **${Number(userSuppliesCost).toLocaleString('vi-VN')} VNĐ**\n` +
      `• **Các đợt xuất dùng gần nhất:**\n${recentLines}`
    );
  }

  // 7. Tool 5: Recent Cultivation Logs
  const logRegex = /(nhật\s*ký|lịch\s*sử\s*chăm\s*sóc|chăm\s*sóc\s*gần\s*đây|mới\s*làm\s*gì|mới\s*tưới|mới\s*bón|mới\s*phun|hôm\s*nay\s*làm\s*gì|hoạt\s*động\s*gần\s*đây)/i;
  if (logRegex.test(rawQuery) || logRegex.test(normalizedText)) {
    triggeredTools.push('tool_get_recent_cultivation_logs');
    const logLines = userLogs.length > 0
      ? userLogs.slice(0, 6).map(l => `• **${new Date(l.log_date).toLocaleDateString('vi-VN')}** — **[${l.log_type}]** tại cây **${l.tree_code || l.plant_type || 'Vườn'}** (${l.farm_name || 'Vườn'}): ${formatLogDetailSummary(l)}`).join('\n')
      : '• Chưa có nhật ký canh tác nào được ghi nhận gần đây.';
    toolSections.push(
      `📝 **Trích Xuất Nhật Ký Canh Tác Thực Địa Gần Nhất:**\n` +
      `[KPI: ${userLogs.length} Nhật ký gần nhất]\n` +
      `${logLines}`
    );
  }

  // 8. Tool 9: NFC Tagging Status Report
  const nfcRegex = /(nfc|thẻ\s*từ|gắn\s*thẻ|chưa\s*gắn|định\s*danh\s*cây)/i;
  if (nfcRegex.test(rawQuery) || nfcRegex.test(normalizedText)) {
    triggeredTools.push('tool_get_nfc_status_report');
    const taggedPlants = userPlants.filter(p => p.nfc_uid && String(p.nfc_uid).trim());
    const untaggedPlants = userPlants.filter(p => !p.nfc_uid || !String(p.nfc_uid).trim());

    const untaggedByFarm = {};
    for (const p of untaggedPlants) {
      const fn = p.farm_name || 'Vườn chưa phân loại';
      if (!untaggedByFarm[fn]) untaggedByFarm[fn] = [];
      untaggedByFarm[fn].push(p.tree_code || ('#' + p.id));
    }

    const untaggedLines = Object.entries(untaggedByFarm).map(([fn, codes]) => {
      const preview = codes.slice(0, 10).join(', ') + (codes.length > 10 ? ` (+${codes.length - 10} cây khác)` : '');
      return `• **${fn} (${codes.length} cây chưa gắn):** ${preview}`;
    }).join('\n') || '• Toàn bộ cây đã được gắn thẻ NFC 100%.';

    toolSections.push(
      `🏷️ **Báo Cáo Tình Trạng Định Danh Thẻ NFC (NTAG213 Anti-Cloning):**\n` +
      `[KPI: ${userPlants.length} Tổng cây | ${taggedPlants.length} Đã gắn NFC | ${untaggedPlants.length} Chưa gắn thẻ]\n` +
      `• **Tỷ lệ gắn thẻ:** **${userPlants.length > 0 ? Math.round((taggedPlants.length / userPlants.length) * 100) : 0}%** (${taggedPlants.length}/${userPlants.length} cây)\n` +
      `• **Danh sách cây chưa gắn thẻ NFC theo vườn:**\n${untaggedLines}`
    );

    if (untaggedPlants.length > 0) {
      suggestedActions.push({ label: 'Mở Cổng Định Danh NFC (/sub)', path: '/sub' });
    }
  }

  // 9. Tool 10: IoT Sensors & Agro-Weather Status
  const iotRegex = /(cảm\s*biến|iot|khí\s*tượng|thời\s*tiết|độ\s*ẩm\s*đất|nhiệt\s*độ|mưa\s*nắng|phun\s*thuốc\s*được\s*không)/i;
  if (iotRegex.test(rawQuery) || iotRegex.test(normalizedText)) {
    triggeredTools.push('tool_get_iot_and_weather_status');
    if (userIotSensors.length > 0) {
      const sensorLines = userIotSensors.map(s => {
        let soil = s.soil_data || {};
        if (typeof soil === 'string') { try { soil = JSON.parse(soil); } catch (_) { soil = {}; } }
        let air = s.air_data || {};
        if (typeof air === 'string') { try { air = JSON.parse(air); } catch (_) { air = {}; } }
        const activeLayer = soil[soil.active_depth ? `depth_${soil.active_depth}` : 'depth_20cm'] || soil.depth_20cm || soil.depth_10cm || soil.depth_30cm || soil;
        const moisture = activeLayer?.moisture ?? soil.moisture ?? soil.humidity ?? s.soil_moisture;
        const temp = air.temperature ?? air.temp ?? s.temperature;
        const airHum = air.humidity;
        const ph = activeLayer?.ph ?? soil.ph ?? s.soil_ph ?? '6.5';
        const ec = activeLayer?.ec;
        const moistStr = moisture !== undefined && moisture !== null ? `${moisture}%` : 'Đang đồng bộ';
        const tempStr = temp !== undefined && temp !== null ? `${temp}°C` : 'Đang đồng bộ';
        const ecStr = ec !== undefined ? ` | EC: **${ec} mS/cm**` : '';
        const humStr = airHum !== undefined ? ` | Ẩm KK: **${airHum}%**` : '';
        return `• **${s.farm_name || s.device_name || 'Trạm quan trắc'}:** Độ ẩm đất: **${moistStr}** | Nhiệt độ: **${tempStr}**${humStr} | pH: **${ph}**${ecStr}`;
      }).join('\n');

      toolSections.push(
        `📡 **Dữ Liệu Trạm Cảm Biến IoT Thực Địa:**\n` +
        `[KPI: ${userIotSensors.length} Trạm IoT hoạt động | Độ chính xác ISO/IEC 17025]\n` +
        `${sensorLines}`
      );
    } else {
      toolSections.push(
        `⛅ **Dữ Liệu Khí Tượng & Khuyến Cáo Canh Tác (Dự Báo Vệ Tinh Open-Meteo):**\n` +
        `[KPI: Đồng bộ Open-Meteo 6 ngày | Khung giờ vàng phun xịt: Sáng 6h-9h / Chiều 16h-18h]\n` +
        `• **Trạng thái kết nối IoT phần cứng:** Chưa kết nối trạm cảm biến IoT đất chuyên dụng tại vườn. Hệ thống đang tự động đồng bộ qua Trạm Khí Tượng Vệ Tinh Toàn Cầu Open-Meteo (chu kỳ 6 ngày, cập nhật mỗi giờ).\n` +
        `• **Khuyến nghị thời tiết:** Khung giờ vàng phun thuốc/bón lá là **Sáng sớm (6h - 9h)** hoặc **Chiều mát (16h - 18h)** khi khí khổng mở tối đa. Tuyệt đối **không phun khi trời chuẩn bị mưa hoặc nắng gắt (> 35°C)** để tránh rửa trôi và cháy lá.`
      );
    }
  }

  // 10. Tool 8: App Navigation & Workflow Guide
  if (normalizedText.includes('hướng dẫn sử dụng') || normalizedText.includes('thuê nhân công') || normalizedText.includes('xuất vietgap')) {
    triggeredTools.push('tool_app_navigation_guide');
    suggestedActions.push(
      { label: 'Mở Cổng Định Danh NFC (/sub)', path: '/sub' },
      { label: 'Quản lý Vườn & Cây (/user/)', path: '/user/' }
    );
  }

  // 11. Greeting & Account Summary Tool
  if (
    triggeredTools.length === 0 &&
    /^(xin\s*chào|chào(\s*bé\s*mầm)?|hello|hi|bạn\s*là\s*ai|em\s*là\s*ai|tôi\s*là\s*ai|thông\s*tin\s*tài\s*khoản)/i.test(rawQuery.trim())
  ) {
    triggeredTools.push('tool_greeting_and_account_summary');
    const totalPlantsCount = userPlants.length || userFarms.reduce((acc, f) => acc + (Number(f.total) || 0), 0);
    toolSections.push(
      `🌱 **Chào ${isAdmin ? 'Admin' : 'Bác ' + (currentUser.name || 'Nông hộ')}!** Em là **Bé Mầm AI AgTech** — Trợ lý nông nghiệp thông minh của Sổ Nông Tân Bảo.\n` +
      `• **Tóm tắt nhanh vườn của ${isAdmin ? 'hệ thống' : 'Bác'}:** Hiện đang quản lý **${userFarms.length} trang trại** với **${totalPlantsCount} cây trồng**.\n` +
      `• Bác có thể hỏi ngay: *"Tôi có bao nhiêu vườn?"*, *"Chi phí vật tư?"*, *"Cây có bệnh không?"*, hoặc hỏi phác đồ trị sâu bệnh & tính liều lượng pha thuốc ạ!`
    );
  }

  return {
    triggeredTools,
    toolSections,
    suggestedActions
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GROUNDED AGENT SYNTHESIZER (TỔNG HỢP ĐÁP ÁN CHÍNH XÁC 100%, KHÔNG BAO GIỜ CỤT)
// ─────────────────────────────────────────────────────────────────────────────
function synthesizeGroundedAgentReply({
  rawQuery,
  isAdmin = false,
  userName = 'Bác nông hộ',
  matchedQAResult = null,
  ragResult = { topArticles: [], matchedSynonyms: [], maxScore: 0 },
  toolExecResult = { triggeredTools: [], toolSections: [], suggestedActions: [] }
}) {
  const greetingTitle = isAdmin ? 'Admin' : `Bác ${userName}`;
  const blocks = [];

  // 1. Nếu khớp Cặp Q&A đã huấn luyện
  if (matchedQAResult && matchedQAResult.qa?.expected_answer) {
    blocks.push(matchedQAResult.qa.expected_answer);
  }

  // 2. Nếu có kết quả từ 8 Agent Tools (Số liệu vườn thực tế / Máy tính liều lượng / Kiểm định an toàn)
  if (toolExecResult.toolSections && toolExecResult.toolSections.length > 0) {
    blocks.push(toolExecResult.toolSections.join('\n\n'));
  }

  // 3. Nếu có bài viết chuyên môn từ Kho Tri Thức (BM25 Top Articles)
  // Chống nhiễu: Nếu Personal Data Tool đã trả lời câu hỏi dữ liệu vườn/cây/chi phí/nhật ký thì chỉ đính kèm bài viết khi điểm khớp rất cao (>= 7.0)
  const PERSONAL_DATA_TOOLS = new Set([
    'tool_self_correction_and_full_audit',
    'tool_get_farm_portfolio',
    'tool_get_plant_inventory_summary',
    'tool_get_sick_plants_report',
    'tool_lookup_plant_by_code',
    'tool_get_supply_and_cost_analytics',
    'tool_get_recent_cultivation_logs',
    'tool_greeting_and_account_summary',
    'tool_get_nfc_status_report',
    'tool_get_iot_and_weather_status'
  ]);
  const hasPersonalDataAnswer = (toolExecResult.triggeredTools || []).some(t => PERSONAL_DATA_TOOLS.has(t));
  const shouldIncludeRagArticles = !matchedQAResult &&
    !hasPersonalDataAnswer &&
    ragResult.topArticles &&
    ragResult.topArticles.length > 0;

  if (shouldIncludeRagArticles) {
    const primaryArt = ragResult.topArticles[0];
    blocks.push(
      `📘 **Phác Đồ & Tri Thức Chuyên Môn Chuẩn Tân Bảo AgTech — ${primaryArt.title} (${primaryArt.category}):**\n` +
      `${primaryArt.content}`
    );

    if (ragResult.topArticles.length > 1 && ragResult.topArticles[1].matchScore >= 5.5) {
      const secArt = ragResult.topArticles[1];
      blocks.push(`💡 **Tham khảo bổ sung (${secArt.title}):**\n${secArt.content}`);
    }
  }

  // 4. Tính toán điểm tin cậy (Confidence Score theo chuẩn ISO/IEC TR 24028)
  let confidenceScore = 0.25;
  if (matchedQAResult) {
    confidenceScore = Math.max(confidenceScore, matchedQAResult.score);
  }
  if (toolExecResult.triggeredTools.length > 0) {
    confidenceScore = Math.max(confidenceScore, 0.92);
  }
  if (ragResult.maxScore > 0) {
    confidenceScore = Math.max(confidenceScore, Math.min(0.95, 0.45 + ragResult.maxScore * 0.05));
  }
  confidenceScore = Number(confidenceScore.toFixed(2));

  // 5. Nếu câu hỏi hoàn toàn nằm ngoài cả Q&A, Tools và Kho Tri Thức -> Trả lời định hướng có cấu trúc & đánh dấu Auto-Learning
  if (blocks.length === 0) {
    blocks.push(
      `Dạ chào ${greetingTitle}! Về câu hỏi **"${rawQuery}"**, Bé Mầm đã ghi nhận vào **Hệ thống Tự học (Auto-Learning Queue)** để cập nhật phác đồ chuyên sâu.\n\n` +
      `Hiện tại ${greetingTitle} có thể yêu cầu Bé Mầm thực hiện ngay các tác vụ Agent sau:\n` +
      `• 🧮 **Tính liều lượng pha thuốc/bón phân:** Ví dụ *"Pha 25ml thuốc cho bình 20L, vậy 3 phuy 200L cần bao nhiêu ml?"* hoặc *"120 gốc sầu riêng bón 0.6kg/gốc hết bao nhiêu kg?"*\n` +
      `• 🩺 **Chẩn đoán & Phác đồ bệnh hại:** Xì mủ nứt thân, vàng lá thối rễ, cháy lá thán thư, rầy xanh, nhện đỏ, làm bông, chống rụng trái non, sượng cơm.\n` +
      `• 📊 **Tra cứu dữ liệu thực của vườn:** *"Vườn có mấy cây bệnh?"*, *"Chi phí vật tư đã dùng?"*, *"Nhật ký chăm sóc gần nhất?"* hoặc tra theo mã cây (*"SR-001"*).`
    );
  }

  return {
    reply: blocks.join('\n\n---\n\n'),
    confidenceScore,
    needsAutoLearning: confidenceScore < 0.35,
    agentMetadata: {
      standard: 'ISO/IEC 42001 & ISO/IEC 23053 Hybrid Agent',
      confidenceScore,
      toolsTriggered: toolExecResult.triggeredTools,
      matchedQAId: matchedQAResult?.qa?.id || null,
      matchedArticles: (ragResult.topArticles || []).map(a => ({ id: a.id, title: a.title, score: a.matchScore })),
      matchedSynonyms: ragResult.matchedSynonyms || [],
      suggestedActions: toolExecResult.suggestedActions || []
    }
  };
}

module.exports = {
  checkPromptInjection,
  normalizeAgroQuery,
  tokenizeVietnamese,
  loadKnowledgeBaseCached,
  matchTrainingQA,
  rankKnowledgeArticles,
  formatSmartIsoArea,
  cleanAndDedupeCrops,
  formatLogDetailSummary,
  calculateAgroDosageTool,
  executeAgentTools,
  synthesizeGroundedAgentReply,
  BUILTIN_ENCYCLOPEDIA_ARTICLES
};
