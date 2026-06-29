/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/media.js — File upload preview, watermark & lightbox
   ═══════════════════════════════════════════════════════════════ */

import { esc } from '../core/utils.js';

/** Danh sách file media đã chọn cho nhật ký chăm sóc hiện tại */
export let selectedCareFiles = [];

/**
 * Xoá danh sách file đã chọn (gọi khi mở modal mới).
 */
export function clearSelectedFiles() {
  selectedCareFiles = [];
}

/**
 * Xử lý khi người dùng chọn file từ camera hoặc thư viện.
 * Tích luỹ các file vào selectedCareFiles và hiển thị thumbnail xem trước.
 * @param {'capture'|'library'} source
 */
export function onCareMediaSelected(source) {
  const inputId = source === 'capture' ? 'c-detail-media-capture' : 'c-detail-media-library';
  const input   = document.getElementById(inputId);
  const preview = document.getElementById('c-media-preview');
  if (!input || !preview) return;

  const newFiles = Array.from(input.files);
  selectedCareFiles = selectedCareFiles.concat(newFiles);
  preview.innerHTML = '';

  if (selectedCareFiles.length === 0) return;

  selectedCareFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = Object.assign(document.createElement('div'), {});
      Object.assign(div.style, {
        position: 'relative', width: '64px', height: '64px',
        borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--gray-200)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      });

      if (file.type.startsWith('image/')) {
        div.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        div.innerHTML = `
          <div style="width:100%;height:100%;background:var(--gray-100);display:flex;align-items:center;justify-content:center;">
            <i class="fa-solid fa-video" style="color:var(--text-muted)"></i>
          </div>`;
      }
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Đóng dấu watermark lên ảnh bệnh cây.
 * Ghi thông tin: Mã cây / Thời gian / Tên bệnh vào góc dưới ảnh.
 * @param {File} file
 * @param {string} treeCode
 * @param {string} diseaseName
 * @returns {Promise<File>}
 */
export function watermarkImage(file, treeCode, diseaseName) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');

        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const padding  = Math.max(16, Math.round(canvas.width * 0.03));
        const fontSize = Math.max(14, Math.round(canvas.width * 0.025));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const timeStr   = new Date().toLocaleString('vi-VN');
        const textLines = [
          `Mã cây: ${treeCode}`,
          `Thời gian: ${timeStr}`,
          `Tên bệnh: ${diseaseName || 'Chưa xác định'}`
        ];

        const textHeight = textLines.length * (fontSize + 6) + padding * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, canvas.height - textHeight, canvas.width, textHeight);

        ctx.fillStyle   = '#ffffff';
        ctx.textBaseline = 'top';
        textLines.forEach((line, idx) => {
          ctx.fillText(line, padding, canvas.height - textHeight + padding + idx * (fontSize + 8));
        });

        canvas.toBlob((blob) => {
          resolve(blob
            ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })
            : file
          );
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Mở lightbox xem ảnh hoặc video toàn màn hình.
 * Click vào bất kỳ vùng nào để đóng.
 * @param {string} url
 * @param {'image'|'video'} type
 */
export function openLightbox(url, type) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.9)', zIndex: '2000',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px'
  });
  overlay.onclick = () => overlay.remove();

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '20px', right: '20px',
    background: 'none', border: 'none', color: '#fff',
    fontSize: '40px', cursor: 'pointer'
  });
  overlay.appendChild(closeBtn);

  if (type === 'video') {
    const video = Object.assign(document.createElement('video'), {
      src: url, controls: true, autoplay: true
    });
    Object.assign(video.style, { maxWidth: '100%', maxHeight: '90vh' });
    overlay.appendChild(video);
  } else {
    const img = Object.assign(document.createElement('img'), { src: url });
    Object.assign(img.style, { maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' });
    overlay.appendChild(img);
  }

  document.body.appendChild(overlay);
}

/**
 * Tạo HTML thumbnail media (dùng chung cho bảng nhật ký).
 * @param {Array} mediaUrls — mảng { url, type } hoặc string URL
 * @param {number} size — kích thước thumbnail (px), mặc định 40
 * @returns {string} HTML string
 */
export function buildMediaThumbnailsHtml(mediaUrls, size = 40) {
  if (!mediaUrls || mediaUrls.length === 0) return '';
  const thumbs = mediaUrls.map(m => {
    const url     = m.url || m;
    const isVideo = (m.type === 'video') || /\.(mp4|mov|avi|mkv|webm)/i.test(url);
    if (isVideo) {
      return `<div style="width:${size}px;height:${size}px;border-radius:4px;overflow:hidden;position:relative;cursor:pointer;background:#000;flex-shrink:0;" onclick="openLightbox('${esc(url)}','video')">
        <video src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;"></video>
        <i class="fa fa-play-circle" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:11px;"></i>
      </div>`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:4px;overflow:hidden;cursor:pointer;flex-shrink:0;" onclick="openLightbox('${esc(url)}','image')">
      <img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;">
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:6px;margin-top:6px;overflow-x:auto;padding-bottom:4px;">${thumbs}</div>`;
}
