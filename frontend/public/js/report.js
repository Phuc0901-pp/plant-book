    // Global State
    let plantData = null;

    // Helpers
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
      const dateObj = new Date(d);
      return dateObj.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
    }

    function formatTime(d) {
      if (!d) return '—';
      const dateObj = new Date(d);
      return dateObj.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
    }

    function getLogDetailsText(log) {
      const details = log.details || {};
      if (log.log_type === 'Tưới nước') {
        return `Phương pháp: ${esc(details.method || '—')} | Lượng nước: ${esc(details.amount || '—')} ${esc(details.unit || '')}`;
      }
      if (log.log_type === 'Bón phân') {
        return `Loại phân: ${esc(details.type || '—')} | Lượng bón: ${esc(details.amount || '—')} ${esc(details.unit || '')} | Tên phân: ${esc(details.fertilizer_name || '—')}`;
      }
      if (log.log_type === 'Phun thuốc') {
        return `Loại thuốc: ${esc(details.type || '—')} | Tên thuốc: ${esc(details.pesticide_name || '—')} | Liều lượng: ${esc(details.amount || '—')} | Lý do: ${esc(details.reason || '—')}`;
      }
      if (log.log_type === 'Cắt lá') {
        return `Số cành/lá cắt tỉa: ${esc(details.amount || '—')} | Lý do: ${esc(details.reason || '—')}`;
      }
      if (log.log_type === 'Tỉa hoa') {
        return `Số bông/trái tỉa bớt: ${esc(details.amount || '—')} | Lý do: ${esc(details.reason || '—')}`;
      }
      if (log.log_type === 'Bệnh cây') {
        return `Bệnh: ${esc(details.disease_name || 'Bệnh chưa xác định')} | Mức độ: ${esc(details.severity || '—')} | Mô tả: ${esc(details.description || '—')}`;
      }
      return '';
    }

    // Copy link function
    function copyReportLink() {
      const btn = document.getElementById('btn-copy-link');
      navigator.clipboard.writeText(window.location.href).then(() => {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
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

    // Initialization
    async function initReport() {
      try {
        // Parse Slug from URL (/plant/:slug/report)
        const pathParts = window.location.pathname.split('/');
        // Format pathParts: ['', 'plant', ':slug', 'report']
        const slug = pathParts[2];
        if (!slug) throw new Error("Mã định danh cây trồng trống.");

        // Parse query params
        const urlParams = new URLSearchParams(window.location.search);
        const fromDate = urlParams.get('from');
        const toDate = urlParams.get('to');
        const categoriesParam = urlParams.get('categories');
        const checkedCats = categoriesParam ? categoriesParam.split(',') : [];

        // Fetch Plant Data
        const res = await fetch(`/api/plants/public/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Không tìm thấy thông tin hồ sơ cây trồng.');
        }
        plantData = await res.json();

        // Render current extraction time
        const now = new Date();
        document.getElementById('report-time').textContent = `Trích xuất lúc: ${formatDate(now)} ${formatTime(now)}`;

        // Populate Plant Specs
        document.getElementById('plant-id').textContent = `#${plantData.id}`;
        document.getElementById('plant-type').textContent = plantData.plant_type || '—';
        document.getElementById('plant-variety').textContent = plantData.plant_variety || '—';
        document.getElementById('plant-age').textContent = plantData.plant_age || '—';
        document.getElementById('plant-location').textContent = plantData.location || '—';
        document.getElementById('plant-farm').textContent = plantData.farm_name || '—';
        
        const hasCoords = plantData.latitude && plantData.longitude;
        document.getElementById('plant-gps').textContent = hasCoords 
          ? `${plantData.latitude}, ${plantData.longitude}` 
          : '—';

        // Filter and Sort Logs
        const logs = plantData.logs || [];
        const filteredLogs = logs.filter(log => {
          const logDateStr = new Date(log.log_date).toISOString().split('T')[0];
          const isWithinDate = (!fromDate || logDateStr >= fromDate) && (!toDate || logDateStr <= toDate);
          
          // If no categories filter given, match all; otherwise check containment
          const isMatchedCat = checkedCats.length === 0 || checkedCats.includes(log.log_type);
          return isWithinDate && isMatchedCat;
        });
        filteredLogs.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

        // Render Summary text
        const summaryText = `Thời gian báo cáo: từ <strong>${fromDate ? formatDate(fromDate) : 'ngày đầu số hóa'}</strong> đến <strong>${toDate ? formatDate(toDate) : 'hiện tại'}</strong>. Đã lọc <strong>${filteredLogs.length}</strong> nhật ký hoạt động.`;
        document.getElementById('report-summary').innerHTML = summaryText;

        // Render Logs table
        const tableContainer = document.getElementById('table-container');
        if (filteredLogs.length === 0) {
          tableContainer.innerHTML = `<div class="no-data">Không có hoạt động canh tác nào khớp với khoảng thời gian và hạng mục đã chọn.</div>`;
        } else {
          let tableHtml = `
            <table>
              <thead>
                <tr>
                  <th style="width: 15%">Ngày thực hiện</th>
                  <th style="width: 20%">Hoạt động</th>
                  <th style="width: 45%">Nội dung chi tiết</th>
                  <th style="width: 20%">Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          filteredLogs.forEach(l => {
            const detailsText = getLogDetailsText(l);
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
                      <a href="${url}" target="_blank">Xem video nhật ký bệnh cây</a>
                    </div>
                  `);
                } else {
                  imgHtmls.push(`
                    <img src="${url}" class="media-thumb" onclick="window.open('${url}', '_blank')">
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

            tableHtml += `
              <tr>
                <td><strong>${formatDate(l.log_date)}</strong></td>
                <td><span class="log-type">${esc(l.log_type)}</span></td>
                <td>
                  ${detailsText ? `<div style="font-weight: 500; margin-bottom: 4px;">${detailsText}</div>` : ''}
                  ${l.note ? `<div class="log-note">${esc(l.note)}</div>` : ''}
                  ${mediaHtml}
                </td>
                <td>${esc(l.creator_name || 'Công nhân / Khách')}</td>
              </tr>
            `;
          });
          
          tableHtml += `
              </tbody>
            </table>
          `;
          tableContainer.innerHTML = tableHtml;
        }

        // Hide Loader, Show Content
        document.getElementById('loader').style.display = 'none';
        document.getElementById('report-content').style.display = 'block';

        // Load map if coordinates or boundary polygon exist
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

    // Mapbox Initialization
    async function initReportMap(hasCoords, hasBoundary) {
      let mapboxToken = '';
      try {
        const tokenRes = await fetch('/api/config/mapbox-token');
        const tokenData = await tokenRes.json();
        mapboxToken = tokenData.token;
      } catch (e) {
        console.error('Không thể lấy Mapbox Token:', e);
      }

      if (!mapboxToken) return;
      mapboxgl.accessToken = mapboxToken;

      const centerLng = parseFloat(plantData.longitude || 105.0);
      const centerLat = parseFloat(plantData.latitude || 16.0);

      const map = new mapboxgl.Map({
        container: 'report-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [centerLng, centerLat],
        zoom: 15,
        interactive: true,
        attributionControl: false
      });

      map.on('load', () => {
        addContourLinesToMap(map);
        const bounds = new mapboxgl.LngLatBounds();
        let hasBounds = false;

        // Draw Farm Boundary Polygon
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

        // Draw Plant Location Marker
        if (hasCoords) {
          const lat = parseFloat(plantData.latitude);
          const lng = parseFloat(plantData.longitude);

          const el = document.createElement('div');
          el.style.width = '26px';
          el.style.height = '26px';
          el.style.backgroundColor = '#22c55e';
          el.style.border = '2px solid white';
          el.style.borderRadius = '50%';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          el.innerHTML = '<span style="font-size: 11px;">🌱</span>';

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

/**
 * Thêm đường đồng mức mật độ cao (Contour Lines), dải màu cao độ quang phổ (Elevation Spectrum Gradient)
 * và nút Bật/Tắt đường đồng mức kèm Bảng chú giải cao độ (Elevation Legend).
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true }
 */
function addContourLinesToMap(map, options = {}) {
  if (!map) return;
  const defaultVisible = options.defaultVisible !== false;
  const showControl = options.showControl !== false;

  const initContours = () => {
    try {
      // 1. Thêm nguồn Terrain DEM cho 3D địa hình gồ gồ
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      // 2. Thêm nguồn Vector Đường Đồng Mức (Mapbox Terrain v2)
      if (!map.getSource('mapbox-terrain-contours')) {
        map.addSource('mapbox-terrain-contours', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-terrain-v2'
        });
      }

      // Dải màu dốc cao độ dải quang phổ (Spectrum Elevation Color Ramp: Xanh dương -> Xanh ngọc -> Xanh lá -> Vàng -> Cam -> Đỏ)
      const contourColorRamp = [
        'interpolate',
        ['linear'],
        ['get', 'ele'],
        0,    '#1d4ed8', // 0m: Xanh dương đậm
        100,  '#0284c7', // 100m: Xanh biển
        300,  '#06b6d4', // 300m: Xanh lam sáng
        450,  '#10b981', // 450m: Xanh lá cây
        490,  '#22c55e', // 490m: Xanh lá mạ
        500,  '#84cc16', // 500m: Xanh đọt chuối
        504,  '#eab308', // 504m: Vàng tươi
        508,  '#f97316', // 508m: Cam
        512,  '#ef4444', // 512m: Đỏ tươi
        800,  '#dc2626', // 800m: Đỏ sẫm
        1500, '#991b1b'  // 1500m: Đỏ đậm
      ];

      // 3. Lớp Đường Đồng Mức Năng Động Mật Độ Cao (High-Density Contour Lines)
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

      // 4. Lớp nhãn số chỉ cao độ m (Contour Elevation Labels)
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

      // 5. Nút Bật/Tắt đường đồng mức (Custom Mapbox Control Button)
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
            btn.title = 'Bật/Tắt đường đồng mức mật độ cao (Contour Lines)';
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
              if (m.getLayer('contour-lines')) m.setLayoutProperty('contour-lines', 'visibility', visVal);
              if (m.getLayer('contour-labels')) m.setLayoutProperty('contour-labels', 'visibility', visVal);

              btn.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btn.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget');
              if (legendEl) legendEl.style.display = isVisible ? 'flex' : 'none';
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

        // 6. Thêm Bảng Chú Giải Dải Màu Cao Độ (Elevation Spectrum Legend Widget)
        const mapContainer = map.getContainer();
        if (mapContainer && !mapContainer.querySelector('.elevation-legend-widget')) {
          const legend = document.createElement('div');
          legend.className = 'elevation-legend-widget';
          legend.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 10px;
            z-index: 8;
            background: rgba(7, 25, 16, 0.88);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            padding: 8px 10px;
            color: #fff;
            font-size: 11px;
            display: ${defaultVisible ? 'flex' : 'none'};
            flex-direction: column;
            align-items: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            pointer-events: none;
          `;
          legend.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px; font-size:10px; text-transform:uppercase; color:#9ca3af; letter-spacing:0.5px;">Cao độ (m)</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="
                width: 10px;
                height: 110px;
                border-radius: 5px;
                background: linear-gradient(to top, #1d4ed8, #06b6d4, #10b981, #84cc16, #eab308, #f97316, #ef4444);
                border: 1px solid rgba(255,255,255,0.3);
              "></div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; height:110px; font-size:9px; font-weight:700; color:#e5e7eb;">
                <span style="color:#ef4444;">Cao ▲</span>
                <span style="color:#eab308;">TB</span>
                <span style="color:#06b6d4;">Thấp ▼</span>
              </div>
            </div>
          `;
          mapContainer.appendChild(legend);
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

