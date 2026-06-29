# 👩‍🌾 Cổng Nông Hộ (User Panel) - `/user`

Thư mục này chứa giao diện làm việc hàng ngày của các nông hộ và công nhân chăm sóc cây trồng tại trang trại.

## 📌 Mục đích
Tối ưu hóa các thao tác thực địa cho nông hộ trên thiết bị di động và máy tính:
1. **Bản đồ vệ tinh trang trại phụ trách**: Chỉ hiển thị ranh giới trang trại và các cây trồng thuộc quyền quản lý của nông hộ đó.
2. **Nhắc nhở công việc thông minh**: 
   * Cảnh báo cây chưa được tưới nước hôm nay.
   * Cảnh báo cây đã quá 7 ngày chưa được bón phân.
3. **Canh tác nhanh (1-Click Log)**: Nút "Tưới nhanh" hoặc "Bón nhanh" cho phép ghi nhận trực tiếp hoạt động chăm sóc mà không cần điền form phức tạp.
4. **Nhật ký canh tác chi tiết**: Hộp thoại modal ghi nhận đầy đủ chi tiết (phương pháp tưới, lượng nước, loại phân, loại thuốc, triệu chứng bệnh...) đồng bộ với danh sách chuẩn từ Admin.

---

## 📂 Cấu trúc Tệp tin

*   **`index.html`**: File giao diện SPA chứa Welcome banner, Bảng danh sách cây trồng, Bảng hoạt động canh tác 3 ngày gần nhất và hộp thoại Modal chăm sóc cây.
*   **`css/`**:
    *   `user-layout.css`: Chứa toàn bộ Layout responsive di động, các thẻ card cao cấp, bảng dữ liệu, alerts, modal popup và các CSS marker Mapbox (bao gồm lớp `.low-zoom` biến marker thành chấm tròn khi thu nhỏ bản đồ).
*   **`js/`**:
    *   `app.js`: Quản lý nạp dữ liệu từ API `/api/farms`, `/api/plants`, `/api/config` và `/api/plants/logs/recent`; Quản lý Mapbox vệ tinh của nông hộ; Xử lý logic nhắc nhở, hoạt động ghi nhật ký nhanh và chi tiết.
    *   `auth.js`: Quản lý đăng nhập, lưu trữ token, đăng xuất và tự động định tuyến (nhân viên/nông hộ đăng nhập sẽ ở lại trang này, nếu Admin đăng nhập tại đây sẽ tự động chuyển sang trang `/admin`).

---

## ⚙️ Hướng dẫn bảo trì & mở rộng
*   **Thay đổi thuật toán nhắc nhở**: Chỉnh sửa hàm `renderUserReminders` trong `js/app.js` nếu muốn thay đổi mốc thời gian cảnh báo bón phân (mặc định là 7 ngày) hoặc thêm các nhắc nhở phun thuốc trừ sâu.
*   **Mở rộng biểu mẫu hoạt động chăm sóc**: 
    1. Thêm thẻ `<option>` mới vào dropdown `#c-log-type` trong `index.html`.
    2. Viết thêm khối HTML sinh trường động trong hàm `onCareLogTypeChange()` ở `js/app.js`.
    3. Cập nhật logic thu thập dữ liệu và gửi request lên API backend trong hàm `saveCareLog()` ở `js/app.js`.
