/**
 * modules/weather-clock.js - Live Digital Clock & Real-Time GPS Weather Widget (Open-Meteo API)
 * Enhanced with Local Storage Caching, Fault-Tolerant Climatology Fallback & 503 Error Resilience
 */

let _clockInterval = null;
let _currentCoords = null;
const CACHE_KEY = 'tanbao_cached_weather';

// WMO Weather Interpretation Codes (WW) with Rich Multi-Layer Meteorological SVGs
export function getCorporateWeatherSvg(code) {
  const c = parseInt(code, 10);
  // 0: Sunny / Clear Sky
  if (c === 0) {
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 10px rgba(245,158,11,0.45));">
      <defs>
        <radialGradient id="sunGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="60%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#D97706"/>
        </radialGradient>
      </defs>
      <g stroke="#FBBF24" stroke-width="2.6" stroke-linecap="round" opacity="0.95">
        <line x1="24" y1="4" x2="24" y2="8" />
        <line x1="24" y1="40" x2="24" y2="44" />
        <line x1="4" y1="24" x2="8" y2="24" />
        <line x1="40" y1="24" x2="44" y2="24" />
        <line x1="9.8" y1="9.8" x2="12.8" y2="12.8" />
        <line x1="35.2" y1="35.2" x2="38.2" y2="38.2" />
        <line x1="9.8" y1="38.2" x2="12.8" y2="35.2" />
        <line x1="35.2" y1="12.8" x2="38.2" y2="9.8" />
      </g>
      <circle cx="24" cy="24" r="11.5" fill="url(#sunGlowGrad)" stroke="#FEF08A" stroke-width="1.5"/>
    </svg>`;
  }
  // 1, 2, 80: Clear / Partly Cloudy / Sun & Rain
  if (c === 1 || c === 2 || c === 80) {
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 12px rgba(56,189,248,0.35));">
      <defs>
        <radialGradient id="sunPartGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="70%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#D97706"/>
        </radialGradient>
        <linearGradient id="cloudGradPart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#94A3B8"/>
        </linearGradient>
      </defs>
      <circle cx="31" cy="17" r="8.5" fill="url(#sunPartGrad)" stroke="#FEF08A" stroke-width="1.2"/>
      <path d="M15 39h20a7 7 0 0 0 2.2-13.6 8.5 8.5 0 0 0-15.6-3.8 6 6 0 0 0-7.6 6.4A6.5 6.5 0 0 0 15 39z" fill="url(#cloudGradPart)" stroke="rgba(255,255,255,0.85)" stroke-width="1"/>
      ${c === 80 ? '<line x1="20" y1="41" x2="18" y2="45" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/><line x1="28" y1="41" x2="26" y2="45" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/>' : ''}
    </svg>`;
  }
  // 3: Overcast / Cloudy
  if (c === 3) {
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 10px rgba(148,163,184,0.3));">
      <defs>
        <linearGradient id="cloudBackGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#94A3B8"/>
          <stop offset="100%" stop-color="#475569"/>
        </linearGradient>
        <linearGradient id="cloudFrontGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F8FAFC"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </linearGradient>
      </defs>
      <path d="M12 28h17a6 6 0 0 0 1.5-11.8 7.5 7.5 0 0 0-13.8-2.6 5.5 5.5 0 0 0-6.7 5.4A5.5 5.5 0 0 0 12 28z" fill="url(#cloudBackGrad)" opacity="0.8"/>
      <path d="M16 38h20a7 7 0 0 0 2.3-13.6 8.5 8.5 0 0 0-15.6-3.8 6 6 0 0 0-7.7 6.4A6.5 6.5 0 0 0 16 38z" fill="url(#cloudFrontGrad)" stroke="rgba(255,255,255,0.9)" stroke-width="1"/>
    </svg>`;
  }
  // 45, 48: Fog / Smog
  if (c === 45 || c === 48) {
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 8px rgba(203,213,225,0.3));">
      <defs>
        <linearGradient id="mistLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(148,163,184,0.2)"/>
          <stop offset="25%" stop-color="#F1F5F9"/>
          <stop offset="75%" stop-color="#94A3B8"/>
          <stop offset="100%" stop-color="rgba(148,163,184,0.2)"/>
        </linearGradient>
      </defs>
      <line x1="8" y1="16" x2="40" y2="16" stroke="url(#mistLineGrad)" stroke-width="3.2" stroke-linecap="round"/>
      <line x1="12" y1="23" x2="36" y2="23" stroke="url(#mistLineGrad)" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="6" y1="30" x2="42" y2="30" stroke="url(#mistLineGrad)" stroke-width="3.2" stroke-linecap="round"/>
      <line x1="14" y1="37" x2="34" y2="37" stroke="url(#mistLineGrad)" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  // 51, 53, 55, 61, 63, 65, 81, 82: Rain / Showers
  if ((c >= 51 && c <= 65) || c === 81 || c === 82) {
    const isHeavy = c === 65 || c === 82 || c === 55 || c === 63;
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 12px rgba(59,130,246,0.4));">
      <defs>
        <linearGradient id="rainCloudGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E2E8F0"/>
          <stop offset="100%" stop-color="${isHeavy ? '#334155' : '#64748B'}"/>
        </linearGradient>
        <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#60A5FA"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <path d="M15 29h19a6.5 6.5 0 0 0 2.1-12.6 8 8 0 0 0-14.7-3.6 5.5 5.5 0 0 0-7.4 5.9A6 6 0 0 0 15 29z" fill="url(#rainCloudGrad)" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
      <line x1="15" y1="34" x2="12" y2="43" stroke="url(#dropGrad)" stroke-width="2.8" stroke-linecap="round"/>
      <line x1="24" y1="34" x2="21" y2="43" stroke="url(#dropGrad)" stroke-width="2.8" stroke-linecap="round"/>
      <line x1="33" y1="34" x2="30" y2="43" stroke="url(#dropGrad)" stroke-width="2.8" stroke-linecap="round"/>
      ${isHeavy ? '<line x1="19" y1="36" x2="16" y2="45" stroke="url(#dropGrad)" stroke-width="2.5" stroke-linecap="round"/><line x1="28" y1="36" x2="25" y2="45" stroke="url(#dropGrad)" stroke-width="2.5" stroke-linecap="round"/>' : ''}
    </svg>`;
  }
  // 95, 96, 99: Thunderstorm / Lightning
  if (c >= 95 && c <= 99) {
    return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" style="filter: drop-shadow(0 4px 14px rgba(234,179,8,0.5));">
      <defs>
        <linearGradient id="thunderCloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#475569"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
        <linearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="40%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <path d="M15 27h19a6.5 6.5 0 0 0 2.1-12.6 8 8 0 0 0-14.7-3.6 5.5 5.5 0 0 0-7.4 5.9A6 6 0 0 0 15 27z" fill="url(#thunderCloud)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
      <path d="M26 21l-5 10h6l-3.5 13 11-14h-6.5l5.5-9h-7z" fill="url(#boltGrad)" stroke="#FEF08A" stroke-width="0.8" style="filter: drop-shadow(0 0 6px #FDE047);"/>
    </svg>`;
  }
  // Default Sunny
  return `<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="12" fill="#F59E0B"/></svg>`;
}

const WMO_WEATHER_MAP = {
  0: { label: 'Trời nắng trong xanh', code: 0, color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' },
  1: { label: 'Trời quang, ít mây', code: 1, color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' },
  2: { label: 'Mây rải rác', code: 2, color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' },
  3: { label: 'Trời nhiều mây âm u', code: 3, color: '#94a3b8', bg: 'rgba(148,163,184,0.18)' },
  45: { label: 'Sương mù sáng sớm', code: 45, color: '#cbd5e1', bg: 'rgba(203,213,225,0.18)' },
  48: { label: 'Sương mù đọng sương', code: 48, color: '#cbd5e1', bg: 'rgba(203,213,225,0.18)' },
  51: { label: 'Mưa phùn nhẹ', code: 51, color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  53: { label: 'Mưa phùn vừa', code: 53, color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  55: { label: 'Mưa phùn hạt nặng', code: 55, color: '#3b82f6', bg: 'rgba(59,130,246,0.2)' },
  61: { label: 'Mưa rào nhẹ', code: 61, color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  63: { label: 'Mưa rào vừa', code: 63, color: '#3b82f6', bg: 'rgba(59,130,246,0.2)' },
  65: { label: 'Mưa to nặng hạt', code: 65, color: '#1d4ed8', bg: 'rgba(29,78,216,0.25)' },
  80: { label: 'Mưa rào thoáng qua', code: 80, color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' },
  81: { label: 'Mưa rào từng cơn', code: 81, color: '#3b82f6', bg: 'rgba(59,130,246,0.2)' },
  82: { label: 'Mưa rất to xối xả', code: 82, color: '#1e40af', bg: 'rgba(30,64,175,0.3)' },
  95: { label: 'Mưa dông, sấm sét', code: 95, color: '#f59e0b', bg: 'rgba(245,158,11,0.25)' },
  96: { label: 'Dông lốc kèm mưa đá nhẹ', code: 96, color: '#ea580c', bg: 'rgba(234,88,12,0.25)' },
  99: { label: 'Dông mạnh kèm mưa đá lớn', code: 99, color: '#dc2626', bg: 'rgba(220,38,38,0.3)' }
};

function _getWindDirection(deg) {
  if (deg === undefined || deg === null || isNaN(deg)) return 'Gió nhẹ';
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

function _saveCachedWeather(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...payload,
      timestamp: Date.now()
    }));
  } catch (_) {}
}

function _getCachedWeather() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function startLiveClock() {
  if (_clockInterval) clearInterval(_clockInterval);

  function update() {
    const now = new Date();
    
    // Time format HH:mm:ss
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timeEl = document.getElementById('live-clock-time');
    const secEl = document.getElementById('live-clock-seconds');
    if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
    if (secEl) secEl.textContent = `:${seconds}`;

    // Date format in Vietnamese
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const dateStr = `${dayName}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const dateEl = document.getElementById('live-clock-date');
    if (dateEl) dateEl.textContent = dateStr;
  }

  update();
  _clockInterval = setInterval(update, 1000);
}

function _renderWeatherUI(data, locationName, isRealGps, statusBadge = '') {
  const widgetBox = document.getElementById('weather-widget-content');
  if (!widgetBox) return;

  const {
    temp = 30,
    feelLike = 32,
    humidity = 75,
    windSpeed = 12,
    windDir = 'Đông',
    uv = '4.5',
    rainProb = 15,
    tempMax = 33,
    tempMin = 26,
    weatherCode = 0,
    wmo = { label: 'Trời quang đãng', code: 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' },
    agriTip = 'Thời tiết thuận lợi cho việc chăm sóc cây trồng và theo dõi độ ẩm đất.'
  } = data;

  const weatherSvg = getCorporateWeatherSvg(wmo.code !== undefined ? wmo.code : weatherCode);

  widgetBox.innerHTML = `
    <div class="weather-widget-wrapper" style="display:flex; flex-direction:column; gap:12px; width:100%;">
      
      <!-- Top Header Strip: Location & Status -->
      <div class="weather-header-strip" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding-bottom:8px; border-bottom:1px solid #e2e8f0; width:100%;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <i data-lucide="map-pin" class="lucide-sm" style="color:#e11d48; font-size:13px;"></i>
          <span style="font-weight:800; color:#064e3b; font-size:13px;">${locationName}</span>
          ${isRealGps ? `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="satellite" class="lucide-sm" style="color:#059669; font-size:10px;"></i> GPS Thiết bị</span>` : `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="sprout" class="lucide-sm" style="color:#d97706; font-size:10px;"></i> Trang trại</span>`}
          ${statusBadge ? `<span style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:12px;">${statusBadge}</span>` : ''}
        </div>
        <div style="font-size:11.5px; font-weight:700; color:#64748b; display:inline-flex; align-items:center; gap:5px;">
          <span style="width:6px; height:6px; border-radius:50%; background:#10b981; display:inline-block; box-shadow:0 0 4px #10b981;"></span> Trực tuyến
        </div>
      </div>

      <!-- Main Body: Hero Condition (Left) + 4 Metrics Grid (Right) -->
      <div class="weather-body-grid" style="display:grid; grid-template-columns:auto 1fr; gap:16px; align-items:center; width:100%;">
        
        <!-- Hero Weather Condition & Temperature Box -->
        <div class="weather-hero-block" style="display:flex; align-items:center; gap:14px; min-width:220px;">
          <div style="width:58px; height:58px; border-radius:14px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(16,185,129,0.12); border:1.5px solid #a7f3d0; flex-shrink:0;">
            ${weatherSvg}
          </div>
          <div>
            <div style="display:flex; align-items:baseline; gap:8px;">
              <span id="weather-val-temp" style="font-size:32px; font-weight:900; line-height:1; letter-spacing:-0.5px; color:#064e3b; font-family:'Segoe UI', Inter, sans-serif;">${temp}°C</span>
              <span style="font-size:12.5px; color:#059669; font-weight:700; white-space:nowrap;">(Cảm giác: <span id="weather-val-feel" style="color:#047857; font-weight:800;">${feelLike}</span>°C)</span>
            </div>
            <div style="font-size:13px; font-weight:800; color:#065f46; margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="color:#b45309; background:#fef3c7; padding:2px 8px; border-radius:6px; font-size:11.5px; font-weight:800; border:1px solid #fde68a;">${wmo.label}</span>
              <span style="font-size:12px; color:#64748b; font-weight:700; white-space:nowrap;">• ${tempMin}° / ${tempMax}°C</span>
            </div>
          </div>
        </div>

        <!-- Detailed Metrics Grid (4 Clean Balanced Chips) -->
        <div class="weather-metrics-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; width:100%;">
          
          <!-- Humidity Chip -->
          <div class="weather-metric-chip" style="background:#ecfdf5; border:1.2px solid #a7f3d0; border-radius:10px; padding:7px 10px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size:10.5px; color:#059669; font-weight:800; display:flex; align-items:center; gap:5px;">
              <i data-lucide="droplet" class="lucide-sm" style="color:#059669;"></i> Độ ẩm KK
            </div>
            <div id="weather-val-humidity" style="font-size:15px; font-weight:900; color:#064e3b; margin-top:2px; font-family:'Segoe UI', Inter, sans-serif;">${humidity}%</div>
          </div>

          <!-- Wind Chip -->
          <div class="weather-metric-chip" style="background:#f0fdfa; border:1.2px solid #99f6e4; border-radius:10px; padding:7px 10px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size:10.5px; color:#0f766e; font-weight:800; display:flex; align-items:center; gap:5px;">
              <i data-lucide="wind" class="lucide-sm" style="color:#0d9488;"></i> Gió & Hướng
            </div>
            <div style="font-size:13px; font-weight:900; color:#115e59; margin-top:2px;"><span id="weather-val-wind">${windSpeed}</span> km/h <span style="font-size:10.5px; font-weight:700; color:#0f766e;">${windDir}</span></div>
          </div>

          <!-- Rain Prob Chip -->
          <div class="weather-metric-chip" style="background:#eff6ff; border:1.2px solid #bfdbfe; border-radius:10px; padding:7px 10px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size:10.5px; color:#2563eb; font-weight:800; display:flex; align-items:center; gap:5px;">
              <i data-lucide="cloud-rain" class="lucide-sm" style="color:#3b82f6;"></i> Khả năng mưa
            </div>
            <div id="weather-val-rain" style="font-size:15px; font-weight:900; color:#1e40af; margin-top:2px; font-family:'Segoe UI', Inter, sans-serif;">${rainProb}%</div>
          </div>

          <!-- UV Chip -->
          <div class="weather-metric-chip" style="background:#fffbeb; border:1.2px solid #fde68a; border-radius:10px; padding:7px 10px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="font-size:10.5px; color:#d97706; font-weight:800; display:flex; align-items:center; gap:5px;">
              <i data-lucide="sun" class="lucide-sm" style="color:#d97706;"></i> Chỉ số UV
            </div>
            <div style="font-size:14px; font-weight:900; color:#92400e; margin-top:2px;"><span id="weather-val-uv">${uv}</span> <span style="font-size:10px; font-weight:800; color:${parseFloat(uv) > 6 ? '#dc2626' : '#16a34a'};">(${parseFloat(uv) > 6 ? 'Cao' : 'An toàn'})</span></div>
          </div>

        </div>

      </div>

      <!-- Bottom Advisory Box (Full Width) -->
      <div class="weather-advice-strip" style="background:#ecfdf5; border:1px solid #a7f3d0; border-left:3.5px solid #059669; border-radius:10px; padding:9px 14px; display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:#064e3b; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.02); width:100%; box-sizing:border-box;">
        <i data-lucide="sprout" class="lucide-sm" style="color:#059669; font-size:14px; margin-top:2px; flex-shrink:0;"></i>
        <div style="flex:1;">
          <strong style="color:#047857; font-weight:800; margin-right:4px;">Khuyến cáo canh tác:</strong>
          <span>${agriTip}</span>
        </div>
      </div>

    </div>
  `;

  // Trigger CountUp animations on weather numbers!
  if (typeof window.animateValue === 'function') {
    window.animateValue(document.getElementById('weather-val-temp'), 0, temp, 800, 0, '°C');
    window.animateValue(document.getElementById('weather-val-feel'), 0, feelLike, 800, 0);
    window.animateValue(document.getElementById('weather-val-humidity'), 0, humidity, 800, 0, '%');
    window.animateValue(document.getElementById('weather-val-wind'), 0, windSpeed, 800, 0);
    window.animateValue(document.getElementById('weather-val-rain'), 0, rainProb, 800, 0, '%');
    window.animateValue(document.getElementById('weather-val-uv'), 0, parseFloat(uv), 800, 1);
  }

  // Sync state to 3D Chibi Mascot
  if (typeof window.setMascotState === 'function') {
    if (rainProb >= 60) {
      window.setMascotState('rain');
    } else if (temp >= 34) {
      window.setMascotState('thirsty');
    }
  }
}

export async function refreshDeviceWeather() {
  const statusEl = document.getElementById('weather-status-text');
  const refreshBtn = document.getElementById('btn-refresh-weather');

  if (refreshBtn) refreshBtn.classList.add('lucide-spin');
  if (statusEl) statusEl.textContent = 'Đang xác định vị trí trang trại...';

  // Step 1: Obtain registered farm coordinates or fallback
  const activeFarm = (typeof window.getActiveFarm === 'function' ? window.getActiveFarm() : null)
    || (window._allFarmsCache && window._allFarmsCache.length > 0 ? window._allFarmsCache[0] : null);

  let lat = null;
  let lng = null;
  let isRealGps = false;
  let farmDisplayName = '';

  if (activeFarm) {
    if (activeFarm.latitude && activeFarm.longitude) {
      lat = parseFloat(activeFarm.latitude);
      lng = parseFloat(activeFarm.longitude);
    } else if (activeFarm.polygon_coordinates) {
      try {
        const poly = typeof activeFarm.polygon_coordinates === 'string' 
          ? JSON.parse(activeFarm.polygon_coordinates) 
          : activeFarm.polygon_coordinates;
        if (Array.isArray(poly) && poly.length > 0) {
          const ring = Array.isArray(poly[0][0]) ? poly[0] : poly;
          let sumLat = 0, sumLng = 0;
          ring.forEach(pt => {
            sumLng += parseFloat(pt[0]);
            sumLat += parseFloat(pt[1]);
          });
          lat = sumLat / ring.length;
          lng = sumLng / ring.length;
        }
      } catch (_) {}
    }
    farmDisplayName = activeFarm.name ? `${activeFarm.name} (${activeFarm.address || 'Khu vực canh tác'})` : '';
  }

  // Try real-time device Geolocation
  try {
    if ('geolocation' in navigator) {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 60000
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      isRealGps = true;
    }
  } catch (err) {
    console.warn('[WeatherWidget] GPS position error or permission denied. Using registered Farm coordinates.', err.message);
  }

  // Fallback coordinates if still undefined
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    lat = 10.9415; // Default Long Khánh, Đồng Nai or Mekong Delta
    lng = 107.2418;
  }

  _currentCoords = { lat, lng, isRealGps };

  if (statusEl) statusEl.textContent = 'Đang tải dữ liệu khí tượng Open-Meteo...';

  // Step 2: Fetch Open-Meteo Real-Time Weather API with automatic resilient fallback
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,et0_fao_evapotranspiration&timezone=auto`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(weatherUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const data = await res.json();

    // Step 3: Fetch Location Name (Reverse Geocode / Farm Name)
    let locationName = isRealGps 
      ? `GPS: ${lat.toFixed(3)}°, ${lng.toFixed(3)}°` 
      : (farmDisplayName || 'Trang trại Nông hộ');

    try {
      const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const district = geoData.locality || geoData.city || '';
        const province = geoData.principalSubdivision || '';
        const geoStr = [district, province].filter(Boolean).join(', ');
        if (geoStr) {
          if (isRealGps) {
            locationName = geoStr;
          } else if (activeFarm && activeFarm.name) {
            locationName = `${activeFarm.name} (${geoStr})`;
          } else {
            locationName = geoStr;
          }
        }
      }
    } catch (_) {}

    // Step 4: Parse Weather metrics
    const current = data.current || {};
    const daily = data.daily || {};

    const temp = Math.round(current.temperature_2m ?? 29);
    const feelLike = Math.round(current.apparent_temperature ?? temp);
    const humidity = Math.round(current.relative_humidity_2m ?? 75);
    const windSpeed = Math.round(current.wind_speed_10m ?? 12);
    const windDir = _getWindDirection(current.wind_direction_10m);
    const uv = current.uv_index !== undefined ? current.uv_index.toFixed(1) : ((daily.uv_index_max && daily.uv_index_max[0]) ? daily.uv_index_max[0].toFixed(1) : '4.5');
    const rainProb = daily.precipitation_probability_max?.[0] !== undefined ? daily.precipitation_probability_max[0] : 15;
    const rainSum = daily.precipitation_sum?.[0] !== undefined ? daily.precipitation_sum[0] : 0;
    const tempMax = daily.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : temp + 3;
    const tempMin = daily.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : temp - 4;
    const et0 = daily.et0_fao_evapotranspiration?.[0] ? Math.round(daily.et0_fao_evapotranspiration[0] * 10) / 10 : 4.2;
    const windGusts = daily.wind_gusts_10m_max?.[0] ? Math.round(daily.wind_gusts_10m_max[0]) : null;

    const weatherCode = current.weather_code ?? 0;
    const wmo = WMO_WEATHER_MAP[weatherCode] || { label: 'Trời quang đãng', icon: 'sun', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };

    // Agricultural Advisory Formula & Advice
    const irrigLiters = Math.round(et0 * 30 * 0.85);
    let agriTip = `Bốc thoát hơi nước hôm nay ~${et0} mm/ngày (tưới bù ~${irrigLiters}L/gốc). Thời tiết thuận lợi cho các hoạt động chăm sóc cây trồng.`;
    if (rainProb >= 60 || rainSum >= 10) {
      agriTip = `⚠️ Khả năng mưa cao (${rainProb}%, ~${rainSum}mm): Tuyệt đối hoãn phun thuốc BVTV và bón phân để tránh bị rửa trôi.`;
    } else if (temp >= 34 || et0 >= 5.5) {
      agriTip = `☀️ Nắng gắt & bốc thoát hơi nước mạnh (${et0}mm/ngày): Khuyến nghị tưới bù ~${irrigLiters}L/cây vào sáng sớm và tủ gốc giữ ẩm.`;
    } else if (windGusts && windGusts >= 35) {
      agriTip = `💨 Cảnh báo gió giật mạnh (${windGusts} km/h): Kiểm tra chằng chống cành sầu riêng mang quả và hạn chế phun thuốc trừ sâu.`;
    } else if (humidity >= 85) {
      agriTip = `💧 Độ ẩm không khí cao (${humidity}%): Cần kiểm tra kỹ nấm lá thán thư và xì mủ Phytophthora trên cơi đọt.`;
    }

    const weatherPayload = {
      temp,
      feelLike,
      humidity,
      windSpeed,
      windDir,
      uv,
      rainProb,
      tempMax,
      tempMin,
      et0,
      wmo,
      agriTip
    };

    // Save to Local Storage Cache
    _saveCachedWeather({ data: weatherPayload, locationName, isRealGps });

    // Render UI
    _renderWeatherUI(weatherPayload, locationName, isRealGps);

  } catch (err) {
    console.warn('[WeatherWidget] Open-Meteo API unreachable or returning 503/Timeout. Activating cache/fallback resilience.', err.message);
    
    // Check if we have cached weather
    const cached = _getCachedWeather();
    if (cached && cached.data) {
      const timeStr = new Date(cached.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      _renderWeatherUI(cached.data, cached.locationName || 'Vườn mẫu Tân Bảo', cached.isRealGps, `🕒 Lưu lúc ${timeStr}`);
    } else {
      // Climatology fallback
      const now = new Date();
      const hour = now.getHours();
      let estTemp = 29;
      if (hour >= 6 && hour <= 10) estTemp = 28;
      else if (hour > 10 && hour <= 15) estTemp = 32;
      else if (hour > 15 && hour <= 18) estTemp = 30;
      else estTemp = 26;

      const fallbackPayload = {
        temp: estTemp,
        feelLike: estTemp + 1,
        humidity: 78,
        windSpeed: 10,
        windDir: 'Đông',
        uv: '4.5',
        rainProb: 20,
        tempMax: estTemp + 3,
        tempMin: estTemp - 4,
        wmo: { label: 'Trời quang, ít mây', icon: 'cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
        agriTip: 'Thời tiết ổn định, thuận lợi cho các hoạt động canh tác nông nghiệp.'
      };

      _renderWeatherUI(fallbackPayload, isRealGps ? `GPS: ${lat.toFixed(3)}°, ${lng.toFixed(3)}°` : 'Vùng Nông nghiệp Trọng điểm (Bến Tre)', isRealGps, '🌤️ Dữ liệu dự phòng');
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('lucide-spin');
    if (statusEl) statusEl.textContent = 'Thời tiết thực tế';
  }
}
window.refreshDeviceWeather = refreshDeviceWeather;

export function initWeatherClockWidget() {
  startLiveClock();
  refreshDeviceWeather();
}
window.initWeatherClockWidget = initWeatherClockWidget;
