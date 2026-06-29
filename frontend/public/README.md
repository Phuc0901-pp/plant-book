# 🌐 Cổng Công Khai (Public Portal) - `/public`

Thư mục này chứa giao diện hiển thị thông tin công khai của cây trồng và hỗ trợ nông hộ/người dùng ghi nhật ký nhanh thông qua quét QR/NFC.

## 📌 Mục đích
1. **Hồ sơ cây trồng công khai (`/plant/:slug`)**: Hiển thị chi tiết thông tin giống cây, tuổi cây, quy trình chăm sóc hiện tại và bản đồ vị trí cây đó cho khách tham quan hoặc đối tác.
2. **Báo cáo lịch trình canh tác (`/plant/:slug/report`)**: Cung cấp trang in ấn/báo cáo sạch sẽ, trực quan cho toàn bộ lịch sử tưới nước, bón phân, bệnh lý của cây.
3. **Ghi nhật ký nhanh từ mã QR**: Người dùng thực địa (không cần đăng nhập) có thể sử dụng các form rút gọn để ghi nhận nhanh 6 hoạt động:
   * 💧 Tưới nước
   * 🍃 Bón phân
   * 💊 Phun thuốc
   * ✂️ Cắt cành/lá
   * 🌸 Tỉa hoa/quả
   * 🐛 Bệnh cây

---

## 📂 Cấu trúc Tệp tin

*   **`plant.html`**: Giao diện hiển thị hồ sơ cây công khai, tích hợp các nút popup ghi nhanh hoạt động và thư viện ảnh/video.
*   **`report.html`**: Giao diện báo cáo lịch trình, lọc thời gian và hỗ trợ xuất file PDF hoặc in ấn trực tiếp từ trình duyệt.
*   **`css/`**:
    *   `plant.css`: Kiểu dáng kính mờ (Glassmorphism), hiệu ứng chuyển động, màu sắc quy trình chăm sóc của trang hồ sơ cây.
    *   `report.css`: Kiểu dáng đơn giản, tối ưu hóa bố cục khi in ấn (print stylesheet).
*   **`js/`**:
    *   `plant.js`: Nạp dữ liệu cây từ API công khai, khởi tạo bản đồ Mapbox cá nhân của cây, xử lý đóng/mở modal và submit log nhanh không cần token.
    *   `report.js`: Xử lý bộ lọc khoảng thời gian, tổng hợp thống kê số lượt chăm sóc và hiển thị bản đồ di chuyển/hoạt động.

---

## ⚙️ Hướng dẫn bảo trì & mở rộng
*   **Sửa cấu trúc in ấn**: Cập nhật file `css/report.css` trong khối `@media print` để thay đổi cách ẩn/hiện các nút công cụ khi in trang báo cáo.
*   **Chỉnh sửa giao diện ghi nhanh**: Các modal gửi dữ liệu chăm sóc trực tiếp được xử lý qua API công khai ở backend (`/api/plants/public/:slug/logs`). Nếu thay đổi cấu trúc dữ liệu gửi đi, cần cập nhật tương ứng tại file `js/plant.js`.
