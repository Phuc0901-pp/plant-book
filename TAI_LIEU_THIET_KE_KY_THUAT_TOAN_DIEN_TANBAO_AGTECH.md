# HỒ SƠ THIẾT KẾ KỸ THUẬT TOÀN DIỆN HỆ THỐNG SỔ NÔNG SỐ & TRỢ LÝ AI TÂN BẢO AGTECH v1.1.1
## (ENTERPRISE TECHNICAL SYSTEM SPECIFICATION & ARCHITECTURAL BLUEPRINT)

```
========================================================================================================
TỔNG CÔNG TY NÔNG NGHIỆP CÔNG NGHỆ CAO TÂN BẢO (TANBAO AGTECH CORPORATION)
MÃ TÀI LIỆU: TDD-TB-AGTECH-2026 | PHIÊN BẢN HỆ THỐNG: v1.1.1 | NGÀY BAN HÀNH: 25/08/2026
QUY CHUẨN KỸ THUẬT: IEEE 1016-2009, ISO/IEC 25010, TOGAF 9.2, VIETGAP / GLOBALGAP, ISO/IEC 11558
========================================================================================================
```

---

# MỤC LỤC TỔNG QUAN

1. **CHƯƠNG I: TỔNG QUAN HẠ TẦNG PHÂN TẦNG VÀ DÒNG CHẢY DỮ LIỆU**
2. **CHƯƠNG II: MA TRẬN PHÂN QUYỀN VÀ QUẢN TRỊ NGƯỜI DÙNG (USER VS ADMIN)**
3. **CHƯƠNG III: ĐẶC TẢ CHI TIẾT TỪNG TÍNH NĂNG VÀ SƠ ĐỒ QUY TRÌNH VẬN HÀNH (12 DIAGRAMS)**
   * *Tính năng 1:* Xác thực JWT, Cấp mã ISO Hash ID & Phân luồng Dữ liệu Scoped
   * *Tính năng 2:* Khởi tạo Trang trại Vệ tinh GPS & Bản đồ Ranh giới GIS Mapbox
   * *Tính năng 3:* Số hóa Cây trồng (Tree Digital Twin) & Gán Thẻ NFC/Mã QR Thực địa
   * *Tính năng 4:* Tương tác 1-Chạm "Bé Mầm Ôm Nút Dấu Cộng (+)" & Menu 2 Hành động
   * *Tính năng 5:* Ghi Nhật ký Canh tác Thực địa & Kiểm soát Cảnh báo PHI VietGAP
   * *Tính năng 6:* Camera AI OCR Quét Hóa đơn/Bao bì & Tự động Tính Chi phí, Trừ Kho
   * *Tính năng 7:* Trợ lý AI Bé Mầm - Điều hướng Mô hình Động & Chuỗi Auto-Failover
   * *Tính năng 8:* Trạm Quan trắc IoT Đất/Khí tượng & Bộ Quy tắc Cảnh báo Sớm (Rule Engine)
   * *Tính năng 9:* PWA Offline-First, Bộ nhớ Đệm IndexedDB & Đồng bộ Dữ liệu Nền
   * *Tính năng 10:* Executive Admin Command Center & Phê duyệt Nông hộ 3 Bước
   * *Tính năng 11:* Mô hình Quan hệ Thực thể Cơ sở Dữ liệu Toàn diện (Complete ERD)
   * *Tính năng 12:* Kiến trúc Bộ nhớ đệm Redis & Chiến lược Chịu tải 5.000 - 50.000 Users
4. **CHƯƠNG IV: QUY TẮC VẬN HÀNH, BẢO MẬT VÀ NGUYÊN TẮC BẢO TRÌ HỆ THỐNG**

---

# CHƯƠNG I: TỔNG QUAN HẠ TẦNG PHÂN TẦNG VÀ DÒNG CHẢY DỮ LIỆU

Hệ thống **Sổ Nông Số Tân Bảo AgTech v1.1.1** được xây dựng theo kiến trúc **Module-Monolith hiệu năng cao**, tối ưu hóa để vận hành tại các vùng nông nghiệp có hạ tầng viễn thông hạn chế nhưng vẫn đảm bảo khả năng mở rộng quy mô lớn cho doanh nghiệp.

```mermaid
flowchart TB
    subgraph CLIENT_TIER["📱 TẦNG GIAO DIỆN ĐA NỀN TẢNG (CLIENT INTERFACE LAYER)"]
        direction TB
        subgraph USER_CLIENT["🧑‍🌾 CỔNG NÔNG HỘ (PWA Mobile & Web)"]
            UC1["🌤️ Dashboard Vi Khí Hậu Open-Meteo"]
            UC2["🌳 Bản Đồ Cây Trồng & Quét NFC / QR"]
            UC3["🍐 Bé Mầm Ôm Nút (+) Ghi Nhật Ký 1-Chạm"]
            UC4["📦 Kho Vật Tư & Camera AI OCR Bóc Giá"]
            UC5["💬 Trợ Lý AI Scoped Cho Riêng Nông Hộ"]
        end
        subgraph ADMIN_CLIENT["🛡️ CỔNG QUẢN TRỊ (Admin Command Center)"]
            AC1["📊 Executive Executive Dashboard & Doanh Thu"]
            AC2["🗺️ Bản Đồ Vệ Tinh GIS Mapbox (Polygon Tool)"]
            AC3["📡 Trạm Quan Trắc IoT & Rule Engine Cảnh Báo"]
            AC4["👥 Phê Duyệt Nông Hộ 3 Bước (ISO Hash ID)"]
            AC5["💰 Kiểm Toán Chi Phí & Hồ Sơ VietGAP Xuất Khẩu"]
        end
    end

    subgraph NETWORK_GATEWAY["🔒 TẦNG ĐIỀU PHỐI & BẢO MẬT (API GATEWAY & SECURITY)"]
        GW1["SSL/TLS (HTTPS & Secure WSS)"]
        GW2["JWT Token Validation & ISO Role Guard"]
        GW3["Per-User Scoped Data Authorization Middleware"]
        GW4["Cloudflare Edge CDN (Static Assets Caching)"]
    end

    subgraph COMPUTE_TIER["⚙️ TẦNG XỬ LÝ TRUNG TÂM (CORE SERVICES BACKEND)"]
        S1["🚀 Express.js Non-blocking Engine"]
        S2["🔄 WebSocket Realtime Sync Server (ws)"]
        S3["🤖 Smart Dynamic AI Router & Failover Engine"]
        S4["📷 Gemini Vision OCR Parser"]
        S5["⛅ Open-Meteo Telemetry Syncer"]
        S6["🧠 In-Memory Trained Agricultural Knowledge Engine"]
    end

    subgraph CACHE_DATA_TIER["💾 TẦNG LƯU TRỮ & DỮ LIỆU TỐC ĐỘ CAO (PERSISTENCE LAYER)"]
        DB1[("🐘 PostgreSQL Enterprise\n(Indexed: farms, plants, logs, supplies, costs)")]
        DB2[("⚡ Redis In-Memory Cache\n(Sub-millisecond Latency)")]
        DB3[("☁️ Supabase Cloud Storage\n(Images & Media Watermark)")]
    end

    CLIENT_TIER --> NETWORK_GATEWAY
    NETWORK_GATEWAY --> COMPUTE_TIER
    COMPUTE_TIER --> CACHE_DATA_TIER
```

---

# CHƯƠNG II: MA TRẬN PHÂN QUYỀN VÀ QUẢN TRỊ NGƯỜI DÙNG (USER VS ADMIN)

Hệ thống thiết lập cơ chế cô lập dữ liệu nghiêm ngặt (**Per-User Scoped Data Isolation**) nhằm đảm bảo tính bảo mật và quyền riêng tư thương mại giữa các nông hộ thành viên:

| Hạng mục So sánh | 🧑‍🌾 CỔNG NÔNG HỘ (USER PORTAL) | 🛡️ CỔNG QUẢN TRỊ (ADMIN COMMAND CENTER) |
| :--- | :--- | :--- |
| **Phạm vi Dữ liệu (Data Scope)** | **Cô lập 100% (Scoped Data):** Chỉ có quyền đọc và ghi dữ liệu đối với các trang trại do tài khoản mình sở hữu (1 hoặc nhiều trang trại). Tuyệt đối không nhìn thấy trang trại của hộ khác. | **Toàn quyền hệ thống (Global Scope):** Xem toàn bộ danh sách trang trại, tổng số cây trồng, tổng sản lượng, tổng chi phí vật tư toàn công ty. |
| **Cấu trúc Định danh** | Mã Obfuscation chuẩn ISO: `usr-xxxxxxxx` (VD: `usr-10492817`) | Mã Obfuscation chuẩn ISO: `adm-xxxxxxxx` (VD: `adm-58291034`) |
| **Giao diện Bé Mầm AI** | **Sprite Bé Mầm Ôm Nút Dấu Cộng (+):** Chạm vào mở menu 2 khối (Ghi nhật ký / Chat AI). Trả lời dữ liệu riêng của nông hộ. | **Bé Mầm Chibi HUD Quản Trị:** Nhấn vào mở khung chat hỏi đáp tổng quan hệ thống, kiểm tra cảm biến IoT và số liệu toàn công ty. |
| **Quyền Thao tác Bản đồ** | Xem vị trí các gốc cây, quét NFC/QR và định vị cây trồng trong trang trại của mình. | Vẽ ranh giới Polygon lô đất, đo diện tích tự động, phân bổ cây trồng và quản trị đa trang trại. |
| **Quản lý Vật tư & Chi phí** | Quét OCR hóa đơn/bao bì, nhập kho phân thuốc cá nhân, tự động tính chi phí mùa vụ trang trại. | Kiểm toán chi phí toàn bộ các trang trại, xuất báo cáo tài chính và hồ sơ truy xuất nguồn gốc VietGAP. |

---

# CHƯƠNG III: ĐẶC TẢ CHI TIẾT TỪNG TÍNH NĂNG VÀ SƠ ĐỒ VẬN HÀNH

---

### 1. TÍNH NĂNG 1: XÁC THỰC JWT, CẤP MÃ ISO HASH ID & PHÂN LUỒNG DỮ LIỆU SCOPED

* **Mục đích:** Xác thực danh tính người dùng, cấp mã định danh ẩn danh an toàn và cô lập truy vấn CSDL theo quyền sở hữu.
* **Quy tắc phân luồng:**
  * Request gửi kèm Header: `Authorization: Bearer <token>`.
  * Middleware `auth.js` giải mã token ➔ Lấy `req.user = { id, email, role, name, farm_id }`.
  * Nếu `role === 'admin'` ➔ Truy vấn toàn bộ bảng `farms`, `plants`, `supplies`.
  * Nếu `role === 'user'` ➔ Tự động gắn điều kiện `WHERE (f.user_id = $1 OR f.id = (SELECT farm_id FROM users WHERE id = $1))`.

```mermaid
sequenceDiagram
    autonumber
    actor User as 🧑‍🌾 Nông Hộ / 🛡️ Admin
    participant Client as 📱 Frontend (SPA/PWA)
    participant AuthMW as 🔒 Middleware auth.js
    participant Controller as ⚙️ API Controller
    participant DB as 🐘 PostgreSQL

    User->>Client: Nhập Email/SĐT & Mật khẩu
    Client->>Controller: POST /api/auth/login
    Controller->>DB: SELECT * FROM users WHERE email = $1
    DB-->>Controller: Trả về thông tin User & Mật khẩu Bcrypt
    Controller->>Controller: Kiểm tra Bcrypt Hash + Tạo JWT Token (Thời hạn 7 ngày)
    Controller->>Controller: Tạo ISO Public ID: generateIsoPublicId(role, id)
    Controller-->>Client: Trả về JWT Token + Thông tin User + Public ID (usr-xxx / adm-xxx)
    
    Note over Client, DB: CÁC REQUEST TIẾP THEO ĐƯỢC PHÂN LUỒNG TỰ ĐỘNG
    Client->>AuthMW: GET /api/plants (Header: Bearer Token)
    AuthMW->>AuthMW: Verify JWT Token -> Trích xuất req.user
    AuthMW->>Controller: Next() kèm req.user
    alt User Role == 'admin'
        Controller->>DB: SELECT * FROM plants (Toàn quyền)
    else User Role == 'user'
        Controller->>DB: SELECT * FROM plants JOIN farms ON plants.farm_id = farms.id WHERE farms.user_id = req.user.id
    end
    DB-->>Controller: Trả về tập dữ liệu đã cô lập (Scoped Dataset)
    Controller-->>Client: Trả về JSON dữ liệu cho Frontend hiển thị
```

---

### 2. TÍNH NĂNG 2: KHỞI TẠO TRANG TRẠI VỆ TINH GPS & BẢN ĐỒ RANH GIỚI GIS MAPBOX

* **Mục đích:** Số hóa không gian địa lý của nông trại, lấy tọa độ GPS chính xác và vẽ ranh giới Polygon vệ tinh.
* **Quy trình vận hành:**
  1. Nông hộ đứng tại vườn, nhấn **"Lấy GPS"** ➔ Trình duyệt kích hoạt `navigator.geolocation.getCurrentPosition()`.
  2. Hệ thống ghim tọa độ trung tâm vườn lên bản đồ vệ tinh Mapbox GL JS v3.
  3. Quản trị viên sử dụng công cụ vẽ Polygon (Mapbox Draw) để xác định đường biên giới thửa đất, hệ thống tự động tính toán diện tích (Hecta).
  4. Kết nối ngay lập tức trạm khí tượng vệ tinh Open-Meteo theo tọa độ Lat/Long để lấy dự báo mưa, nhiệt độ, độ ẩm 6 ngày.

```mermaid
flowchart TD
    A["📍 Nông Hộ Nhấn 'Khởi Tạo Trang Trại Mới'"] --> B["🛰️ Trình Duyệt Kích Hoạt GPS (navigator.geolocation)"]
    B --> C["🗺️ Mapbox GL JS Ghim Tọa Độ Trung Tâm Vườn"]
    C --> D["📐 Công Cụ Vẽ Ranh Giới (Mapbox Polygon Draw)"]
    D --> E["⚙️ Backend Tính Diện Tích (Turf.js) & Lưu JSON Polygon"]
    E --> F["🌤️ Open-Meteo API Kết Nối Tọa Độ: Tải Dự Báo Thời Tiết 6 Ngày"]
    F --> G["💾 Lưu Vào Bảng farms: id, name, area, lat, long, boundary_polygon"]
    G --> H["✅ Trang Trại Đã Sẵn Sàng Số Hóa Cây Trồng"]
```

---

### 3. TÍNH NĂNG 3: SỐ HÓA CÂY TRỒNG (TREE DIGITAL TWIN) & GÁN THẺ NFC/MÃ QR

* **Mục đích:** Tạo "Lý lịch số học" cho từng gốc cây trong vườn, quản lý tuổi cây, giống cây, tọa độ vi trí và liên kết chip NFC/tem mã QR chống nước.

```mermaid
flowchart LR
    A["🌳 Chọn Trang Trại -> Nhấn '+ Thêm Cây'"] --> B["📝 Nhập Thông Tin:\n- Mã Cây (VD: SR-001)\n- Giống (Ri6, Monthong)\n- Ngày Trồng, Giai Đoạn"]
    B --> C["📍 Chạm Vị Trí Cây Trên Bản Đồ Vệ Tinh GIS"]
    C --> D{"🔗 Phương Thức Gán Thẻ Thực Địa"}
    D -->|Quét Chip NFC| E["📱 Đưa Điện Thoại Chạm Chip NFC\nLưu nfc_tag_id vào CSDL"]
    D -->|Dán Tem QR Code| F["📷 Quét Tem Mã QR Chống Nước\nLưu qr_code vào CSDL"]
    E & F --> G["💾 Lưu Bảng plants: tree_code, plant_type, health_status, lat, long"]
    G --> H["✅ Cây Trở Thành Thực Thể Số Hóa (Digital Twin)"]
```

---

### 4. TÍNH NĂNG 4: TƯƠNG TÁC 1-CHẠM "BÉ MẦM ÔM NÚT DẤU CỘNG (+)" & MENU 2 HÀNH ĐỘNG

* **Mục đích:** Tối giản hóa tối đa trải nghiệm người dùng ngoài thực địa, gom toàn bộ thao tác nhanh vào một Sprite Chibi 3D duy nhất.
* **Cơ chế hoạt động:**
  * Biểu tượng Bé Mầm ôm trọn nút tròn dấu cộng `(+)` hiển thị nổi bật ở góc dưới bên phải màn hình.
  * Khi người dùng chạm vào (Click Event), hệ thống kích hoạt `e.stopPropagation()` để ngăn chặn đóng nhầm, đồng thời mở Popup Menu 2 Khối sang trọng:
    * **Khối 1: [📝 Ghi nhật ký chăm sóc]** ➔ Kích hoạt Care Modal.
    * **Khối 2: [🌱 Bé Mầm tư vấn & hỏi đáp]** ➔ Mở Chatbox AI Gemini.

```mermaid
stateDiagram-v2
    [*] --> MascotClosed: Màn hình chính sau khi đăng nhập
    MascotClosed --> MenuOpened: Nông dân chạm vào "Bé Mầm Ôm Nút Dấu Cộng (+)"
    
    state MenuOpened {
        [*] --> ChoiceWaiting
        ChoiceWaiting --> OpenCareModal: Nhấn chọn "📝 Ghi nhật ký chăm sóc"
        ChoiceWaiting --> OpenAiChat: Nhấn chọn "🌱 Bé Mầm tư vấn & hỏi đáp"
    }

    OpenCareModal --> MascotClosed: Hoàn thành ghi nhật ký / Đóng Modal
    OpenAiChat --> MascotClosed: Đóng khung chat AI
    MenuOpened --> MascotClosed: Chạm ra ngoài màn hình
```

---

### 5. TÍNH NĂNG 5: GHI NHẬT KÝ CANH TÁC THỰC ĐỊA & KIỂM SOÁT CẢNH BÁO PHI VIETGAP

* **Mục đích:** Ghi nhận chính xác lượng nước tưới, loại phân NPK, thuốc BVTV, cắt tỉa cành, đồng thời tự động kích hoạt **Cảnh báo Đỏ** nếu vi phạm thời gian cách ly thu hoạch (PHI).

```mermaid
flowchart TD
    A["📝 Mở Modal Ghi Nhật Ký Chăm Sóc"] --> B["🌳 Chọn Mã Cây Trồng (SR-001)"]
    B --> C{"🌿 Chọn Loại Hoạt Động Canh Tác"}
    
    C -->|Tưới Nước| D1["Nhập Số Lít/Gốc + Phương Pháp Tưới\nKiểm tra độ ẩm đất 65-75%"]
    C -->|Bón Phân| D2["Chọn Loại Phân NPK / Hữu Cơ\nNhập liều lượng (kg/gốc)"]
    C -->|Phun Thuốc BVTV| D3["Chọn Tên Thuốc & Hoạt Chất\nNhập nồng độ pha chế (ml/bình)"]
    C -->|Cắt Tỉa / Khảo Sát| D4["Đánh Giá Sức Khỏe: Khỏe / Sâu Bệnh\nGhi chú triệu chứng"]
    
    D3 --> E{"⏳ Kiểm Tra Thời Gian Cách Ly (PHI)"}
    E -->|Gần Ngày Thu Hoạch < 7-14 ngày| E1["🚨 BẬT CẢNH BÁO ĐỎ VI PHẠM VIETGAP\nKhuyến cáo đổi sang hoạt chất sinh học"]
    E -->|Đảm Bảo Thời Gian Cách Ly| E2["✅ Đạt Tiêu Chuẩn An Toàn VietGAP"]
    
    D1 & D2 & E1 & E2 & D4 --> F["📸 Chụp Ảnh Hiện Trường (Gắn Watermark GPS + Timestamp)"]
    F --> G["💾 Bấm 'Lưu Nhật Ký'"]
    G --> H["⚙️ Hệ Thống Tự Động:\n1. Lưu bảng plant_logs\n2. Khấu trừ tồn kho supplies\n3. Tính chi phí tiêu hao (Số lượng x Đơn giá)\n4. Phát WebSocket Realtime tới Admin"]
```

---

### 6. TÍNH NĂNG 6: CAMERA AI OCR QUÉT HÓA ĐƠN/BAO BÌ & TỰ ĐỘNG TÍNH CHI PHÍ, TRỪ KHO

* **Mục đích:** Loại bỏ hoàn toàn việc gõ tay hóa đơn phức tạp, sử dụng Vision AI để tự động bóc tách tên thuốc, hoạt chất, quy cách và đơn giá.

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as 🧑‍🌾 Nông Hộ
    participant Client as 📱 Camera App (Frontend)
    participant Backend as ⚙️ Backend Node.js
    participant VisionAI as 🤖 Google Gemini Vision OCR
    participant DB as 🐘 PostgreSQL Database

    Farmer->>Client: Mở mục "Vật tư" -> Bấm "Quét hóa đơn / Bao bì (AI OCR)"
    Client->>Client: Chụp ảnh cận cảnh nhãn phân bón / hóa đơn mua hàng
    Client->>Backend: POST /api/supplies/ocr (Multipart FormData + Base64 Image)
    Backend->>VisionAI: Gửi ảnh kèm System Prompt trích xuất JSON cấu trúc
    VisionAI-->>Backend: Trả về JSON: { name, active_ingredient, unit, unit_price, quantity }
    Backend-->>Client: Tự động điền đầy đủ các ô dữ liệu trên Form
    Farmer->>Client: Kiểm tra và bấm "Lưu vào Kho Vật Tư"
    Client->>Backend: POST /api/supplies (Lưu mới)
    Backend->>DB: INSERT INTO supplies (name, category, unit_price, quantity, ocr_image)
    DB-->>Backend: Thành công
    Backend-->>Farmer: Thông báo vật tư đã vào kho sẵn sàng sử dụng!
```

---

### 7. TÍNH NĂNG 7: TRỢ LÝ AI BÉ MẦM - ĐIỀU HƯỚNG MÔ HÌNH ĐỘNG & AUTO-FAILOVER

* **Mục đích:** Phân loại độ khó câu hỏi thông minh, ưu tiên model tiết kiệm quota cho câu hỏi dễ và điều hướng model Flagship cho câu hỏi khó, tự động failover sang CSDL nội bộ khi mất mạng.

```mermaid
flowchart TD
    A["💬 Người Dùng Gửi Câu Hỏi Cho Bé Mầm"] --> B["⚙️ Backend Phân Quyền Dữ Liệu (Scoped Data Extraction)\nChỉ trích xuất trang trại, cây trồng, chi phí của RIÊNG User đó"]
    B --> C["🧠 Bộ Phân Loại Độ Khó Câu Hỏi (classifyQueryComplexity)"]
    
    C -->|Câu hỏi thường / Tra cứu dữ liệu / Thao tác App| D["⚡ ROUTE TỚI TIER 2 (STANDARD MODELS - 1.500 RPD)\n- Gemini 2.5 Flash Lite\n- Gemini 2.0 Flash\n- Gemini 1.5 Flash"]
    C -->|Câu hỏi khó / Chẩn đoán bệnh lạ / Phác đồ VietGAP| E["🌟 ROUTE TỚI TIER 1 (FLAGSHIP REASONING MODELS)\n- Gemini 3.7 Flash\n- Gemini 3.5 Flash\n- Gemini Pro"]
    
    E -->|Gặp HTTP 429 Quota Exceeded| F["🔄 TỰ ĐỘNG CHUYỂN TIẾP (AUTO-FAILOVER)\nNhảy xuống Gemini 2.5 Flash Lite -> 2.0 Flash"]
    D & F -->|Mất Mạng Hoàn Toàn / Hết Toàn Bộ Quota| G["💾 BỘ NÃO TRI THỨC CSDL NỘI BỘ (ZERO COST)\nPhản hồi chuẩn xác cẩm nang 4 bước & VietGAP (<30ms)"]
    
    D & E & G --> H["✅ Trả Về Câu Trả Lời Đầy Đủ 100%, Không Bao Giờ Cụt Câu!"]
```

---

### 8. TÍNH NĂNG 8: TRẠM QUAN TRẮC IoT ĐẤT/KHÍ TƯỢNG & BỘ QUY TẮC CẢNH BÁO SỚM (RULE ENGINE)

* **Mục đích:** Tiếp nhận dữ liệu độ ẩm đất, nhiệt độ khí quyển từ các đầu đo IoT theo thời gian thực và kích hoạt cảnh báo thông minh.

```mermaid
flowchart LR
    A["📡 Cảm Biến IoT Tầng Đất\n(Độ ẩm rễ, pH đất, EC)"] --> C["🌐 Trạm Thu Thập Dữ Liệu Gateway\n(ESP32 / LoRaWAN)"]
    B["⛅ Trạm Thời Tiết Vệ Tinh\n(Nhiệt độ, Độ ẩm, Dự báo mưa)"] --> C
    C --> D["⚙️ Backend Telemetry API: POST /api/iot/telemetry"]
    D --> E["💾 Lưu Bảng farm_iot_sensors & Đẩy WebSocket"]
    E --> F{"⚡ Bộ Quy Tắc Cảnh Báo (Rule Engine)"}
    F -->|Độ ẩm đất < 60%| G["🚨 Cảnh Báo: Đất khô hạn -> Cần kích hoạt tưới 30L/gốc"]
    F -->|Độ ẩm KK > 85% + Mưa liên tục| H["🚨 Cảnh Báo: Nguy cơ bùng phát nấm thán thư/vàng lá"]
    G & H --> I["📱 Gửi Thông Báo Đẩy (Notification) Đến Điện Thoại Nông Dân"]
```

---

### 9. TÍNH NĂNG 9: PWA OFFLINE-FIRST, BỘ NHỚ ĐỆM INDEXEDDB & ĐỒNG BỘ NỀN

* **Mục đích:** Đảm bảo nông dân vẫn ghi chép và chụp ảnh bình thường kể cả khi đang đứng ở vùng đồi dốc mất hoàn toàn sóng 3G/4G.

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as 🧑‍🌾 Nông Dân Ngoài Vườn (Mất Sóng 3G/4G)
    participant PWA as 📱 PWA Service Worker (App)
    participant LocalDB as 💾 IndexedDB (Local Phone Storage)
    participant Backend as ⚙️ Máy Chủ Trung Tâm (Backend)
    participant DB as 🐘 PostgreSQL Database

    Farmer->>PWA: Ghi nhật ký tưới phân + Chụp ảnh hiện trường
    PWA->>PWA: Kiểm tra navigator.onLine == false (Mất mạng)
    PWA->>LocalDB: Lưu bản ghi vào bảng đệm offline_logs (Status: 'Pending_Sync')
    PWA-->>Farmer: Hiển thị: "Đã lưu offline an toàn trên máy!"
    
    Note over Farmer, DB: KHI NÔNG DÂN VỀ NHÀ CÓ SÓNG WIFI TRỞ LẠI
    PWA->>PWA: Bắt sự kiện 'online' (Network Restored)
    PWA->>LocalDB: Đọc toàn bộ danh sách bản ghi 'Pending_Sync'
    loop Từng bản ghi chưa đồng bộ
        PWA->>Backend: POST /api/plants/logs (Đẩy dữ liệu nền)
        Backend->>DB: INSERT INTO plant_logs
        DB-->>Backend: Thành công
        Backend-->>PWA: Trả về HTTP 200 OK
        PWA->>LocalDB: Cập nhật trạng thái bản ghi: 'Synced'
    end
    PWA-->>Farmer: Bật thông báo: "Đã đồng bộ toàn bộ dữ liệu lên máy chủ thành công! ✨"
```

---

### 10. TÍNH NĂNG 10: EXECUTIVE ADMIN COMMAND CENTER & PHÊ DUYỆT NÔNG HỘ 3 BƯỚC

* **Mục đích:** Giúp Ban Quản trị Hợp tác xã/Doanh nghiệp phê duyệt tài khoản nông hộ mới, phân quyền trang trại và kiểm soát chất lượng dữ liệu.

```mermaid
flowchart TD
    A["👤 Nông Hộ Đăng Ký Tài Khoản Mới Tại /user"] --> B["📋 Tài Khoản Ở Trạng Thái: 'Chờ Phê Duyệt' (Pending)"]
    B --> C["🛡️ Quản Trị Viên Mở Cổng Admin -> Tab 'Quản lý Nông hộ'"]
    C --> D["🔍 Kiểm Tra Thông Tin: Họ tên, Số điện thoại, Vị trí vườn"]
    D --> E{"Quyết Định Phê Duyệt?"}
    E -->|Từ Chối| F["❌ Hủy Yêu Cầu & Gửi Lý Do"]
    E -->|Chấp Thuận| G["✅ Bấm 'Phê Duyệt Nông Hộ'"]
    G --> H["⚙️ Hệ Thống Tự Động:\n1. Gán Role: 'user'\n2. Tạo Mã ISO Public ID: usr-xxxxxxxx\n3. Gán Trang Trại Thuộc Quyền Sở Hữu\n4. Kích Hoạt Quyền Đăng Nhập & Mở Bé Mầm AI"]
```

---

### 11. TÍNH NĂNG 11: MÔ HÌNH QUAN HỆ THỰC THỂ CƠ SỞ DỮ LIỆU TOÀN DIỆN (COMPLETE ERD)

* **Mục đích:** Quản lý toàn vẹn dữ liệu quan hệ ACID trên PostgreSQL Enterprise.

```mermaid
erDiagram
    USERS ||--o{ FARMS : "sở hữu / quản lý (1:N)"
    USERS ||--o{ SUPPLY_USAGES : "ghi nhận tiêu hao (1:N)"
    USERS ||--o{ USER_NOTIFICATIONS : "nhận thông báo (1:N)"
    FARMS ||--o{ PLANTS : "chứa danh mục cây (1:N)"
    FARMS ||--o{ SUPPLIES : "quản lý kho vật tư (1:N)"
    FARMS ||--o{ FARM_IOT_SENSORS : "kết nối trạm đo (1:1)"
    FARMS ||--o{ FIXED_ASSETS : "sở hữu tài sản (1:N)"
    PLANTS ||--o{ PLANT_LOGS : "lịch sử chăm sóc (1:N)"
    PLANTS ||--o{ PLANT_MEDIA : "album ảnh thực địa (1:N)"
    SUPPLIES ||--o{ SUPPLY_USAGES : "xuất kho sử dụng (1:N)"

    USERS {
        int id PK
        string email
        string password_hash
        string full_name
        string role "admin / user"
        string phone
        string account_tier "normal / pro"
        timestamptz created_at
    }

    FARMS {
        int id PK
        int user_id FK "Chủ sở hữu"
        string name
        numeric area "Hecta"
        numeric latitude
        numeric longitude
        jsonb boundary_polygon "Mapbox GeoJSON"
        int total_plants
        boolean is_deleted
    }

    PLANTS {
        int id PK
        int farm_id FK
        string tree_code "Mã cây (SR-001)"
        string plant_type "Sầu riêng, Bưởi..."
        string plant_variety "Ri6, Monthong..."
        string health_status "Tốt / Chú ý / Bệnh"
        string growth_stage "Kiến thiết / Nuôi hoa / Nuôi trái"
        string nfc_tag_id "Mã chip NFC"
        string qr_code "Mã QR"
        numeric latitude
        numeric longitude
    }

    PLANT_LOGS {
        int id PK
        int plant_id FK
        date log_date
        string log_type "Tưới / Bón phân / Phun thuốc"
        text note
        jsonb details "Số lít nước, tên phân"
        numeric cost "Chi phí phát sinh"
        int phi_days "Thời gian cách ly VietGAP"
        int created_by FK
    }

    SUPPLIES {
        int id PK
        int farm_id FK
        string name "Tên phân bón / thuốc"
        string category "Bón phân / Phun thuốc"
        string active_ingredient "Hoạt chất"
        numeric quantity "Tồn kho"
        string unit "Bao, Chai, Gói"
        numeric unit_price "Đơn giá mua"
        string ocr_scanned_image
    }

    SUPPLY_USAGES {
        int id PK
        int supply_id FK
        int farm_id FK
        int user_id FK
        numeric quantity "Số lượng dùng"
        numeric unit_price
        numeric total_cost
        date usage_date
    }

    FARM_IOT_SENSORS {
        int id PK
        int farm_id FK
        numeric soil_moisture "Độ ẩm đất %"
        numeric soil_ph "Độ pH"
        numeric air_temperature "Nhiệt độ °C"
        numeric air_humidity "Độ ẩm KK %"
        jsonb weather_forecast "Dự báo 6 ngày"
        timestamptz last_updated
    }
```

---

### 12. TÍNH NĂNG 12: KIẾN TRÚC BỘ NHỚ ĐỆM REDIS & CHIẾN LƯỢC CHỊU TẢI 5.000 - 50.000 USERS

* **Mục đích:** Tối ưu hóa hiệu năng, giảm tải 85% truy vấn CSDL PostgreSQL và duy trì thời gian phản hồi <15ms khi có hàng ngàn nông hộ đồng loạt truy cập.

```mermaid
flowchart TD
    A["👥 5.000 - 50.000 Nông Hộ Gửi Request Cùng Lúc"] --> B["🌐 Cloudflare Global Edge CDN\n(Phục vụ toàn bộ HTML, CSS, JS, Ảnh từ Edge Server)"]
    B --> C["⚖️ Load Balancer / Node.js Cluster Mode (Đa luồng CPU)"]
    C --> D{"🔍 Kiểm Tra Bộ Nhớ Đệm Redis Cache (RAM)"}
    
    D -->|Cache Hit: Dữ liệu đã lưu| E["⚡ Trả Về Ngay Lập Tức Trong 0.001s (<1ms)\n(Danh mục phân thuốc, thời tiết, cấu hình)"]
    D -->|Cache Miss: Chưa có trong RAM| F["🔌 PgBouncer Connection Pooler (Cổng 6543)"]
    
    F --> G["🐘 PostgreSQL Database (Đánh Chỉ Mục B-Tree Index)"]
    G --> H["Lưu Kết Quả Vào Redis (TTL = 300s) & Trả Về Cho Client"]
```

---

# CHƯƠNG IV: QUY TẮC VẬN HÀNH, BẢO MẬT VÀ NGUYÊN TẮC BẢO TRÌ HỆ THỐNG

### 1. NGUYÊN TẮC BẢO MẬT & TOÀN VẸN DỮ LIỆU (DATA INTEGRITY & SECURITY)
* **Bảo vệ đường truyền:** 100% kết nối Web và WebSocket bắt buộc chạy qua giao thức mã hóa **HTTPS / WSS (TLS 1.3)**.
* **Mã hóa mật khẩu:** Sử dụng thuật toán `bcryptjs` với hệ số Salt Rounds = 10.
* **Khóa bất biến dữ liệu kiểm toán (Audit Trail):** Mọi bản ghi nhật ký canh tác khi đã được Kỹ thuật viên ký duyệt sẽ bị khóa cờ `is_locked = TRUE`, không cho phép sửa đổi tùy tiện nhằm bảo vệ giá trị pháp lý của chứng nhận VietGAP.

### 2. QUY ĐỊNH SAO LƯU DỮ LIỆU & PHỤC HỒI THẢM HỌA (DISASTER RECOVERY)
* **Sao lưu tự động:** Hệ thống kích hoạt Cron Job tự động xuất bản sao lưu CSDL PostgreSQL (`pg_dump`) mỗi ngày vào lúc 02:00 AM, nén mã hóa và đẩy lên bộ lưu trữ đám mây độc lập.
* **Mục tiêu phục hồi:**
  * **RPO (Recovery Point Objective):** < 24 giờ.
  * **RTO (Recovery Time Objective):** < 30 phút.

---

> **PHÊ DUYỆT & BAN HÀNH:**  
> Hồ sơ thiết kế kỹ thuật này là tài sản trí tuệ và tài liệu quy chuẩn kỹ thuật chính thức của **Công ty Cổ phần Nông nghiệp Công nghệ cao Tân Bảo**. Toàn bộ các phiên bản phát triển, mở rộng module tiếp theo bắt buộc phải tuân thủ nghiêm ngặt theo kiến trúc này.
