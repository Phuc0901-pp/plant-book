# 📱 User Portal — Frontend

## Cấu trúc Module (sau tái cấu trúc)

```
frontend/user/
├── index.html              ← SPA duy nhất, 4-tab mobile app
├── css/
│   └── user-layout.css     ← Toàn bộ CSS (mobile-first responsive)
└── js/
    ├── app.js              ← Entry point (slim ~40 dòng): import + expose window
    ├── auth.js             ← Login / logout / token verification
    ├── core/               ← Tiện ích dùng chung
    │   ├── api.js          ← Token, api() fetch helper
    │   ├── utils.js        ← toast(), esc(), healthBadge(), formatDate()
    │   └── router.js       ← showPage(), toggleMobileSidebar()
    └── modules/            ← Nghiệp vụ theo từng chức năng
        ├── dashboard.js    ← loadUserDashboard() — orchestrator chính
        ├── plants.js       ← Render + filter danh sách cây
        ├── logs.js         ← Render + filter nhật ký chăm sóc
        ├── reminders.js    ← Nhắc nhở + cảnh báo bệnh + quickCare
        ├── map.js          ← Bản đồ Mapbox GIS
        ├── care-modal.js   ← Modal ghi nhật ký (open/close/save)
        ├── media.js        ← Chọn file, watermark ảnh, lightbox viewer
        └── fab.js          ← Nút nổi (+) kéo rê
```

## Quy tắc phát triển

### Thêm loại hoạt động chăm sóc mới
→ Sửa `modules/care-modal.js`, hàm `_buildDetailFields(logType, configs)`

### Thêm trường filter mới cho nhật ký
→ Sửa `modules/logs.js`, hàm `filterUserLogs()`

### Thêm nhắc nhở mới
→ Sửa `modules/reminders.js`, hàm `renderUserReminders(plants)`

### Thêm loại media mới
→ Sửa `modules/media.js`, hàm `buildMediaThumbnailsHtml()`

### Thêm field mới vào UI
→ Sửa `index.html` (thêm HTML element)
→ Thêm logic trong module tương ứng
→ Nếu cần expose ra HTML onclick: thêm vào `app.js` (`window.xxx = xxx`)

## Dependency Graph

```
app.js
 ├── core/router.js
 ├── modules/dashboard.js
 │   ├── core/api.js
 │   ├── core/utils.js
 │   ├── modules/plants.js   → core/utils.js
 │   ├── modules/logs.js     → core/utils.js, modules/media.js
 │   ├── modules/reminders.js → core/api.js, core/utils.js, modules/plants.js, modules/logs.js, modules/media.js
 │   ├── modules/fab.js      (độc lập, gọi window.openCareModal)
 │   └── modules/map.js      → core/api.js, core/utils.js
 ├── modules/plants.js
 ├── modules/logs.js
 ├── modules/reminders.js
 ├── modules/care-modal.js   → core/api.js, core/utils.js, modules/media.js
 └── modules/media.js        → core/utils.js

auth.js
 ├── core/api.js
 └── core/router.js
```

## Circular Import Prevention
Để tránh vòng lặp import giữa các module:
- `dashboard.js` expose cache qua hàm getter `getPlantsCache()` / `getLogsCache()`
- `care-modal.js` và `reminders.js` truy cập config qua `window._allConfigsCache`
- `fab.js` gọi `window.openCareModal` (không import trực tiếp từ care-modal)
- `router.js` gọi `window.loadUserDashboard` (không import trực tiếp từ dashboard)
