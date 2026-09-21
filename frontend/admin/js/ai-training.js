/**
 * frontend/admin/js/ai-training.js
 * Trung Tâm Huấn Luyện AI Bé Mầm (AI Training Studio) & Quản Lý Tri Thức Nông Nghiệp
 * - Phân trang 10 bản ghi / trang cho tất cả các bảng dữ liệu
 * - Trích xuất Real Client IP & Đánh dấu Proxy nội bộ
 * - Mã hóa / Ẩn danh hóa ID người dùng và Email quản trị
 * - Định dạng Chi tiết sự kiện bảo mật trực quan, loại bỏ JSON thô
 */

(function() {
  let _knowledgeArticles = [];
  let _knowledgePage = 1;
  const _knowledgePageSize = 10;

  let _qaPairs = [];
  let _qaPage = 1;
  const _qaPageSize = 10;

  let _securityLogs = [];
  let _logsPage = 1;
  const _logsPageSize = 10;

  let _currentSubtab = 'knowledge';
  let _searchDebounceTimer = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAuthToken() {
    return localStorage.getItem('pb_token') || localStorage.getItem('token') || window.token || '';
  }

  // ─────────────────────────────────────────────────────────────
  // 0. BỘ ĐIỀU KHIỂN PHÂN TRANG CHUẨN (10 BẢN GHI / TRANG)
  // ─────────────────────────────────────────────────────────────
  function renderPaginationControls({ containerId, currentPage, totalItems, pageSize, onPageChangeFnName }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalItems <= 0) {
      container.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalItems);

    let pageButtonsHtml = '';

    // First & Prev Button
    pageButtonsHtml += `
      <button type="button" class="btn btn-outline" onclick="${onPageChangeFnName}(1)" ${currentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed; padding:5px 9px; font-size:12px;"' : 'style="padding:5px 9px; font-size:12px; cursor:pointer;"'} title="Trang đầu">
        <i data-lucide="chevrons-left" class="lucide-sm"></i>
      </button>
      <button type="button" class="btn btn-outline" onclick="${onPageChangeFnName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed; padding:5px 9px; font-size:12px;"' : 'style="padding:5px 9px; font-size:12px; cursor:pointer;"'} title="Trang trước">
        <i data-lucide="chevron-left" class="lucide-sm"></i>
      </button>
    `;

    // Page Numbers (up to 5 buttons)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === currentPage;
      pageButtonsHtml += `
        <button type="button" class="btn ${isActive ? 'btn-primary' : 'btn-outline'}" onclick="${onPageChangeFnName}(${p})" style="min-width:32px; padding:5px 9px; font-size:12px; font-weight:700; cursor:pointer; ${isActive ? 'background:#059669; color:#ffffff; border-color:#059669;' : 'background:#ffffff; color:#334155;'}">
          ${p}
        </button>
      `;
    }

    // Next & Last Button
    pageButtonsHtml += `
      <button type="button" class="btn btn-outline" onclick="${onPageChangeFnName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed; padding:5px 9px; font-size:12px;"' : 'style="padding:5px 9px; font-size:12px; cursor:pointer;"'} title="Trang sau">
        <i data-lucide="chevron-right" class="lucide-sm"></i>
      </button>
      <button type="button" class="btn btn-outline" onclick="${onPageChangeFnName}(${totalPages})" ${currentPage === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed; padding:5px 9px; font-size:12px;"' : 'style="padding:5px 9px; font-size:12px; cursor:pointer;"'} title="Trang cuối">
        <i data-lucide="chevrons-right" class="lucide-sm"></i>
      </button>
    `;

    container.innerHTML = `
      <div style="font-size:12.5px; color:#64748b; font-weight:600;">
        Hiển thị <strong style="color:#0f172a;">${startIdx} - ${endIdx}</strong> trên tổng số <strong style="color:#0f172a;">${totalItems}</strong> bản ghi (<span style="color:#059669; font-weight:700;">${pageSize}</span> bản ghi/trang)
      </div>
      <div style="display:flex; align-items:center; gap:5px;">
        ${pageButtonsHtml}
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. CHUYỂN SUB-TAB & KHỞI TẠO DỮ LIỆU
  // ─────────────────────────────────────────────────────────────
  window.switchAiTrainingSubtab = function(subtabName) {
    _currentSubtab = subtabName;
    const subtabs = ['knowledge', 'qa', 'simulator', 'security'];

    subtabs.forEach(tab => {
      const btn = document.getElementById(`ai-subtab-btn-${tab}`);
      const pane = document.getElementById(`ai-subtab-${tab}`);
      if (btn) btn.classList.toggle('active', tab === subtabName);
      if (pane) pane.style.display = tab === subtabName ? 'block' : 'none';
    });

    if (subtabName === 'knowledge') loadAiKnowledgeList();
    else if (subtabName === 'qa') loadAiQaList();
    else if (subtabName === 'security') loadAiSecurityLogs();
  };

  window.initAiTrainingStudio = function() {
    loadAiTrainingStats();
    loadAiKnowledgeList();
  };

  // ─────────────────────────────────────────────────────────────
  // 2. TẢI THỐNG KÊ (STATS & KPIS)
  // ─────────────────────────────────────────────────────────────
  window.loadAiTrainingStats = async function() {
    try {
      const res = await fetch('/api/ai/training/stats', {
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.stats) {
        const s = data.stats;
        const elArt = document.getElementById('ai-kpi-articles-count');
        const elQa = document.getElementById('ai-kpi-qa-count');
        const elLogs = document.getElementById('ai-kpi-logs-count');

        if (elArt) elArt.innerHTML = `${s.articles.total} <span style="font-size:12px; font-weight:600; color:#059669;">(${s.articles.active} đang dùng)</span>`;
        if (elQa) elQa.innerHTML = `${s.qa.total} <span style="font-size:12px; font-weight:600; color:#0284c7;">(${s.qa.active} đang dùng)</span>`;
        if (elLogs) elLogs.innerHTML = `${s.logsTotal} <span style="font-size:12px; font-weight:600; color:#16a34a;">(Anti-Bot)</span>`;
      }
    } catch (err) {
      console.warn('Lỗi tải thống kê AI:', err);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. KHO TRI THỨC QUY TRÌNH (KNOWLEDGE BASE)
  // ─────────────────────────────────────────────────────────────
  window.onAiKnowledgeSearchChange = function() {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      _knowledgePage = 1;
      loadAiKnowledgeList();
    }, 300);
  };

  window.changeAiKnowledgePage = function(page) {
    const totalPages = Math.ceil(_knowledgeArticles.length / _knowledgePageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    _knowledgePage = page;
    renderKnowledgeTable(_knowledgeArticles);
  };

  window.loadAiKnowledgeList = async function() {
    const tbody = document.getElementById('ai-knowledge-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('ai-knowledge-search-input');
    const catSelect = document.getElementById('ai-knowledge-cat-filter');
    const searchVal = searchInput ? searchInput.value.trim() : '';
    const catVal = catSelect ? catSelect.value : 'all';

    let url = `/api/ai/training/knowledge?category=${encodeURIComponent(catVal)}`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        _knowledgeArticles = data.articles || [];
        renderKnowledgeTable(_knowledgeArticles);
      } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#dc2626;">Lỗi tải dữ liệu: ${escapeHtml(data.error)}</td></tr>`;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#dc2626;">Lỗi kết nối máy chủ khi tải tri thức</td></tr>`;
    }
  };

  function renderKnowledgeTable(articles) {
    const tbody = document.getElementById('ai-knowledge-table-body');
    const pagContainer = document.getElementById('ai-knowledge-pagination');
    if (!tbody) return;

    if (!articles || articles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:35px; color:#94a3b8;">Chưa có bài viết tri thức nào phù hợp. Bấm <strong>"+ Thêm Tri Thức SOP"</strong> để nạp dữ liệu!</td></tr>`;
      if (pagContainer) pagContainer.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(articles.length / _knowledgePageSize) || 1;
    if (_knowledgePage > totalPages) _knowledgePage = totalPages;

    const startIdx = (_knowledgePage - 1) * _knowledgePageSize;
    const pageSlice = articles.slice(startIdx, startIdx + _knowledgePageSize);

    tbody.innerHTML = pageSlice.map(a => {
      const categoryColor = a.category === 'An toàn Sinh học' ? '#059669' :
        (a.category === 'Sâu bệnh hại' ? '#dc2626' : (a.category === 'Phân bón & Dinh dưỡng' ? '#d97706' : '#2563eb'));
      const categoryBg = a.category === 'An toàn Sinh học' ? '#ecfdf5' :
        (a.category === 'Sâu bệnh hại' ? '#fef2f2' : (a.category === 'Phân bón & Dinh dưỡng' ? '#fffbeb' : '#eff6ff'));

      const priorityBadge = a.priority >= 9 
        ? `<span style="background:#fef2f2; color:#dc2626; font-weight:800; padding:2px 8px; border-radius:6px; font-size:11.5px;">⭐ ${a.priority}</span>`
        : `<span style="background:#f1f5f9; color:#475569; font-weight:700; padding:2px 8px; border-radius:6px; font-size:11.5px;">${a.priority}</span>`;

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 14px; text-align:center;">${priorityBadge}</td>
          <td style="padding:12px 14px;">
            <div style="font-weight:800; color:#0f172a; margin-bottom:4px; font-size:13.5px;">${escapeHtml(a.title)}</div>
            <div style="font-size:12px; color:#64748b; line-height:1.4;">${escapeHtml((a.content || '').slice(0, 110))}...</div>
          </td>
          <td style="padding:12px 14px;">
            <span style="background:${categoryBg}; color:${categoryColor}; font-weight:700; font-size:11.5px; padding:3px 8px; border-radius:6px; display:inline-block;">
              ${escapeHtml(a.category)}
            </span>
          </td>
          <td style="padding:12px 14px; font-size:12px; color:#475569;">
            ${escapeHtml(a.topic_keywords || '—')}
          </td>
          <td style="padding:12px 14px; text-align:center;">
            ${a.is_active 
              ? `<span style="color:#059669; font-weight:700; font-size:12px;"><i data-lucide="check-circle-2" class="lucide-sm"></i> Đang bật</span>` 
              : `<span style="color:#94a3b8; font-weight:600; font-size:12px;"><i data-lucide="pause-circle" class="lucide-sm"></i> Tạm dừng</span>`}
          </td>
          <td style="padding:12px 14px; text-align:center;">
            <div style="display:flex; justify-content:center; gap:6px;">
              <button class="btn-table-action" onclick="openAiKnowledgeModal(${a.id})" title="Chỉnh sửa" style="padding:5px 8px; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#0284c7; cursor:pointer;">
                <i data-lucide="edit" class="lucide-sm"></i>
              </button>
              <button class="btn-table-action" onclick="deleteAiKnowledgeArticle(${a.id})" title="Xóa" style="padding:5px 8px; border-radius:6px; border:1px solid #fee2e2; background:#fff1f2; color:#dc2626; cursor:pointer;">
                <i data-lucide="trash-2" class="lucide-sm"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls({
      containerId: 'ai-knowledge-pagination',
      currentPage: _knowledgePage,
      totalItems: articles.length,
      pageSize: _knowledgePageSize,
      onPageChangeFnName: 'changeAiKnowledgePage'
    });
  }

  window.openAiKnowledgeModal = function(editId) {
    const modal = document.getElementById('ai-knowledge-modal');
    if (!modal) return;

    const titleEl = document.getElementById('ai-k-modal-title');
    const idInput = document.getElementById('ai-k-id');
    const titleInput = document.getElementById('ai-k-title');
    const catSelect = document.getElementById('ai-k-category');
    const kwInput = document.getElementById('ai-k-keywords');
    const priSelect = document.getElementById('ai-k-priority');
    const actCheck = document.getElementById('ai-k-active');
    const contentText = document.getElementById('ai-k-content');
    const hpTrap = document.getElementById('ai-k-hp-trap');

    if (hpTrap) hpTrap.value = ''; // Luôn để trống honeypot

    if (editId) {
      const art = _knowledgeArticles.find(x => x.id === editId);
      if (art) {
        if (titleEl) titleEl.innerText = 'Chỉnh Sửa Tài Liệu Tri Thức SOP';
        if (idInput) idInput.value = art.id;
        if (titleInput) titleInput.value = art.title;
        if (catSelect) catSelect.value = art.category;
        if (kwInput) kwInput.value = art.topic_keywords || '';
        if (priSelect) priSelect.value = art.priority;
        if (actCheck) actCheck.checked = art.is_active;
        if (contentText) contentText.value = art.content;
      }
    } else {
      if (titleEl) titleEl.innerText = 'Thêm Tài Liệu Tri Thức SOP Mới';
      if (idInput) idInput.value = '';
      if (titleInput) titleInput.value = '';
      if (catSelect) catSelect.value = 'An toàn Sinh học';
      if (kwInput) kwInput.value = '';
      if (priSelect) priSelect.value = '5';
      if (actCheck) actCheck.checked = true;
      if (contentText) contentText.value = '';
    }

    modal.style.display = 'flex';
  };

  window.closeAiKnowledgeModal = function() {
    const modal = document.getElementById('ai-knowledge-modal');
    if (modal) modal.style.display = 'none';
  };

  window.saveAiKnowledgeArticle = async function(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('ai-k-id');
    const titleInput = document.getElementById('ai-k-title');
    const catSelect = document.getElementById('ai-k-category');
    const kwInput = document.getElementById('ai-k-keywords');
    const priSelect = document.getElementById('ai-k-priority');
    const actCheck = document.getElementById('ai-k-active');
    const contentText = document.getElementById('ai-k-content');
    const hpTrap = document.getElementById('ai-k-hp-trap');

    const id = idInput ? idInput.value : '';
    const payload = {
      title: titleInput ? titleInput.value.trim() : '',
      category: catSelect ? catSelect.value : 'Kỹ thuật Canh tác',
      topic_keywords: kwInput ? kwInput.value.trim() : '',
      priority: priSelect ? parseInt(priSelect.value, 10) : 5,
      is_active: actCheck ? actCheck.checked : true,
      content: contentText ? contentText.value.trim() : '',
      hp_security_trap: hpTrap ? hpTrap.value : '' // Honeypot
    };

    if (!payload.title || !payload.content) {
      alert('Vui lòng điền đầy đủ Tiêu đề và Nội dung bài viết tri thức.');
      return;
    }

    const btn = document.getElementById('btn-save-ai-knowledge');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...';
    }

    try {
      const url = id ? `/api/ai/training/knowledge/${id}` : '/api/ai/training/knowledge';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        closeAiKnowledgeModal();
        loadAiKnowledgeList();
        loadAiTrainingStats();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể lưu bài viết'));
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save" class="lucide-sm"></i> Lưu Bài Viết Tri Thức';
      }
    }
  };

  window.deleteAiKnowledgeArticle = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết tri thức này? Thao tác này sẽ cập nhật ngay vào mô hình Bé Mầm.')) return;

    try {
      const res = await fetch(`/api/ai/training/knowledge/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        loadAiKnowledgeList();
        loadAiTrainingStats();
      } else {
        alert('Lỗi khi xóa: ' + (data.error || 'Không thể xóa'));
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    }
  };


  // ─────────────────────────────────────────────────────────────
  // 4. HUẤN LUYỆN CẶP Q&A THỰC CHIẾN
  // ─────────────────────────────────────────────────────────────
  window.onAiQaSearchChange = function() {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      _qaPage = 1;
      loadAiQaList();
    }, 300);
  };

  window.changeAiQaPage = function(page) {
    const totalPages = Math.ceil(_qaPairs.length / _qaPageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    _qaPage = page;
    renderQaList(_qaPairs);
  };

  window.loadAiQaList = async function() {
    const container = document.getElementById('ai-qa-list-container');
    if (!container) return;

    const searchInput = document.getElementById('ai-qa-search-input');
    const catSelect = document.getElementById('ai-qa-cat-filter');
    const searchVal = searchInput ? searchInput.value.trim() : '';
    const catVal = catSelect ? catSelect.value : 'all';

    let url = `/api/ai/training/qa?category=${encodeURIComponent(catVal)}`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        _qaPairs = data.qas || [];
        renderQaList(_qaPairs);
      } else {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#dc2626;">Lỗi tải Q&amp;A: ${escapeHtml(data.error)}</div>`;
      }
    } catch (err) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:#dc2626;">Lỗi kết nối máy chủ khi tải Q&amp;A</div>`;
    }
  };

  function renderQaList(qas) {
    const container = document.getElementById('ai-qa-list-container');
    const pagContainer = document.getElementById('ai-qa-pagination');
    if (!container) return;

    if (!qas || qas.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:35px; color:#94a3b8;">Chưa có cặp Q&amp;A nào. Bấm <strong>"+ Thêm Cặp Q&amp;A"</strong> để huấn luyện câu trả lời mẫu cho Bé Mầm!</div>`;
      if (pagContainer) pagContainer.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(qas.length / _qaPageSize) || 1;
    if (_qaPage > totalPages) _qaPage = totalPages;

    const startIdx = (_qaPage - 1) * _qaPageSize;
    const pageSlice = qas.slice(startIdx, startIdx + _qaPageSize);

    container.innerHTML = pageSlice.map(q => {
      const questionLines = (q.sample_questions || '').split('\n').filter(Boolean);
      return `
        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:#eff6ff; color:#0284c7; font-size:11.5px; font-weight:800; padding:3px 10px; border-radius:20px;">
                ${escapeHtml(q.category)}
              </span>
              ${q.is_active ? `<span style="color:#059669; font-size:11.5px; font-weight:700;"><i data-lucide="check-circle-2" class="lucide-sm"></i> Đang kích hoạt</span>` : `<span style="color:#94a3b8; font-size:11.5px;"><i data-lucide="pause-circle" class="lucide-sm"></i> Tạm dừng</span>`}
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" onclick="openAiQaModal(${q.id})" style="padding:4px 10px; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#0284c7; font-size:12px; font-weight:700; cursor:pointer;">
                <i data-lucide="edit" class="lucide-sm"></i> Sửa
              </button>
              <button type="button" onclick="deleteAiQaPair(${q.id})" style="padding:4px 10px; border-radius:6px; border:1px solid #fee2e2; background:#fff1f2; color:#dc2626; font-size:12px; font-weight:700; cursor:pointer;">
                <i data-lucide="trash-2" class="lucide-sm"></i> Xóa
              </button>
            </div>
          </div>

          <!-- Question Variations -->
          <div>
            <div style="font-size:12px; font-weight:800; color:#475569; margin-bottom:4px;">
              ❓ Các mẫu câu hỏi nông dân thường hỏi (${questionLines.length} biến thể):
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${questionLines.map(line => `<span style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-size:12px; font-weight:600; padding:3px 8px; border-radius:6px;">💬 "${escapeHtml(line)}"</span>`).join('')}
            </div>
          </div>

          <!-- Expected Answer -->
          <div style="background:#ffffff; border-left:4px solid #0284c7; border-radius:0 8px 8px 0; padding:12px 14px; font-size:13px; color:#1e293b; line-height:1.5;">
            <div style="font-size:11.5px; font-weight:800; color:#0284c7; margin-bottom:4px;">
              🌱 Câu trả lời chuẩn của Bé Mầm (Phản hồi tức thì 0ms):
            </div>
            ${escapeHtml(q.expected_answer).replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    }).join('');

    renderPaginationControls({
      containerId: 'ai-qa-pagination',
      currentPage: _qaPage,
      totalItems: qas.length,
      pageSize: _qaPageSize,
      onPageChangeFnName: 'changeAiQaPage'
    });
  }

  window.openAiQaModal = function(editId) {
    const modal = document.getElementById('ai-qa-modal');
    if (!modal) return;

    const titleEl = document.getElementById('ai-qa-modal-title');
    const idInput = document.getElementById('ai-qa-id');
    const catSelect = document.getElementById('ai-qa-category');
    const qText = document.getElementById('ai-qa-questions');
    const aText = document.getElementById('ai-qa-answer');
    const kwInput = document.getElementById('ai-qa-keywords');
    const actCheck = document.getElementById('ai-qa-active');
    const hpTrap = document.getElementById('ai-qa-hp-trap');

    if (hpTrap) hpTrap.value = '';

    if (editId) {
      const qa = _qaPairs.find(x => x.id === editId);
      if (qa) {
        if (titleEl) titleEl.innerText = 'Chỉnh Sửa Cặp Q&A Huấn Luyện';
        if (idInput) idInput.value = qa.id;
        if (catSelect) catSelect.value = qa.category;
        if (qText) qText.value = qa.sample_questions;
        if (aText) aText.value = qa.expected_answer;
        if (kwInput) kwInput.value = qa.keywords || '';
        if (actCheck) actCheck.checked = qa.is_active;
      }
    } else {
      if (titleEl) titleEl.innerText = 'Thêm Cặp Q&A Huấn Luyện Mới';
      if (idInput) idInput.value = '';
      if (catSelect) catSelect.value = 'An toàn Sinh học';
      if (qText) qText.value = '';
      if (aText) aText.value = '';
      if (kwInput) kwInput.value = '';
      if (actCheck) actCheck.checked = true;
    }

    modal.style.display = 'flex';
  };

  window.closeAiQaModal = function() {
    const modal = document.getElementById('ai-qa-modal');
    if (modal) modal.style.display = 'none';
  };

  window.saveAiQaPair = async function(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('ai-qa-id');
    const catSelect = document.getElementById('ai-qa-category');
    const qText = document.getElementById('ai-qa-questions');
    const aText = document.getElementById('ai-qa-answer');
    const kwInput = document.getElementById('ai-qa-keywords');
    const actCheck = document.getElementById('ai-qa-active');
    const hpTrap = document.getElementById('ai-qa-hp-trap');

    const id = idInput ? idInput.value : '';
    const payload = {
      category: catSelect ? catSelect.value : 'Hỏi Đáp Thường Gặp',
      sample_questions: qText ? qText.value.trim() : '',
      expected_answer: aText ? aText.value.trim() : '',
      keywords: kwInput ? kwInput.value.trim() : '',
      is_active: actCheck ? actCheck.checked : true,
      hp_security_trap: hpTrap ? hpTrap.value : ''
    };

    if (!payload.sample_questions || !payload.expected_answer) {
      alert('Vui lòng điền đầy đủ Mẫu câu hỏi và Câu trả lời chuẩn.');
      return;
    }

    const btn = document.getElementById('btn-save-ai-qa');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...';
    }

    try {
      const url = id ? `/api/ai/training/qa/${id}` : '/api/ai/training/qa';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        closeAiQaModal();
        loadAiQaList();
        loadAiTrainingStats();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể lưu cặp Q&A'));
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save" class="lucide-sm"></i> Lưu Cặp Q&A';
      }
    }
  };

  window.deleteAiQaPair = async function(id) {
    if (!confirm('Bạn có chắc muốn xóa cặp Q&A này?')) return;

    try {
      const res = await fetch(`/api/ai/training/qa/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        loadAiQaList();
        loadAiTrainingStats();
      } else {
        alert('Lỗi khi xóa: ' + (data.error || 'Không thể xóa'));
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    }
  };


  // ─────────────────────────────────────────────────────────────
  // 5. PHÒNG THỬ NGHIỆM AI SANDBOX (SIMULATOR)
  // ─────────────────────────────────────────────────────────────
  window.setAiTestPrompt = function(promptText) {
    const input = document.getElementById('ai-test-input');
    if (input) {
      input.value = promptText;
      input.focus();
    }
  };

  window.runAiTestSimulation = async function() {
    const input = document.getElementById('ai-test-input');
    const resultBox = document.getElementById('ai-test-result-box');
    const latencyBadge = document.getElementById('ai-test-latency-badge');
    const btn = document.getElementById('btn-run-ai-test');

    const msg = input ? input.value.trim() : '';
    if (!msg) {
      alert('Vui lòng nhập câu hỏi thử nghiệm.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang phân tích...';
    }
    if (resultBox) {
      resultBox.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;"><i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang quét kho tri thức và đối sánh mô hình...</div>';
    }

    try {
      const res = await fetch('/api/ai/training/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify({ message: msg })
      });

      const data = await res.json();
      if (data.success) {
        if (latencyBadge) {
          latencyBadge.style.display = 'inline-block';
          latencyBadge.innerText = `${data.elapsedMs} ms`;
        }

        let outputHtml = `
          <div style="margin-bottom:12px;">
            <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:4px;"><i data-lucide="target" class="lucide-sm"></i> Đề xuất định tuyến &amp; xử lý:</div>
            <div style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700;">
              ${escapeHtml(data.recommendation)}
            </div>
          </div>
        `;

        if (data.matchedQA) {
          outputHtml += `
            <div style="margin-bottom:14px; background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; padding:12px;">
              <div style="font-weight:800; color:#1e40af; font-size:12.5px; margin-bottom:4px;">
                <i data-lucide="check-circle-2" class="lucide-sm"></i> Khớp Cặp Q&amp;A Huấn Luyện (Ưu tiên số 1 - Phản hồi tức thì 0ms):
              </div>
              <div style="font-size:12.5px; color:#1e293b; line-height:1.5; white-space:pre-wrap;">${escapeHtml(data.matchedQA.expectedAnswer)}</div>
            </div>
          `;
        }

        if (data.matchedArticles && data.matchedArticles.length > 0) {
          outputHtml += `
            <div style="margin-bottom:10px;">
              <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:6px;">
                📚 Bài viết tri thức liên quan được chèn vào Prompt:
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${data.matchedArticles.map(art => `
                  <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span style="font-weight:700; color:#0f172a; font-size:12.5px;">${escapeHtml(art.title)}</span>
                      <span style="background:#f1f5f9; color:#475569; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px;">Điểm khớp: ${art.score}</span>
                    </div>
                    <div style="font-size:12px; color:#64748b;">${escapeHtml(art.snippet)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        resultBox.innerHTML = outputHtml;

      } else {
        resultBox.innerHTML = `<div style="color:#dc2626; padding:10px;">Lỗi kiểm thử: ${escapeHtml(data.error)}</div>`;
      }
    } catch (err) {
      resultBox.innerHTML = `<div style="color:#dc2626; padding:10px;">Lỗi kết nối máy chủ: ${escapeHtml(err.message)}</div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="play" class="lucide-sm"></i> Chạy Kiểm Thử Ngay (Run Test)';
      }
    }
  };


  // ─────────────────────────────────────────────────────────────
  // 6. NHẬT KÝ BẢO MẬT & AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────
  window.changeAiLogsPage = function(page) {
    const totalPages = Math.ceil(_securityLogs.length / _logsPageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    _logsPage = page;
    renderSecurityLogsTable(_securityLogs);
  };

  window.loadAiSecurityLogs = async function() {
    const tbody = document.getElementById('ai-security-logs-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/ai/training/logs', {
        headers: { 'Authorization': 'Bearer ' + getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        _securityLogs = data.logs || [];
        renderSecurityLogsTable(_securityLogs);
      } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#dc2626;">Lỗi tải nhật ký: ${escapeHtml(data.error)}</td></tr>`;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#dc2626;">Lỗi kết nối máy chủ khi tải nhật ký</td></tr>`;
    }
  };

  function formatAuditDetails(action, targetType, details) {
    let d = details;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { d = { raw: details }; }
    }
    if (!d || typeof d !== 'object') d = { raw: String(details || '') };

    if (action === 'BLOCKED_BOT') {
      return `<div style="color:#b91c1c; font-weight:700; display:flex; align-items:center; gap:6px;"><i data-lucide="shield-alert" class="lucide-sm"></i> Bẫy Honeypot tự động chặn Bot xâm nhập</div>`;
    }

    if (targetType === 'KNOWLEDGE_ARTICLE') {
      if (action === 'CREATE') {
        return `<div style="font-weight:700; color:#0f172a;">Thêm SOP: "${escapeHtml(d.title || '')}"</div><div style="font-size:11.5px; color:#64748b;">Phân loại: ${escapeHtml(d.category || 'Chung')}</div>`;
      }
      if (action === 'UPDATE') {
        return `<div style="font-weight:700; color:#0f172a;">Cập nhật SOP: "${escapeHtml(d.new || d.title || '')}"</div><div style="font-size:11.5px; color:#64748b;">${d.old ? `Cũ: ${escapeHtml(d.old)}` : ''}</div>`;
      }
      if (action === 'DELETE') {
        return `<div style="font-weight:700; color:#dc2626;"><i data-lucide="trash-2" class="lucide-sm"></i> Xóa SOP: "${escapeHtml(d.title || '')}"</div>`;
      }
    }

    if (targetType === 'TRAINING_QA') {
      if (action === 'CREATE') {
        return `<div style="font-weight:700; color:#0284c7;">Thêm Q&A: [${escapeHtml(d.category || 'Q&A')}]</div><div style="font-size:11.5px; color:#64748b;">"${escapeHtml(d.sample || '')}"</div>`;
      }
      if (action === 'UPDATE') {
        return `<div style="font-weight:700; color:#0284c7;">Cập nhật Q&A: [${escapeHtml(d.category || 'Q&A')}]</div><div style="font-size:11.5px; color:#64748b;">"${escapeHtml(d.sample || '')}"</div>`;
      }
      if (action === 'DELETE') {
        return `<div style="font-weight:700; color:#dc2626;"><i data-lucide="trash-2" class="lucide-sm"></i> Xóa cặp Q&A [${escapeHtml(d.category || 'Q&A')}]</div>`;
      }
    }

    return `<div style="color:#334155; font-size:12px;">${escapeHtml(typeof details === 'object' ? JSON.stringify(details) : String(details || '—'))}</div>`;
  }

  function formatAdminDisplay(l) {
    if (l.admin_display) {
      return `<div style="font-weight:700; color:#0f172a; font-size:12.5px;">${escapeHtml(l.admin_display)}</div>`;
    }
    if (l.admin_name) {
      const publicId = l.admin_public_id || (l.admin_id ? `adm-${l.admin_id}` : 'adm-****');
      return `<div style="font-weight:700; color:#0f172a; font-size:12.5px;">${escapeHtml(l.admin_name)}</div><div style="font-size:11px; color:#64748b;">${escapeHtml(publicId)}</div>`;
    }
    return '<span style="color:#64748b; font-size:12px;"><i data-lucide="shield-check" class="lucide-sm"></i> Quản trị viên (adm-****)</span>';
  }

  function formatIpBadge(ip) {
    if (!ip) return '<span style="color:#94a3b8; font-family:monospace; font-size:11.5px;">127.0.0.1</span>';
    const isInternal = ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.0.') || ip.startsWith('172.');
    if (isInternal) {
      return `<span style="font-family:monospace; background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px; font-size:11.5px;" title="IP Cân bằng tải / Proxy nội bộ Render"><i data-lucide="network" class="lucide-sm"></i> ${escapeHtml(ip)} <small style="color:#94a3b8;">(Proxy)</small></span>`;
    }
    return `<span style="font-family:monospace; background:#ecfdf5; color:#059669; font-weight:700; padding:3px 8px; border-radius:6px; font-size:11.5px;" title="IP Công Khai Của Quản Trị Viên"><i data-lucide="globe" class="lucide-sm"></i> ${escapeHtml(ip)}</span>`;
  }

  function renderSecurityLogsTable(logs) {
    const tbody = document.getElementById('ai-security-logs-tbody');
    const pagContainer = document.getElementById('ai-security-logs-pagination');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:35px; color:#94a3b8;">Chưa có sự kiện bảo mật nào được ghi nhận.</td></tr>`;
      if (pagContainer) pagContainer.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(logs.length / _logsPageSize) || 1;
    if (_logsPage > totalPages) _logsPage = totalPages;

    const startIdx = (_logsPage - 1) * _logsPageSize;
    const pageSlice = logs.slice(startIdx, startIdx + _logsPageSize);

    tbody.innerHTML = pageSlice.map(l => {
      const actionBadge = l.action === 'CREATE' 
        ? `<span style="background:#ecfdf5; color:#059669; font-weight:800; font-size:11px; padding:3px 8px; border-radius:6px;">TẠO MỚI</span>`
        : (l.action === 'UPDATE' 
          ? `<span style="background:#eff6ff; color:#0284c7; font-weight:800; font-size:11px; padding:3px 8px; border-radius:6px;">CẬP NHẬT</span>`
          : (l.action === 'DELETE' 
            ? `<span style="background:#fef2f2; color:#dc2626; font-weight:800; font-size:11px; padding:3px 8px; border-radius:6px;">XÓA BỎ</span>`
            : `<span style="background:#fff1f2; color:#b91c1c; font-weight:900; font-size:11px; padding:3px 8px; border-radius:6px;"><i data-lucide="shield-alert" class="lucide-sm"></i> CHẶN BOT</span>`));

      const timeFormatted = new Date(l.created_at).toLocaleString('vi-VN');

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 14px; font-size:12px; color:#64748b; white-space:nowrap;">${timeFormatted}</td>
          <td style="padding:12px 14px; text-align:center;">${actionBadge}</td>
          <td style="padding:12px 14px; font-weight:700; color:#0f172a; font-size:12.5px;">${escapeHtml(l.target_type)}</td>
          <td style="padding:12px 14px; font-size:12.5px; line-height:1.4;">
            ${formatAuditDetails(l.action, l.target_type, l.details)}
          </td>
          <td style="padding:12px 14px;">
            ${formatAdminDisplay(l)}
          </td>
          <td style="padding:12px 14px; text-align:center;">
            ${formatIpBadge(l.ip_address)}
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls({
      containerId: 'ai-security-logs-pagination',
      currentPage: _logsPage,
      totalItems: logs.length,
      pageSize: _logsPageSize,
      onPageChangeFnName: 'changeAiLogsPage'
    });
  }

})();
