    let plantData = null;

    const LEGACY_LABOR_ALIASES = ['Nhân công', 'Cắt lá', 'Cắt tỉa', 'Cắt cành', 'Tỉa cành/lá', 'Tỉa hoa', 'Tỉa quả', 'Tỉa quả/hoa', 'Thụ phấn', 'Làm cỏ'];
    const BASE_REPORT_CATEGORIES = [
      { value: 'Kiểm toán quả', label: 'Kiểm toán quả (Đậu quả → Quả non → Quả chín)' },
      { value: 'Phun thuốc', label: 'Phun thuốc BVTV & Kiểm soát PHI' },
      { value: 'Bón phân', label: 'Bón phân & Dinh dưỡng cây trồng' },
      { value: 'Tưới nước', label: 'Tưới nước & Điều tiết ẩm độ' },
      { value: 'Nhân công', label: 'Thuê nhân công & Cắt tỉa vườn' },
      { value: 'Bệnh cây', label: 'Theo dõi bệnh cây & Dịch hại' },
      { value: 'Thu hoạch', label: 'Thu hoạch & Đối soát sản lượng' }
    ];

    let _activeReportConfig = {
      fromDate: '',
      toDate: '',
      checkedCats: BASE_REPORT_CATEGORIES.map(c => c.value),
      standard: 'vietgap_globalgap_iso',
      explicitCats: false
    };

    function isReportFruitAuditLog(logOrType) {
      if (!logOrType) return false;
      const lt = typeof logOrType === 'string' ? logOrType : (logOrType.log_type || '');
      const norm = String(lt).trim().toLowerCase();
      if (norm === 'kiểm toán quả' || norm === 'kiểm đếm quả' || norm === 'fruit_audit' || norm === 'fruit audit' || norm.startsWith('kiểm toán quả')) {
        return true;
      }
      if (typeof logOrType === 'object' && logOrType.details && (logOrType.details.audit_stage || logOrType.details.fruit_stage) && norm !== 'thu hoạch') {
        return true;
      }
      return false;
    }

    function toReportLocalYmd(dVal) {
      if (!dVal) return '';
      const s = String(dVal).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/i.test(s)) return s.slice(0, 10);
      const d = new Date(dVal);
      if (isNaN(d.getTime())) return s.slice(0, 10);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function matchesReportCategory(checkedCats, logOrType) {
      if (!checkedCats) return true;
      if (checkedCats.length === 0) return false;
      const logType = typeof logOrType === 'string' ? logOrType : (logOrType?.log_type || '');
      if (checkedCats.includes(logType)) return true;
      if (checkedCats.includes('Kiểm toán quả') && isReportFruitAuditLog(logOrType)) return true;
      if (checkedCats.includes('Nhân công') && LEGACY_LABOR_ALIASES.includes(logType)) return true;
      return false;
    }

    function trReportTerm(text) {
      if (!text) return text;
      if (typeof window !== 'undefined' && window.PlantBookI18n && typeof window.PlantBookI18n.translateDynamicTerm === 'function') {
        const lang = window.PlantBookI18n.getLanguage ? window.PlantBookI18n.getLanguage() : 'vi';
        if (lang && lang !== 'vi') {
          return window.PlantBookI18n.translateDynamicTerm(String(text), lang);
        }
      }
      return String(text);
    }

    function enrichReportLogsWithFruitAuditChain(logs) {
      if (!Array.isArray(logs) || logs.length === 0) return logs || [];
      const chain = logs.filter(l => l && (l.log_type === 'Kiểm toán quả' || l.log_type === 'Thu hoạch'));
      chain.sort((a, b) => {
        const dA = a.log_date ? new Date(a.log_date).toISOString().slice(0, 10) : '';
        const dB = b.log_date ? new Date(b.log_date).toISOString().slice(0, 10) : '';
        if (dA !== dB) return dA.localeCompare(dB);
        const tA = (a.details?.audit_time || a.details?.performed_at || a.created_at || '');
        const tB = (b.details?.audit_time || b.details?.performed_at || b.created_at || '');
        if (tA !== tB) return String(tA).localeCompare(String(tB));
        return (a.id || 0) - (b.id || 0);
      });
      let lastAudit = null;
      for (const l of chain) {
        if (!l.details || typeof l.details !== 'object') l.details = {};
        const d = l.details;
        const dDateIso = l.log_date ? new Date(l.log_date).toISOString().slice(0, 10) : '';
        if (l.log_type === 'Kiểm toán quả') {
          const stage = d.audit_stage || d.fruit_stage || 'Đậu quả';
          const cnt = parseInt(d.fruit_count ?? d.amount, 10);
          if (!isNaN(cnt)) {
            if (lastAudit) {
              const delta = cnt - lastAudit.count;
              const pct = lastAudit.count > 0 ? Number(((delta / lastAudit.count) * 100).toFixed(1)) : 0;
              const label = delta < 0 ? `Suy giảm ${Math.abs(delta)} quả (${pct}%)` : (delta > 0 ? `Tăng ${delta} quả (+${pct}%)` : 'Giữ nguyên số quả (0%)');
              d.prev_stage = lastAudit.stage;
              d.prev_fruit_count = lastAudit.count;
              d.prev_log_date = lastAudit.dateIso;
              d.delta_count = delta;
              d.delta_pct = pct;
              d.comparison_text = `${lastAudit.stage} (${formatDate(lastAudit.dateIso)}): ${lastAudit.count} quả → ${stage} (${formatDate(dDateIso)}): ${cnt} quả (${label})`;
            } else {
              d.comparison_text = d.comparison_text || `Khởi tạo mốc ${stage} (${formatDate(dDateIso)}): ${cnt} quả`;
            }
            lastAudit = { stage, count: cnt, dateIso: dDateIso };
          }
        } else if (l.log_type === 'Thu hoạch') {
          const hCount = parseInt(d.fruit_count, 10);
          if (lastAudit && !isNaN(hCount) && hCount > 0) {
            const delta = hCount - lastAudit.count;
            const pct = lastAudit.count > 0 ? Number(((delta / lastAudit.count) * 100).toFixed(1)) : 0;
            const label = delta < 0 ? `Suy giảm ${Math.abs(delta)} quả (${pct}%)` : (delta > 0 ? `Tăng ${delta} quả (+${pct}%)` : 'Khớp 100% số quả');
            d.prev_audit_stage = lastAudit.stage;
            d.prev_audit_count = lastAudit.count;
            d.prev_audit_date = lastAudit.dateIso;
            d.harvest_delta_count = delta;
            d.harvest_delta_pct = pct;
            d.harvest_comparison_text = `So với Kiểm toán ${lastAudit.stage} (${formatDate(lastAudit.dateIso)}: ${lastAudit.count} quả): Thu hoạch ${hCount} quả (${label})`;
          }
        }
      }
      return logs;
    }

    function esc(s) {
      if (s === undefined || s === null) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatDate(d) {
      if (!d) return '—';
      const s = String(d);
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
      const dateObj = new Date(d);
      return !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : s;
    }

    function formatTime(d) {
      if (!d) return '';
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function formatReportLogTime(log) {
      if (!log) return '';
      const d = (log.details && typeof log.details === 'object') ? log.details : {};
      if (d.audit_time && /^\d{1,2}:\d{2}/.test(String(d.audit_time))) {
        return String(d.audit_time).slice(0, 5);
      }
      const raw = d.performed_at || log.created_at;
      if (raw) {
        const dt = new Date(raw);
        if (!isNaN(dt.getTime())) {
          const hh = String(dt.getHours()).padStart(2, '0');
          const mm = String(dt.getMinutes()).padStart(2, '0');
          if (hh !== '00' || mm !== '00') return `${hh}:${mm}`;
        }
      }
      return '';
    }

    function getReportOperatorName(log) {
      if (!log) return 'Kỹ thuật viên trang trại';
      const d = (log.details && typeof log.details === 'object') ? log.details : {};
      return log.operator_name || log.creator_name || d.operator_name || 'Kỹ thuật viên trang trại';
    }

    function computeReportTreeAge(plant) {
      if (!plant) return '—';
      if (plant.plant_age) return plant.plant_age;
      if (!plant.planting_date) return '—';
      const planted = new Date(plant.planting_date);
      if (isNaN(planted.getTime())) return '—';
      const years = (Date.now() - planted.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (years < 1) {
        const months = Math.max(1, Math.round(years * 12));
        return `${months} tháng tuổi`;
      }
      return `${years.toFixed(1)} năm tuổi`;
    }

    function computeReportPhiStatus(logs, farmSupplies) {
      const now = Date.now();
      let maxExpiryMs = 0;
      let lastPestName = '';
      const supplyMap = new Map();
      (farmSupplies || []).forEach(s => {
        if (s && s.name) supplyMap.set(String(s.name).trim().toLowerCase(), s);
      });

      (logs || []).forEach(log => {
        if (!log || log.log_type !== 'Phun thuốc') return;
        const d = (log.details && typeof log.details === 'object') ? log.details : {};
        const pName = (d.supply_name || d.pesticide_name || d.pesticide || d.material_name || d.name || '').trim();
        const linkedSup = pName ? supplyMap.get(pName.toLowerCase()) : null;
        const phiDays = parseInt(d.phi_days ?? d.phi ?? (linkedSup && linkedSup.phi_days), 10) || 14;
        const logDt = new Date(log.log_date || log.created_at);
        if (!isNaN(logDt.getTime())) {
          const expMs = logDt.getTime() + phiDays * 24 * 60 * 60 * 1000;
          if (expMs > maxExpiryMs) {
            maxExpiryMs = expMs;
            lastPestName = pName || 'Thuốc BVTV';
          }
        }
      });

      if (!maxExpiryMs) {
        return { isSafe: true, daysRemaining: 0, text: 'An Toàn Thu Hoạch (0 ngày cách ly PHI)' };
      }
      const diffDays = Math.ceil((maxExpiryMs - now) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        return { isSafe: false, daysRemaining: diffDays, text: `Cách ly PHI: Còn ${diffDays} ngày (${lastPestName})` };
      }
      return { isSafe: true, daysRemaining: 0, text: `An Toàn Thu Hoạch (Đã qua PHI: ${lastPestName})` };
    }

    function getLogDetailsText(log) {
      const details = (log && log.details && typeof log.details === 'object') ? log.details : {};
      const qty = details.quantity ?? details.amount ?? details.qty ?? details.dosage ?? details.volume ?? details.water_volume ?? '';
      if (log.log_type === 'Tưới nước') {
        const wQty = details.water_liters ? `${details.water_liters} Lít` : (qty ? `${qty} ${details.unit || 'm³'}` : 'Định mức chuẩn');
        return `Phương pháp: ${esc(details.method || log.equipment_used || 'Tự động')} | Lượng nước: ${esc(wQty)}`;
      }
      if (log.log_type === 'Bón phân') {
        const fName = details.supply_name || details.fertilizer_name || details.fertilizer || details.material_name || details.name || '—';
        const fQty = qty ? `${qty} ${details.unit || 'kg'}` : '—';
        return `Phân bón: ${esc(fName)} | Loại: ${esc(details.type || details.method || '—')} | Lượng bón: ${esc(fQty)}`;
      }
      if (log.log_type === 'Phun thuốc') {
        const pName = details.supply_name || details.pesticide_name || details.pesticide || details.material_name || details.name || '—';
        const parts = [
          `Thuốc BVTV: ${esc(pName)}`,
          `Loại: ${esc(details.type || details.method || '—')}`,
          `Liều lượng: ${esc(qty ? `${qty} ${details.unit || ''}`.trim() : '—')}`
        ];
        if (details.active_ingredient) parts.push(`Hoạt chất: ${esc(details.active_ingredient)}`);
        if (details.phi_days || details.phi) parts.push(`Cách ly PHI: ${esc(details.phi_days || details.phi)} ngày`);
        if (details.reason) parts.push(`Đối tượng: ${esc(details.reason)}`);
        return parts.join(' | ');
      }
      if (log.log_type === 'Nhân công') {
        const workContent = details.work_content || details.reason || 'Chăm sóc vườn';
        const workers = details.worker_count || details.workers_count || details.amount || 1;
        return `Công việc: ${esc(workContent)} | Số công: ${esc(workers)} người`;
      }
      if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
        return `Số cành/lá cắt tỉa: ${esc(qty || '—')} | Lý do: ${esc(details.reason || '—')}`;
      }
      if (log.log_type === 'Tỉa hoa') {
        return `Số bông/trái tỉa bớt: ${esc(qty || '—')} | Lý do: ${esc(details.reason || '—')}`;
      }
      if (log.log_type === 'Bệnh cây') {
        return `Bệnh: ${esc(details.disease_name || 'Bệnh chưa xác định')} | Mức độ: ${esc(details.severity || '—')} | Mô tả: ${esc(details.description || details.treatment || '—')}`;
      }
      if (log.log_type === 'Kiểm toán quả') {
        const stage = details.audit_stage || details.fruit_stage || 'Đậu quả';
        const cnt = details.fruit_count !== undefined ? details.fruit_count : (details.amount || 0);
        const culled = details.dropped_or_culled_count !== undefined ? details.dropped_or_culled_count : 0;
        const timePart = details.audit_time ? ` (${esc(details.audit_time)})` : '';
        const culledPart = culled > 0 ? ` | Rụng/Tỉa bỏ: ${esc(culled)} quả` : '';
        const cmpPart = details.comparison_text ? ` | Đối chiếu: ${esc(details.comparison_text)}` : '';
        const reasonPart = details.reason ? ` | Nguyên nhân: ${esc(details.reason)}` : '';
        return `Giai đoạn: ${esc(stage)}${timePart} | Số quả: ${esc(cnt)} quả${culledPart}${cmpPart}${reasonPart}`;
      }
      if (log.log_type === 'Thu hoạch') {
        const yieldVal = details.amount || details.yield_kg || '—';
        const yieldUnit = details.unit || 'kg';
        const fruitPart = details.fruit_count ? ` (${esc(details.fruit_count)} quả)` : '';
        const qualityVal = details.quality || details.grade || 'Đạt chuẩn';
        const batchVal = log.batch_code || details.batch_code || '—';
        const cmpPart = details.harvest_comparison_text ? ` | ${esc(details.harvest_comparison_text)}` : '';
        return `Sản lượng: ${esc(yieldVal)} ${esc(yieldUnit)}${fruitPart} | Chất lượng: ${esc(qualityVal)} | Mã lô: ${esc(batchVal)}${cmpPart}`;
      }
      return details.method ? `${esc(details.method)}${qty ? ' (' + esc(qty) + ')' : ''}` : '';
    }

    function getReportStandardLabel(code) {
      if (code === 'vietgap') return 'Tiêu chuẩn áp dụng: VietGAP Trồng Trọt (TCVN 11892-1:2017) · ISO 22005:2007';
      if (code === 'globalgap_gacc') return 'Tiêu chuẩn áp dụng: GlobalG.A.P. IFA v6.0 · Nghị định thư GACC · ISO 22005:2007';
      return 'Tiêu chuẩn áp dụng: VietGAP (TCVN 11892-1:2017) · GlobalG.A.P. (IFA v6.0) · ISO 22005:2007';
    }

    function copyReportLink() {
      const btn = document.getElementById('btn-copy-link');
      if (!btn) return;
      navigator.clipboard.writeText(window.location.href).then(() => {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" class="lucide-sm"></i> Đã sao chép!';
        btn.style.borderColor = 'var(--green-primary)';
        btn.style.color = 'var(--green-primary)';

        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.style.borderColor = 'var(--border-gray)';
          btn.style.color = 'var(--text-secondary)';
        }, 2000);
      }).catch(err => {
        console.error('Không thể sao chép liên kết:', err);
      });
    }

    function getReportTargetSlug() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('slug')) return urlParams.get('slug');
      if (urlParams.get('nfc_uid')) return urlParams.get('nfc_uid');
      if (urlParams.get('plant_id')) return urlParams.get('plant_id');

      const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
      const reportIdx = pathParts.indexOf('report');
      if (reportIdx > 0) {
        return decodeURIComponent(pathParts[reportIdx - 1]);
      }
      if (pathParts.length >= 2) {
        return decodeURIComponent(pathParts[pathParts.length - 1]);
      }
      return '';
    }

    function filterReportLogsByConfig(logs, config) {
      const cfg = config || _activeReportConfig;
      const checkedCats = cfg.explicitCats ? (cfg.checkedCats || []) : null;
      const fromDate = cfg.fromDate || '';
      const toDate = cfg.toDate || '';
      const filtered = (logs || []).filter(log => {
        const rawDt = log.log_date || log.created_at;
        const logDateStr = toReportLocalYmd(rawDt);
        const isWithinDate = (!fromDate || !logDateStr || logDateStr >= fromDate) && (!toDate || !logDateStr || logDateStr <= toDate);
        const isMatchedCat = !checkedCats || matchesReportCategory(checkedCats, log);
        return isWithinDate && isMatchedCat;
      });
      filtered.sort((a, b) => new Date(a.log_date || a.created_at) - new Date(b.log_date || b.created_at));
      return filtered;
    }

    function buildReportCsvString(filteredLogs, config) {
      const cfg = config || _activeReportConfig;
      const stdText = getReportStandardLabel(cfg.standard);
      const headers = [
        'STT',
        'Tiêu Chuẩn Áp Dụng',
        'Mã Số Cây',
        'Loại Cây',
        'Giống Cây',
        'Mã Vùng Trồng (PUC)',
        'Chứng Nhận VietGAP',
        'Trang Trại',
        'Địa Chỉ Trang Trại',
        'Ngày Thực Hiện',
        'Giờ Thực Hiện',
        'Hạng Mục Canh Tác',
        'Chi Tiết Kỹ Thuật / Vật Tư / Kiểm Toán Quả',
        'Thiết Bị Sử Dụng',
        'Mã Lô Canh Tác',
        'Người Thực Hiện',
        'Ghi Chú',
        'Minh Chứng Thực Địa'
      ].map(trReportTerm);

      function escapeCsvCell(val) {
        if (val === null || val === undefined) return '""';
        let raw = String(val);
        if (/^[=+\-@\t\r]/.test(raw)) {
          raw = "'" + raw;
        }
        const str = raw.replace(/"/g, '""');
        return `"${str}"`;
      }

      const rows = [];
      rows.push(headers.map(escapeCsvCell).join(','));

      filteredLogs.forEach((log, index) => {
        const detailsText = trReportTerm(getLogDetailsText(log).replace(/<[^>]*>/g, ''));
        const mediaUrls = (log.media_urls && Array.isArray(log.media_urls))
          ? log.media_urls.map(m => m.url || m).join('; ')
          : '';
        const timeStr = formatReportLogTime(log) || '—';

        const row = [
          index + 1,
          stdText,
          plantData.tree_code || plantData.id || '',
          trReportTerm(plantData.plant_type || ''),
          plantData.plant_variety || '',
          plantData.puc_code || '',
          plantData.vietgap_cert_number || '',
          plantData.farm_name || '',
          plantData.farm_address || '',
          formatDate(log.log_date || log.created_at),
          timeStr,
          trReportTerm(log.log_type || ''),
          detailsText,
          log.equipment_used || '',
          log.batch_code || '',
          getReportOperatorName(log),
          log.note || '',
          mediaUrls
        ];
        rows.push(row.map(escapeCsvCell).join(','));
      });

      return '\uFEFF' + rows.join('\r\n');
    }

    function exportReportCsv(overrideLogs, overrideConfig) {
      if (!plantData) {
        alert('Dữ liệu báo cáo chưa sẵn sàng.');
        return null;
      }
      const logs = enrichReportLogsWithFruitAuditChain(plantData.logs || []);
      const filteredLogs = Array.isArray(overrideLogs)
        ? overrideLogs
        : filterReportLogsByConfig(logs, overrideConfig || _activeReportConfig);

      if (filteredLogs.length === 0) {
        alert('Không có nhật ký canh tác nào phù hợp với hạng mục và khoảng thời gian đã chọn.');
        return null;
      }

      const csvContent = buildReportCsvString(filteredLogs, overrideConfig || _activeReportConfig);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanPlantType = (plantData.plant_type || 'Cay').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
      const cleanTreeCode = (plantData.tree_code || plantData.id || 'Tree').toString().replace(/[^a-zA-Z0-9_]/g, '_');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `BaoCaoVietGAP_GlobalGAP_${cleanPlantType}_${cleanTreeCode}_${dateSuffix}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return csvContent;
    }
    window.exportReportCsv = exportReportCsv;

    function getAllAvailableReportCategories() {
      const cats = BASE_REPORT_CATEGORIES.map(c => ({ ...c }));
      const knownValues = new Set(cats.map(c => c.value));
      ((plantData && plantData.logs) || []).forEach(l => {
        if (l && l.log_type && !knownValues.has(l.log_type) && !LEGACY_LABOR_ALIASES.includes(l.log_type)) {
          knownValues.add(l.log_type);
          cats.push({ value: l.log_type, label: l.log_type });
        }
      });
      return cats;
    }

    function countLogsForCategory(catValue) {
      const logs = (plantData && plantData.logs) || [];
      return logs.filter(l => matchesReportCategory([catValue], l)).length;
    }

    function openReportConfigModal(defaultMode) {
      if (!plantData) {
        alert('Dữ liệu cây trồng đang được tải. Vui lòng đợi giây lát.');
        return;
      }
      const grid = document.getElementById('report-cfg-categories-grid');
      const fromEl = document.getElementById('report-cfg-from');
      const toEl = document.getElementById('report-cfg-to');
      const stdEl = document.getElementById('report-cfg-standard');
      const titleEl = document.getElementById('report-cfg-modal-title');

      if (titleEl) {
        if (defaultMode === 'csv') titleEl.textContent = 'Chọn Hạng Mục Canh Tác Trước Khi Xuất CSV (Excel)';
        else if (defaultMode === 'print') titleEl.textContent = 'Chọn Hạng Mục Canh Tác Trước Khi In / Tải PDF';
        else titleEl.textContent = 'Cấu Hình Hạng Mục Xuất Báo Cáo';
      }

      if (fromEl) fromEl.value = _activeReportConfig.fromDate || '';
      if (toEl) toEl.value = _activeReportConfig.toDate || '';
      if (stdEl && _activeReportConfig.standard) stdEl.value = _activeReportConfig.standard;

      if (grid) {
        const cats = getAllAvailableReportCategories();
        const activeSet = new Set(_activeReportConfig.checkedCats || []);
        grid.innerHTML = cats.map(c => {
          const cnt = countLogsForCategory(c.value);
          const checkedAttr = (!_activeReportConfig.explicitCats || activeSet.has(c.value)) ? 'checked' : '';
          return `
            <label class="report-cfg-cat-item">
              <span style="display:flex; align-items:center; gap:7px; min-width:0;">
                <input type="checkbox" name="report_cfg_cat" value="${esc(c.value)}" ${checkedAttr} onchange="updateReportConfigMatchCount()">
                <span>${esc(c.label)}</span>
              </span>
              <span class="report-cfg-cat-count">${cnt}</span>
            </label>
          `;
        }).join('');
      }

      updateReportConfigMatchCount();
      const modal = document.getElementById('report-export-config-modal');
      if (modal) modal.style.display = 'flex';
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      if (window.PlantBookI18n && typeof window.PlantBookI18n.applyDomTranslations === 'function') {
        window.PlantBookI18n.applyDomTranslations();
      }
    }
    window.openReportConfigModal = openReportConfigModal;

    function closeReportConfigModal() {
      const modal = document.getElementById('report-export-config-modal');
      if (modal) modal.style.display = 'none';
    }
    window.closeReportConfigModal = closeReportConfigModal;

    function readReportConfigFromModal() {
      const fromEl = document.getElementById('report-cfg-from');
      const toEl = document.getElementById('report-cfg-to');
      const stdEl = document.getElementById('report-cfg-standard');
      const checkedCats = [];
      document.querySelectorAll('#report-cfg-categories-grid input[name="report_cfg_cat"]:checked').forEach(cb => {
        checkedCats.push(cb.value);
      });
      return {
        fromDate: fromEl ? fromEl.value : '',
        toDate: toEl ? toEl.value : '',
        checkedCats,
        standard: stdEl ? stdEl.value : 'vietgap_globalgap_iso',
        explicitCats: true
      };
    }

    function updateReportConfigMatchCount() {
      const banner = document.getElementById('report-cfg-match-count');
      if (!banner || !plantData) return 0;
      const cfg = readReportConfigFromModal();
      const logs = enrichReportLogsWithFruitAuditChain(plantData.logs || []);
      const matched = filterReportLogsByConfig(logs, cfg);
      if (cfg.checkedCats.length === 0) {
        banner.textContent = 'Vui lòng chọn ít nhất 1 hạng mục canh tác để xuất báo cáo.';
        banner.style.background = '#fef2f2';
        banner.style.borderColor = '#fecaca';
        banner.style.color = '#991b1b';
        return 0;
      }
      banner.style.background = '#ecfdf5';
      banner.style.borderColor = '#a7f3d0';
      banner.style.color = '#065f46';
      banner.textContent = `Đã chọn ${cfg.checkedCats.length} hạng mục · Sẵn sàng xuất ${matched.length} nhật ký canh tác đạt chuẩn VietGAP / GlobalG.A.P.`;
      return matched.length;
    }
    window.updateReportConfigMatchCount = updateReportConfigMatchCount;

    function selectReportConfigCategoriesPreset(preset) {
      const boxes = document.querySelectorAll('#report-cfg-categories-grid input[name="report_cfg_cat"]');
      boxes.forEach(cb => {
        if (preset === 'all') cb.checked = true;
        else if (preset === 'none') cb.checked = false;
        else if (preset === 'fruit_audit') cb.checked = (cb.value === 'Kiểm toán quả' || cb.value === 'Thu hoạch');
        else if (preset === 'phi_safety') cb.checked = (cb.value === 'Phun thuốc' || cb.value === 'Bón phân' || cb.value === 'Bệnh cây');
      });
      updateReportConfigMatchCount();
    }
    window.selectReportConfigCategoriesPreset = selectReportConfigCategoriesPreset;

    function setReportConfigDatePreset(preset) {
      const fromEl = document.getElementById('report-cfg-from');
      const toEl = document.getElementById('report-cfg-to');
      if (!fromEl || !toEl) return;
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      if (preset === 'all') {
        fromEl.value = '';
        toEl.value = '';
      } else if (preset === '30d') {
        const d = new Date(today.getTime() - 30 * 86400000);
        fromEl.value = d.toISOString().slice(0, 10);
        toEl.value = todayIso;
      } else if (preset === '90d') {
        const d = new Date(today.getTime() - 90 * 86400000);
        fromEl.value = d.toISOString().slice(0, 10);
        toEl.value = todayIso;
      } else if (preset === 'year') {
        fromEl.value = `${today.getFullYear()}-01-01`;
        toEl.value = todayIso;
      }
      updateReportConfigMatchCount();
    }
    window.setReportConfigDatePreset = setReportConfigDatePreset;

    function applyReportConfigPreview() {
      const cfg = readReportConfigFromModal();
      if (cfg.checkedCats.length === 0) {
        alert('Vui lòng chọn ít nhất một hạng mục canh tác cần xuất.');
        return false;
      }
      _activeReportConfig = cfg;
      renderReportView();
      closeReportConfigModal();
      return true;
    }
    window.applyReportConfigPreview = applyReportConfigPreview;

    function confirmExportReportCsv() {
      const cfg = readReportConfigFromModal();
      if (cfg.checkedCats.length === 0) {
        alert('Vui lòng chọn ít nhất một hạng mục canh tác cần xuất.');
        return false;
      }
      _activeReportConfig = cfg;
      renderReportView();
      const csvOut = exportReportCsv(null, cfg);
      if (csvOut) closeReportConfigModal();
      return Boolean(csvOut);
    }
    window.confirmExportReportCsv = confirmExportReportCsv;

    function confirmPrintReport() {
      const ok = applyReportConfigPreview();
      if (!ok) return false;
      setTimeout(() => {
        if (typeof window.print === 'function') window.print();
      }, 180);
      return true;
    }
    window.confirmPrintReport = confirmPrintReport;

    function renderReportView() {
      if (!plantData) return;
      const now = new Date();
      const timeEl = document.getElementById('report-time');
      if (timeEl) timeEl.textContent = `Trích xuất lúc: ${formatDate(now)} ${formatTime(now)}`;

      const stdSubEl = document.getElementById('report-standard-subtitle');
      if (stdSubEl) stdSubEl.textContent = getReportStandardLabel(_activeReportConfig.standard);

      document.getElementById('plant-id').textContent = `#${plantData.tree_code || plantData.id}`;
      document.getElementById('plant-type').textContent = plantData.plant_type || '—';
      document.getElementById('plant-variety').textContent = plantData.plant_variety || '—';
      document.getElementById('plant-age').textContent = computeReportTreeAge(plantData);
      document.getElementById('plant-location').textContent = plantData.location || plantData.plot_code || '—';
      document.getElementById('plant-farm').textContent = plantData.farm_name || '—';

      const pucEl = document.getElementById('plant-puc-code');
      if (pucEl) pucEl.textContent = plantData.puc_code || 'Chưa cấp mã PUC';
      const certEl = document.getElementById('plant-vietgap-cert');
      if (certEl) certEl.textContent = plantData.vietgap_cert_number ? `${plantData.vietgap_cert_number}${plantData.vietgap_cert_org ? ' (' + plantData.vietgap_cert_org + ')' : ''}` : 'TCVN 11892-1:2017 / GlobalG.A.P.';
      const nfcEl = document.getElementById('plant-nfc-uid');
      if (nfcEl) nfcEl.textContent = plantData.nfc_uid || 'Chưa gắn thẻ NFC';

      const hasCoords = plantData.latitude && plantData.longitude;
      document.getElementById('plant-gps').textContent = hasCoords
        ? `${Number(plantData.latitude).toFixed(6)}, ${Number(plantData.longitude).toFixed(6)}`
        : '—';

      const logs = enrichReportLogsWithFruitAuditChain(plantData.logs || []);
      const phi = computeReportPhiStatus(logs, plantData.farm_supplies);
      const phiEl = document.getElementById('plant-phi-status');
      if (phiEl) {
        phiEl.textContent = phi.text;
        phiEl.classList.toggle('is-quarantine', !phi.isSafe);
      }

      const filteredLogs = filterReportLogsByConfig(logs, _activeReportConfig);

      const statsStrip = document.getElementById('report-stats-strip');
      if (statsStrip) {
        const countByCat = new Map();
        filteredLogs.forEach(l => {
          const catKey = LEGACY_LABOR_ALIASES.includes(l.log_type) ? 'Nhân công' : (l.log_type || 'Khác');
          countByCat.set(catKey, (countByCat.get(catKey) || 0) + 1);
        });
        const totalCard = `<div class="report-stat-card"><div class="report-stat-val">${filteredLogs.length}</div><div class="report-stat-lbl">Tổng bản ghi xuất</div></div>`;
        const catCards = Array.from(countByCat.entries()).map(([cat, cnt]) => {
          const lbl = cat === 'Nhân công' ? 'Thuê nhân công' : cat;
          return `<div class="report-stat-card"><div class="report-stat-val">${cnt}</div><div class="report-stat-lbl">${esc(lbl)}</div></div>`;
        }).join('');
        statsStrip.innerHTML = totalCard + catCards;
      }

      const auditChainBox = document.getElementById('report-fruit-audit-chain');
      if (auditChainBox) {
        const auditItems = filteredLogs.filter(l => l.log_type === 'Kiểm toán quả' || l.log_type === 'Thu hoạch');
        const chainLines = auditItems
          .map(l => {
            const txt = (l.details && (l.details.comparison_text || l.details.harvest_comparison_text)) || '';
            if (!txt) return '';
            return `<div class="report-audit-step"><strong>${esc(formatDate(l.log_date))} (${esc(l.log_type)}):</strong> ${esc(txt)}</div>`;
          })
          .filter(Boolean);
        if (chainLines.length > 0) {
          auditChainBox.style.display = 'block';
          auditChainBox.innerHTML = `<div class="report-audit-chain-title">Chuỗi Theo Dõi Kiểm Toán Quả &amp; Đối Soát Thu Hoạch (${chainLines.length} mốc)</div>${chainLines.join('')}`;
        } else {
          auditChainBox.style.display = 'none';
          auditChainBox.innerHTML = '';
        }
      }

      const activeCatLabels = _activeReportConfig.explicitCats && _activeReportConfig.checkedCats.length > 0
        ? _activeReportConfig.checkedCats.map(c => (c === 'Nhân công' ? 'Thuê nhân công' : c)).join(', ')
        : 'Tất cả hạng mục canh tác';

      const summaryText = `Thời gian báo cáo: từ <strong>${_activeReportConfig.fromDate ? formatDate(_activeReportConfig.fromDate) : 'ngày đầu số hóa'}</strong> đến <strong>${_activeReportConfig.toDate ? formatDate(_activeReportConfig.toDate) : 'hiện tại'}</strong> · Hạng mục: <strong>${esc(activeCatLabels)}</strong> · Đã lọc <strong>${filteredLogs.length}</strong> nhật ký hoạt động.`;
      document.getElementById('report-summary').innerHTML = summaryText;

      const sigOp = document.getElementById('report-sig-operator');
      if (sigOp && filteredLogs.length > 0) sigOp.textContent = getReportOperatorName(filteredLogs[filteredLogs.length - 1]);
      const sigOwner = document.getElementById('report-sig-owner');
      if (sigOwner) sigOwner.textContent = plantData.owner_name || plantData.farm_name || 'Chủ trang trại';

      const hashSeal = document.getElementById('report-hash-seal');
      if (hashSeal) {
        const latestLog = filteredLogs[filteredLogs.length - 1];
        const shortHash = latestLog && latestLog.record_hash ? String(latestLog.record_hash).slice(0, 16) : (plantData.nfc_uid || `PLANT-${plantData.id}`);
        hashSeal.textContent = `ISO-22005 SEAL: ${shortHash}`;
      }

      const tableContainer = document.getElementById('table-container');
      if (filteredLogs.length === 0) {
        tableContainer.innerHTML = `<div class="no-data">Không có hoạt động canh tác nào khớp với khoảng thời gian và hạng mục đã chọn.</div>`;
      } else {
        let tableHtml = `
          <table>
            <thead>
              <tr>
                <th style="width: 12%">Ngày / Giờ</th>
                <th style="width: 14%">Hạng mục</th>
                <th style="width: 34%">Chi tiết kỹ thuật / Vật tư / Kiểm toán</th>
                <th style="width: 14%">Thiết bị &amp; Tuân thủ</th>
                <th style="width: 14%">Ghi chú &amp; Minh chứng</th>
                <th style="width: 12%">Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
        `;

        filteredLogs.forEach((l, idx) => {
          const detailsText = getLogDetailsText(l);
          const timePart = formatReportLogTime(l);
          const mediaUrls = (l.media_urls && Array.isArray(l.media_urls)) ? l.media_urls : [];
          let mediaHtml = '';

          if (mediaUrls.length > 0) {
            const imgHtmls = [];
            const videoHtmls = [];

            mediaUrls.forEach(m => {
              const url = m.url || m;
              const isVideo = (m.type === 'video') || /\.(mp4|mov|avi|mkv|webm)/i.test(url);
              if (isVideo) {
                videoHtmls.push(`
                  <div class="video-link-item">
                    <span style="color: #e53e3e;">▶</span>
                    <a href="${esc(url)}" target="_blank">Xem video thực địa</a>
                  </div>
                `);
              } else {
                imgHtmls.push(`
                  <img src="${esc(url)}" class="media-thumb" onclick="window.open('${esc(url)}', '_blank')">
                `);
              }
            });

            if (imgHtmls.length > 0 || videoHtmls.length > 0) {
              mediaHtml = `
                <div class="media-container">
                  ${imgHtmls.length > 0 ? `<div class="media-gallery">${imgHtmls.join('')}</div>` : ''}
                  ${videoHtmls.join('')}
                </div>
              `;
            }
          }

          const equipParts = [];
          if (l.equipment_used) equipParts.push(`<div>Thiết bị: <strong>${esc(l.equipment_used)}</strong></div>`);
          if (l.batch_code) equipParts.push(`<div class="font-mono">Lô: <strong>${esc(l.batch_code)}</strong></div>`);
          const logDetails = (l && typeof l.details === 'object' && l.details) ? l.details : {};
          const isPhiViol = Boolean(l.is_phi_violation || logDetails.is_phi_violation);
          const phiUntil = logDetails.phi_until_date || plantData.phi_until_date || null;
          const logYmd = l.log_date ? String(l.log_date).slice(0, 10) : '';
          if (isPhiViol) {
            equipParts.push('<span class="compliance-pill" style="background:#fef2f2;color:#dc2626;border-color:#fca5a5;">Vi Phạm PHI</span>');
          } else if (phiUntil && logYmd && logYmd <= String(phiUntil).slice(0, 10)) {
            equipParts.push('<span class="compliance-pill" style="background:#fffbeb;color:#d97706;border-color:#fcd34d;">Đang Cách Ly PHI</span>');
          } else {
            equipParts.push('<span class="compliance-pill">Đạt Chuẩn</span>');
          }

          tableHtml += `
            <tr>
              <td>
                <div style="font-weight:700; color:#64748b; font-size:11px;">#${idx + 1}</div>
                <strong>${formatDate(l.log_date || l.created_at)}</strong>
                ${timePart ? `<div style="font-size:11px; color:#64748b;">${esc(timePart)}</div>` : ''}
              </td>
              <td><span class="log-type">${esc(l.log_type)}</span></td>
              <td>${detailsText ? `<div style="font-weight: 500;">${detailsText}</div>` : '<span style="color:#94a3b8;">Theo quy trình chuẩn</span>'}</td>
              <td>${equipParts.join('')}</td>
              <td>
                ${l.note ? `<div class="log-note">${esc(l.note)}</div>` : '<span style="color:#94a3b8; font-size:11.5px;">Không có ghi chú</span>'}
                ${mediaHtml}
              </td>
              <td><strong>${esc(getReportOperatorName(l))}</strong></td>
            </tr>
          `;
        });

        tableHtml += `
            </tbody>
          </table>
        `;
        tableContainer.innerHTML = tableHtml;
      }

      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      if (window.PlantBookI18n && typeof window.PlantBookI18n.applyDomTranslations === 'function') {
        window.PlantBookI18n.applyDomTranslations();
      }
    }

    async function initReport() {
      try {
        const slug = getReportTargetSlug();
        if (!slug) throw new Error('Mã định danh cây trồng trống.');

        const urlParams = new URLSearchParams(window.location.search);
        const fromDate = urlParams.get('from') || '';
        const toDate = urlParams.get('to') || '';
        const categoriesParam = urlParams.get('categories');
        const checkedCats = categoriesParam ? categoriesParam.split(',').filter(Boolean) : BASE_REPORT_CATEGORIES.map(c => c.value);

        _activeReportConfig = {
          fromDate,
          toDate,
          checkedCats,
          standard: urlParams.get('standard') || 'vietgap_globalgap_iso',
          explicitCats: Boolean(categoriesParam)
        };

        let res = await fetch(`/api/plants/public/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
          const farmId = (!isNaN(parseInt(pathParts[0], 10))) ? pathParts[0] : null;
          if (farmId && slug) {
            res = await fetch(`/api/plants/public-by-farm-uid/${farmId}/${encodeURIComponent(slug)}`);
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Không tìm thấy thông tin hồ sơ cây trồng.');
        }
        plantData = await res.json();

        renderReportView();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('report-content').style.display = 'block';

        const hasCoords = plantData.latitude && plantData.longitude;
        const hasBoundary = plantData.farm_boundary && plantData.farm_boundary.coordinates;
        if (hasCoords || hasBoundary) {
          document.getElementById('map-section').style.display = 'block';
          await initReportMap(hasCoords, hasBoundary);
        }
      } catch (err) {
        console.error(err);
        document.getElementById('loader').style.display = 'none';
        const errView = document.getElementById('error-view');
        document.getElementById('error-msg').textContent = err.message;
        errView.style.display = 'block';
      }
    }

    async function initReportMap(hasCoords, hasBoundary) {
      const DEFAULT_MAPBOX_TOKEN = typeof atob === 'function' ? atob('cGsuZXlKMUlqb2ljR2gxWTIxbGIyMWxieUlzSW1FaU9pSmpiWEYwT1RSNk9HTXdNbkk1TW5OelptZHVNekoxY210cUluMC5JWC1vWndJc1BVRXcxRzEwZVJfSnNR') : '';
      let mapboxToken = DEFAULT_MAPBOX_TOKEN;
      try {
        const tokenRes = await fetch('/api/config/mapbox-token');
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData && tokenData.token) mapboxToken = tokenData.token;
        }
      } catch (e) {
        console.warn('Không thể lấy Mapbox Token từ server, dùng token dự phòng:', e.message);
      }

      mapboxgl.accessToken = mapboxToken;

      const centerLng = parseFloat(plantData.longitude || 105.0);
      const centerLat = parseFloat(plantData.latitude || 16.0);

      const map = new mapboxgl.Map({
        container: 'report-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [centerLng, centerLat],
        zoom: 15,
        maxZoom: 22,
        interactive: true,
        attributionControl: false
      });

      map.on('error', (e) => {
        if (e && e.error) {
          const msg = String(e.error.message || e.error).toLowerCase();
          if (msg.includes('image') || msg.includes('send') || msg.includes('ajax') || msg.includes('sprite') || msg.includes('svg')) {
            return;
          }
        }
      });

      map.on('load', () => {
        addContourLinesToMap(map);
        const bounds = new mapboxgl.LngLatBounds();
        let hasBounds = false;

        if (hasBoundary && plantData.farm_boundary.coordinates[0]) {
          map.addSource('farm-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: plantData.farm_boundary
            }
          });

          map.addLayer({
            id: 'farm-boundary-fill',
            type: 'fill',
            source: 'farm-boundary',
            paint: {
              'fill-color': '#22c55e',
              'fill-opacity': 0.15
            }
          });

          map.addLayer({
            id: 'farm-boundary-line',
            type: 'line',
            source: 'farm-boundary',
            paint: {
              'line-color': '#22c55e',
              'line-width': 2
            }
          });

          const coords = plantData.farm_boundary.coordinates[0];
          coords.forEach(coord => {
            bounds.extend(coord);
          });
          hasBounds = true;
        }

        if (hasCoords) {
          const lat = parseFloat(plantData.latitude);
          const lng = parseFloat(plantData.longitude);

          const el = document.createElement('div');
          el.style.width = '26px';
          el.style.height = '26px';
          el.style.backgroundColor = '#16a34a';
          el.style.border = '2px solid white';
          el.style.borderRadius = '50%';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          el.innerHTML = '<i data-lucide="sprout" style="width:14px; height:14px; color:#ffffff;"></i>';
          if (window.lucide) {
            window.lucide.createIcons({ root: el });
          }

          new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);

          bounds.extend([lng, lat]);
          hasBounds = true;
        }

        if (hasBounds) {
          map.fitBounds(bounds, { padding: 45, animate: false });
        }
      });
    }

    window.onload = initReport;

function addContourLinesToMap(map, options = {}) {
  if (!map) return;
  const defaultVisible = options.defaultVisible !== false;
  const showControl = options.showControl !== false;

  const initContours = () => {
    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      if (!map.getSource('mapbox-terrain-contours')) {
        map.addSource('mapbox-terrain-contours', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-terrain-v2'
        });
      }

      const contourColorRamp = [
        'interpolate',
        ['linear'],
        ['get', 'ele'],
        0,    '#1d4ed8',
        100,  '#0284c7',
        300,  '#06b6d4',
        450,  '#10b981',
        490,  '#22c55e',
        500,  '#84cc16',
        504,  '#eab308',
        508,  '#f97316',
        512,  '#ef4444',
        800,  '#dc2626',
        1500, '#991b1b'
      ];

      if (!map.getLayer('contour-lines')) {
        map.addLayer({
          id: 'contour-lines',
          type: 'line',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'line-color': contourColorRamp,
            'line-width': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              11, 0.6,
              14, 1.4,
              17, 2.8
            ],
            'line-opacity': 0.9
          }
        });
      }

      if (!map.getLayer('contour-labels')) {
        map.addLayer({
          id: 'contour-labels',
          type: 'symbol',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'symbol-placement': 'line',
            'text-field': ['concat', ['get', 'ele'], ' m'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12, 9,
              16, 12
            ],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-max-angle': 35,
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'text-color': contourColorRamp,
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 2
          }
        });
      }

      function getFarmBoundingBox() {
        if (typeof plantData !== 'undefined' && plantData.farm_boundary && plantData.farm_boundary.coordinates) {
          const coords = plantData.farm_boundary.coordinates[0];
          let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
          coords.forEach(c => {
            if (c[0] < west) west = c[0];
            if (c[1] < south) south = c[1];
            if (c[0] > east) east = c[0];
            if (c[1] > north) north = c[1];
          });
          return { west, south, east, north };
        }
        return null;
      }

      function buildDynamicColorRamp(min, max) {
        return [
          'interpolate', ['linear'], ['get', 'ele'],
          min, '#1d4ed8',
          (min + max) / 2, '#22c55e',
          max, '#ef4444'
        ];
      }

      const updateDense1mContours = () => {
        try {
          const bbox = getFarmBoundingBox();
          if (!bbox) return;

          const currentZoom = map.getZoom();
          let interval = 2.5 - (currentZoom - 16.0) * 0.5;
          interval = Math.max(0.5, Math.min(10.0, interval));
          interval = Math.round(interval * 2) / 2;

          const { west, south, east, north } = bbox;
          const nx = 45;
          const ny = 45;
          const dx = (east - west) / (nx - 1);
          const dy = (north - south) / (ny - 1);

          const grid = [];
          let minEle = Infinity;
          let maxEle = -Infinity;
          let hasTerrainData = false;

          for (let r = 0; r < ny; r++) {
            const lat = south + r * dy;
            const row = [];
            for (let c = 0; c < nx; c++) {
              const lng = west + c * dx;
              const ele = map.queryTerrainElevation([lng, lat]);
              if (ele !== null && ele !== undefined) {
                row.push(ele);
                if (ele < minEle) minEle = ele;
                if (ele > maxEle) maxEle = ele;
                hasTerrainData = true;
              } else {
                row.push(0);
              }
            }
            grid.push(row);
          }

          if (!hasTerrainData || minEle === Infinity || maxEle === -Infinity) return;

          const startLevel = Math.ceil(minEle / interval) * interval;
          const endLevel = Math.floor(maxEle / interval) * interval;
          const features = [];

          function interp(pA, pB, vA, vB, val) {
            if (Math.abs(vB - vA) < 1e-6) return pA;
            const t = (val - vA) / (vB - vA);
            return [pA[0] + t * (pB[0] - pA[0]), pA[1] + t * (pB[1] - pA[1])];
          }

          for (let threshold = startLevel; threshold <= endLevel + 1e-5; threshold += interval) {
            const roundedThreshold = Math.round(threshold * 10) / 10;
            const segments = [];

            for (let r = 0; r < ny - 1; r++) {
              const lat0 = south + r * dy;
              const lat1 = south + (r + 1) * dy;

              for (let c = 0; c < nx - 1; c++) {
                const lng0 = west + c * dx;
                const lng1 = west + (c + 1) * dx;

                const v0 = grid[r][c];
                const v1 = grid[r][c + 1];
                const v2 = grid[r + 1][c + 1];
                const v3 = grid[r + 1][c];

                const code = (v0 >= roundedThreshold ? 1 : 0) |
                             (v1 >= roundedThreshold ? 2 : 0) |
                             (v2 >= roundedThreshold ? 4 : 0) |
                             (v3 >= roundedThreshold ? 8 : 0);

                if (code === 0 || code === 15) continue;

                const p0 = [lng0, lat0];
                const p1 = [lng1, lat0];
                const p2 = [lng1, lat1];
                const p3 = [lng0, lat1];

                const e0 = interp(p0, p1, v0, v1, roundedThreshold);
                const e1 = interp(p1, p2, v1, v2, roundedThreshold);
                const e2 = interp(p3, p2, v3, v2, roundedThreshold);
                const e3 = interp(p0, p3, v0, v3, roundedThreshold);

                switch (code) {
                  case 1: case 14: segments.push([e3, e0]); break;
                  case 2: case 13: segments.push([e0, e1]); break;
                  case 3: case 12: segments.push([e3, e1]); break;
                  case 4: case 11: segments.push([e1, e2]); break;
                  case 5: segments.push([e3, e2]); segments.push([e0, e1]); break;
                  case 6: case 9:  segments.push([e0, e2]); break;
                  case 7: case 8:  segments.push([e3, e2]); break;
                  case 10: segments.push([e3, e0]); segments.push([e1, e2]); break;
                }
              }
            }

            if (segments.length > 0) {
              features.push({
                type: 'Feature',
                properties: { ele: roundedThreshold },
                geometry: {
                  type: 'MultiLineString',
                  coordinates: segments
                }
              });
            }
          }

          const geoData = { type: 'FeatureCollection', features };
          const dynamicRamp = buildDynamicColorRamp(minEle, maxEle);

          if (map.getSource('dense-1m-contours')) {
            map.getSource('dense-1m-contours').setData(geoData);
            if (map.getLayer('dense-1m-contour-lines')) {
              map.setPaintProperty('dense-1m-contour-lines', 'line-color', dynamicRamp);
            }
            if (map.getLayer('dense-1m-contour-labels')) {
              map.setPaintProperty('dense-1m-contour-labels', 'text-color', dynamicRamp);
            }
          } else {
            map.addSource('dense-1m-contours', {
              type: 'geojson',
              data: geoData
            });

            map.addLayer({
              id: 'dense-1m-contour-lines',
              type: 'line',
              source: 'dense-1m-contours',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'line-color': dynamicRamp,
                'line-width': [
                  'interpolate',
                  ['exponential', 1.5],
                  ['zoom'],
                  12, 1.5,
                  15, 2.5,
                  18, 4.0
                ],
                'line-opacity': 0.95
              }
            });

            map.addLayer({
              id: 'dense-1m-contour-labels',
              type: 'symbol',
              source: 'dense-1m-contours',
              layout: {
                'symbol-placement': 'line',
                'text-field': ['concat', ['get', 'ele'], ' m'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12, 10,
                  16, 13
                ],
                'text-allow-overlap': true,
                'text-ignore-placement': false,
                'text-max-angle': 45,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': dynamicRamp,
                'text-halo-color': 'rgba(0, 0, 0, 0.95)',
                'text-halo-width': 2.5
              }
            });
          }

          updateLegendWidget(minEle, maxEle, interval);
        } catch (e) {
          console.warn('Lỗi sinh đường đồng mức nông trại:', e);
        }
      };

      const updateLegendWidget = (minEle, maxEle, interval) => {
        const legendContainer = map.getContainer().querySelector('.elevation-legend-widget-container');
        if (!legendContainer) return;

        const minE = Math.floor(minEle);
        const maxE = Math.ceil(maxEle);
        const midE = Math.round((maxE + minE) / 2);
        const stepTxt = interval ? ` (${interval}m)` : '';

        legendContainer.innerHTML = `
          <div style="
            background: rgba(10, 25, 18, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 10px 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 90px;
            pointer-events: auto;
          ">
            <div style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:#9ca3af; margin-bottom:8px; letter-spacing:0.5px; text-align:center;">Cao độ${stepTxt}</div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="
                width: 12px;
                height: 140px;
                border-radius: 6px;
                background: linear-gradient(to top, #1d4ed8, #22c55e, #ef4444);
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: inset 0 0 4px rgba(0,0,0,0.3);
              "></div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; height:140px; font-size:11px; font-weight:800;">
                <span style="color:#ef4444; text-shadow:0 1px 2px #000;">${maxE} m</span>
                <span style="color:#eab308; text-shadow:0 1px 2px #000;">${midE} m</span>
                <span style="color:#38bdf8; text-shadow:0 1px 2px #000;">${minE} m</span>
              </div>
            </div>
          </div>
        `;
      };

      let contourTimer = null;
      const debouncedUpdate = () => {
        clearTimeout(contourTimer);
        contourTimer = setTimeout(updateDense1mContours, 300);
      };

      map.on('moveend', debouncedUpdate);
      map.on('idle', debouncedUpdate);
      setTimeout(updateDense1mContours, 600);
      setTimeout(updateDense1mContours, 1500);

      if (showControl && !map._contourControlAdded) {
        map._contourControlAdded = true;

        class ContourToggleControl {
          onAdd(m) {
            this._map = m;
            this._container = document.createElement('div');
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

            const btn = document.createElement('button');
            btn.className = 'mapboxgl-ctrl-icon mapbox-ctrl-contour-btn';
            btn.type = 'button';
            btn.title = 'Bật/Tắt đường đồng mức 1m nông trại (Contour Lines)';
            btn.setAttribute('aria-label', 'Toggle Contour Lines');
            btn.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: center;
              width: 29px;
              height: 29px;
              font-size: 13px;
              font-weight: bold;
              background: ${defaultVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent'};
              color: ${defaultVisible ? '#f59e0b' : '#555'};
              border: none;
              cursor: pointer;
            `;
            btn.innerHTML = '⛰️';

            let isVisible = defaultVisible;

            btn.onclick = () => {
              isVisible = !isVisible;
              const visVal = isVisible ? 'visible' : 'none';
              if (m.getLayer('dense-1m-contour-lines')) m.setLayoutProperty('dense-1m-contour-lines', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-labels')) m.setLayoutProperty('dense-1m-contour-labels', 'visibility', visVal);

              btn.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btn.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget-container');
              if (legendEl) legendEl.style.display = isVisible ? 'block' : 'none';
            };

            this._container.appendChild(btn);
            return this._container;
          }

          onRemove() {
            if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
            }
            this._map = undefined;
          }
        }

        map.addControl(new ContourToggleControl(), 'top-right');

        const mapContainer = map.getContainer();
        if (mapContainer && !mapContainer.querySelector('.elevation-legend-widget-container')) {
          const legendContainer = document.createElement('div');
          legendContainer.className = 'elevation-legend-widget-container';
          legendContainer.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 10px;
            z-index: 8;
            display: ${defaultVisible ? 'block' : 'none'};
            pointer-events: auto;
          `;
          mapContainer.appendChild(legendContainer);
        }
      }
    } catch (err) {
      console.warn('Cảnh báo hiển thị đường đồng mức:', err);
    }
  };

  if (map.isStyleLoaded()) {
    initContours();
  } else {
    map.once('load', initContours);
  }
}

let _savedPublicReportId = null;

function toggleReportTitleEdit(open) {
  const wrap = document.getElementById('report-title-edit-wrap');
  const inp = document.getElementById('report-title-input');
  const h1 = document.getElementById('report-main-heading');
  if (!wrap) return;
  wrap.style.display = open ? 'flex' : 'none';
  if (open && inp) {
    if (h1 && !inp.value.trim()) inp.value = h1.textContent.trim();
    inp.focus();
    inp.select();
  }
}
window.toggleReportTitleEdit = toggleReportTitleEdit;

async function saveReportTitleEdit() {
  const inp = document.getElementById('report-title-input');
  const h1 = document.getElementById('report-main-heading');
  if (!inp || !h1) return;
  const newTitle = inp.value.trim();
  if (!newTitle) return;
  h1.textContent = newTitle;
  document.title = newTitle;
  toggleReportTitleEdit(false);

  const token = (typeof localStorage !== 'undefined') ? (localStorage.getItem('user_token') || localStorage.getItem('token') || '') : '';
  if (_savedPublicReportId && !String(_savedPublicReportId).startsWith('local_') && token) {
    try {
      await fetch(`/api/plants/reports/${_savedPublicReportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (_) {}
  }
  try {
    const key = 'plantbook_saved_reports_v1';
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    if (_savedPublicReportId && Array.isArray(list)) {
      const next = list.map(r => String(r.id) === String(_savedPublicReportId) ? { ...r, title: newTitle, updated_at: new Date().toISOString() } : r);
      localStorage.setItem(key, JSON.stringify(next));
    }
  } catch (_) {}
}
window.saveReportTitleEdit = saveReportTitleEdit;

async function savePublicReportAndPrintPdf() {
  const h1 = document.getElementById('report-main-heading');
  const title = (h1 ? h1.textContent.trim() : '') || 'Báo cáo lịch trình canh tác';
  const filteredLogs = plantData ? filterReportLogsByConfig(enrichReportLogsWithFruitAuditChain(plantData.logs || []), _activeReportConfig) : [];
  const stdLabel = getReportStandardLabel(_activeReportConfig.standard);
  const reportHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  const payload = {
    title,
    farm_id: plantData?.farm_id || null,
    plant_id: plantData?.id || null,
    standard_code: _activeReportConfig.standard || 'vietgap_globalgap_iso',
    standard_label: stdLabel,
    categories: _activeReportConfig.checkedCats || [],
    from_date: _activeReportConfig.fromDate || null,
    to_date: _activeReportConfig.toDate || null,
    total_logs: filteredLogs.length,
    report_html: reportHtml,
    report_meta: {
      farmName: plantData?.farm_name || 'Nông Trại',
      treeCode: plantData?.tree_code || plantData?.id || ''
    }
  };

  let saved = null;
  const token = (typeof localStorage !== 'undefined') ? (localStorage.getItem('user_token') || localStorage.getItem('token') || '') : '';
  if (token) {
    try {
      const res = await fetch('/api/plants/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) saved = await res.json();
    } catch (_) {}
  }

  if (saved && saved.id) {
    _savedPublicReportId = saved.id;
  } else {
    _savedPublicReportId = _savedPublicReportId || `local_${Date.now()}`;
    try {
      const key = 'plantbook_saved_reports_v1';
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const item = {
        id: _savedPublicReportId,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const next = [item, ...(Array.isArray(list) ? list.filter(r => String(r.id) !== String(_savedPublicReportId)) : [])].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
  }

  const btn = document.getElementById('btn-save-pdf-report');
  if (btn) btn.textContent = 'Đã lưu · Đang xuất PDF';
  setTimeout(() => {
    if (typeof window.print === 'function') window.print();
  }, 150);
}
window.savePublicReportAndPrintPdf = savePublicReportAndPrintPdf;

async function downloadPublicSignedPdf() {
  try {
    if (!plantData || !plantData.id) {
      alert('Dữ liệu báo cáo chưa sẵn sàng.');
      return;
    }
    const resp = await fetch(`/api/plants/${plantData.id}/export-pdf-signed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: document.title || `Ho So Truy Xuat ${plantData.tree_code || plantData.id}` })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TruyXuat_KySo_${plantData.tree_code || plantData.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Lỗi tải PDF ký số: ' + err.message);
  }
}
window.downloadPublicSignedPdf = downloadPublicSignedPdf;
