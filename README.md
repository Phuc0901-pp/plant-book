# 🌿 Sổ Nông Tân Bảo AgTech (Plant Book)
### Hệ Thống Quản Lý Vườn Cây & Nhật Ký Canh Tác Nông Nghiệp Thông Minh Chuẩn VietGAP

> **Tân Bảo Sài Gòn Corp** · Phiên bản 2.0 (AgTech Enterprise Suite)  
> Nền tảng: **Web App PWA (Offline-First Mobile + Tablet + Desktop) + Multi-Cloud Backend**

---

## 📑 MỤC LỤC TỔNG QUAN

1. [Giới thiệu & Mục tiêu Dự án](#1-giới-thiệu--mục-tiêu-dự-án)
2. [Sơ đồ Khối Kiến trúc Hệ thống (Architecture Diagram)](#2-sơ-đồ-khối-kiến-trúc-hệ-thống)
3. [Sơ đồ Phân Luồng & Ma Trận Phân Quyền (RBAC Flowchart)](#3-sơ-đồ-phân-luồng--ma-trận-phân-quyền)
   - [3.1 Sơ đồ Phân luồng Truy cập Người dùng](#31-sơ-đồ-phân-luồng-truy-cập-người-dùng)
   - [3.2 Ma trận Phân quyền 4 Cấp bậc (Admin, User Pro, User Normal, Guest)](#32-ma-trận-phân-quyền-4-cấp-bậc)
4. [Sơ đồ Quy trình Nghiệp vụ & Logic Cốt lõi](#4-sơ-đồ-quy-trình-nghiệp-vụ--logic-cốt-lõi)
   - [4.1 Quy trình Khởi tạo & Định vị GIS Vùng trồng](#41-quy-trình-khởi-tạo--định-vị-gis-vùng-trồng)
   - [4.2 Quy trình Ghi Nhật Ký Chăm Sóc & Khấu Trừ Vật Tư / Chi Phí](#42-quy-trình-ghi-nhật-ký-chăm-sóc--khấu-trừ-vật-tư--chi-phí)
   - [4.3 Quy trình Kiểm soát Thời gian Cách ly Thuốc BVTV (VietGAP PHI Quarantine)](#43-quy-trình-kiểm-soát-thời-gian-cách-ly-thuốc-bvtv-vietgap-phi)
   - [4.4 Quy trình Hoạt động Ngoại tuyến & Tự Đồng Bộ 2 Chiều (Offline-First PWA Engine)](#44-quy-trình-hoạt-động-ngoại-tuyến--tự-đồng-bộ-2-chiều-offline-first)
   - [4.5 Quy trình Truy xuất Nguồn gốc Công Khai (Public QR Traceability Flow)](#45-quy-trình-truy-xuất-nguồn-gốc-công-khai-public-qr)
5. [Thiết Kế Cơ Sở Dữ Liệu & Tối Ưu Hóa Hiệu Năng](#5-thiết-kế-cơ-sở-dữ-liệu--tối-ưu-hóa-hiệu-năng)
   - [5.1 Entity Relationship Diagram (ERD)](#51-entity-relationship-diagram-erd)
   - [5.2 PostgreSQL GIN Indexes & Performance Optimization](#52-postgresql-gin-indexes--performance-optimization)
   - [5.3 Database Migrations Roadmap](#53-database-migrations-roadmap)
6. [Tài liệu API Endpoints Toàn diện](#6-tài-liệu-api-endpoints-toàn-diện)
7. [Hướng Dẫn Vận Hành & Hướng Dẫn Sử Dụng](#7-hướng-dẫn-vận-hành--hướng-dẫn-sử-dụng)
   - [7.1 Dành cho Quản trị viên (Admin)](#71-dành-cho-quản-trị-viên-admin)
   - [7.2 Dành cho Nông hộ Chủ Vườn (User Pro)](#72-dành-cho-nông-hộ-chủ-vườn-user-pro)
   - [7.3 Dành cho Nhân công Chăm sóc (User Normal)](#73-dành-cho-nhân-công-chăm-sóc-user-normal)
   - [7.4 Dành cho Khách hàng & Đối tác Thu mua (Guest/Public)](#74-dành-cho-khách-hàng--đối-tác-thu-mua-guestpublic)
8. [Bộ Kiểm Thử Tự Động Toàn Diện (Master Automated Test Suite)](#8-bộ-kiểm-thử-tự-động-toàn-diện)
9. [Hướng Dẫn Cài Đặt & Triển Khai Thực Tế](#9-hướng-dẫn-cài-đặt--triển-khai-thực-tế)

---

## 1. Giới thiệu & Mục tiêu Dự án

**Sổ Nông Tân Bảo AgTech (Plant Book)** là hệ thống phần mềm quản lý nông nghiệp thông minh, số hóa 100% vòng đời của từng cây trồng và toàn bộ quy trình canh tác nông nghiệp. Ứng dụng đáp ứng các tiêu chuẩn khắt khe của **VietGAP / GlobalGAP**, phục vụ mục tiêu xuất khẩu nông sản chính ngạch và minh bạch hóa nguồn gốc thực phẩm.

### 🌟 Tính Năng Đột Phá:
* **Hồ sơ định danh từng cây (Tree Digital Twin):** Mỗi cây trồng sở hữu một mã `tree_code`, tọa độ vệ tinh GPS, lịch sử hình thái sinh trưởng, nhật ký chăm sóc và mã QR Code động.
* **Quy chuẩn VietGAP 100%:** Kiểm soát nghiêm ngặt thời gian cách ly sau khi phun thuốc BVTV (PHI - Pre-Harvest Interval), ngăn chặn thu hoạch nông sản chưa an toàn, tự động cấp mã lô thu hoạch truy xuất nguồn gốc.
* **Quản lý Vật tư & Kế toán Chi phí Nông nghiệp:** Tự động khấu trừ kho phân bón, thuốc BVTV, tự động cộng chi phí tiền nước tưới theo khối lượng/giờ tưới và chi phí nhân công theo từng cây hoặc toàn vườn.
* **Offline-First PWA (Hoạt động tốt khi mất sóng ngoài vườn):** Ứng dụng PWA với Service Worker + IndexedDB Client Engine, cho phép nông dân ghi chép nhật ký ngay tại nơi không có sóng điện thoại và tự động đồng bộ khi có mạng trở lại.
* **Bản đồ Vùng trồng GIS:** Tích hợp Leaflet / Mapbox Satellite, hỗ trợ vẽ polygon ranh giới nông trại, tự động tính diện tích ra Hecta và định vị các điểm chấm GPS cây trồng.
* **Khí tượng Nông nghiệp Thông minh (Open-Meteo API):** Tích hợp dự báo thời tiết real-time, chỉ số UV, xác suất mưa và đưa ra khuyến nghị canh tác thông minh (hoãn bón phân khi sắp mưa, tưới đẫm khi nắng nóng).

---

## 2. Sơ đồ Khối Kiến trúc Hệ thống

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIẾP NHẬN (Frontend Layer)                       │
│                                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────┐  │
│   │   Admin Portal         │  │   User Portal (PWA)    │  │   Public Traceability   │  │
│   │   /admin               │  │   /user                │  │   /plant/:slug          │  │
│   │   (Desktop / Laptop)   │  │   (Mobile / Tablet)    │  │   (Mọi thiết bị / QR)   │  │
│   └───────────┬────────────┘  └───────────┬────────────┘  └────────────┬────────────┘  │
│               │                           │                            │               │
│               │            ┌──────────────┴──────────────┐             │               │
│               │            │ Service Worker + IndexedDB  │             │               │
│               │            │ (Chế độ Offline-First)      │             │               │
│               │            └──────────────┬──────────────┘             │               │
└───────────────┼───────────────────────────┼────────────────────────────┼───────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY & BẢO MẬT (Security Layer)                        │
│   • Anti-Scraper & Rate Limiting                                                       │
│   • JWT Authentication & Role-Based Access Control (RBAC)                              │
│   • Global Exception & Extension Error Suppressor (window.onerror)                     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND ENGINE (Node.js & Express)                         │
│                                                                                        │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│   │ Auth & Users       │ │ Plants & QR Engine │ │ VietGAP & PHI     │ │ Supplies &  │  │
│   │ Service            │ │ Service            │ │ Compliance Engine │ │ Cost Engine │  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘ └─────────────┘  │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│   │ GIS & Farm Spatial │ │ Weather & Agro-Tip │ │ Storage Service   │ │ IoT Telemetry│  │
│   │ Engine             │ │ Service (Open-Meteo)│ │ (Multi-driver)    │ │ & Alerts    │  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘ └─────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
┌───────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       DATABASE LAYER (PostgreSQL Enterprise)   │ │      CLOUD STORAGE & EXTERNAL API    │
│                                               │ │                                      │
│  • JSONB GIN Indexes (jsonb_path_ops)         │ │  • Supabase Storage / S3 / R2 Bucket │
│  • Composite Index (plant_id, log_date DESC)  │ │    (Ảnh bệnh cây, Video thực địa)    │
│  • GPS Spatial Index (latitude, longitude)    │ │  • Open-Meteo API (Khí tượng 8 hướng)│
│  • Auto Migration System (001, 002, 003)      │ │  • BigDataCloud Reverse Geocoding    │
└───────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 3. Sơ đồ Phân Luồng & Ma Trận Phân Quyền

### 3.1 Sơ đồ Phân luồng Truy cập Người dùng

```mermaid
flowchart TD
    Start([Người dùng truy cập Hệ thống]) --> CheckType{Loại truy cập?}

    %% Khách quét mã QR
    CheckType -->|Quét mã QR / Link công khai| PublicView["Trang Hồ Sơ Cây Trồng Công Khai (/plant/:slug)"]
    PublicView --> ViewBio["Xem lý lịch cây, hình thái học, xuất xứ"]
    PublicView --> ViewLogs["Xem nhật ký VietGAP minh bạch & An toàn PHI"]
    PublicView --> ViewGPS["Xem vị trí nông trại trên bản đồ vệ tinh"]

    %% Đăng nhập hệ thống
    CheckType -->|Truy cập Ứng dụng Quản lý| LoginPage["Màn hình Đăng nhập (/login)"]
    LoginPage --> SubmitAuth["Nhập Email & Mật khẩu -> POST /api/auth/login"]
    SubmitAuth --> TokenVerify{Xác thực JWT?}
    
    TokenVerify -->|Thất bại| LoginFail["Báo lỗi sai tài khoản / mật khẩu"]
    TokenVerify -->|Thành công| RoleCheck{Kiểm tra Vai trò (Role) & Gói (Tier)}

    %% Phân luồng Admin
    RoleCheck -->|Role: 'admin'| AdminRoute["Điều hướng về /admin (Admin Dashboard)"]
    AdminRoute --> AdminFeatures["Quản trị hệ thống, Duyệt nông hộ, Quản lý vật tư, Cấu hình GIS & Xuất báo cáo"]

    %% Phân luồng User Pro
    RoleCheck -->|Role: 'user' & Tier: 'pro'| UserProRoute["Điều hướng về /user (Chế độ Chuyên nghiệp)"]
    UserProRoute --> ProFeatures["Quản lý nhiều nông trại, Phân tích tài chính đầu tư, Bách khoa cây trồng, Offline-First"]

    %% Phân luồng User Normal
    RoleCheck -->|Role: 'user' & Tier: 'normal'| UserNorRoute["Điều hướng về /user (Chế độ Nông dân Tinh gọn)"]
    UserNorRoute --> NorFeatures["Ghi nhật ký 1 chạm, Quét QR cây, Báo bệnh có Watermark, Nhắc việc tự động"]
```

---

### 3.2 Ma trận Phân quyền 4 Cấp bậc

| Phân hệ / Quyền hạn | 👑 Quản trị viên (`Admin`) | ⭐ Nông hộ Nâng cao (`User Pro`) | 👨‍🌾 Nông dân (`User Normal`) | 🌐 Khách hàng (`Guest/Public`) |
| :--- | :---: | :---: | :---: | :---: |
| **Xem hồ sơ cây trồng & nhật ký công khai** | ✅ | ✅ | ✅ | ✅ |
| **Ghi nhật ký chăm sóc (Tưới, Bón, Phun, Cắt)** | ✅ Toàn hệ thống | ✅ Farm phụ trách | ✅ Cây được phân công | ❌ |
| **Ghi nhận bệnh cây có Watermark ảnh/video** | ✅ | ✅ | ✅ | ❌ |
| **Xem bản đồ GIS & Tọa độ GPS cây trồng** | ✅ Toàn bộ | ✅ Farm của mình | ✅ Farm của mình | ⚠️ Chỉ xem vị trí chung |
| **Quản lý Kho Vật Tư & Chi Phí Đầu Tư** | ✅ Toàn quyền | ✅ Nhập kho & Xem chi phí | ❌ Chỉ chọn dùng | ❌ |
| **Tạo mới / Chỉnh sửa / Xóa cây trồng** | ✅ | ✅ | ❌ | ❌ |
| **Vẽ ranh giới Polygon & Khởi tạo Farm mới** | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Tài khoản & Phân quyền User** | ✅ | ❌ | ❌ | ❌ |
| **Cấu hình tham số Hệ thống & Danh mục** | ✅ | ❌ | ❌ | ❌ |
| **Chế độ Ngoại tuyến PWA & Tự đồng bộ** | ⚠️ Online ưu tiên | ✅ Hỗ trợ đầy đủ | ✅ Hỗ trợ đầy đủ | ❌ |

---

## 4. Sơ đồ Quy trình Nghiệp vụ & Logic Cốt lõi

### 4.1 Quy trình Khởi tạo & Định vị GIS Vùng trồng

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản trị viên / Chủ vườn Pro
    participant Client as Giao diện Bản đồ GIS
    participant Backend as Express API Engine
    participant DB as PostgreSQL GIS Storage

    Admin->>Client: Mở tab Bản đồ Vùng trồng & Chọn "Tạo Nông trại"
    Client->>Admin: Kích hoạt công cụ vẽ Đa giác (Polygon Tool)
    Admin->>Client: Chấm các điểm tọa độ bao quanh ranh giới đất
    Client->>Client: Tính toán diện tích thực tế (m²) & tự đổi sang Hecta (ha)
    Admin->>Client: Nhập Tên trang trại, Mã số Vùng trồng (PUC Code), Gán Nông hộ phụ trách
    Client->>Backend: POST /api/farms (Kèm polygon_coords JSON)
    Backend->>DB: Lưu ranh giới Farm & Đánh Spatial Index
    DB-->>Backend: Khởi tạo thành công
    Backend-->>Client: Trả về Farm ID
    Admin->>Client: Chọn "Thêm Cây Trồng" & Click vào vị trí trên bản đồ
    Client->>Client: Tự động lấy tọa độ GPS (Latitude, Longitude)
    Admin->>Client: Nhập Mã cây (tree_code), Giống cây (vd: Sầu riêng Ri6), Năm trồng
    Client->>Backend: POST /api/plants (Kèm tọa độ & Farm ID)
    Backend->>Backend: Tự động sinh Public Slug & Mã QR Code duy nhất
    Backend->>DB: Lưu cây vào CSDL
    Backend-->>Client: Cây hiển thị tức thì trên bản đồ với Marker Trạng thái
```

---

### 4.2 Quy trình Ghi Nhật Ký Chăm Sóc & Khấu Trừ Vật Tư / Chi Phí

```mermaid
flowchart TD
    A[Nông dân chọn Cây trồng hoặc Quét mã QR/NFC] --> B[Mở Modal Ghi Nhật Ký Chăm Sóc]
    B --> C{Chọn loại hoạt động canh tác}

    %% Tưới nước
    C -->|💧 Tưới nước| D1[Nhập thời gian tưới / Thể tích nước m³]
    D1 --> D2[Hệ thống tự động quy đổi: Thể tích x Đơn giá nước = Chi phí tưới]

    %% Bón phân
    C -->|🌱 Bón phân| E1[Chọn loại phân bón từ Danh mục kho]
    E1 --> E2[Nhập liều lượng bón ví dụ: 500g NPK 16-16-8]
    E2 --> E3[Tự động trừ số dư tồn kho & Cộng chi phí phân vào Cây]

    %% Phun thuốc BVTV
    C -->|🛡️ Phun thuốc BVTV| F1[Chọn thuốc BVTV trong danh mục được cấp phép]
    F1 --> F2[Nhập nồng độ/liều lượng pha & Mục đích phòng trị]
    F2 --> F3[Tự động tính Ngày hết cách ly PHI = Ngày phun + Số ngày PHI]
    F3 --> F4[Khóa cảnh báo thu hoạch & Đổi trạng thái cây sang CÁCH LY PHI]

    %% Báo bệnh cây
    C -->|⚠️ Báo Bệnh cây| G1[Chọn triệu chứng bệnh & Mức độ nghiêm trọng]
    G1 --> G2[Chụp ảnh / Quay video thực địa]
    G2 --> G3[Canvas API đóng dấu Watermark: Mã Cây · Ngày Giờ · Tọa độ GPS]
    G3 --> G4[Upload ảnh lên Cloud Storage & Gửi cảnh báo về Admin]

    %% Ghi nhận vào DB
    D2 & E3 & F4 & G4 --> H[Lưu Nhật Ký -> POST /api/plants/:id/logs]
    H --> I[Cập nhật Dòng thời gian Sinh trưởng & Chi phí Lũy kế của Cây]
```

---

### 4.3 Quy trình Kiểm soát Thời gian Cách ly Thuốc BVTV (VietGAP PHI)

```mermaid
stateDiagram-v2
    [*] --> AnToan: Trạng thái bình thường (Cây khỏe / An toàn)
    
    AnToan --> DangCachLy: Phun thuốc BVTV (Bắt đầu tính chu kỳ PHI)
    
    state DangCachLy {
        [*] --> DemNguocPHI: Ngày kết thúc PHI = Ngày phun + PHI_days
        DemNguocPHI --> KiemTraThuHoach: Nông dân thao tác "Thu Hoạch"?
        KiemTraThuHoach --> CanhBaoViPham: Nếu Thời gian < Ngày kết thúc PHI
        CanhBaoViPham --> HuyThuHoach: Cảnh báo đỏ vi phạm an toàn thực phẩm VietGAP
    }
    
    DangCachLy --> HetCachLy: Thời gian hiện tại >= Ngày kết thúc PHI
    HetCachLy --> AnToanThuHoach: Cho phép thu hoạch nông sản
    AnToanThuHoach --> XuatMaLo: Sinh Mã Lô Nông Sản (Traceability Batch Code)
    XuatMaLo --> [*]
```

---

### 4.4 Quy trình Hoạt động Ngoại tuyến & Tự Đồng Bộ 2 Chiều (Offline-First)

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Nông dân tại vườn
    participant SW as Service Worker & Cache
    participant IDB as IndexedDB (tanbao_offline_db)
    participant Sync as Sync Engine
    participant Server as Backend Express Server

    Note over Farmer,IDB: [Giai đoạn Mất Sóng / Không có Internet]
    Farmer->>SW: Mở ứng dụng Sổ Nông Tân Bảo
    SW-->>Farmer: Trả về UI từ Service Worker Cache (Tải tức thì 0.1s)
    Farmer->>IDB: Xem danh sách cây & vật tư (Lấy từ Local Store)
    Farmer->>IDB: Ghi nhật ký chăm sóc / Bón phân / Phun thuốc
    IDB->>IDB: Lưu bản ghi vào bảng "offline_outbox_queue" với cờ sync_status = 'pending'
    IDB-->>Farmer: Thông báo: "Đã lưu offline an toàn. Sẽ tự đồng bộ khi có mạng!"

    Note over Farmer,Server: [Giai đoạn Kết Nối Mạng Trở Lại]
    Sync->>Sync: Lắng nghe sự kiện 'online' của trình duyệt
    Sync->>IDB: Quét toàn bộ bản ghi chờ trong "offline_outbox_queue"
    loop Từng bản ghi trong hàng đợi
        Sync->>Server: POST /api/plants/:id/logs (Đẩy dữ liệu lên Cloud)
        Server-->>Sync: Phản hồi Thành công (201 Created)
        Sync->>IDB: Xóa bản ghi đã đồng bộ khỏi Outbox
    end
    Sync->>Server: Kéo dữ liệu mới nhất về cập nhật vào IndexedDB
    Sync-->>Farmer: Đổi huy hiệu Topbar sang "✅ Đã đồng bộ hoàn tất"
```

---

### 4.5 Quy trình Truy xuất Nguồn gốc Công Khai (Public QR)

```mermaid
flowchart LR
    QR[Khách hàng / Đối tác quét mã QR trên quả/thân cây] --> URL["GET /plant/:slug"]
    URL --> Query[Backend truy vấn CSDL theo public_slug]
    Query --> CheckPub{Cây có bật is_public?}
    
    CheckPub -->|Không| Deny["Hiển thị thông báo: Hồ sơ cây đang ở chế độ bảo mật nội bộ"]
    CheckPub -->|Có| Render["Hiển thị Trang Hồ Sơ Nông Sản Chuẩn VietGAP"]
    
    Render --> D1["🌳 Thông tin Giống, Tuổi cây, Vườn trồng"]
    Render --> D2["📜 Nhật ký Canh tác minh bạch (Đã lọc bỏ thông tin bảo mật)"]
    Render --> D3["🛡️ Chứng thực An Toàn Cách Ly PHI & Mã Lô Thu Hoạch"]
    Render --> D4["📍 Bản đồ Vệ tinh xác thực Nguồn gốc Địa lý"]
```

---

## 5. Thiết Kế Cơ Sở Dữ Liệu & Tối Ưu Hóa Hiệu Năng

### 5.1 Entity Relationship Diagram (ERD)

```
┌────────────────────────────────┐            ┌────────────────────────────────┐
│             users              │            │         plant_schemas          │
├────────────────────────────────┤            ├────────────────────────────────┤
│ id (PK, VARCHAR)               │            │ id (PK, VARCHAR)               │
│ email (UNIQUE, VARCHAR)        │            │ name (VARCHAR)                 │
│ password_hash (VARCHAR)        │            │ description (TEXT)             │
│ full_name (VARCHAR)            │            │ fields (JSONB)                 │
│ role ('admin' | 'user')        │            │ created_at (TIMESTAMP)         │
│ tier ('normal' | 'pro')        │            └────────────────────────────────┘
│ created_at, updated_at         │                            │
└───────────────┬────────────────┘                            │ schema_id
                │ user_id                                     │
                ▼                                             ▼
┌────────────────────────────────┐            ┌────────────────────────────────┐
│             farms              │            │             plants             │
├────────────────────────────────┤            ├────────────────────────────────┤
│ id (PK, VARCHAR)               │◄───────────│ id (PK, VARCHAR)               │
│ name (VARCHAR)                 │  farm_id   │ farm_id (FK -> farms.id)       │
│ description (TEXT)             │            │ schema_id (FK -> schemas.id)   │
│ polygon_coords (JSONB)         │            │ tree_code (VARCHAR)            │
│ area (DOUBLE PRECISION)        │            │ public_slug (UNIQUE, VARCHAR)  │
│ puc_code (Mã số Vùng trồng)    │            │ plant_type, plant_variety      │
│ user_id (FK -> users.id)       │            │ plant_age, health_status       │
│ created_at, updated_at         │            │ latitude, longitude (DOUBLE)   │
└────────────────────────────────┘            │ data (JSONB)                   │
                                              │ cover_image, is_public         │
                                              │ created_at, updated_at         │
                                              └───────────────┬────────────────┘
                                                              │ plant_id
                                ┌─────────────────────────────┴─────────────────────────────┐
                                ▼                                                           ▼
┌────────────────────────────────────────────────────────┐ ┌────────────────────────────────┐
│                      plant_logs                        │ │          plant_media           │
├────────────────────────────────────────────────────────┤ ├────────────────────────────────┤
│ id (PK, VARCHAR)                                       │ │ id (PK, VARCHAR)               │
│ plant_id (FK -> plants.id)                             │ │ plant_id (FK -> plants.id)     │
│ log_date (DATE)                                        │ │ object_name (VARCHAR)          │
│ log_type (Tưới/Bón/Phun/Cắt lá/Tỉa hoa/Bệnh/Thu hoạch) │ │ url (CDN Link)                 │
│ note (TEXT)                                            │ │ media_type ('image' | 'video') │
│ details (JSONB)                                        │ │ caption (TEXT)                 │
│ media_urls (JSONB)                                     │ │ uploaded_at (TIMESTAMP)        │
│ cost_amount (DOUBLE PRECISION)                         │ └────────────────────────────────┘
│ operator_name (VARCHAR)                                │
│ is_phi_violation (BOOLEAN)                             │ ┌────────────────────────────────┐
│ harvest_batch_code (VARCHAR)                           │ │         farm_supplies          │
│ created_at (TIMESTAMP)                                 │ ├────────────────────────────────┤
└────────────────────────────────────────────────────────┘ │ id (PK, VARCHAR)               │
                                                           │ farm_id (FK -> farms.id)       │
                                                           │ name, category                 │
                                                           │ unit, unit_price               │
                                                           │ stock_balance, phi_days        │
                                                           │ is_infinite_stock (BOOLEAN)    │
                                                           │ created_at, updated_at         │
                                                           └────────────────────────────────┘
```

---

### 5.2 PostgreSQL GIN Indexes & Performance Optimization

Hệ thống tận dụng sức mạnh của **PostgreSQL GIN (Generalized Inverted Index)** để tối ưu hóa truy vấn trên các trường dữ liệu động `JSONB`:

```sql
-- 1. GIN Index trên trường details của plant_logs (Tăng tốc độ truy vấn sâu JSONB lên 10-50x)
CREATE INDEX IF NOT EXISTS idx_plant_logs_details_gin 
ON plant_logs USING gin (details jsonb_path_ops);

-- 2. GIN Index trên trường data mở rộng của plants
CREATE INDEX IF NOT EXISTS idx_plants_data_gin 
ON plants USING gin (data jsonb_path_ops);

-- 3. Composite Index phục vụ truy vấn lịch sử canh tác theo thời gian thực
CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_date 
ON plant_logs (plant_id, log_date DESC);

-- 4. Spatial Index định vị GPS nhanh chóng trên bản đồ
CREATE INDEX IF NOT EXISTS idx_plants_coords 
ON plants (latitude, longitude);
```

---

### 5.3 Database Migrations Roadmap

* [`001_initial_schema.sql`](file:///C:/Users/USER/OneDrive%20-%20CONG%20TY%20CO%20PHAN%20TAN%20BAO%20SAI%20GON/Tanbao/TESTversion2/TESTversion2/plant-book-deploy/plant-app-deploy/backend/db/migrations/001_initial_schema.sql): Khởi tạo bảng cốt lõi (`users`, `farms`, `plants`, `plant_logs`, `plant_media`, `plant_schemas`, `system_configs`).
* [`002_vietgap_and_supplies.sql`](file:///C:/Users/USER/OneDrive%20-%20CONG%20TY%20CO%20PHAN%20TAN%20BAO%20SAI%20GON/Tanbao/TESTversion2/TESTversion2/plant-book-deploy/plant-app-deploy/backend/db/migrations/002_vietgap_and_supplies.sql): Bổ sung cấu trúc VietGAP, bảng quản lý kho vật tư `farm_supplies`, trường `puc_code`, `phi_days`, `is_phi_violation`, `harvest_batch_code`.
* [`003_gin_and_performance_indexes.sql`](file:///C:/Users/USER/OneDrive%20-%20CONG%20TY%20CO%20PHAN%20TAN%20BAO%20SAI%20GON/Tanbao/TESTversion2/TESTversion2/plant-book-deploy/plant-app-deploy/backend/db/migrations/003_gin_and_performance_indexes.sql): Thiết lập các GIN Indexes và Composite Indexes cho tải dữ liệu lớn 20+ năm.

---

## 6. Tài liệu API Endpoints Toàn diện

### 🔐 6.1 Authentication & Profile
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập tài khoản, trả về JWT Token (24h) |
| `GET` | `/api/auth/me` | User / Admin | Lấy thông tin tài khoản hiện tại, vai trò và quyền hạn |

### 🌱 6.2 Cây Trồng & Nhật Ký Canh Tác (Plants & Logs)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/plants` | User / Admin | Lấy danh sách cây (User: giới hạn trong farm phụ trách) |
| `POST` | `/api/plants` | User Pro / Admin | Tạo mới hồ sơ cây trồng kèm định vị GPS |
| `PUT` | `/api/plants/:id` | User Pro / Admin | Cập nhật thông tin hình thái và trạng thái sức khỏe cây |
| `DELETE` | `/api/plants/:id` | Admin | Xóa cây trồng khỏi hệ thống |
| `GET` | `/api/plants/markers` | User / Admin | Lấy tọa độ thu gọn của toàn bộ cây phục vụ hiển thị bản đồ |
| `GET` | `/api/plants/:id/logs` | User / Admin | Xem toàn bộ lịch sử dòng thời gian canh tác của 1 cây |
| `POST` | `/api/plants/:id/logs` | User / Admin | Thêm nhật ký chăm sóc (Tự động trừ kho & tính an toàn PHI) |
| `DELETE` | `/api/plants/:id/logs/:logId`| Admin | Xóa bản ghi nhật ký |
| `POST` | `/api/plants/:id/media` | User / Admin | Upload ảnh/video thực địa có đóng dấu Watermark |
| `GET` | `/plant/:slug` | Công khai | Trang hồ sơ nguồn gốc xuất xứ phục vụ quét mã QR |

### 📦 6.3 Quản Lý Vật Tư Nông Nghiệp & Chi Phí (Supplies & Costs)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/supplies` | User / Admin | Danh sách vật tư trong kho (Phân bón, Thuốc BVTV, Nước, Nhân công) |
| `POST` | `/api/supplies` | User Pro / Admin | Thêm mới vật tư và định nghĩa thời gian cách ly PHI |
| `PUT` | `/api/supplies/:id` | User Pro / Admin | Cập nhật đơn giá, liều lượng và điều chỉnh tồn kho |
| `GET` | `/api/costs/summary` | User Pro / Admin | Báo cáo phân tích tài chính đầu tư theo ngày/tháng/quý/năm |

### 🏡 6.4 Nông Trại & GIS Vùng Trồng (Farms & Spatial GIS)
| Method | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/farms` | User / Admin | Danh sách nông trại kèm tọa độ ranh giới Polygon |
| `POST` | `/api/farms` | User Pro / Admin | Khởi tạo nông trại mới, vẽ ranh giới đất và cấp mã PUC |
| `PUT` | `/api/farms/:id` | User Pro / Admin | Cập nhật thông tin, diện tích hoặc chỉnh sửa ranh giới đất |
| `DELETE` | `/api/farms/:id` | Admin | Xóa trang trại |

---

## 7. Hướng Dẫn Vận Hành & Hướng Dẫn Sử Dụng

### 7.1 Dành cho Quản trị viên (Admin)
1. **Đăng nhập:** Truy cập `/login`, đăng nhập bằng tài khoản Quản trị. Hệ thống tự động chuyển tới giao diện `/admin`.
2. **Quản lý Nông hộ:** Truy cập menu **"Người dùng"** $\rightarrow$ Tạo tài khoản mới cho nông dân/chủ vườn $\rightarrow$ Phân quyền `User Pro` hoặc `User Normal`.
3. **Quản lý Cấu hình & Danh mục:** Truy cập menu **"Cấu hình"** $\rightarrow$ Định nghĩa danh mục phân bón, thuốc BVTV được phép sử dụng trong mùa vụ.
4. **Giám sát Sức khỏe Toàn Vườn:** Theo dõi bản đồ vệ tinh tổng quan để phát hiện các khu vực cảnh báo sâu bệnh (chấm đỏ) để điều phối kỹ thuật viên.

### 7.2 Dành cho Nông hộ Chủ Vườn (User Pro)
1. **Khởi tạo Nông trại:** Mở tab **"Bản đồ"** $\rightarrow$ Dùng công cụ vẽ đa giác khoanh vùng đất canh tác $\rightarrow$ Nhập mã số vùng trồng VietGAP (PUC).
2. **Nhập kho Vật tư:** Vào tab **"Vật tư"** $\rightarrow$ Thêm các loại phân bón hữu cơ, thuốc sinh học, đơn giá nước và thời gian cách ly PHI tương ứng.
3. **Theo dõi Chi phí:** Mở tab **"Báo cáo Chi phí"** để xem biểu đồ chi phí phân bón, tiền nước và thuốc BVTV theo từng cây hoặc từng mùa thu hoạch.

### 7.3 Dành cho Nhân công Chăm sóc (User Normal)
1. **Kiểm tra Nhắc việc:** Mở ứng dụng trên điện thoại $\rightarrow$ Xem danh sách các cây cần tưới nước trong ngày hoặc các cây cần kiểm tra sâu bệnh.
2. **Ghi Nhật ký 1 Chạm:** Bấm nút **(+)** nổi hoặc quét mã QR gắn trên thân cây $\rightarrow$ Chọn hoạt động (Tưới nước, Bón phân...) $\rightarrow$ Điền số lượng $\rightarrow$ Bấm **"Lưu nhật ký"**.
3. **Chụp Ảnh Báo Bệnh:** Nếu phát hiện cây có dấu hiệu lạ, chọn mục **"Bệnh cây"** $\rightarrow$ Bấm **"Chụp ảnh"** $\rightarrow$ Hệ thống tự động đóng dấu tọa độ GPS và thời gian lên ảnh $\rightarrow$ Bấm gửi để kỹ thuật viên hỗ trợ xử lý.
4. **Làm việc khi mất sóng:** Yên tâm ghi chép bình thường. Khi điện thoại bắt được sóng 4G/Wifi, ứng dụng sẽ tự động đồng bộ toàn bộ nhật ký lên máy chủ.

### 7.4 Dành cho Khách hàng & Đối tác Thu mua (Guest/Public)
1. Mở camera điện thoại hoặc ứng dụng quét mã QR bất kỳ.
2. Quét tem QR dán trên trái cây hoặc bao bì nông sản.
3. Xem ngay toàn bộ thông tin minh bạch: Vườn trồng tại đâu, bón loại phân gì, ngày phun thuốc lần cuối (đã cách ly an toàn bao nhiêu ngày) và mã lô thu hoạch VietGAP.

---

## 8. Bộ Kiểm Thử Tự Động Toàn Diện

Hệ thống được trang bị bộ kiểm thử tự động toàn diện không phụ thuộc thư viện ngoài (`Zero-Dependency Test Runner`), bao gồm **10 Test Suites với 53 kịch bản kiểm thử (100% Passed)**:

```bash
# Chạy toàn bộ 10 bộ Test Suite từ thư mục backend
cd backend
npm test
```

### Chi tiết 10 Bộ Kiểm Thử (100% Coverage):
* **Suite 1:** Authentication, Password Hashing & RBAC Authorization (5 tests)
* **Suite 2:** Farms Management, GIS Spatial Algorithms & VietGAP PUC Code (5 tests)
* **Suite 3:** Plants Registry, Health Status & Public QR Code Generation (4 tests)
* **Suite 4:** Supplies Management, Cost Accounting & Inventory Dynamics (7 tests)
* **Suite 5:** VietGAP Compliance, PHI Quarantine & Traceability Batch Codes (5 tests)
* **Suite 6:** IoT Sensor Telemetry, Threshold Rules & Alert System (3 tests)
* **Suite 7:** HTML Template Compilation, Tag Balance & DOM ID Verification (5 tests)
* **Suite 8:** Durian Ri6 20-Year Dataset & VietGAP Traceability (7 tests)
* **Suite 9:** Phase 1 & 2 Architecture, GIN Indexes & Offline Sync Engine (5 tests)
* **Suite 10:** Open-Meteo Weather API Integration & Fault-Tolerant Resilience (7 tests)

---

## 9. Hướng Dẫn Cài Đặt & Triển Khai Thực Tế

### 9.1 Yêu cầu Môi trường
* **Node.js:** Phiên bản `>= 18.x` LTS
* **PostgreSQL:** Phiên bản `>= 14.x` (Hỗ trợ tốt JSONB & GIN Indexes)
* **Trình duyệt:** Chrome, Safari, Edge, Firefox (Hỗ trợ PWA & Service Worker)

### 9.2 Cài đặt & Chạy Local

```bash
# 1. Clone repository
git clone https://github.com/Phuc0901-pp/plant-book.git
cd plant-book/plant-app-deploy

# 2. Cài đặt dependencies cho backend
cd backend
npm install

# 3. Thiết lập biến môi trường
cp .env.example .env
# Chỉnh sửa chuỗi kết nối DATABASE_URL và JWT_SECRET trong file .env

# 4. Chạy Database Migrations
node db/migrate.js up

# 5. Biên dịch giao diện HTML Modular
node scripts/build-html.js

# 6. Khởi chạy Server
npm start
# Ứng dụng chạy tại: http://localhost:3000
```

### 9.3 Danh mục Biến Môi trường (`.env`)

```ini
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@localhost:5432/plantbook_db
JWT_SECRET=super_secret_jwt_key_tanbao_agtech_2026
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
STORAGE_DRIVER=local # local | supabase | s3
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...
```

---

<p align="center">
  <b>© 2026 Tân Bảo Sài Gòn AgTech Corporation. All rights reserved.</b><br>
  <i>Hệ thống Quản lý Vườn Cây & Nhật Ký Canh Tác Nông Nghiệp Thông Minh Chuẩn VietGAP.</i>
</p>
