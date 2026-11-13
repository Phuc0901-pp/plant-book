/* ============================================================================
   TBSG AgTech — Chibi ISO Vector Icon Library v1.0
   Standardized W3C SVG 1.1 | 64x64 Grid | WCAG 2.1 AA Accessible (role="img")
   ============================================================================ */

(function (global) {
  'use strict';

  const CHIBI_REGISTRY = {
    'chibi-water': {
      label: 'Tưới nước',
      svg: `<defs>
        <linearGradient id="cw-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#e0f2fe"/>
      <path d="M32 10 C32 10 16 28 16 39 C16 48 23.2 54 32 54 C40.8 54 48 48 48 39 C48 28 32 10 32 10 Z" fill="url(#cw-g1)" stroke="#0369a1" stroke-width="2.2" stroke-linejoin="round"/>
      <ellipse cx="25" cy="31" rx="3" ry="5" transform="rotate(-25 25 31)" fill="#bae6fd" opacity="0.7"/>
      <circle cx="26.5" cy="39" r="2.2" fill="#0f172a"/>
      <circle cx="37.5" cy="39" r="2.2" fill="#0f172a"/>
      <circle cx="27.2" cy="38.2" r="0.8" fill="#ffffff"/>
      <circle cx="38.2" cy="38.2" r="0.8" fill="#ffffff"/>
      <ellipse cx="23.5" cy="42.5" rx="2.5" ry="1.4" fill="#fb7185" opacity="0.75"/>
      <ellipse cx="40.5" cy="42.5" rx="2.5" ry="1.4" fill="#fb7185" opacity="0.75"/>
      <path d="M29 42.5 Q32 45.5 35 42.5" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>`
    },

    'chibi-fertilize': {
      label: 'Bón phân',
      svg: `<defs>
        <linearGradient id="cf-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4ade80"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#dcfce7"/>
      <path d="M18 46 Q32 53 46 46 L43 52 Q32 56 21 52 Z" fill="#92400e" stroke="#78350f" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M32 47 L32 30" stroke="#15803d" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M32 32 C22 32 16 24 18 16 C26 16 32 22 32 32 Z" fill="url(#cf-g1)" stroke="#166534" stroke-width="2" stroke-linejoin="round"/>
      <path d="M32 28 C42 28 48 20 46 12 C38 12 32 18 32 28 Z" fill="#22c55e" stroke="#166534" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="28" cy="40" r="2.1" fill="#0f172a"/>
      <circle cx="36" cy="40" r="2.1" fill="#0f172a"/>
      <circle cx="28.6" cy="39.3" r="0.8" fill="#ffffff"/>
      <circle cx="36.6" cy="39.3" r="0.8" fill="#ffffff"/>
      <path d="M30 43.5 Q32 45.5 34 43.5" fill="none" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="49" cy="35" r="2.5" fill="#fbbf24"/>
      <circle cx="15" cy="37" r="2" fill="#fbbf24"/>`
    },

    'chibi-pesticide': {
      label: 'Phun thuốc',
      svg: `<circle cx="32" cy="32" r="30" fill="#ffedd5"/>
      <rect x="25" y="13" width="14" height="6" rx="2" fill="#f97316" stroke="#9a3412" stroke-width="2"/>
      <path d="M29 19 L35 19 L36 23 L28 23 Z" fill="#cbd5e1" stroke="#475569" stroke-width="1.6"/>
      <rect x="20" y="23" width="24" height="27" rx="9" fill="#fb923c" stroke="#9a3412" stroke-width="2.2"/>
      <rect x="24" y="27" width="16" height="19" rx="6" fill="#fff7ed" opacity="0.9"/>
      <circle cx="27.5" cy="35" r="2" fill="#0f172a"/>
      <circle cx="36.5" cy="35" r="2" fill="#0f172a"/>
      <circle cx="28.1" cy="34.3" r="0.7" fill="#ffffff"/>
      <circle cx="37.1" cy="34.3" r="0.7" fill="#ffffff"/>
      <ellipse cx="24.5" cy="38" rx="2" ry="1.2" fill="#fb7185" opacity="0.7"/>
      <ellipse cx="39.5" cy="38" rx="2" ry="1.2" fill="#fb7185" opacity="0.7"/>
      <path d="M29.5 38.5 Q32 41 34.5 38.5" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M13 17 L18 17 M15 14 L15 20" stroke="#ea580c" stroke-width="2" stroke-linecap="round"/>`
    },

    'chibi-labor': {
      label: 'Thuê nhân công',
      svg: `<circle cx="32" cy="32" r="30" fill="#e0f2fe"/>
      <path d="M18 52 C18 42 24 38 32 38 C40 38 46 42 46 52 Z" fill="#0284c7" stroke="#075985" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="32" cy="30" r="10.5" fill="#fde68a" stroke="#92400e" stroke-width="2"/>
      <path d="M17 26 L32 14 L47 26 Z" fill="#fcd34d" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="28" cy="30" r="1.9" fill="#0f172a"/>
      <circle cx="36" cy="30" r="1.9" fill="#0f172a"/>
      <circle cx="28.5" cy="29.4" r="0.7" fill="#ffffff"/>
      <circle cx="36.5" cy="29.4" r="0.7" fill="#ffffff"/>
      <ellipse cx="25" cy="33" rx="2.1" ry="1.1" fill="#fb7185" opacity="0.75"/>
      <ellipse cx="39" cy="33" rx="2.1" ry="1.1" fill="#fb7185" opacity="0.75"/>
      <path d="M29.5 33.5 Q32 36 34.5 33.5" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M47 46 L53 34" stroke="#78350f" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="53" cy="34" r="2.2" fill="#22c55e" stroke="#15803d" stroke-width="1.4"/>`
    },

    'chibi-disease': {
      label: 'Bệnh cây',
      svg: `<circle cx="32" cy="32" r="30" fill="#fee2e2"/>
      <path d="M32 13 L48 20 V33 C48 43.5 40.8 50.5 32 53 C23.2 50.5 16 43.5 16 33 V20 L32 13 Z" fill="#f87171" stroke="#b91c1c" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="27" cy="31" r="2.1" fill="#0f172a"/>
      <circle cx="37" cy="31" r="2.1" fill="#0f172a"/>
      <path d="M24 27 L29 29 M40 27 L35 29" stroke="#7f1d1d" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M28 38 Q32 35 36 38" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="46" cy="45" r="5" fill="#ffffff" stroke="#dc2626" stroke-width="2"/>
      <path d="M46 42.5 V45.5 M46 47.5 V47.6" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>`
    },

    'chibi-harvest': {
      label: 'Thu hoạch',
      svg: `<circle cx="32" cy="32" r="30" fill="#fef3c7"/>
      <path d="M18 33 L46 33 L43 50 C42.5 52 40.5 53 38 53 L26 53 C23.5 53 21.5 52 21 50 Z" fill="#d97706" stroke="#92400e" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M22 33 C22 22 42 22 42 33" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>
      <circle cx="26" cy="26" r="5.5" fill="#4ade80" stroke="#15803d" stroke-width="1.8"/>
      <circle cx="38" cy="26" r="5.5" fill="#facc15" stroke="#a16207" stroke-width="1.8"/>
      <circle cx="32" cy="22" r="6" fill="#fb923c" stroke="#c2410c" stroke-width="1.8"/>
      <circle cx="27.5" cy="41.5" r="2" fill="#0f172a"/>
      <circle cx="36.5" cy="41.5" r="2" fill="#0f172a"/>
      <circle cx="28.1" cy="40.9" r="0.7" fill="#ffffff"/>
      <circle cx="37.1" cy="40.9" r="0.7" fill="#ffffff"/>
      <path d="M29.5 44.5 Q32 47 34.5 44.5" fill="none" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>`
    },

    'chibi-login': {
      label: 'Đăng nhập',
      svg: `<circle cx="32" cy="32" r="30" fill="#d1fae5"/>
      <rect x="19" y="27" width="26" height="22" rx="6" fill="#10b981" stroke="#047857" stroke-width="2.2"/>
      <path d="M24 27 V21 C24 16 27.5 13 32 13 C36.5 13 40 16 40 21 V27" fill="none" stroke="#047857" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="27.5" cy="37" r="2" fill="#0f172a"/>
      <circle cx="36.5" cy="37" r="2" fill="#0f172a"/>
      <circle cx="28.1" cy="36.3" r="0.7" fill="#ffffff"/>
      <circle cx="37.1" cy="36.3" r="0.7" fill="#ffffff"/>
      <ellipse cx="24.5" cy="40" rx="2" ry="1.1" fill="#fb7185" opacity="0.75"/>
      <ellipse cx="39.5" cy="40" rx="2" ry="1.1" fill="#fb7185" opacity="0.75"/>
      <path d="M29.5 40.5 Q32 43 34.5 40.5" fill="none" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>`
    },

    'chibi-register': {
      label: 'Đăng ký vườn mới',
      svg: `<circle cx="32" cy="32" r="30" fill="#fef3c7"/>
      <path d="M16 32 L32 17 L48 32" fill="#f59e0b" stroke="#b45309" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="20" y="31" width="24" height="19" rx="4" fill="#ffffff" stroke="#b45309" stroke-width="2.2"/>
      <circle cx="27.5" cy="39" r="1.9" fill="#0f172a"/>
      <circle cx="36.5" cy="39" r="1.9" fill="#0f172a"/>
      <path d="M29.5 42.5 Q32 45 34.5 42.5" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="47" cy="18" r="4" fill="#22c55e" stroke="#15803d" stroke-width="1.5"/>
      <path d="M47 16 V20 M45 18 H49" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`
    },

    'chibi-app': {
      label: 'Ứng dụng chính',
      svg: `<circle cx="32" cy="32" r="30" fill="#dcfce7"/>
      <rect x="16" y="16" width="14" height="14" rx="4" fill="#10b981" stroke="#047857" stroke-width="2"/>
      <rect x="34" y="16" width="14" height="14" rx="4" fill="#34d399" stroke="#047857" stroke-width="2"/>
      <rect x="16" y="34" width="14" height="14" rx="4" fill="#34d399" stroke="#047857" stroke-width="2"/>
      <rect x="34" y="34" width="14" height="14" rx="4" fill="#059669" stroke="#047857" stroke-width="2"/>
      <circle cx="23" cy="23" r="2" fill="#ffffff"/>
      <circle cx="41" cy="41" r="2" fill="#ffffff"/>`
    },

    'chibi-web': {
      label: 'Website doanh nghiệp',
      svg: `<circle cx="32" cy="32" r="30" fill="#e0f2fe"/>
      <circle cx="32" cy="32" r="17" fill="#38bdf8" stroke="#0369a1" stroke-width="2.2"/>
      <ellipse cx="32" cy="32" rx="8" ry="17" fill="none" stroke="#ffffff" stroke-width="1.8"/>
      <line x1="15" y1="32" x2="49" y2="32" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="27" cy="28" r="1.8" fill="#0f172a"/>
      <circle cx="37" cy="28" r="1.8" fill="#0f172a"/>
      <path d="M29.5 31.5 Q32 33.8 34.5 31.5" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>`
    }
  };

  function buildSvg(name, size = 28, extraClass = '') {
    const item = CHIBI_REGISTRY[name];
    if (!item) return '';
    return `<svg class="chibi-iso-svg ${extraClass}" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${item.label}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; flex-shrink:0; filter:drop-shadow(0 2px 4px rgba(15,23,42,0.08));">${item.svg}</svg>`;
  }

  function hydrate(root = document) {
    if (!root || !root.querySelectorAll) return;
    const nodes = root.querySelectorAll('[data-chibi]');
    nodes.forEach((el) => {
      const name = el.getAttribute('data-chibi');
      const size = parseInt(el.getAttribute('data-size') || '28', 10);
      const cls = el.getAttribute('class') || '';
      const svgHtml = buildSvg(name, size, cls);
      if (svgHtml) {
        el.outerHTML = svgHtml;
      }
    });
  }

  global.ChibiIcons = {
    version: '1.0.0-ISO',
    registry: CHIBI_REGISTRY,
    get: buildSvg,
    hydrate: hydrate
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => hydrate(document));
  } else {
    hydrate(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
