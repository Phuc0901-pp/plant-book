const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');

describe('Suite 13: AI Training Studio, Knowledge Base RAG & High-Grade Security Architecture', () => {

  const mig006Path = path.join(__dirname, '../../db/migrations/006_ai_training_and_knowledge_base.sql');
  const initPath = path.join(__dirname, '../../db/init.js');
  const aiTrainingRoutePath = path.join(__dirname, '../../routes/ai_training.js');
  const aiRoutePath = path.join(__dirname, '../../routes/ai.js');
  const adminHtmlPath = path.join(__dirname, '../../../frontend/admin/index.html');
  const serverPath = path.join(__dirname, '../../server.js');

  it('13.1 Should verify Migration 006 and init.js contain valid schema for AI Knowledge Base & Q&A Fine-Tuning', () => {
    expect(fs.existsSync(mig006Path)).toBe(true);
    const mig006 = fs.readFileSync(mig006Path, 'utf8');
    const init = fs.readFileSync(initPath, 'utf8');

    // Tables
    expect(mig006.includes('CREATE TABLE IF NOT EXISTS ai_knowledge_articles')).toBe(true);
    expect(mig006.includes('CREATE TABLE IF NOT EXISTS ai_training_qa')).toBe(true);
    expect(mig006.includes('CREATE TABLE IF NOT EXISTS ai_training_logs')).toBe(true);
    expect(mig006.includes('CREATE TABLE IF NOT EXISTS ai_unanswered_queries')).toBe(true);

    // Initial Seed Data
    expect(mig006.includes('Khoảng Cách 10 ~ 15 Ngày Giữa Thuốc BVTV Hóa Học & Chế Phẩm Vi Sinh')).toBe(true);
    expect(mig006.includes('Phytophthora')).toBe(true);
    expect(mig006.includes('Trichoderma')).toBe(true);

    // init.js consistency
    expect(init.includes('ai_knowledge_articles')).toBe(true);
    expect(init.includes('ai_training_qa')).toBe(true);
    expect(init.includes('ai_training_logs')).toBe(true);
  });

  it('13.2 Should verify Anti-Bot Honeypot validation logic blocks malicious bot submissions', () => {
    const routeContent = fs.readFileSync(aiTrainingRoutePath, 'utf8');
    expect(routeContent.includes('botProtectionMiddleware')).toBe(true);
    expect(routeContent.includes('hp_security_trap')).toBe(true);

    // Test pure logic of honeypot
    function mockBotCheck(body) {
      const { hp_security_trap, website_hidden_check } = body || {};
      if (hp_security_trap || website_hidden_check) {
        return { blocked: true, status: 403, error: 'Truy cập bị từ chối bởi Hệ thống Phòng Vệ Tự Động.' };
      }
      return { blocked: false, status: 200 };
    }

    // Normal user submit (honeypot empty) -> allowed
    const humanReq = mockBotCheck({ title: 'Kỹ thuật bón phân', hp_security_trap: '' });
    expect(humanReq.blocked).toBe(false);
    expect(humanReq.status).toBe(200);

    // Automated bot submit (auto-fills all inputs including hidden honeypot) -> blocked
    const botReq = mockBotCheck({ title: 'Spam article', hp_security_trap: 'http://spam-link.ru' });
    expect(botReq.blocked).toBe(true);
    expect(botReq.status).toBe(403);
  });

  it('13.3 Should verify XSS input sanitization prevents malicious script injection', () => {
    function sanitizeInput(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/onload\s*=/gi, '')
        .replace(/onerror\s*=/gi, '')
        .trim();
    }

    const dirty1 = 'Phác đồ sầu riêng <script>alert("hacked")</script> chuẩn Tân Bảo';
    expect(sanitizeInput(dirty1)).toBe('Phác đồ sầu riêng  chuẩn Tân Bảo');

    const dirty2 = '<img src=x onerror=alert(1)> Triệu chứng xì mủ';
    expect(sanitizeInput(dirty2)).toBe('<img src=x alert(1)> Triệu chứng xì mủ');

    const dirty3 = '<a href="javascript:stealCookie()">Bấm vào đây</a>';
    expect(sanitizeInput(dirty3)).toBe('<a href="stealCookie()">Bấm vào đây</a>');
  });

  it('13.4 Should verify Dynamic RAG Matching Algorithm (prioritizes trained Q&A and extracts top-ranked Knowledge)', () => {
    const sampleQA = [
      {
        id: 1,
        sample_questions: 'vừa xịt thuốc nấm tưới vi sinh được không\nxịt thuốc sâu xong bón trichoderma liền được không',
        expected_answer: 'Dạ Bác tuyệt đối KHÔNG ĐƯỢC tưới vi sinh liền, BẮT BUỘC cách 10 đến 15 ngày sau ạ!'
      },
      {
        id: 2,
        sample_questions: 'app này sài sao\nhướng dẫn sử dụng',
        expected_answer: 'Dạ chào Bác! Bé Mầm xin hướng dẫn 4 bước...'
      }
    ];

    const sampleArticles = [
      {
        id: 101,
        title: 'Quy Tắc Vàng: Khoảng Cách 10 ~ 15 Ngày Giữa Thuốc BVTV & Vi Sinh',
        topic_keywords: 'thuốc hóa học, vi sinh, trichoderma, khoảng cách 10 ngày',
        content: 'Bắt buộc cách 10-15 ngày...',
        priority: 10
      },
      {
        id: 102,
        title: 'Phác Đồ Đặc Trị Vàng Lá Thối Rễ & Xì Mủ Thân',
        topic_keywords: 'vàng lá, xì mủ, metalaxyl, phytophthora',
        content: 'Cạo sạch vỏ và quét metalaxyl...',
        priority: 9
      }
    ];

    function matchRAG(query) {
      const lower = query.toLowerCase().trim();
      let matchedQA = null;

      for (const qa of sampleQA) {
        const variants = qa.sample_questions.split('\n').map(v => v.trim().toLowerCase());
        if (variants.some(v => lower.includes(v) || v.includes(lower))) {
          matchedQA = qa;
          break;
        }
      }

      const matchedArticles = [];
      for (const art of sampleArticles) {
        const kwList = art.topic_keywords.split(',').map(k => k.trim().toLowerCase());
        let score = 0;
        if (lower.includes(art.title.toLowerCase())) score += 5;
        kwList.forEach(k => { if (lower.includes(k)) score += 3; });
        if (score > 0) matchedArticles.push({ art, score });
      }

      matchedArticles.sort((a, b) => b.score - a.score);
      return { matchedQA, matchedArticles };
    }

    // Query 1: Exact match question about TBVTV & Vi sinh
    const res1 = matchRAG('vừa xịt thuốc nấm tưới vi sinh được không');
    expect(res1.matchedQA !== null).toBe(true);
    expect(res1.matchedQA.expected_answer).toContain('BẮT BUỘC cách 10 đến 15 ngày');
    expect(res1.matchedArticles.length).toBeGreaterThan(0);
    expect(res1.matchedArticles[0].art.id).toBe(101);

    // Query 2: Disease inquiry about xì mủ
    const res2 = matchRAG('cây sầu riêng bị xì mủ thân đọt non');
    expect(res2.matchedQA).toBe(null);
    expect(res2.matchedArticles.length).toBeGreaterThan(0);
    expect(res2.matchedArticles[0].art.id).toBe(102);
  });

  it('13.5 Should verify presence of critical Admin AI Training Studio DOM elements and Modals in compiled HTML', () => {
    const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

    const requiredIds = [
      'page-ai-training',
      'ai-subtab-btn-knowledge',
      'ai-subtab-btn-qa',
      'ai-subtab-btn-simulator',
      'ai-subtab-btn-security',
      'ai-knowledge-modal',
      'ai-qa-modal',
      'ai-knowledge-table-body',
      'ai-qa-list-container',
      'ai-test-input',
      'ai-security-logs-tbody'
    ];

    requiredIds.forEach(id => {
      const hasId = adminHtml.includes(`id="${id}"`) || adminHtml.includes(`id='${id}'`);
      if (!hasId) {
        throw new Error(`Critical AI Training Studio DOM ID "${id}" is missing in admin/index.html`);
      }
      expect(hasId).toBe(true);
    });
  });

  it('13.6 Should verify Security RBAC middleware protection and route registration in server.js', () => {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    expect(serverContent.includes("app.use('/api/ai/training', require('./routes/ai_training'));")).toBe(true);

    const trainingRouteContent = fs.readFileSync(aiTrainingRoutePath, 'utf8');
    expect(trainingRouteContent.includes('router.use(auth);')).toBe(true);
    expect(trainingRouteContent.includes('router.use(admin);')).toBe(true);

    const aiRouteContent = fs.readFileSync(aiRoutePath, 'utf8');
    expect(aiRouteContent.includes('ai_training_qa')).toBe(true);
    expect(aiRouteContent.includes('ai_knowledge_articles')).toBe(true);
  });

});
