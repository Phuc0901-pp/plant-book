# 🌿 SỔ NÔNG TÂN BẢO AGTECH (PLANT BOOK)
# 🚀 BẢN THIẾT KẾ KIẾN TRÚC & KẾ HOẠCH TRIỂN KHAI TOÀN DIỆN
## CỔNG SỐ ĐỊNH DANH CÂY TRỒNG & THU THẬP DỮ LIỆU KHÁCH HÀNG TẬP TRUNG (`domain/sub`)
### HỆ THỐNG SMART NFC TAG ONBOARDING & HIGH-PRECISION GPS PROVISIONING GATEWAY

> **Tân Bảo Sài Gòn Corp (TBSG AgTech)** · Phiên bản: **2.3.0 Smart NFC Gateway Edition**  
> Ngày lập: **02/10/2026** · Trạng thái: **Đang Triển Khai (Active Implementation)**

---

## 📑 MỤC LỤC TỔNG QUAN

1. [Tổng Quan & Định Hướng Chiến Lược](#1-tổng-quan--định-hướng-chiến-lược)
2. [Sơ Đồ Tư Duy Hệ Thống Cổng Số (System Mindmap)](#2-sơ-đồ-tư-duy-hệ-thống-cổng-số-system-mindmap)
3. [Kiến Trúc Hệ Thống & Sơ Đồ Khối Module](#3-kiến-trúc-hệ-thống--sơ-đồ-khối-module)
4. [Sơ Đồ Vận Hành & Quy Trình Chuẩn SOP](#4-sơ-đồ-vận-hành--quy-trình-chuẩn-sop)
   - [4.1 Sơ đồ Vận hành Tổng quan (Dual-Option Gateway Flow)](#41-sơ-đồ-vận-hành-tổng-quan)
   - [4.2 Thuật toán Lấy GPS Độ Chính Xác Cao (Sub-1m High-Precision GPS Engine)](#42-thuật-toán-lấy-gps-độ-chính-xác-cao-sub-1m)
   - [4.3 Quy trình 2 Pha Giao thức Web NFC (Read UID -> Write NDEF URI)](#43-quy-trình-2-pha-giao-thức-web-nfc)
5. [Sơ Đồ Luồng Dữ Liệu & Sequence Diagrams](#5-sơ-đồ-luồng-dữ-liệu--sequence-diagrams)
   - [5.1 Luồng 1: Người Dùng Đã Có Tài Khoản (Existing User Flow)](#51-luồng-1-người-dùng-đã-có-tài-khoản)
   - [5.2 Luồng 2: Người Dùng Mới (New Lead Acquisition & Zero-Friction Flow)](#52-luồng-2-người-dùng-mới)
6. [Thiết Kế Giao Diện UI/UX & Tương Tác](#6-thiết-kế-giao-diện-uiux--tương-tác)
7. [Cấu Trúc Cơ Sở Dữ Liệu Nâng Cấp & ERD](#7-cấu-trúc-cơ-sở-dữ-liệu-nâng-cấp--erd)
8. [Tài Liệu API Endpoints Mới](#8-tài-liệu-api-endpoints-mới)
9. [Lộ Trình Triển Khai Chi Tiết Từ A -> Z (6 Giai Đoạn Chuẩn Doanh Nghiệp)](#9-lộ-trình-triển-khai-chi-tiết-từ-a---z)
10. [Bộ Tiêu Chí Nghiệm Thu (Acceptance Criteria Matrix)](#10-bộ-tiêu-chí-nghiệm-thu)

---

## 1. Tổng Quan & Định Hướng Chiến Lược

### 🎯 Bài toán thực tế
Khi **Tân Bảo Sài Gòn (TBSG AgTech)** sản xuất và phân phối hàng loạt thẻ cứng thông minh NFC/QR ra thị trường:
1. **Chưa xác định trước khách hàng mục tiêu:** Thẻ được bán hoặc cấp phát tới nhiều đối tượng (Chủ trang trại lớn, Hợp tác xã, Nông hộ cá thể mới, Khách mua lẻ trải nghiệm).
2. **Cần một đường dẫn cố định ban đầu:** Mọi thẻ xuất xưởng đều được nạp sẵn URL cổng thông minh duy nhất: `https://domain.com/sub` (hoặc `https://domain.com/sub?tag_uid=...`).
3. **Mục tiêu kép (Dual Objectives):**
   - **Thu thập dữ liệu khách hàng (Customer Lead Acquisition & Data Mining):** Biến mỗi lượt chạm thẻ của người dùng mới thành một tài khoản định danh trong hệ sinh thái AgTech.
   - **Khai báo & Định danh 1 Cây chuẩn xác tại thực địa (Single Tree High-Precision Provisioning):** Gán thẻ vật lý vào cây trồng với độ chính xác GPS cao (sai số $< \pm 1\text{m}$), sau đó **ghi đè trực tiếp URL hồ sơ số công khai** (`/farm_id/plant_id/tag_uid`) vào bộ nhớ thẻ NFC bằng **Web NFC API**.

---

## 2. Sơ Đồ Tư Duy Hệ Thống Cổng Số (System Mindmap)

```mermaid
mindmap
  root((CỔNG SỐ SMART NFC /sub))
    Cổng Chuyển Đổi Số Landing /sub
      Giao diện Hiện đại Animation Glassmorphism
      Nhận diện Thiết bị và Hỗ trợ Web NFC
      Phân luồng 2 Lựa chọn Rõ ràng
    Luồng Đã Có Tài Khoản
      Đăng nhập Nhanh JWT Biometric
      Chọn Trang Trại Sở Hữu
      Xem Danh Sách Cây Hoặc Thêm Cây Mới
      Khóa Định Vị GPS Dưới 1 Mét
      Ghi Đè URL Hồ Sơ Vào Thẻ NFC
    Luồng Chưa Có Tài Khoản
      Đăng ký Nhanh Thu Thập Dữ Liệu Khách Hàng
      Khởi Tạo Trang Trại Kèm GPS Vườn Thực Tế
      Tự Động Tạo Lô Mặc Định
      Khai Báo Chi Tiết Cây Trồng Đầu Tiên
      Ghi Đè URL Hồ Sơ Vào Thẻ NFC
    Công Nghệ Lõi Core Engine
      GPS High-Precision Multi-Sample Filter
      Web NFC Hardware Bridge NDEF Read Write
      Anti-Duplicate Tag Serial Lock
      Tự Động Sinh Mã QR và Public Slug
    Phễu Thu Thập và Phân Tích Dữ Liệu
      Tracking Nguồn Gốc Lô Thẻ Xuất Xưởng
      Tỷ Lệ Kích Hoạt Thẻ Thành Công
      Bản Đồ Phân Bố Khách Hàng Mới
```

---

## 3. Kiến Trúc Hệ Thống & Sơ Đồ Khối Module

```mermaid
flowchart TD
    subgraph Hardware_Layer ["1. LỚP PHẦN CỨNG & CẢM BIẾN (Hardware Layer)"]
        NFC_Tag["Thẻ Cứng NFC RFID NTAG213/215/216"]
        GPS_Sensor["GPS Chipset Mobile (Sai số < +-1m)"]
        Mobile_Cam["Camera Chụp Ảnh Thực Địa Watermark"]
    end

    subgraph Client_Gateway ["2. LỚP GIAO DIỆN CỔNG SỐ (PWA Gateway Layer - /sub)"]
        Landing_UI["UI/UX Landing Page: 2 Options Glassmorphism Animation"]
        Auth_Bridge["Module Xác Thực & Đăng Ký Thu Thập Dữ Liệu"]
        Farm_Selector["Module Chọn / Tạo Nông Trại Kèm GPS Vườn"]
        Single_Plant_Engine["Form Khai Báo Chi Tiết 1 Cây Trồng"]
        GPS_Precision_Engine["GPS Precision Engine: Lọc Sai Số Multi-Sample < +-1m"]
        WebNFC_Controller["Web NFC Controller: Read UID & Write NDEF URI Record"]
    end

    subgraph Backend_Layer ["3. LỚP XỬ LÝ TRUNG TÂM (Backend REST API Layer)"]
        Route_Sub["Router /sub & Lead Tracking Middleware"]
        Route_Auth["Auth Service: Register / Login JWT"]
        Route_Farms["Farms Service: Auto-Create Farm & GPS Spatial Index"]
        Route_Plants["Plants Service: 1-Plant Provision & Unique Tag Linkage"]
        Route_NFC["NFC Security Service: Anti-Duplicate UID Validator"]
    end

    subgraph Data_Layer ["4. LỚP CƠ SỞ DỮ LIỆU & LƯU TRỮ (Database & Storage)"]
        DB_Users[("Bảng users: Dữ liệu Khách Hàng")]
        DB_Farms[("Bảng farms: Không Gian Nông Trại")]
        DB_Plants[("Bảng plants: Hồ Sơ Cây & Tọa Độ GPS")]
        DB_Tags[("Bảng plant_tags: Mã Thẻ NFC Cố Định")]
        Cloud_Media[("Cloud Storage S3/R2: Ảnh Cây Thực Địa")]
    end

    Hardware_Layer <--> Client_Gateway
    Client_Gateway <--> Backend_Layer
    Backend_Layer <--> Data_Layer
```

---

## 4. Sơ Đồ Vận Hành & Quy Trình Chuẩn SOP

### 4.1 Sơ đồ Vận hành Tổng quan

```mermaid
flowchart TD
    Start(["Nông Dân Chạm Thẻ NFC / Quét QR Lần Đầu"]) --> OpenSub["Mở Cổng Số: https://domain.com/sub"]
    OpenSub --> CheckOption{"Lựa Chọn Của Người Dùng"}

    %% ================= LUỒNG 1 =================
    CheckOption -->|"1. ĐÃ CÓ TÀI KHOẢN"| LoginUI["Hiển Thị Giao Diện Đăng Nhập"]
    LoginUI --> DoLogin["Nhập Email/SĐT + Mật Khẩu"]
    DoLogin --> AuthSuccess{"Xác Thực Thành Công?"}
    AuthSuccess -->|"Thất bại"| LoginError["Báo lỗi & Cho phép thử lại/Lấy lại mật khẩu"]
    LoginError --> LoginUI
    
    AuthSuccess -->|"Thành công"| SelectFarm["Hiển thị Danh Sách Trang Trại Sở Hữu"]
    SelectFarm --> ActionChoice{"Chọn Hành Động"}
    
    ActionChoice -->|"Gán vào cây có sẵn"| PickPlant["Chọn 1 cây từ danh sách vườn"]
    ActionChoice -->|"Khai báo cây mới"| NewPlantForm["Mở Form Khai Báo Chi Tiết 1 Cây"]

    %% ================= LUỒNG 2 =================
    CheckOption -->|"2. CHƯA CÓ TÀI KHOẢN"| RegUI["Hiển Thị Form Đăng Ký Siêu Tốc (Thu thập thông tin KH)"]
    RegUI --> CollectLead["Nhập Họ Tên, SĐT, Email, Mật Khẩu"]
    CollectLead --> CreateFarmUI["Nhập Tên Trang Trại / Vườn Cây"]
    CreateFarmUI --> CaptureFarmGPS["Tự Động Lấy Tọa Độ GPS Vị Trí Vườn Hiện Tại"]
    CaptureFarmGPS --> SubmitReg["Tạo Tài Khoản + Khởi Tạo Trang Trại Mới"]
    SubmitReg --> NewPlantForm

    %% ================= BƯỚC KHAI BÁO CÂY & ĐO GPS =================
    NewPlantForm --> FillPlantDetail["Nhập Thông Tin Chi Tiết: Giống cây, Lô/Hàng, Ngày trồng, Năm tuổi..."]
    FillPlantDetail --> ActivateGPS["KÍCH HOẠT BỘ ĐO GPS ĐỘ CHÍNH XÁC CAO (Holding Tag)"]
    ActivateGPS --> GPSLoop{"Độ chính xác GPS < +-1.0m?"}
    GPSLoop -->|"Chưa đạt (đang dò)"| WaitGPS["Hiển thị Vòng Tròn Xung Lực Đang Tinh Chỉnh (Multi-sample)"]
    WaitGPS --> GPSLoop
    GPSLoop -->|"Đạt chuẩn < +-1.0m"| LockGPS["KHÓA TỌA ĐỘ GPS CHÍNH XÁC VÀO CÂY"]
    
    PickPlant --> LockGPS
    LockGPS --> SavePlantDB["Lưu CSDL: Gán plant_id với Mã Thẻ NFC"]
    
    %% ================= GHI ĐÈ THẺ NFC =================
    SavePlantDB --> PromptNFCWrite["HIỂN THỊ HỘP THOẠI: Chạm Lại Điện Thoại Vào Thẻ Để Nạp Hồ Sơ"]
    PromptNFCWrite --> WebNFCWrite["Web NFC API: Ghi URL https://domain.com/farmId/plantId/nfcUid vào Thẻ"]
    WebNFCWrite --> WriteSuccess{"Ghi NDEF Thành Công?"}
    WriteSuccess -->|"Thành công"| BuzzSuccess["Rung phản hồi + Âm thanh Chuông + Chuyển đến Hồ Sơ Cây"]
    WriteSuccess -->|"Thiết bị không hỗ trợ NFC"| FallbackQR["Hiển thị Mã QR Công Khai để in/dán dự phòng"]
    
    BuzzSuccess --> Finish(["Hoàn Tất Định Danh Số Cho Cây"])
    FallbackQR --> Finish
```

---

### 4.2 Thuật toán Lấy GPS Độ Chính Xác Cao (Sub-1m High-Precision GPS Engine)

```mermaid
flowchart TD
    StartGPS["Bắt đầu lấy tọa độ khi giữ thẻ tại gốc cây"] --> Watch["Kích hoạt navigator.geolocation.watchPosition với enableHighAccuracy: true"]
    Watch --> Sample["Thu thập mẫu tọa độ thứ n (lat, lng, accuracy, timestamp)"]
    Sample --> CheckAcc{"accuracy <= 1.0 mét?"}
    
    CheckAcc -->|"Đạt ngay <= 1.0m"| LockImmediate["Khóa ngay tọa độ GPS chuẩn xác"]
    CheckAcc -->|"accuracy > 1.0m"| Buffer["Thêm vào mảng mẫu đệm (Buffer 10 mẫu liên tục)"]
    
    Buffer --> CheckCount{"Đã đủ 10 mẫu đệm?"}
    CheckCount -->|"Chưa đủ"| Watch
    CheckCount -->|"Đã đủ 10 mẫu"| WeightedAvg["Thuật toán Tính Trung Bình Trọng Số Theo Độ Chính Xác (Kalman-like Weighted Average)"]
    
    WeightedAvg --> BestCoord["Tạo tọa độ tinh chỉnh tối ưu"]
    BestCoord --> ShowGauge["Hiển thị Thanh đo Độ Chính Xác Xanh Lục: Chuẩn xác < +-1m"]
    LockImmediate --> ShowGauge
    ShowGauge --> ConfirmGPS["Người dùng bấm Xác Nhận Gắn Tọa Độ"]
```

---

## 5. Sơ Đồ Luồng Dữ Liệu & Sequence Diagrams

### 5.1 Luồng 1: Người Dùng Đã Có Tài Khoản (Existing User Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Nông Dân / Chủ Vườn
    participant UI as Cổng Số /sub (PWA)
    participant NFC_HW as Phần Cứng Thẻ NFC
    participant Backend as Backend API Server
    participant DB as PostgreSQL Database

    Farmer->>UI: Truy cập URL /sub (Chạm thẻ hoặc quét QR)
    UI->>Farmer: Hiển thị 2 Option -> Farmer chọn "ĐÃ CÓ TÀI KHOẢN"
    Farmer->>UI: Nhập Email/SĐT & Password
    UI->>Backend: POST /api/auth/login
    Backend->>DB: Kiểm tra tài khoản & cấp JWT
    Backend-->>UI: 200 OK { token, user, farms: [...] }
    
    UI->>Farmer: Hiển thị danh sách nông trại đang sở hữu -> Farmer chọn Nông trại A
    UI->>Farmer: Màn hình chọn cây có sẵn HOẶC bấm "+ Khai Báo Cây Mới"
    
    Farmer->>UI: Bấm "+ Khai Báo Cây Mới" (Chi tiết 1 cây)
    Farmer->>UI: Nhập Giống, Lô A1, Hàng 01, Ngày trồng, Năm tuổi...
    Farmer->>UI: Đặt điện thoại sát thẻ tại thân cây & bấm "Đo GPS Chuẩn Xác"
    UI->>UI: Kích hoạt High-Precision GPS Engine (Đo & Tinh chỉnh sai số < +-1m)
    UI-->>Farmer: Hiển thị Huy Hiệu Xanh: "Độ chính xác: +-0.8m (Đạt chuẩn)"
    
    Farmer->>UI: Bấm "Lưu & Nạp Thẻ"
    UI->>Backend: POST /api/plants/single-provision (Kèm farm_id, plant_data, gps, nfc_uid)
    Backend->>DB: INSERT INTO plants + INSERT INTO plant_tags
    DB-->>Backend: Tạo thành công plant_id = 105, public_slug
    Backend-->>UI: 201 Created { plant_id: 105, public_url: "https://domain.com/12/105/04F1D832" }
    
    UI->>Farmer: Hiện hướng dẫn: "Áp lưng điện thoại vào thẻ NFC để nạp dữ liệu..."
    UI->>NFC_HW: NDEFReader.write({ records: [{ recordType: 'url', data: public_url }] })
    NFC_HW-->>UI: Ghi thành công vào chip NDEF
    UI->>Farmer: Rung nhẹ + Chuông báo: "ĐÃ GHI ĐẦY ĐỦ HỒ SƠ VÀO THẺ THÀNH CÔNG!"
    UI->>UI: Tự động chuyển hướng sang Hồ Sơ Cây Trồng
```

---

### 5.2 Luồng 2: Người Dùng Mới (New Lead Acquisition & Zero-Friction Flow)

```mermaid
sequenceDiagram
    autonumber
    actor NewUser as Khách Hàng / Nông Dân Mới
    participant UI as Cổng Số /sub (PWA)
    participant GPS_HW as Cảm Biến GPS Thiết Bị
    participant NFC_HW as Phần Cứng Thẻ NFC
    participant Backend as Backend API Server
    participant DB as PostgreSQL Database

    NewUser->>UI: Chạm thẻ NFC trống mở /sub
    UI->>NewUser: Hiển thị 2 Option -> Chọn "CHƯA CÓ TÀI KHOẢN"
    
    Note over NewUser,UI: BƯỚC 1: THU THẬP THÔNG TIN KHÁCH HÀNG (LEAD GENERATION)
    NewUser->>UI: Nhập Họ tên, Số điện thoại, Email, Mật khẩu
    
    Note over NewUser,UI: BƯỚC 2: THIẾT LẬP NÔNG TRẠI KÈM GPS VỰƠN TỰ ĐỘNG
    NewUser->>UI: Nhập Tên Trang Trại (ví dụ: Vườn Sầu Riêng Chín Sớm)
    UI->>GPS_HW: Lấy GPS vị trí thiết bị hiện tại
    GPS_HW-->>UI: Tọa độ tâm trang trại (lat, lng)
    
    UI->>Backend: POST /api/auth/onboard-lead (Kèm User Info + Farm Name + Farm GPS)
    Backend->>DB: INSERT INTO users (Tạo tài khoản mới)
    Backend->>DB: INSERT INTO farms (Tạo trang trại + Gán quyền User Pro)
    Backend->>DB: INSERT INTO farm_plots (Tự động tạo Lô A1 mặc định)
    DB-->>Backend: Khởi tạo xong user_id = 50, farm_id = 15
    Backend-->>UI: 201 Created { token, user, farm: { id: 15, name: "..." } }
    
    Note over NewUser,UI: BƯỚC 3: KHAI BÁO CÂY TRỒNG ĐẦU TIÊN (1 CÂY)
    UI->>NewUser: Mở Form Khai Báo Chi Tiết Cây Trồng Số 1
    NewUser->>UI: Chọn Giống: Sầu riêng Ri6, Ngày trồng, Chụp ảnh thực địa
    NewUser->>UI: Giữ điện thoại tại vị trí cây -> Khóa GPS sai số < +-1m
    
    NewUser->>UI: Bấm "Xác Nhận & Nạp Thẻ"
    UI->>Backend: POST /api/plants/single-provision (farm_id: 15, plant_data, gps, nfc_uid)
    Backend->>DB: INSERT INTO plants + plant_tags
    DB-->>Backend: Tạo plant_id = 201
    Backend-->>UI: 201 Created { plant_id: 201, public_url: "https://domain.com/15/201/04F1D832" }
    
    Note over NewUser,NFC_HW: BƯỚC 4: GHI ĐÈ HỒ SƠ ĐIỆN TỬ VÀO THẺ
    UI->>NewUser: Thông báo: "Chạm điện thoại vào thẻ để nạp hồ sơ điện tử..."
    UI->>NFC_HW: NDEFReader.write(public_url)
    NFC_HW-->>UI: Ghi thành công
    UI->>NewUser: Hoàn tất 100% -> Chuyển vào Dashboard Nông Trại
```

---

## 6. Thiết Kế Giao Diện UI/UX & Tương Tác

### 6.1 Landing Page Cổng Số `/sub`
* **Phong cách:** Glassmorphism hiện đại, hiệu ứng neon emerald/amber nông nghiệp công nghệ cao, responsive tối ưu hóa cho màn hình điện thoại cầm tay ngoài vườn.
* **Các thẻ tương tác:**
  - `card-existing-user`: Khối "ĐÃ CÓ TÀI KHOẢN" kèm biểu tượng bảo mật, mở modal/view đăng nhập nhanh.
  - `card-new-user`: Khối "CHƯA CÓ TÀI KHOẢN" nổi bật hiệu ứng pulse sáng, kích hoạt quy trình Onboarding 3 bước.
  - `nfc-status-pill`: Thanh trạng thái hiển thị khả năng kết nối Web NFC của trình duyệt.

### 6.2 Module Lọc GPS Độ Chính Xác Cao (`sub-gps-engine.js`)
* **Chế độ đo Multi-Sample:**
  - Thu thập tối đa 10 mẫu GPS liên tục qua `watchPosition`.
  - Tính toán sai số trung bình có trọng số ngược với `accuracy`.
  - Hiển thị thanh tiến trình và vòng tròn radar động:
    - Xanh lục: $\le 1.0\text{m}$ (Khóa tự động).
    - Vàng: $1.0\text{m} - 3.0\text{m}$ (Đang hiệu chỉnh).
    - Đỏ: $> 3.0\text{m}$ (Cần di chuyển ra khoảng thoáng).

---

## 7. Cấu Trúc Cơ Sở Dữ Liệu Nâng Cấp & ERD

```mermaid
erDiagram
    users ||--o{ farms : owns
    users ||--o{ customer_leads : converts
    farms ||--o{ farm_plots : contains
    farms ||--o{ plants : cultivates
    plants ||--|| plant_tags : binds
    
    users {
        int id PK
        string email UK
        string phone UK
        string full_name
        string role
        string tier
        timestamp created_at
    }

    customer_leads {
        int id PK
        string full_name
        string phone
        string email
        string source_tag_uid
        string acquisition_campaign
        string status
        timestamp converted_at
    }

    farms {
        int id PK
        int user_id FK
        string name
        float center_latitude
        float center_longitude
        string puc_code
        timestamp created_at
    }

    plants {
        int id PK
        int farm_id FK
        string tree_code UK
        string plant_variety
        string plot_code
        int row_number
        float latitude
        float longitude
        float gps_accuracy
        string public_slug UK
        string cover_image
        timestamp created_at
    }

    plant_tags {
        int id PK
        int plant_id FK
        string nfc_uid UK
        string initial_gateway_url
        string assigned_public_url
        timestamp written_at
        string write_status
    }
```

---

## 8. Tài Liệu API Endpoints Mới

| Method | Endpoint | Quyền hạn | Mục đích chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/sub` | Public | Phục vụ trang giao diện Cổng số Smart NFC Gateway (SPA) |
| `POST` | `/api/auth/onboard-lead` | Public | Đăng ký tài khoản nhanh + Tự động tạo Trang Trại + Ghi nhận GPS Vườn |
| `POST` | `/api/plants/single-provision` | User / Admin | Khai báo 1 cây trồng chi tiết + Khóa tọa độ GPS $< 1\text{m}$ + Gán UID Thẻ |
| `POST` | `/api/nfc/verify-write` | User / Admin | Ghi nhận trạng thái thẻ NFC đã được nạp URL hồ sơ công khai thành công |
| `GET` | `/api/analytics/leads` | Admin | Thống kê số lượng khách hàng mới tiếp cận qua từng đợt cấp phát thẻ NFC |

---

## 9. Lộ Trình Triển Khai Chi Tiết Từ A -> Z

### 📅 Giai Đoạn 1: Lập Kế Hoạch & Thiết Kế Kiến Trúc (Planning & Specs)
- [x] Lập bản thiết kế kiến trúc hệ thống và luồng vận hành chi tiết.
- [x] Lưu tài liệu `20261002_planning_updated.md` làm tài liệu chuẩn hóa dự án.

### 💻 Giai Đoạn 2: Triển Khai Phát Triển (Implementation & Coding)
- [ ] Cấu hình Backend Route `/sub` và các API xử lý Lead Onboarding, Single Provisioning.
- [ ] Xây dựng giao diện Landing Cổng Số `/sub` với Glassmorphism UI & Animations.
- [ ] Phát triển Engine GPS sai số $< \pm 1\text{m}$ (`sub-gps-engine.js`).
- [ ] Tích hợp bộ điều khiển ghi thẻ Web NFC 2 chiều (`sub-nfc-bridge.js`).

### 🧪 Giai Đoạn 3: Kiểm Thử Tự Động & Đơn Vị (Unit & Integration Testing)
- [ ] Xây dựng kịch bản kiểm thử tự động `backend/scripts/test-sub-gateway.ps1`.
- [ ] Kiểm thử toàn diện các luồng Đã có tài khoản & Chưa có tài khoản.
- [ ] Kiểm thử cơ chế lọc GPS và chống trùng lặp mã thẻ NFC.

### 🔍 Giai Đoạn 4: Kiểm Soát Chất Lượng Nội Bộ (Quality Control - QC)
- [ ] Thử nghiệm tương thích giao diện trên thiết bị di động thực tế.
- [ ] Xử lý các trường hợp biên (Edge cases: Mất mạng, từ chối cấp quyền GPS, thiết bị không có NFC).

### 🏆 Giai Đoạn 5: Đảm Bảo Chất Lượng & Chuẩn Quốc Tế (Quality Assurance - QA)
- [ ] Đo lường theo tiêu chuẩn ISO/IEC 25010 (Hiệu năng tải trang $< 0.5\text{s}$).
- [ ] Đảm bảo chuẩn bảo mật OWASP Top 10 và tuân thủ VietGAP.

### 📦 Giai Đoạn 6: Nghiệm Thu & Bàn Giao Thực Địa (UAT & Acceptance)
- [ ] Chạy bộ test tổng duyệt 100% PASS.
- [ ] Cập nhật tài liệu kỹ thuật và bàn giao.

---

## 10. Bộ Tiêu Chí Nghiệm Thu (Acceptance Criteria Matrix)

| STT | Hạng Mục Nghiệm Thu | Tiêu Chuẩn Đạt Chuẩn (Definition of Done) | Mức Độ |
| :---: | :--- | :--- | :---: |
| 1 | **Tốc độ & Giao diện `/sub`** | Giao diện hiện đại, animation mượt, tải trang $< 0.5\text{s}$, chia rõ 2 lựa chọn. | 🔥 P0 |
| 2 | **Thu thập Lead Khách Hàng Mới** | Đăng ký tài khoản + Tạo Farm + Lưu GPS vườn trong 1 luồng duy nhất $< 60\text{s}$. | 🔥 P0 |
| 3 | **Độ Chính Xác GPS Cây Trồng** | Thuật toán khóa tọa độ chỉ cho phép lưu khi độ chính xác cảm biến đạt sai số $< \pm 1.0\text{m}$. | 🔥 P0 |
| 4 | **Ghi Thẻ Web NFC Hai Chiều** | Ghi đè thành công URL hồ sơ số công khai vào chip NDEF của thẻ vật lý. | 🔥 P0 |
| 5 | **Cơ chế Fallback QR Code** | Thiết bị không có Web NFC (như iPhone Safari) tự động hiển thị mã QR công khai. | ⚡ P1 |
| 6 | **Bảo mật & Chống Trùng Thẻ** | Mỗi mã UID NFC chỉ gắn duy nhất cho 1 cây trên toàn hệ thống CSDL. | 🔥 P0 |
| 7 | **Tự Động Hóa QA/QC** | Toàn bộ các API và kịch bản nghiệm thu mới đạt $100\%$ PASS. | 🔥 P0 |

---
*Tài liệu được phê duyệt và áp dụng trực tiếp cho toàn bộ hệ thống Tân Bảo AgTech Enterprise Suite 2026.*
