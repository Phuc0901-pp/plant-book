# 🔐 Thư mục Quản trị (Admin Panel) - `/admin`

Thư mục này chứa toàn bộ mã nguồn giao diện quản trị viên của hệ thống **Plant Book**.

## 📌 Mục đích
Dành cho người quản lý hệ thống (Admin) thực hiện các tác vụ:
1. Quản lý bản đồ GIS trang trại (vẽ ranh giới đất, định vị cây trồng).
2. Thiết lập quy trình chăm sóc (Tưới nước, Bón phân, Phun thuốc, Cắt cành/lá, Tỉa hoa/quả, Bệnh cây).
3. Quản lý danh sách cây trồng (Thêm, Sửa, Xóa, Lọc, Import dữ liệu cây trồng bằng CSV).
4. Quản lý tài khoản nông hộ (Tạo tài khoản và gán trang trại quản lý).
5. Quản lý cấu hình chung của hệ thống.

---

## 📂 Cấu trúc Tệp tin

*   **`index.html`**: File giao diện SPA (Single Page Application) chính chứa khung sidebar, các tab chức năng và hộp thoại modal quản trị.
*   **`css/`**:
    *   `admin-layout.css`: Cấu trúc Layout lưới, Sidebar, Topbar và các thành phần giao diện khung xương.
    *   `admin-components.css`: Định nghĩa các thành phần UI chung (Card, Table, Button, Form inputs, Badge, Modal, Alert...).
    *   `admin-gis.css`: Các lớp CSS đặc thù cho Mapbox (Markers, Tooltips, Zoom classes...).
*   **`js/`**:
    *   `app.js`: Quản lý bộ điều hướng (Router), sidebar mobile, xác thực token và khởi chạy trang.
    *   `dashboard.js`: Xử lý nạp dữ liệu thống kê, biểu đồ tổng quan và sự kiện tương tác trên Dashboard.
    *   `gis.js`: Chứa logic bản đồ Mapbox (Vẽ polygon trang trại, định vị cây trồng, quản lý Mapbox Draw, chế độ zoom xa/gần).
    *   `media.js`: Xử lý tải ảnh/video lên Supabase Storage và quản lý lịch sử nhật ký chăm sóc cây trồng.
    *   `plants.js`: Quản lý danh mục cây trồng, form thêm/sửa, bộ lọc lồng nhau và logic Import tệp CSV.
    *   `users.js`: Quản lý tài khoản người dùng, thêm mới tài khoản nông hộ.

---

## ⚙️ Hướng dẫn bảo trì & mở rộng
*   **Thêm bộ lọc mới**: Chỉnh sửa HTML trong `index.html` (phần `.search-bar` tương ứng) và cập nhật logic lọc trong file JS tương ứng (ví dụ: `plants.js`).
*   **Cập nhật Marker bản đồ**: Chỉnh sửa định dạng CSS của `.plant-id-marker` trong `admin-gis.css` hoặc logic vẽ marker trong `gis.js`. Chú ý lớp `.low-zoom` được sử dụng để chuyển số hiển thị thành chấm tròn khi bản đồ thu nhỏ.
