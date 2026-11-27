# 🌿 SỔ NÔNG TÂN BẢO AGTECH ERP (PLANT BOOK)
### Nền Tảng Quản Trị Trang Trại Thông Minh, Định Danh NFC 1-Cây-1-Thẻ, BI Tài Chính & AI Agent Nông Học Chuẩn Quốc Tế

> [!IMPORTANT]
> **ĐƠN VỊ CHỦ QUẢN & BẢN QUYỀN**:  
> **CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN / CÔNG TY CỔ PHẦN TÂN BẢO SÀI GÒN (TBSG AGTECH)**  
> - **Phiên bản hệ thống**: `v1.3.7 Core Release / v3.0 Enterprise Suite` (Build 21 · Commit baseline `3576c67`)  
> - **Nền tảng vận hành**: Multi-Cloud / On-Premise NAS + Web App PWA 3 Cổng (Admin · Farmer · Public) + Native Mobile App (Flutter Android & iOS)  
> - **Linh vật & Nhận diện**: Bé Mầm 3D Chibi & Biểu tượng Tân Bảo AgTech  
> - **Trạng thái kiểm định**: **33 Test Suites · 222 / 222 Test Cases Đạt 100.0% (0 Failed · ~2.04s)**  
> - **Tiêu chuẩn tuân thủ**: `ISO/IEC 25010` · `ISO/IEC 27001` · `ISO/IEC 29119` · `ISO/IEC 42001` · `ISO 22005` · `ISO 19115` · `VietGAP (TCVN 11892-1:2017)` · `GlobalG.A.P.` · `OWASP Top 10 & LLM Top 10`  
> - **CI/CD & Quality Gate**: 🟢 [PostgreSQL 16 + Playwright CI](plant-app-deploy/.github/workflows/ci-quality-gate.yml) | 🟢 [Android APK/AAB](https://github.com/Phuc0901-pp/plant-book/actions/workflows/build-apk.yml) | 🟢 [iOS IPA](https://github.com/Phuc0901-pp/plant-book/actions/workflows/build-ios.yml)

---

## 📑 MỤC LỤC TỔNG QUAN

1. [Tổng Quan, Chỉ Số Kỹ Thuật & Đánh Giá Chuẩn Quốc Tế](#1-tổng-quan--đánh-giá-chất-lượng-theo-chuẩn-quốc-tế-isoiec-25010)
2. [Sơ Đồ Tư Duy Hệ Thống Toàn Diện (System Mindmap)](#2-sơ-đồ-tư-duy-hệ-thống-toàn-diện-system-mindmap)
3. [Kiến Trúc Hệ Thống & Topology Đa Tầng (Enterprise Architecture)](#3-kiến-trúc-hệ-thống--topology-đa-tầng-enterprise-architecture)
4. [Lưu Đồ Giải Thuật & Quy Trình Vận Hành Chuẩn SOP](#4-lưu-đồ-giải-thuật--quy-trình-vận-hành-chuẩn-sop)
   - [4.1 Sơ Đồ Vận Hành Khép Kín Từ Đầu Vụ Đến Thu Hoạch](#41-sơ-đồ-vận-hành-khép-kín-từ-đầu-vụ-đến-thu-hoạch)
   - [4.2 Lưu Đồ Giải Thuật Khóa An Toàn Cách Ly Thuốc BVTV (PHI Quarantine Guard)](#42-lưu-đồ-giải-thuật-khóa-an-toàn-cách-ly-thuốc-bvtv-phi-quarantine-guard)
   - [4.3 Lưu Đồ Giải Thuật Tự Động Đồng Bộ Ngoại Tuyến 2 Chiều (Offline-First Sync Engine)](#43-lưu-đồ-giải-thuật-tự-động-đồng-bộ-ngoại-tuyến-2-chiều-offline-first-sync-engine)
   - [4.4 Lưu Đồ Giải Thuật Khai Báo Cây Ma Trận Tự Tăng Hàng (Matrix Generator)](#44-lưu-đồ-giải-thuật-khai-báo-cây-ma-trận-tự-tăng-hàng-matrix-generator)
   - [4.5 Luồng Truy Xuất Nguồn Gốc Công Khai & Bảo Mật Bí Mật Kinh Doanh (Public QR Traceability)](#45-luồng-truy-xuất-nguồn-gốc-công-khai--bảo-mật-bí-mật-kinh-doanh-public-qr-traceability)
   - [4.6 Luồng Tự Động Đóng Gói Di Động CI/CD (Android APK/AAB & iOS IPA Pipeline)](#46-luồng-tự-động-đóng-gói--ký-số-di-động-cicd-android-apkaab--ios-ipa-release-pipeline)
5. [Cấu Trúc Tính Năng, Module & Các Phân Hệ Nâng Cao v3.0](#5-cấu-trúc-tính-năng--danh-mục-module-chi-tiết)
   - [5.1 Phân Hệ Frontend Web PWA (55 Files JS · 3 Cổng · Cache-Busting & SmartAutoRefresh)](#51-phân-hệ-frontend-web-pwa-55-files-js--3-cổng)
   - [5.2 Phân Hệ Backend Core, Services & Security Middlewares (23 Routes · 19 Services · 9 Middlewares)](#52-phân-hệ-backend-core-services--security-middlewares)
   - [5.3 Phân Hệ Native Mobile App Flutter (60 Files Dart — Android & iOS)](#53-phân-hệ-native-mobile-app-flutter-60-files-dart--android--ios)
   - [5.4 Ma Trận Phân Quyền 4 Cấp Bậc (RBAC Matrix)](#54-ma-trận-phân-quyền-4-cấp-bậc-rbac-matrix)
   - [5.5 Kiến Trúc An Ninh ISO/IEC 27001, AI Agent Bé Mầm v3, BI Tài Chính, GIS & Notification Hub](#55-kiến-trúc-an-ninh-isoiec-27001-ai-agent-v3-bi-tài-chính-gis--notification-hub)
6. [Kiến Trúc Cơ Sở Dữ Liệu & Entity Relationship Diagram (ERD)](#6-kiến-trúc-cơ-sở-dữ-liệu--entity-relationship-diagram-erd)
   - [6.1 Sơ Đồ Quan Hệ Thực Thể Toàn Diện (ERD)](#61-sơ-đồ-quan-hệ-thực-thể-toàn-diện-erd)
   - [6.2 Thiết Kế Bảng, Khóa Ngoại & JSONB GIN Indexes](#62-thiết-kế-bảng-khóa-ngoại--jsonb-gin-indexes)
   - [6.3 Lộ Trình Migrations Đầy Đủ (20 Tệp SQL: 001 -> 019)](#63-lộ-trình-migrations-đầy-đủ-001---019)
7. [Tài Liệu API Endpoints Toàn Diện (205 REST APIs)](#7-tài-liệu-api-endpoints-toàn-diện-205-rest-apis)
8. [Hướng Dẫn Vận Hành Hệ Thống Theo Từng Vai Trò (SOP Manual)](#8-hướng-dẫn-vận-hành-hệ-thống-theo-từng-vai-trò-sop-manual)
9. [Bộ Kiểm Thử Tự Động & Tiêu Chuẩn Nghiệm Thu QA/QC (222/222 PASS — 33 Suites)](#9-bộ-kiểm-thử-tự-động--tiêu-chuẩn-nghiệm-thu-qaqc-222222-pass)
10. [Hướng Dẫn Cài Đặt, Triển Khai & Vận Hành Hạ Tầng (DevOps)](#10-hướng-dẫn-cài-đặt-triển-khai--vận-hành-hạ-tầng-devops)
    - [10.1 Chạy Cục Bộ (Local Development)](#101-chạy-cục-bộ-local-development)
    - [10.2 Triển Khai Máy Chủ Synology NAS On-Premise (Docker Compose)](#102-triển-khai-máy-chủ-synology-nas-on-premise-docker-compose)
    - [10.3 Vận Hành Ứng Dụng Di Động (Android APK, Google Play AAB & iOS IPA)](#103-vận-hành-ứng-dụng-di-động-android-apk-google-play-aab--ios-ipa)
    - [10.4 Triển Khai Multi-Cloud & Biến Môi Trường Production](#104-triển-khai-multi-cloud-postgresql-supabase-cloudflare-r2--aws-s3)
11. [Định Hướng Kiến Trúc Mở Rộng: MCU (IoT) & MCP / ReAct Scale 10.000+ Users](#11-định-hướng-kiến-trúc-mở-rộng-hệ-thống-có-cần-mcu-và-mcp-không)

---

## 1. Tổng Quan & Đánh Giá Chất Lượng Theo Chuẩn Quốc Tế (ISO/IEC 25010)

**Sổ Nông Tân Bảo (Plant Book AgTech ERP)** là nền tảng Agri-ERP toàn diện được phát triển bởi **Tân Bảo Sài Gòn (TBSG AgTech)**, số hóa vòng đời từng cá thể cây trồng (Sầu riêng, Bưởi, Cà phê, Xoài, Thanh long...) theo chuỗi giá trị truy xuất nguồn gốc và xuất khẩu chính ngạch.

### 📊 Quy Mô Thực Tế & Đánh Giá Theo Chuẩn Quốc Tế

| Hạng mục / Tiêu chuẩn | Quy mô / Mức độ | Chi tiết kỹ thuật đã triển khai & kiểm chứng |
| :--- | :---: | :--- |
| **Backend API Architecture** | **23 Modules · 205 Endpoints** | Express.js phân tầng (`routes/plants/` tách module `core`, `media-logs`, `nfc`, `public`, `helpers`), `19` core services, `9` security/ops middlewares. |
| **Cơ Sở Dữ Liệu PostgreSQL** | **20 SQL Migrations** | `001`–`019` đồng bộ `init.js`; Hash-chain SHA-256 nhật ký (`withFarmHashChainLock`), GIN JSONB Index, Soft-delete (`deleted_at IS NULL`), `SAVEPOINT` offline sync. |
| **Frontend Web & Mobile** | **55 Web JS · 60 Dart** | 3 cổng Web (`18` Admin JS, `26` Farmer JS, `11` Public JS) biên dịch SSOT qua `build-html.js` kèm **SHA-256 content-hash cache-busting**; Flutter Offline-First (Hive AES-256). |
| **ISO/IEC 27001 & OWASP** | ⭐⭐⭐⭐⭐ **Zero-Trust 5 Lớp** | TOTP MFA (RFC 6238 + AES-256-GCM vault), `adminIpGuard` (IP/CIDR), `dlpAntiExfiltration` (tự thu hồi `token_version`), Admin JWT 30p + `HttpOnly; SameSite=Strict` cookie, CSP, 1-Cây-1-Thẻ NFC HMAC-SHA256, khóa cập nhật GPS công khai (`403`). |
| **AI Agent (ISO/IEC 42001)** | ⭐⭐⭐⭐⭐ **Bé Mầm v3 ReAct** | Gemini Native Function Calling (`7` tools DB/Kho/Thời tiết/PHI/Calculator/KB), vấn đáp 3 bước, ẩn danh PII, DLP đầu ra, AES-256-GCM, Biosecurity/PHI Post-Verifier, RateLimiter + Bulkhead + CircuitBreaker + L0 Cache. |
| **Hiệu Năng & Quan Trắc** | ⭐⭐⭐⭐⭐ **High-Resilience** | `singleflight.js`, Redis + RAM cache, `SmartAutoRefresh` không giật lag (60s + `requestIdleCallback` + giữ scroll), OpenMetrics `/metrics`, APM `p50/p95/p99`, k6 200-VU gate. |
| **Kiểm Định Tự Động (QA)** | ⭐⭐⭐⭐⭐ **222 / 222 PASSED** | **33 suites** unit/integration tests + PostgreSQL 16 & Playwright Chromium CI (`0` lỗi, `337` file sạch `0` comment rác). |

---

## 2. Sơ Đồ Tư Duy Hệ Thống Toàn Diện (System Mindmap)

```mermaid
flowchart TD
    Root(["🌿 SỔ NÔNG NHÀN TÂN BẢO AGTECH ERP"])
    
    %% Nhánh 1: Định danh số
    Root --> ID_System["🏷️ ĐỊNH DANH SỐ CÂY TRỒNG"]
    ID_System --> ID_TreeCode["Mã Cây Duy Nhất (tree_code)"]
    ID_System --> ID_GPS["Tọa Độ Vệ Tinh GPS Không Trôi"]
    ID_System --> ID_Matrix["Phân Lô (Plot) & Tự Tăng Hàng (Row)"]
    ID_System --> ID_NFC["Thẻ Cứng NFC RFID (Chống trùng lặp)"]
    ID_System --> ID_QR["Mã QR Code Truy Xuất Động"]
    ID_System --> ID_Fallback["Nhận Diện Giống Thông Minh (Smart Crop Asset)"]

    %% Nhánh 2: Quản lý sinh trưởng & Media
    Root --> Media_System["📸 SINH TRƯỞNG & HỒ SƠ MEDIA"]
    Media_System --> Media_Album["Album Sinh Trưởng Bất Biến (Append-Only)"]
    Media_System --> Media_Watermark["Đóng Dấu Watermark GPS & Thời Gian"]
    Media_System --> Media_Stage["Theo Dõi Giai Đoạn: Ra Hoa, Đậu Trái, Nuôi Trái"]
    Media_System --> Media_Disease["Tách Riêng Ảnh & Video Bệnh Cây Cảnh Báo Đỏ"]
    Media_System --> Media_Storage["Lưu Trữ Đa Đám Mây: Supabase / S3 / R2 / Local"]

    %% Nhánh 3: Nhật ký VietGAP & Cách ly PHI
    Root --> Log_System["📝 NHẬT KÝ CANH TÁC VIETGAP"]
    Log_System --> Log_6Groups["6 Hoạt Động: Tưới, Bón, Phun, Tỉa, Bệnh, Thu Hoạch"]
    Log_System --> Log_PHI["Đếm Ngược Thời Gian Cách Ly Thuốc BVTV (PHI)"]
    Log_System --> Log_Lock["Khóa Thu Hoạch Cưỡng Chế Khi Chưa Hết Hạn PHI"]
    Log_System --> Log_Batch["Tự Sinh Mã Lô Xuất Khẩu: PUC-YYYYMMDD-Code"]
    Log_System --> Log_Export["Xuất Sổ Ký Điện Tử Excel / CSV Thẩm Định"]

    %% Nhánh 4: Agri-ERP Vật tư & Chi phí
    Root --> ERP_System["💰 AGRI-ERP VẬT TƯ & TÀI CHÍNH"]
    ERP_System --> ERP_Supplies["Danh Mục Kho: Phân Bón, Thuốc BVTV, Nước, Công"]
    ERP_System --> ERP_AutoDeduct["Tự Trừ Tồn Kho Khi Ghi Nhật Ký Ngoài Vườn"]
    ERP_System --> ERP_WaterCost["Tự Tính Tiền Nước: Thể Tích (m3) x Đơn Giá Kho"]
    ERP_System --> ERP_Financial["Báo Cáo Tài Chính Lũy Kế Từng Gốc Cây & Toàn Vườn"]
    ERP_System --> ERP_Redact["Bóc Tách Ẩn Giá Vốn Bảo Vệ Bí Mật Kinh Doanh"]

    %% Nhánh 5: Không gian GIS & Khí tượng
    Root --> GIS_System["🛰️ GIS KHÔNG GIAN & KHÍ TƯỢNG"]
    GIS_System --> GIS_Polygon["Vẽ Đa Giác Ranh Giới Vùng Trồng Polygon"]
    GIS_System --> GIS_Area["Tự Động Tính Diện Tích m2 sang Hecta"]
    GIS_System --> GIS_Weather["Dự Báo Khí Tượng Vệ Tinh 24h (Open-Meteo)"]
    GIS_System --> GIS_ET0["Chỉ Số Bốc Thoát Hơi Nước ET0 & An Toàn Phun Thuốc"]
    GIS_System --> GIS_Chibi["Linh Vật Bé Mầm Chibi Đồng Bộ Thời Tiết Thực"]

    %% Nhánh 6: Nền tảng Client & Ngoại tuyến
    Root --> Client_System["📱 NỀN TẢNG CLIENT & OFFLINE-FIRST"]
    Client_System --> Client_PWA["Web PWA Đa Nền Tảng (Desktop / Tablet / Mobile)"]
    Client_System --> Client_IDB["IndexedDB tanbao_offline_db Lưu Trữ Cục Bộ"]
    Client_System --> Client_Sync["Hàng Đợi Outbox Tự Động Đồng Bộ 2 Chiều"]
    Client_System --> Client_Mobile["Native Mobile App Flutter (Android & iOS)"]
    Client_System --> Client_CICD["GitHub Actions CI/CD Tự Động Đóng Gói Ký Số"]
```

---

## 3. Kiến Trúc Hệ Thống & Topology Đa Tầng (Enterprise Architecture)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG 1: CLIENT TIẾP NHẬN (Client Presentation Layer)          │
│                                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────┐  │
│   │   Admin Web Portal     │  │   User Web Portal      │  │   Public Traceability   │  │
│   │   /admin (Desktop)     │  │   /user (PWA Tablet)   │  │   /plant/:slug (QR Code)│  │
│   └───────────┬────────────┘  └───────────┬────────────┘  └────────────┬────────────┘  │
│               │                           │                            │               │
│               │               ┌───────────┴────────────┐               │               │
│               │               │   FLUTTER NATIVE APP   │               │               │
│               │               │   Android (APK & AAB)  │               │               │
│               │               │   Apple iOS (IPA & OTA)│               │               │
│               │               │   [Bé Mầm 3D Icon]     │               │               │
│               │               └───────────┬────────────┘               │               │
│               │                           │                            │               │
│               │            ┌──────────────┴──────────────┐             │               │
│               │            │ Service Worker + IndexedDB  │             │               │
│               │            │ (Chế độ Offline-First PWA)  │             │               │
│               │            └──────────────┬──────────────┘             │               │
│               │                           │ (Auto-Sync khi có sóng)    │               │
└───────────────┼───────────────────────────┼────────────────────────────┼───────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG 2: BẢO MẬT & API GATEWAY (Security Layer)                │
│   • Anti-Scraper & Rate Limiting (IP Limiter + User 10 req/s Protection Guard)         │
│   • JWT Token Authentication (RS256/HS256) & Farm Multi-Tenancy Scope RBAC             │
│   • XSS Sanitization & Global Safe Exception Handler & CORS Enterprise Policy          │
│   • Finance Redaction Filter (Tự động ẩn đơn giá vật tư với người dùng không có quyền) │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG 3: BACKEND CORE ENGINE (Node.js & Express)               │
│                                                                                        │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│   │ Auth & Users       │ │ Plants & Matrix    │ │ VietGAP & PHI     │ │ Supplies &  │  │
│   │ Service (RBAC)     │ │ Spatial Engine     │ │ Compliance Engine │ │ Cost Engine │  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘ └─────────────┘  │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│   │ GIS & Farm Spatial │ │ Weather & Agro-Tip │ │ Multi-Driver      │ │ NFC RFID    │  │
│   │ Polygon Engine     │ │ Service (Open-Meteo)│ │ Storage (S3/Cloud)│ │ Security Svc│  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘ └─────────────┘  │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│   │ Singleflight Dedup │ │ EventBus & Cache   │ │ Audit Logger &    │ │ Zalo / SMS  │  │
│   │ Concurrent Engine  │ │ Invalidation       │ │ History Service   │ │ Alert Engine│  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘ └─────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
┌───────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       TẦNG 4: CƠ SỞ DỮ LIỆU & LƯU TRỮ         │ │      TẦNG 5: DEVOPS & CI/CD          │
│                                               │ │                                      │
│  • PostgreSQL Enterprise (v14 - v16)          │ │  • GitHub Actions CI/CD Pipeline:    │
│    - GIN Index (details, data jsonb_path_ops) │ │    - build-apk.yml (Signed APK/AAB)  │
│    - Composite Index (plant_id, log_date DESC)│ │    - build-ios.yml (Signed IPA & OTA)│
│    - Spatial GIS Index (latitude, longitude)  │ │  • Synology NAS On-Premise Docker:   │
│  • SQLite CSDL Cục Bộ (Local Development)     │ │    - docker-compose.nas.yml          │
│  • Cloudflare R2 / Supabase Storage / S3      │ │  • Keystore & Apple Certificate Mgmt │
│    (Ảnh sinh trưởng, Video bệnh có Watermark) │ │  • Automated 141 Test Cases Suite    │
└───────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 4. Lưu Đồ Giải Thuật & Quy Trình Vận Hành Chuẩn SOP

### 4.1 Sơ Đồ Vận Hành Khép Kín Từ Đầu Vụ Đến Thu Hoạch

```mermaid
flowchart TD
    Start(["Bắt đầu Mùa Vụ"]) --> FarmSetup["1. Khởi tạo Nông Trại & Vẽ Ranh Giới Đa Giác Polygon GIS"]
    FarmSetup --> SuppliesSetup["2. Khởi tạo Danh Mục Kho Vật Tư, Phân Bón & Đơn Giá Chuẩn"]
    SuppliesSetup --> PlantBatch["3. Khai Báo Cây Trồng Ma Trận: Phân Lô, Tự Tăng Hàng & Gán Ảnh Thực Địa"]
    PlantBatch --> TagAssign["4. Gán Thẻ Cứng NFC RFID & In Tem QR Code"]
    
    TagAssign --> CareCycle{"5. Chu Kỳ Canh Tác Hàng Ngày Ngoài Vườn"}
    
    CareCycle -->|"Tưới nước"| LogWater["Ghi lượng nước (m3): Tự tính chi phí tiền nước"]
    CareCycle -->|"Bón phân"| LogFert["Chọn phân bón từ kho: Tự trừ tồn kho ERP & cộng chi phí cây"]
    CareCycle -->|"Phun thuốc BVTV"| LogPest["Ghi nhận thuốc: Kích hoạt Đếm ngược Thời gian Cách ly PHI"]
    CareCycle -->|"Phát hiện sâu bệnh"| LogDisease["Chụp ảnh Watermark GPS: Gửi cảnh báo đỏ kỹ thuật"]
    CareCycle -->|"Chụp ảnh định kỳ"| LogGrowth["Lưu ảnh Album Sinh Trưởng Bất Biến (Append-Only)"]
    
    LogWater --> UpdateERP["Cập nhật Dòng Thời Gian & Báo Cáo Tài Chính Lũy Kế Cây"]
    LogFert --> UpdateERP
    LogPest --> UpdateERP
    LogDisease --> UpdateERP
    LogGrowth --> UpdateERP
    
    UpdateERP --> HarvestCheck{"6. Đến Thời Điểm Thu Hoạch?"}
    HarvestCheck -->|"Chưa"| CareCycle
    HarvestCheck -->|"Đến kỳ thu hoạch"| PHIVerify{"Đã qua hết thời gian cách ly PHI?"}
    
    PHIVerify -->|"Chưa hết hạn PHI"| BlockHarvest["⛔ CẢNH BÁO ĐỎ: KHÓA THU HOẠCH - Bảo vệ an toàn thực phẩm"]
    BlockHarvest --> CareCycle
    
    PHIVerify -->|"Đã an toàn 100%"| AllowHarvest["7. Mở Khóa Thu Hoạch & Cấp Mã Lô Nông Sản: PUC-YYYYMMDD-Code"]
    AllowHarvest --> PublicTrace["8. In Tem Mã QR Dán Quả: Khách Hàng Quét Truy Xuất Nguồn Gốc"]
    PublicTrace --> EndSeason(["Kết Thúc Mùa Vụ & Báo Cáo Lợi Nhuận Tài Chính"])
```

---

### 4.2 Lưu Đồ Giải Thuật Khóa An Toàn Cách Ly Thuốc BVTV (PHI Quarantine Guard)

Thuật toán đảm bảo 100% tuân thủ quy chuẩn an toàn thực phẩm VietGAP / GlobalGAP, ngăn chặn việc thu hoạch nông sản khi tồn dư thuốc BVTV chưa phân giải hết:

```mermaid
flowchart TD
    A["Nông dân thao tác Ghi Nhật Ký"] --> B{"Loại nhật ký là gì?"}
    
    B -->|"Phun Thuốc BVTV"| C["Tra cứu số ngày cách ly (phi_days) từ kho farm_supplies"]
    C --> D["Tính ngày hết cách ly: safe_date = log_date + phi_days"]
    D --> E["Lưu plant_logs: details.phi_days, details.safe_harvest_date"]
    E --> F["Cập nhật trạng thái cây: health_status = 'quarantine'"]
    F --> G["Hiển thị Huy hiệu Vàng Cảnh báo: 'ĐANG CÁCH LY THUỐC'"]
    
    B -->|"Thu Hoạch"| H["Kiểm tra lịch sử phun thuốc gần nhất của cây"]
    H --> I{"Ngày hiện tại >= safe_harvest_date?"}
    
    I -->|"KHÔNG (Còn trong hạn PHI)"| J["⛔ KÍCH HOẠT KHÓA AN TOÀN VIETGAP"]
    J --> K["Từ chối tạo bản ghi thu hoạch (400 Bad Request)"]
    K --> L["Bật cờ: is_phi_violation = true"]
    L --> M["Báo động đỏ lên giao diện: 'Cây còn X ngày cách ly, nghiêm cấm thu hoạch!'"]
    
    I -->|"CÓ (Đã hết hạn PHI an toàn)"| N["✅ XÁC THỰC AN TOÀN THU HOẠCH"]
    N --> O["Nhập sản lượng thu hoạch (kg) & Phân loại phẩm cấp"]
    O --> P["Sinh mã lô truy xuất: PUC-YYYYMMDD-TreeCode"]
    P --> Q["Lưu bản ghi thu hoạch hợp lệ vào PostgreSQL"]
```

---

### 4.3 Lưu Đồ Giải Thuật Tự Động Đồng Bộ Ngoại Tuyến 2 Chiều (Offline-First Sync Engine)

Cho phép cán bộ kỹ thuật và nhân công tác nghiệp trong các khu vực mất sóng mạng viễn thông:

```mermaid
flowchart TD
    Start(["Người Dùng Thao Tác Ngoài Vườn"]) --> NetCheck{"Trạng thái mạng thiết bị?"}
    
    %% Khi Mất Sóng (Offline)
    NetCheck -->|"Mất sóng (Offline)"| SaveLocal["Ghi dữ liệu vào IndexedDB: store 'offline_logs_queue'"]
    SaveLocal --> SetPending["Gán sync_status = 'pending' & Tạo UUID tạm"]
    SetPending --> LocalFeedback["Hiển thị Toast: 'Đã lưu ngoại tuyến. Sẽ tự đồng bộ khi có mạng'"]
    
    %% Khi Có Sóng (Online)
    NetCheck -->|"Có mạng (Online)"| PostDirect["Gửi trực tiếp lên REST API Backend"]
    
    %% Cơ chế bắt sự kiện Online
    SetPending -.-> ListenEvent["Lắng nghe sự kiện window.addEventListener('online')"]
    ListenEvent --> TriggerSync["Kích hoạt OfflineSyncEngine.scanQueue()"]
    TriggerSync --> ReadQueue["Đọc toàn bộ bản ghi chờ trong offline_logs_queue"]
    
    ReadQueue --> Loop{"Còn bản ghi chờ?"}
    Loop -->|"Còn"| SendItem["Gửi POST /api/plants/:id/logs lên Cloud"]
    SendItem --> RespCheck{"Máy chủ phản hồi 201 Created?"}
    
    RespCheck -->|"Thành công"| RemoveQueue["Xóa bản ghi khỏi IndexedDB outbox queue"]
    RemoveQueue --> Loop
    
    RespCheck -->|"Lỗi mạng / 500"| RetryDelay["Giữ nguyên trong queue & Hẹn lịch thử lại sau (Exponential Backoff)"]
    
    Loop -->|"Hết bản ghi"| PullDelta["Kéo dữ liệu mới nhất từ máy chủ (GET /api/plants/sync-delta)"]
    PullDelta --> UpdateLocalCache["Cập nhật đệm cục bộ IndexedDB 'plants_cache'"]
    UpdateLocalCache --> DoneSync["Đổi huy hiệu trạng thái: 'Đã đồng bộ 100% dữ liệu'"]
    PostDirect --> DoneSync
```

---

### 4.4 Lưu Đồ Giải Thuật Khai Báo Cây Ma Trận Tự Tăng Hàng (Matrix Generator)

```mermaid
flowchart TD
    Open["Mở Modal Khai Báo Cây Trồng"] --> SelectMode{"Chọn Phương Thức"}
    
    SelectMode -->|"Tạo Đơn Lẻ"| Single["Nhập Mã Cây, Giống, Ngày trồng, Chọn Lô/Hàng & Chụp ảnh"]
    Single --> SubmitSingle["Gửi POST /api/plants"]
    
    SelectMode -->|"Ma Trận Hàng Loạt"| MatrixInput["Nhập Tiền tố (vd: S01), Số lượng cây (vd: 50)"]
    MatrixInput --> PlotInput["Nhập Mã Lô chung (vd: A1) & Chọn Tự Tăng Số Hàng (vd: 10 cây/hàng)"]
    PlotInput --> BulkImgOption["Tùy chọn: Chọn 1 ảnh chụp chung cho cả lô hoặc ảnh đại diện giống"]
    
    PlotInput --> GenerateLoop["Thuật Toán Sinh Ma Trận Trên RAM Frontend"]
    GenerateLoop --> LoopCalc["Vòng lặp i = 1 đến N:
    - tree_code = Prefix + PadZero(i, 3)
    - plot_code = StandardizePlot(A1 -> LÔ A1)
    - row_number = Floor((i - 1) / CâyMỗiHàng) + 1
    - public_slug = Slugify(tree_code)"]
    
    LoopCalc --> RenderTable["Hiển Thị Bảng Xem Trước Ma Trận (Editable Table)"]
    RenderTable --> UserAdjust["Người dùng tùy chỉnh riêng từng cây nếu cần (đổi hàng, sửa ngày)"]
    UserAdjust --> SubmitMatrix["Bấm 'Xác Nhận Tạo Toàn Bộ Cây'"]
    
    SubmitMatrix --> APICall["Gửi POST /api/plants/batch-range (Payload 50 cây)"]
    APICall --> DBInsert["PostgreSQL thực thi INSERT BATCH trong 1 Transaction"]
    DBInsert --> ReturnIDs["Trả về danh sách 50 ID cây vừa tạo"]
    
    ReturnIDs --> UploadParalell{"Có ảnh chụp chung được chọn?"}
    UploadParalell -->|"Có"| ConcurrentUpload["Kích hoạt tải ảnh đồng thời vào plant_media cho cả 50 cây"]
    UploadParalell -->|"Không"| FallbackAsset["Gán ảnh giống chuẩn (/assets/crop/durian.png)"]
    
    ConcurrentUpload --> Complete["Hoàn Tất: 50 cây xuất hiện trên bản đồ GIS & sẵn sàng gán thẻ NFC"]
    FallbackAsset --> Complete
```

---

### 4.5 Luồng Truy Xuất Nguồn Gốc Công Khai & Bảo Mật Bí Mật Kinh Doanh (Public QR Traceability)

```mermaid
sequenceDiagram
    autonumber
    actor Consumer as Người Tiêu Dùng / Đối Tác Thu Mua
    participant Mobile as Camera / Trình Duyệt Mobile
    participant Backend as Backend Public Route (/plant/:slug)
    participant Redact as Finance & Business Secret Redaction Engine
    participant DB as PostgreSQL Database

    Consumer->>Mobile: Quét mã QR dán trên quả -> Mở https://plantbook.vn/plant/S01-001
    Mobile->>Backend: GET /api/plants/public/S01-001
    Backend->>DB: Truy vấn thông tin cây, giống, nông trại, mã PUC
    Backend->>DB: Truy vấn dòng thời gian nhật ký chăm sóc (plant_logs)
    Backend->>DB: Truy vấn album ảnh sinh trưởng (plant_media category='growth')
    DB-->>Backend: Dữ liệu thô từ cơ sở dữ liệu
    
    Backend->>Redact: Bóc tách & Làm sạch dữ liệu nhạy cảm
    Note over Redact: 1. Gỡ bỏ 100% đơn giá, chi phí tiền phân thuốc<br/>2. Ẩn công thức độc quyền & tỷ lệ pha chế bí mật<br/>3. Loại bỏ ảnh/video bệnh cây cảnh báo nội bộ<br/>4. Giữ nguyên: Ngày bón, tên hoạt chất, số ngày cách ly PHI
    Redact-->>Backend: Bộ dữ liệu minh bạch an toàn
    
    Backend-->>Mobile: Render Trang Web Hồ Sơ Nông Sản Chuẩn VietGAP
    Mobile-->>Consumer: Xem: Xuất xứ địa lý, Bản đồ vườn, Nhật ký minh bạch, Chứng thực cách ly an toàn 100%
```

---

### 4.6 Luồng Tự Động Đóng Gói & Ký Số Di Động CI/CD (Android APK/AAB & iOS IPA Release Pipeline)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Lập Trình Viên / Agent
    participant Git as GitHub Repository (Branch: main)
    participant Actions as GitHub Actions Runner
    participant Keystore as TBSG Agtech Android Keystore
    participant AppleCert as Apple In-House Enterprise Packaging
    participant Release as GitHub Releases v1.3.5

    Dev->>Git: git push origin main (Commit cập nhật icon / mã nguồn)
    Git->>Actions: Kích hoạt đồng thời 2 Workflows tự động
    
    par Luồng Đóng Gói Android (build-apk.yml)
        Actions->>Actions: Cài đặt Flutter 3.29.x & Java 17
        Actions->>Keystore: Nạp file release-keystore.jks & key.properties (Base64)
        Actions->>Actions: flutter build apk --release (Fat Universal APK)
        Actions->>Actions: flutter build apk --split-per-abi (ARM64 Optimized APK)
        Actions->>Actions: flutter build appbundle --release (Google Play AAB)
        Actions->>Actions: Ký số doanh nghiệp SHA-256 TBSG Agtech
        Actions->>Release: Upload: PlantBook-Mobile-ERP-v1.3.5-universal.apk & .aab
    and Luồng Đóng Gói iOS (build-ios.yml)
        Actions->>Actions: Cài đặt macOS Runner & Xcode
        Actions->>Actions: flutter build ios --release --no-codesign
        Actions->>AppleCert: Đóng gói Payload Runner.app thành file .ipa chuẩn
        Actions->>Actions: Tạo tệp manifest.plist (Apple OTA In-House Installation)
        Actions->>Release: Upload: PlantBook-Mobile-ERP-v1.3.5-ios.ipa & manifest.plist
    end
    
    Release-->>Dev: Thông báo: Bản build mới nhất sẵn sàng tải về cài đặt!
```

---

## 5. Cấu Trúc Tính Năng & Danh Mục Module Chi Tiết

### 5.1 Phân Hệ Frontend Web PWA (55 Files JS · 3 Cổng)

Giao diện chia thành 3 cổng độc lập (**Admin** · **Farmer `/user`** · **Public**), biên dịch từ template qua `backend/scripts/build-html.js` và tự động gắn **SHA-256 content-hash cache-busting** (`?v=v1.3.7-<hash8>`) cho mọi JS/CSS nội bộ:

| Cổng / Nhóm | Tệp Tiêu Biểu | Chức Năng Chính & Nghiệp Vụ |
| :--- | :--- | :--- |
| **Farmer PWA Core (`user/js/core/`)** | `api.js`, `utils.js`, `offline-db.js`, `offline-sync.js`, `router.js` | Giao tiếp RESTful kèm Single-Flight token refresh, IndexedDB Offline-First Outbox sync, điều hướng SPA & deep-link URL |
| **Farmer Modules (`user/js/modules/`)** | `plants.js`, `plants-profile-erp.js`, `plants-iot-weather.js`, `care-modal.js`, `logs.js`, `map.js`, `nfc.js`, `reminders.js`, `notifications.js`, `weather-clock.js`, `mascot-chibi.js` | Quản lý cây ma trận, hồ sơ ERP 4 tab, nhật ký 7 nhóm Chibi ISO + PHI + ảnh Watermark, bản đồ GIS + đồng mức mượt, Web NFC 1-Cây-1-Thẻ, Chuông thông báo 4 nhạc chuông Web Audio |
| **Admin Portal (`admin/js/`)** | `app.js`, `auth.js`, `dashboard.js`, `gis.js`, `gis-export.js`, `gis-gps-tools.js`, `plants.js`, `database.js`, `users.js`, `devices.js`, `ai-training.js`, `notifications.js`, `websocket.js` | Dashboard điều hành, MFA TOTP QR modal, GIS vẽ polygon WGS 84 (`ensureDrawLayersOnTop`) & đồng mức 1m/2m/5m, xuất bản vẽ A4, AI Training Studio, Thanh tra CSDL & WebSocket Real-time |
| **Shared Public & BI (`public/js/`)** | `bi-analytics-widget.js`, `i18n-engine.js`, `smart-auto-refresh.js`, `plant.js`, `plant-nfc-gateway.js`, `report.js`, `sub-gateway.js`, `sub-gps-engine.js` | **BI Tài chính lọc theo Farm & Năm**, i18n VI/EN/ZH (`₫/USD/CNY`), **SmartAutoRefresh 60s không giật lag**, trang truy xuất công khai (`/plant/:slug` — đã khóa cập nhật GPS), cổng `/sub` gán thẻ nhanh |

---

### 5.2 Phân Hệ Backend Core, Services & Security Middlewares

Backend **Node.js & Express** gồm **23 file routes** (**205 endpoints**), **19 services** và **9 security/telemetry middlewares**:

| Thành Phần | Tệp Nguồn Chính | Chức Năng & Nghiệp Vụ Cốt Lõi |
| :--- | :--- | :--- |
| **Routes API (`routes/`)** | `auth.js`, `farms.js`, `plants/{core,media-logs,nfc,public,helpers}.js`, `supplies.js`, `analytics.js`, `ai.js`, `ai_training.js`, `notifications.js`, `devices.js`, `database.js`, `users.js`, `history.js`, `costs.js`, `config.js`, `schemas.js`, `version.js`, `diagnostics.js` | 205 REST endpoints bảo vệ bằng JWT/RBAC, phân tách luồng cây/nhật ký/NFC/công khai, audit chuẩn hóa diện tích farm `POST /api/farms/audit-normalize-areas`, khóa `POST /public/:slug/gps` (`403`) |
| **AI Agent v3 & RAG (`services/`)** | `aiAgentSecurity.js`, `beMamAgentTools.js`, `beMamAgentEngine.js` | **Native Gemini Function Calling** (7 tools), AES-256-GCM payload crypto, PII Redactor, Indirect Injection Guard, Output DLP, Biosecurity/PHI Post-Verifier, `AgentRateLimiter`, `AgentBulkhead`, `ModelCircuitBreaker`, L0 Semantic Cache |
| **Core ERP & Realtime (`services/`)** | `reportQueryService.js`, `unitConversionService.js`, `rbacScopeService.js`, `notificationDispatcher.js`, `nfcSecurityService.js`, `auditLogger.js`, `weatherService.js`, `agriReminder.js`, `storageService.js`, `singleflight.js`, `eventBus.js`, `queueService.js`, `apmMetricsService.js`, `totpMfaService.js`, `zaloService.js`, `emailService.js` | Truy vấn báo cáo ISO 22005, quy đổi đơn vị & kiểm toán diện tích polygon `computePolygonAreaM2`, Notification Hub đa kênh (batch 60s + Quiet Hours), NFC HMAC-SHA256, OpenMetrics `/metrics`, TOTP MFA |
| **Security Middlewares (`middleware/`)** | `auth.js`, `admin.js`, `adminIpGuard.js`, `dlpAntiExfiltration.js`, `antiScraper.js`, `userRateLimiter.js`, `checkTier.js`, `errorHandler.js` | Xác thực `HttpOnly` cookie + Bearer JWT, IP/CIDR allowlist Admin, DLP chặn rút trích hàng loạt (`token_version++`), chống scraper & giới hạn tần suất |

---

### 5.3 Phân Hệ Native Mobile App Flutter (60 Files Dart — Android & iOS)

Ứng dụng Flutter trong `mobile_app/` gồm **60 tệp `.dart`** thiết kế Offline-First đồng bộ với Web ERP:

- **Bảo mật & Kho cục bộ:** Mã hóa **AES-256 Hive Vault** (`encrypted_hive_service.dart`), **HMAC-SHA256 NTAG213** (`crypto_security_service.dart`), RBAC 4 vai trò (`rbac_policy.dart`), khóa API bảo mật trong `FlutterSecureStorage`.
- **Đồng bộ 2 chiều nguyên tử:** `offline_sync_service.dart` gửi batch log về `/api/plants/offline-batch-sync` dùng `SAVEPOINT` PostgreSQL; hỗ trợ đồng bộ nền và cảnh báo PHI / vật tư hết hạn giống hệt Web.
- **Thông báo Real-time & Đa kênh:** `notification_service.dart` tích hợp `flutter_local_notifications` với **2 kênh Android riêng biệt** (Cảnh báo vận hành & Khẩn cấp), kết nối WebSocket Bearer JWT và màn hình `alerts_page.dart` (2 tab: *Thông báo* & *Luật cảnh báo*).
- **Vận hành thực địa:** Đọc/ghi NFC NDEF URI (`0x01`–`0x04`), bản đồ định vị GPS (`geo_fence_service.dart`), nhật ký Chibi 7 nhóm, Carbon MRV & xuất báo cáo tiếng Việt (`vi_VN`).

---

### 5.4 Ma Trận Phân Quyền 4 Cấp Bậc (RBAC Matrix)

| Nghiệp vụ / Phân hệ chức năng | Quản trị viên (`Super Admin / Admin`) | Chủ Trang Trại (`User Pro`) | Nhân Công Vườn (`User Normal`) | Người Tiêu Dùng / Đối Tác (`Public`) |
| :--- | :---: | :---: | :---: | :---: |
| **Xem hồ sơ cây trồng & nhật ký canh tác** | ✅ Toàn hệ thống | ✅ Toàn hệ thống | ✅ Cây thuộc vườn | ✅ Bản rút gọn minh bạch |
| **Khai báo cây ma trận & Phân lô hàng loạt** | ✅ | ✅ | ❌ | ❌ |
| **Tải ảnh Album Sinh Trưởng (Append-Only)** | ✅ | ✅ | ✅ | ❌ |
| **Ghi nhật ký 6 nhóm VietGAP & Đóng dấu GPS** | ✅ | ✅ | ✅ | ❌ |
| **Xem chi phí tài chính & Khấu trừ kho ERP** | ✅ Xem & Quản trị kho | ✅ Xem chi phí vườn nhà | ❌ **Bị ẩn giá tiền (Redacted)** | ❌ **Bảo mật tuyệt đối** |
| **Vẽ đa giác Polygon & Tạo nông trại** | ✅ | ✅ | ❌ | ❌ |
| **Gán thẻ cứng NFC RFID & In tem mã QR** | ✅ | ✅ | ✅ (Chỉ quét gán thẻ) | ❌ |
| **Xuất báo cáo Sổ Ký Điện Tử VietGAP** | ✅ (Mọi nông trại) | ✅ (Trang trại sở hữu) | ❌ | ❌ |
| **Tác nghiệp Ngoại tuyến PWA (Offline-First)**| ✅ | ✅ | ✅ | ❌ |
| **Quản trị tài khoản & Cấu hình máy chủ CSDL**| ✅ | ❌ | ❌ | ❌ |

### 5.5 Kiến Trúc An Ninh ISO/IEC 27001, AI Agent v3, BI Tài Chính, GIS & Notification Hub

- **An Ninh Zero-Trust 5 Lớp (`ISO/IEC 27001`):**
  1. **TOTP MFA (`totpMfaService.js`):** Xác thực 2 lớp RFC 6238 chuẩn Google/Microsoft Authenticator, khóa bí mật mã hóa **AES-256-GCM**, hỗ trợ **Session Kill-Switch** (`token_version++` thu hồi toàn bộ phiên cũ).
  2. **Admin IP Guard (`adminIpGuard.js`):** Lọc IP/CIDR cho luồng quản trị (`/api/admin`, `/api/database`, `/api/users`) thông qua biến `ADMIN_IP_ALLOWLIST`.
  3. **DLP Anti-Exfiltration (`dlpAntiExfiltration.js`):** Giám sát xuất dữ liệu hàng loạt, ghi bảng `security_incidents` và tự động vô hiệu hóa phiên bất thường.
  4. **Session & Transport Hardening:** Admin JWT thời hạn 30 phút đi kèm `HttpOnly; SameSite=Strict` cookie, header CSP chặt chẽ (`worker-src 'self' blob:;` tương thích MapboxDraw), và UI guard thân thiện môi trường dev/prod.
  5. **NFC & Public GPS Guard:** Ký xác thực thẻ cứng bằng **HMAC-SHA256** (`NFC_HMAC_SECRET`), khóa endpoint `POST /public/:slug/gps` (`403 PUBLIC_GPS_UPDATE_LOCKED`) để không cho người xem trang công khai tự ý ghi đè tọa độ cây.

- **AI Agent Bé Mầm v3 (`ai.js`, `beMamAgentTools.js`, `aiAgentSecurity.js`):**
  - Chuyển sang **Gemini Native Function Calling** (tối đa 3 vòng ReAct, timeout 20s/vòng) với `systemInstruction` tách biệt và **7 tools đọc dữ liệu thật** (`get_farm_overview`, `get_plant_dossier`, `get_care_history`, `check_supply_inventory`, `get_farm_weather_forecast`, `calculate_agro_dosage`, `search_agronomy_kb`), mỗi query DB bị giới hạn `statement_timeout = 3s`.
  - **Bảo mật & Mã hóa AI:** `encryptAgentPayload`/`decryptAgentPayload` (AES-256-GCM), `redactPiiForLlm` ẩn danh SĐT/Email tiếng Việt/CCCD/JWT/API Key trước khi gửi LLM, `sanitizeUntrustedDbText` chống indirect injection từ ghi chú DB, `scanAndSanitizeAgentOutput` chống lộ secret, và `verifyAgronomySafetyReply` tự nhắc cách ly 10–15 ngày vi sinh / cảnh báo PHI quarantine.
  - **Chịu tải cao & Tối ưu băng thông:** `AgentRateLimiter` (theo gói `normal`/`pro`/`admin`), `AgentBulkhead` (`maxConcurrent: 25`), `ModelCircuitBreaker` (xoay vòng `gemini-2.5-pro` ↔ `gemini-2.5-flash`), `L0 Semantic Cache`, `trimHistoryToBudget` và `compactToolPayload`.

- **BI Tài Chính Theo Farm & Chuẩn Hóa Diện Tích (`analytics.js`, `bi-analytics-widget.js`, `unitConversionService.js`):**
  - Giao diện BI hỗ trợ chọn trực tiếp **Trang trại (`?farm_id=...`)** và **Năm (`?year=...`)** kèm nhãn phạm vi `#bi-scope-badge`, tab **Ma trận ROI theo Lô** hiển thị cột **Trang trại** bấm lọc nhanh 1 chạm; backend tách riêng key `singleflight` theo `farm_id`/`year` và chặn rò rỉ chi phí `su.farm_id IS NULL`.
  - `auditAndNormalizeFarmArea` và endpoint `POST /api/farms/audit-normalize-areas` tự động phát hiện/khắc phục các farm nhập nhầm `ha` vào `m²`, diện tích outlier bất thường hoặc thiếu `area` so với đa giác polygon (`computePolygonAreaM2`), bảo vệ chỉ số `/ha` trên BI luôn chính xác.

- **GIS & Bản Đồ Số (`gis.js`, `gis-export.js`, `geoIsoValidator.js`):**
  - Chuẩn hóa thứ tự GeoJSON WGS 84 `[lng, lat]`, giữ lớp vẽ `gl-draw-*` luôn nằm trên lớp vệ tinh (`ensureDrawLayersOnTop`), đếm đúng số cây active (`COUNT(DISTINCT p.id)` + đồng bộ `total_plants` khi xóa/khôi phục cây), và nội suy đường đồng mức địa hình mượt mà (Chaikin 2 lượt, `exaggeration: 1.0`, bước thích ứng `1m/2m/5m`).

- **Multi-Platform Notification Hub (`notificationDispatcher.js`):**
  - Gom nhóm thông báo 60 giây, tôn trọng Quiet Hours, phát sự kiện riêng biệt theo quyền WebSocket, 4 nhạc chuông Web Audio trên Web và 2 kênh thông báo Android trên Flutter.

---

## 6. Kiến Trúc Cơ Sở Dữ Liệu & Entity Relationship Diagram (ERD)

### 6.1 Sơ Đồ Quan Hệ Thực Thể Toàn Diện (ERD)

```mermaid
erDiagram
    users ||--o{ farms : owns
    users ||--o{ user_activities : performs
    farms ||--o{ farm_plots : contains
    farms ||--o{ farm_supplies : manages
    farms ||--o{ plants : cultivates
    plant_schemas ||--o{ plants : defines
    plants ||--o{ plant_logs : logs
    plants ||--o{ plant_media : stores
    plants ||--o{ plant_tags : identifies
    
    users {
        int id PK
        string email UK
        string password_hash
        string full_name
        string phone
        string role
        string tier
        int farm_id FK
        timestamp created_at
    }

    farms {
        int id PK
        string name
        string description
        jsonb polygon_coords
        float area
        string puc_code
        int user_id FK
        timestamp created_at
    }

    farm_plots {
        int id PK
        int farm_id FK
        string plot_code
        string plot_name
        int total_rows
        timestamp created_at
    }

    plants {
        int id PK
        int farm_id FK
        int schema_id FK
        string tree_code UK
        string public_slug UK
        string plant_type
        string plant_variety
        string plot_code
        int row_number
        date planting_date
        string plant_age
        string health_status
        float latitude
        float longitude
        string cover_image
        jsonb data
        boolean is_public
        timestamp created_at
    }

    plant_logs {
        int id PK
        int plant_id FK
        date log_date
        string log_type
        string note
        jsonb details
        jsonb media_urls
        float cost_amount
        string operator_name
        boolean is_phi_violation
        string harvest_batch_code
        int created_by FK
        timestamp created_at
    }

    plant_media {
        int id PK
        int plant_id FK
        string object_name
        string url
        string media_type
        string caption
        boolean delete_pending
        timestamp uploaded_at
    }

    plant_tags {
        int id PK
        int plant_id FK
        string nfc_uid UK
        string tag_type
        timestamp assigned_at
    }

    farm_supplies {
        int id PK
        int farm_id FK
        string name
        string category
        string unit
        float unit_price
        float stock_balance
        int phi_days
        timestamp updated_at
    }

    user_activities {
        int id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
        jsonb metadata
        timestamp created_at
    }
```

---

### 6.2 Thiết Kế Bảng, Khóa Ngoại & JSONB GIN Indexes

Hệ thống được thiết lập các chỉ mục nâng cao (**High-Performance Indexing Strategy**) giúp tối ưu hóa truy vấn hàng triệu cá thể cây và hàng chục năm dữ liệu canh tác:

```sql
-- 1. GIN Index tối ưu truy vấn sâu bên trong trường JSONB của nhật ký canh tác
CREATE INDEX IF NOT EXISTS idx_plant_logs_details_gin 
ON plant_logs USING gin (details jsonb_path_ops);

-- 2. GIN Index trên trường dữ liệu nông học mở rộng của cây trồng
CREATE INDEX IF NOT EXISTS idx_plants_data_gin 
ON plants USING gin (data jsonb_path_ops);

-- 3. Composite Index phục vụ tải dòng thời gian sinh trưởng & nhật ký theo thứ tự mới nhất
CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_date 
ON plant_logs (plant_id, log_date DESC);

-- 4. Spatial Index phục vụ truy vấn tọa độ GPS vẽ nhanh Marker trên bản đồ GIS
CREATE INDEX IF NOT EXISTS idx_plants_coords 
ON plants (latitude, longitude);

-- 5. Unique Indexes tìm kiếm nhanh theo mã cây và đường dẫn công khai
CREATE INDEX IF NOT EXISTS idx_plants_tree_code ON plants (tree_code);
CREATE INDEX IF NOT EXISTS idx_plants_public_slug ON plants (public_slug);

-- 6. Index truy xuất lịch sử ảnh sinh trưởng Append-Only
CREATE INDEX IF NOT EXISTS idx_plant_media_plant_date 
ON plant_media (plant_id, uploaded_at DESC);
```

---

### 6.3 Lộ Trình Migrations Đầy Đủ (`001` -> `019`, Tổng 20 Tệp SQL)

| Nhóm Migration | Danh Sách Tệp | Phạm Vi Cấu Trúc CSDL |
| :--- | :--- | :--- |
| **Core ERP & VietGAP (`001`–`005`)** | `001_initial_schema.sql`, `002_vietgap_and_supplies.sql`, `003_gin_and_performance_indexes.sql`, `004_nfc_inventory_and_public_url.sql`, `005_nfc_security_and_geofence.sql`, `005_plant_logs_soft_delete.sql` | Bảng cốt lõi `users`, `farms`, `plants`, `plant_logs`, `supplies`, `supply_usages`; JSONB GIN indexes; `nfc_tags_inventory` 1-Cây-1-Thẻ; Geofence & soft-delete logs |
| **AI Studio, ISO & Carbon (`006`–`011`)** | `006_ai_training_and_knowledge_base.sql`, `007_gallagher_api_iso27001.sql`, `008_utf8_and_hashchain_optimization.sql`, `009_enterprise_iso_hardening.sql`, `010_phase2_optimization_and_vault.sql`, `011_iso_19115_gps_gis_hardening.sql` | Kho tri thức & Q&A Bé Mầm; `farm_api_keys` & `audit_logs`; Hash-Chain SHA-256 `record_hash`; chuẩn hóa GIS/GPS ISO 19115 & mật khẩu/UTF-8 |
| **Enterprise Security, WMS & Telemetry (`012`–`019`)** | `012_enterprise_cleanup_and_security.sql`, `013_be_mam_agent_encyclopedia_seed.sql`, `014_security_hardening_and_saved_reports.sql`, `015_erp_subaccount_wms_and_hardening.sql`, `016_iso_schema_parity_and_perf.sql`, `017_signed_pdf_registry.sql`, `018_admin_zero_trust_security.sql`, `019_notification_hub_multichannel.sql` | Seed bách khoa nông học; báo cáo đã lưu; phân quyền 4 sub-role + moving-avg WMS; parity schema; bảng `totp_mfa` & `security_incidents` (ISO 27001); bảng `user_notifications` & `notification_preferences` |

---

## 7. Tài Liệu API Endpoints Toàn Diện (205 REST APIs)

Hệ thống cung cấp **205 RESTful API Endpoints** phân bổ qua **23 route files**, bảo vệ bởi Rate Limiter, DLP Anti-Exfiltration, Admin IP Allowlist và JWT RBAC:

| Phân Hệ | Endpoints Tiêu Biểu | Quyền Hạn | Mô Tả Chính |
| :--- | :--- | :---: | :--- |
| **Auth & Zero-Trust MFA** | `POST /api/auth/login`, `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`, `POST /api/auth/logout-all`, `GET /api/auth/me` | Public / Auth | Đăng nhập (`HttpOnly` cookie cho Admin), thiết lập & xác thực TOTP MFA 2FA, Session Kill-Switch (`token_version++`) |
| **Farms, GIS & Area Audit** | `GET /api/farms`, `POST /api/farms`, `POST /api/farms/self-init`, `PUT /api/farms/:id`, `POST /api/farms/audit-normalize-areas`, `GET /api/farms/:id/full-dataset` | User / Admin | Quản lý ranh giới WGS 84, tính diện tích `m²/ha`, đếm cây active (`COUNT(DISTINCT p.id)`), rà soát/sửa lỗi đơn vị diện tích, xuất full dataset bảo mật |
| **Plants & Care Logs** | `GET /api/plants`, `POST /api/plants/batch-range`, `DELETE /api/plants/:id`, `POST /api/plants/:id/restore`, `POST /api/plants/:id/logs`, `POST /api/plants/offline-batch-sync`, `GET /api/plants/reports/query` | User / Admin | Ma trận tạo cây, xóa mềm/khôi phục (đồng bộ `total_plants`), khóa cứng PHI (`409`), Hash-Chain SHA-256, Offline batch `SAVEPOINT`, báo cáo ISO 22005 |
| **Public QR Traceability** | `GET /api/plants/public/:slug`, `POST /api/plants/public/:slug/gps` *(LOCKED 403)*, `GET /api/plants/:id/public-logs` | Public / Locked | Xem hồ sơ nông sản công khai đã ẩn bí mật kinh doanh; endpoint cập nhật GPS trang công khai đã khóa `403 PUBLIC_GPS_UPDATE_LOCKED` |
| **NFC 1-Cây-1-Thẻ** | `GET /api/nfc/tag/:farmId/:nfcUid`, `POST /api/nfc/assign`, `POST /api/nfc/inventory/import`, `POST /api/plants/nfc-verify-hmac` | User / Admin | Nhập kho thẻ NTAG213, gán/thay thế thẻ, đóng băng thẻ cũ thu hồi, kiểm tra chữ ký HMAC-SHA256 |
| **Supplies & WMS ERP** | `GET /api/supplies`, `POST /api/supplies`, `POST /api/supplies/:id/restock`, `POST /api/supplies/usages` | User Pro / Admin | Nhập kho bình quân gia quyền, chặn xuất kho vật tư hết hạn (`400`), ẩn đơn giá theo sub-role |
| **Executive BI Analytics** | `GET /api/analytics/bi-overview`, `cost-breakdown`, `plot-comparison`, `predictive-yield`, `i18n/:lang` | User Pro / Admin | Hỗ trợ lọc `?farm_id=...&year=...`, `area_audit_warnings`, ma trận ROI theo Lô & Trang trại, đa ngôn ngữ VI/EN/ZH (`₫/USD/CNY`) |
| **AI Agent Bé Mầm v3** | `POST /api/ai/chat`, `GET/POST /api/ai/training/*` | User / Admin | Chat ReAct Function Calling (7 tools), truyền `active_farm_id` / `active_plant_id`, RateLimit + Bulkhead + CircuitBreaker + DLP + PII Redact |
| **Notifications & Monitoring** | `GET /api/notifications`, `PUT /api/notifications/preferences`, `GET /api/admin/security-incidents`, `GET /metrics`, `GET /api/health` | User / Admin | Trung tâm thông báo đa nền tảng, nhật ký sự cố DLP/IP Guard, OpenMetrics Prometheus & trạng thái DB/Redis/Queue |

---

## 8. Hướng Dẫn Vận Hành Hệ Thống Theo Từng Vai Trò (SOP Manual)

### 👑 8.1 Dành cho Quản Trị Viên Doanh Nghiệp (Admin)
1. **Đăng nhập Hệ thống:** Truy cập `/login`, đăng nhập tài khoản quản trị. Hệ thống tự chuyển đến bảng điều khiển `/admin`.
2. **Quản trị Tài khoản & Phân quyền:** Vào menu **"Người Dùng"** $\rightarrow$ Tạo tài khoản cho nông hộ $\rightarrow$ Cấp quyền `User Pro` (Chủ trang trại) hoặc `User Normal` (Nhân công).
3. **Cấu hình Kho Danh Mục Chuẩn:** Vào menu **"Vật Tư"** $\rightarrow$ Nhập danh mục phân bón, thuốc bảo vệ thực vật được cấp phép và đơn giá nước chuẩn.
4. **Giám sát Không Gian & Cảnh Báo Sâu Bệnh:** Theo dõi bản đồ GIS tổng quan để phát hiện các cụm cây bị nhiễm bệnh (chấm đỏ) để điều động kỹ thuật viên xử lý kịp thời.

### ⭐ 8.2 Dành cho Chủ Nông Trại / Quản Đốc (User Pro)
1. **Khởi tạo Nông Trại & Vẽ Ranh Giới:** Mở tab **"Bản Đồ"** $\rightarrow$ Dùng công cụ Polygon khoanh vùng đất $\rightarrow$ Nhập Mã số vùng trồng (PUC Code).
2. **Khai báo Cây Ma Trận:** Bấm **"+ Thêm Cây Trồng"** $\rightarrow$ Chọn chế độ Ma Trận $\rightarrow$ Nhập số lượng cây (ví dụ 50 cây), nhập Mã Lô (ví dụ Lô A1) và bật tự tăng số Hàng $\rightarrow$ Chụp 1 ảnh chung cho cả lô hoặc tùy chỉnh từng cây $\rightarrow$ Bấm lưu.
3. **Quản lý Album Sinh Trưởng:** Định kỳ mở hồ sơ cây $\rightarrow$ Bấm **"+ Chụp / Tải ảnh mới"** $\rightarrow$ Chọn giai đoạn sinh trưởng (Ra hoa, Đậu trái, Nuôi trái...) để hệ thống lưu lịch sử bất biến qua các năm.
4. **Theo dõi Báo Cáo Tài Chính:** Mở tab **"Chi Phí & Vật Tư"** để xem biểu đồ chi phí phân bón, tiền nước và thuốc BVTV chi tiết đến từng gốc cây.

### 👨‍🌾 8.3 Dành cho Công Nhân Nông Trường (User Normal)
1. **Kiểm tra Nhắc việc:** Mở ứng dụng trên điện thoại $\rightarrow$ Xem danh sách cây cần tưới nước hoặc kiểm tra sâu bệnh trong ngày.
2. **Ghi Nhật Ký 1 Chạm:** Quét mã QR hoặc áp lưng điện thoại vào thẻ NFC trên thân cây $\rightarrow$ Chọn hoạt động (Tưới nước, Bón phân...) $\rightarrow$ Điền số lượng $\rightarrow$ Bấm **"Lưu nhật ký"**.
3. **Chụp Ảnh Báo Bệnh:** Nếu cây có dấu hiệu sâu bệnh lạ, chọn mục **"Bệnh cây"** $\rightarrow$ Chụp ảnh $\rightarrow$ Hệ thống tự động đóng dấu Watermark GPS và thời gian $\rightarrow$ Ảnh tự động lưu vào mục cảnh báo bệnh dịch riêng biệt.
4. **Tác nghiệp khi mất sóng:** Yên tâm ghi chép bình thường. Khi điện thoại có sóng Wifi/4G trở lại, hệ thống sẽ tự động đồng bộ 100% dữ liệu lên máy chủ mà không làm mất thông tin.

### 🌐 8.4 Dành cho Khách Hàng & Cơ Quan Kiểm Định (Public / Inspector)
1. Dùng camera điện thoại hoặc ứng dụng quét mã QR bất kỳ quét tem dán trên quả.
2. Xem ngay hồ sơ nông sản minh bạch: Vườn trồng tại đâu, mã số vùng trồng PUC, các đợt bón phân, ngày phun thuốc lần cuối (đã cách ly an toàn bao nhiêu ngày) và mã lô thu hoạch VietGAP.

---

## 9. Bộ Kiểm Thử Tự Động & Tiêu Chuẩn Nghiệm Thu QA/QC (222/222 PASS — 33 Suites)

Hệ thống kiểm định tự động gồm **33 test suites** (`222` test cases) chạy bằng Node test runner tích hợp cùng GitHub Actions CI (PostgreSQL 16 + Playwright Chromium) và kịch bản chịu tải k6 200-VU:

```powershell
# Chạy toàn bộ 33 suites unit & integration test
node backend/tests/run-all-tests.js
```

```text
═══════════════════════════════════════════════════════════════
🧪 RUNNING SYSTEM AUTOMATED TESTING SUITE (100% COVERAGE)
═══════════════════════════════════════════════════════════════
📊 SUMMARY: 222/222 PASSED (100.0%) | Failed: 0 | Time: ~2041ms
═══════════════════════════════════════════════════════════════
```

### Danh Mục 33 Suites Kiểm Thử Tự Động:
- **Suites `01`–`18` (Nền tảng Core ERP, PWA & Flutter Parity):** Auth & RBAC (`01`), Farms/GIS & PUC (`02`), Plants/QR/NFC (`03`), Supplies & Inventory (`04`), VietGAP & PHI (`05`), IoT & Notifications (`06`), HTML Integrity & Build (`07`), Sample Data & Migration (`08`–`09`), Open-Meteo Weather (`10`), NFC/Geofence & Soft-Delete (`11`, `12`×2), AI Training Security & Zalo Scrubbing (`13`×2), Streaming/Rate-Limit/Performance (`14`–`16`), Hash-Chain SHA-256 & Flutter v1.3.5 Security/Hive Parity (`17`–`18`).
- **Suites `19`–`28` (BI, Chuẩn ISO, Kiến Trúc & Observability):**
  - `19`: Executive BI lọc theo `farm_id` & `year`, `singleflight`, chống rò rỉ `su.farm_id IS NULL`, cột Trang trại trong Ma trận ROI, đa ngôn ngữ VI/EN/ZH (`19.1`–`19.6`).
  - `20`–`25`: ISO 25010 / 29119 / 19115 GIS / 42001 Bé Mầm Agent Engine / 27001 Security Hardening.
  - `26`–`28`: Zero-Trust Crypto, Moving-Avg WMS, Hard PHI gate, Carbon MRV, Report Query Engine CSV Guard, APM `p50/p95/p99` & OpenMetrics `/metrics`, Real PG16 + Playwright CI, k6 200-VU Load Gate.
- **Suites `29`–`32` (Các Phân Hệ Doanh Nghiệp Mới Nhất):**
  - `29` (**ISO/IEC 27001 Zero-Trust Defense**): TOTP MFA RFC 6238, `adminIpGuard`, `dlpAntiExfiltration`, Admin `HttpOnly` cookie & CSP.
  - `30` (**Multi-Platform Notification Hub**): Dispatcher gom nhóm 60s, Quiet Hours, 4 nhạc chuông Web Audio, SW Push, Flutter 2 Android channels.
  - `31` (**Enterprise Bé Mầm AI Agent v3**): AES-256-GCM, PII Redactor (Unicode email/SĐT/CCCD/JWT), Indirect Injection Sanitizer, Output DLP, Biosecurity/PHI Post-Verifier, `AgentRateLimiter`/`AgentBulkhead`/`ModelCircuitBreaker`, Payload Compaction, Zero-Trust Native Tools & ReAct Loop (`31.1`–`31.7`).
  - `32` (**Cache-Busting, Area Audit & Zero-Lag Refresh**): SHA-256 content-hash trong `build-html.js`, `auditAndNormalizeFarmArea` & `POST /api/farms/audit-normalize-areas`, và `SmartAutoRefresh` không giật lag (`32.1`–`32.4`).

---

## 10. Hướng Dẫn Cài Đặt, Triển Khai & Vận Hành Hạ Tầng (DevOps)

### 10.1 Chạy Cục Bộ (Local Development)

```powershell
# 1. Clone mã nguồn
git clone https://github.com/Phuc0901-pp/plant-book.git
cd plant-book/plant-app-deploy

# 2. Cài đặt các gói phụ thuộc Backend
cd backend
npm install

# 3. Biên dịch giao diện HTML + Tự động gắn Content-Hash Cache-Busting
npm run build:html

# 4. Kiểm thử & Khởi động Backend Server
npm test
npm start
# Ứng dụng sẵn sàng tại: http://localhost:3000
```

---

### 10.2 Triển Khai Máy Chủ Synology NAS On-Premise (Docker Compose)

Hệ thống được đóng gói sẵn tệp `docker-compose.nas.yml` phục vụ vận hành độc lập tại trung tâm điều hành trang trại:

```bash
# Khởi chạy cụm dịch vụ (Node.js API + PostgreSQL 16 Enterprise + Nginx Reverse Proxy)
docker-compose -f docker-compose.nas.yml up -d

# Xem logs dịch vụ
docker-compose -f docker-compose.nas.yml logs -f app
```

---

### 10.3 Vận Hành Ứng Dụng Di Động (Android APK, Google Play AAB & iOS IPA)

#### 🤖 Dành cho Android:
1. Build APK / AAB tự động qua GitHub Actions (`build-apk.yml`) hoặc chạy `deploy_adb.ps1` qua cáp USB ADB.

#### 🍎 Dành cho iOS (iPhone / iPad):
1. Build IPA qua `build-ios.yml` và cài đặt bằng **Sideloadly** hoặc OTA qua `manifest.plist`.

---

### 10.4 Triển Khai Multi-Cloud & Biến Môi Trường Production

```ini
# Cổng & Môi trường
PORT=3000
NODE_ENV=production

# Cơ sở dữ liệu PostgreSQL & Redis
DATABASE_URL=postgresql://postgres:your_password@host:5432/plantbook_db
REDIS_URL=redis://default:your_redis_pass@host:6379

# Bảo mật Zero-Trust & Mã hóa
JWT_SECRET=your_64_char_hex_jwt_secret
NFC_HMAC_SECRET=your_iso27001_nfc_hmac_secret_min_32_chars
AI_DATA_ENCRYPTION_KEY=your_32_char_aes256_gcm_key
ADMIN_IP_ALLOWLIST=127.0.0.1,::1
METRICS_TOKEN=your_prometheus_metrics_bearer_token

# AI Agent Bé Mầm v3 & Khí tượng / Bản đồ
GEMINI_API_KEY=your_gemini_api_key
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...

# Lưu trữ tệp (local | supabase | s3)
STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Push Notifications & Email (Tùy chọn)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## 11. Định Hướng Kiến Trúc Mở Rộng: Hệ Thống Có Cần MCU và MCP Không?

Một trong những câu hỏi cốt lõi khi nâng cấp hệ thống **Plant Book (Sổ Nông Nhàn)** từ nền tảng quản trị Agri-ERP sang nông nghiệp thông minh công nghệ cao là: **Hệ thống có cần phần cứng MCU (Microcontroller Unit) và giao thức AI MCP (Model Context Protocol) không?**

Dưới đây là phân tích kiến trúc chuyên sâu:

```mermaid
flowchart TD
    subgraph SENSE["TẦNG 1: THU THẬP THỰC ĐỊA (FIELD SENSING)"]
        Smartphone["📱 Điện Thoại Nông Dân\n(Camera, GPS, Web NFC)"]
        MCU_Sensors["⚡ Vi Điều Khiển MCU (ESP32/LoRaWAN)\n(Độ ẩm đất 3 tầng, pH, EC, Trạm thời tiết)"]
        MCU_Valves["🚰 Điều Khiển MCU Actuator\n(Van tưới điện từ Solenoid, Bơm châm phân)"]
    end

    subgraph CORE["TẦNG 2: PLANT BOOK BACKEND & DATABASE"]
        API_Gateway["API Gateway / MQTT Broker"]
        Postgres["PostgreSQL Enterprise (JSONB, GIS, Logs)"]
        ERP_Engine["VietGAP, PHI & Agri-ERP Cost Engine"]
    end

    subgraph INTELLIGENCE["TẦNG 3: TRÍ TUỆ NHÂN TẠO & MCP (AI PROTOCOL)"]
        MCP_Server["🔌 Plant Book MCP Server\n(Model Context Protocol Bridge)"]
        AI_Agent["🌱 Trợ Lý Ảo Bé Mầm AI (Gemini / Claude)\n(Hỏi đáp giọng nói, Chẩn đoán bệnh, Gợi ý phân thuốc)"]
    end

    Smartphone -->|"HTTP / REST API"| API_Gateway
    MCU_Sensors -->|"MQTT / LoRaWAN Gateway"| API_Gateway
    API_Gateway <-->|"Lệnh đóng ngắt tưới"| MCU_Valves
    API_Gateway --> Postgres
    API_Gateway --> ERP_Engine
    
    Postgres <-->|"Context & Tool Calls"| MCP_Server
    ERP_Engine <-->|"Nghiệp vụ VietGAP & PHI"| MCP_Server
    MCP_Server <-->|"Truy vấn Ngôn Ngữ Tự Nhiên"| AI_Agent
    AI_Agent -.->|"Tư vấn trực tiếp cho nông dân"| Smartphone
```

---

### 11.1 Phân Tích Nhu Cầu Phần Cứng Vi Điều Khiển MCU (Microcontroller Unit)

**MCU là gì trong nông nghiệp?**  
Là các vi điều khiển nhúng như **ESP32, STM32, nRF52, Raspberry Pi Pico hoặc các trạm cảm biến LoRaWAN**.

| Giai đoạn triển khai | Có cần MCU không? | Vai trò và kiến trúc hoạt động |
| :--- | :---: | :--- |
| **Giai đoạn Hiện Tại (v1.3.5 Core Release)** | **CHƯA BẮT BUỘC** | Hệ thống tập trung giải quyết bài toán: **Định danh số cây trồng, Quản lý sinh trưởng, Nhật ký VietGAP, Truy xuất nguồn gốc QR và Quản lý kho ERP**.<br/>Thiết bị thông minh của nông dân (điện thoại Android/iOS) đóng vai trò là một **Edge Device** hoàn chỉnh: chụp ảnh hiện trường, định vị GPS vệ tinh, quét thẻ phần cứng NFC RFID NTAG213. |
| **Giai đoạn Mở Rộng (v2.x Smart Farm IoT)** | **RẤT CẦN THIẾT** | Cần thiết khi trang trại muốn **tự động hóa 100% không cần con người can thiệp thủ công**: |

#### Ứng dụng thực tế của MCU trong Plant Book v2.x:
1. **Quan trắc độ ẩm đất & tiểu khí hậu tự động (Telemetry Nodes)**:
   - Các trạm MCU ESP32 gắn cảm biến đo độ ẩm đất 3 tầng độ sâu (10cm, 30cm, 60cm), độ mặn EC và độ pH của từng gốc cây sầu riêng.
   - Định kỳ 15 phút, MCU tự đóng gói dữ liệu và đẩy về Backend Plant Book qua giao thức **MQTT** hoặc **LoRaWAN**.
2. **Hệ thống tưới & châm phân chính xác tự động (Smart Fertigation)**:
   - Thay vì nông dân phải vặn van tay và vào app bấm nút, MCU đóng vai trò **Bộ chấp hành (Actuator)** nhận lệnh từ máy chủ để đóng/ngắt các van điện từ Solenoid theo lô/hàng, tự động tính khối lượng nước và trừ kho phân bón chính xác từng mililit.
3. **Trạm thời tiết tiểu khí hậu chuyên dụng (Micro-Weather Station)**:
   - Đo tốc độ gió thực tế, hướng gió, bức xạ UV tại nông trường để cảnh báo an toàn phun thuốc BVTV tự động.

---

### 11.2 Phân Tích Nhu Cầu Chuẩn Giao Thức Trí Tuệ Nhân Tạo MCP (Model Context Protocol)

**MCP là gì?**  
**Model Context Protocol (MCP)** là chuẩn mở công nghệ do các tập đoàn AI hàng đầu thế giới (Anthropic, Google) ban hành, cho phép các mô hình Trí tuệ Nhân tạo (LLM như Google Gemini, Claude) kết nối an toàn, trực tiếp và thông minh vào kho dữ liệu và công cụ của ứng dụng doanh nghiệp.

> [!IMPORTANT]
> **Hệ thống Plant Book CÓ RẤT CẦN MCP KHÔNG?**  
> **CỰC KỲ CẦN & ĐÂY LÀ BƯỚC ĐI ĐỘT PHÁ CỦA AGTECH TÂN BẢO SÀI GÒN!**

#### Nếu tích hợp Plant Book MCP Server, hệ thống sẽ sở hữu năng lực vượt trội:
1. **Trợ lý Nông Nghiệp Thông Minh "Bé Mầm AI" (Conversational AgTech Assistant)**:
   - Bà con nông dân không cần phải bấm tìm kiếm phức tạp, chỉ cần **nói bằng giọng nói (Voice Command)** vào ứng dụng điện thoại:
     - 🗣️ *"Bé Mầm ơi, tuần này lô A1 có bao nhiêu cây sầu riêng cần tưới nước?"*
     - 🗣️ *"Cây S01-015 vừa phun thuốc trừ rầy hôm qua, đến ngày nào thì được thu hoạch an toàn?"*
     - 🗣️ *"Tháng này vườn Ri6 đã chi hết bao nhiêu tiền phân bón NPK?"*
   - Thông qua **MCP Protocol**, AI sẽ tự động kích hoạt các tool: `get_plant_status(tree_code)`, `check_phi_quarantine(plant_id)`, `query_farm_expenses(farm_id)` để lấy dữ liệu thực trong CSDL PostgreSQL và giải đáp bằng tiếng Việt chuẩn xác, gần gũi.
2. **Chẩn đoán bệnh cây thông minh qua hình ảnh (Multimodal AI Vision Diagnostic)**:
   - Nông dân chụp ảnh lá cây bị đốm vàng ngoài vườn $\rightarrow$ AI đối chiếu với thư viện bệnh học $\rightarrow$ Tự động phân tích triệu chứng $\rightarrow$ Gợi ý hoạt chất BVTV được phép trong danh mục VietGAP và tự động tạo bản ghi nhật ký chăm sóc nháp để kỹ sư xác nhận.
3. **Phân tích số liệu và đề xuất canh tác tối ưu (Predictive Agronomy)**:
   - AI Agent đọc dữ liệu lịch sử nhật ký 3 năm qua của vườn $\rightarrow$ So sánh năng suất thu hoạch $\rightarrow$ Đưa ra khuyến nghị điều chỉnh liều lượng phân bón giúp tiết kiệm 15-20% chi phí vật tư nông nghiệp.

---

---

<p align="center">
  <b>© 2026 CÔNG TY CỔ PHẦN TÂN BẢO SÀI GÒN (TBSG AGTECH). TẤT CẢ QUYỀN ĐƯỢC BẢO LƯU.</b><br>
  <i>Giải pháp Nông Nghiệp Thông Minh Toàn Diện · Sổ Nông Nhàn — Quản Lý Vườn Cây Chuyên Nghiệp.</i>
</p>
