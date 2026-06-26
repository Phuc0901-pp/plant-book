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

    // Run Startup logic
    window.onload = initReport;
