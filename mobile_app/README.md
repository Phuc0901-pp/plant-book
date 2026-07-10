# 📱 Plant Book — Flutter Client di động

Thư mục này chứa khung dự án di động **Flutter Client** được tổ chức theo cấu trúc phân tách rõ ràng chuyên nghiệp (`pages`, `components`, `models`, `services`) kết nối với API Backend hiện có.

---

## 🛠️ Yêu cầu cài đặt & Chuẩn bị
1. **Flutter SDK**: Đảm bảo máy tính của bạn đã cài đặt Flutter (phiên bản `>= 3.0.0`). Kiểm tra bằng lệnh:
   ```bash
   flutter --version
   ```
2. **IDE**: Khuyên dùng **VS Code** (cài thêm Extension `Flutter` & `Dart`) hoặc **Android Studio**.
3. **Môi trường chạy**: Thiết bị thật Android/iOS hoặc Trình giả lập (Android Emulator / iOS Simulator).

---

## 📂 Cấu trúc dự án
Mã nguồn Dart chính nằm trong thư mục `lib/`:
* `lib/main.dart`: Thiết lập định tuyến (Routing) và khởi chạy ứng dụng.
* `lib/utils/theme.dart`: Thiết lập bảng màu Brand (Xanh lá / Cam nhạt của Nông hộ) và kiểu dáng chữ.
* `lib/services/api_service.dart`: Gọi API đăng nhập, lưu token JWT vào bộ nhớ thiết bị, và tải dữ liệu trang trại/cây trồng.
* `lib/models/`: Định nghĩa kiểu dữ liệu `Farm` và `Plant` (Parse JSON an toàn).
* `lib/pages/`: Các màn hình chính (LoginPage, DashboardPage).
* `lib/components/`: Các thành phần giao diện con tái sử dụng (`FarmCard`, `PlantCard`, `LoadingIndicator`).

---

## 🚀 Hướng dẫn chạy ứng dụng

### Bước 1: Khởi động Backend Server
Đảm bảo máy chủ Backend Node.js đang chạy trên cổng 3000:
```bash
cd backend
npm run dev # hoặc node server.js
```

### Bước 2: Tải các thư viện di động (Dependencies)
Mở cửa sổ dòng lệnh tại thư mục `mobile_app/` và chạy:
```bash
flutter pub get
```

### Bước 3: Chạy ứng dụng di động
Mở trình giả lập di động hoặc cắm thiết bị thật vào máy tính, sau đó chạy lệnh:
```bash
flutter run
```

---

## 🌐 Lưu ý về địa chỉ kết nối API (Base URL)
Trong file `lib/services/api_service.dart`, biến `baseUrl` đã được cấu hình tự động nhận diện môi trường:
* Khi chạy trên **Android Emulator**: sử dụng địa chỉ `http://10.0.2.2:3000` (địa chỉ máy thật do máy ảo Android ánh xạ).
* Khi chạy trên **iOS Simulator / Thiết bị thật**: sử dụng địa chỉ IP của máy tính trong mạng cục bộ (ví dụ: `http://192.168.1.XX:3000`).
