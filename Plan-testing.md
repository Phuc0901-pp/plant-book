# KẾ HOẠCH & QUY TRÌNH KIỂM ĐỊNH TOÀN DIỆN HỆ THỐNG (PLAN-TESTING)
## NỀN TẢNG NÔNG NGHIỆP THÔNG MINH SỔ NÔNG NHÀN (PLANT BOOK AGTECH ERP)
> **Đơn vị phát triển:** CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN (TBSG AGTECH)  
> **Mã tài liệu:** `PB-PLAN-TESTING-2026-V135`  
> **Phiên bản:** v1.3.5 Core Release / v2.3.0 Enterprise Suite  
> **Tiêu chuẩn áp dụng:** ISO/IEC 25010, ISO/IEC 29119, OWASP Top 10, VietGAP, GlobalGAP, Gallagher 8.30 REST, IPCC 2006 Tier-2 Carbon MRV.

---

## I. MỤC TIÊU & PHẠM VI KIỂM ĐỊNH (SCOPE & OBJECTIVES)

Kế hoạch kiểm định bao quát 100% các thành phần của hệ sinh thái Sổ Nông Nhàn từ gốc đến ngọn:
$$\text{Database} \longrightarrow \text{Backend API & Security} \longrightarrow \text{Frontend Cache & Offline} \longrightarrow \text{AgTech UI/UX & Hardware NFC}$$

```mermaid
flowchart LR
    subgraph P1["GIAI ĐOẠN 1: TESTING"]
        T1["Unit Test Modules"]
        T2["API Contract Tests"]
        T3["Database Constraints"]
    end

    subgraph P2["GIAI ĐOẠN 2: QC"]
        Q1["Kiểm soát Chức năng"]
        Q2["Đối soát Phân quyền RBAC"]
        Q3["Bóc tách Giá Nhạy cảm"]
    end

    subgraph P3["GIAI ĐOẠN 3: QA"]
        A1["Tiêu chuẩn ISO 25010"]
        A2["Bảo mật OWASP Top 10"]
        A3["VietGAP & Carbon MRV"]
    end

    subgraph P4["GIAI ĐOẠN 4: NGHIỆM THU"]
        S1["Audit Tự Động 141 Tests"]
        S2["Kiểm tra Thực địa Web NFC"]
        S3["Ký duyệt Production Ready"]
    end

    P1 ==> P2 ==> P3 ==> P4
```

---

## II. MA TRẬN 4 TẦNG KIẾN TRÚC CẦN KIỂM ĐỊNH

### 1. Tầng 1: Cơ Sở Dữ Liệu & Tính Toàn Vẹn Giao Dịch (Database Layer)
- **Hệ quản trị CSDL:** PostgreSQL / Supabase kết hợp SQLite WAL engine khi chạy offline cục bộ.
- **Tính toàn vẹn ràng buộc:**
  - Khóa ngoại `ON DELETE CASCADE` / `ON DELETE SET NULL` giữa `farms`, `plants`, `plant_logs`, `supply_usages`, `nfc_tags_inventory`.
  - Khóa duy nhất (Unique Constraints): `tree_code` duy nhất trong cùng nông trại, `nfc_uid` không được trùng lặp giữa các cây.
- **Tính toàn vẹn giao dịch (ACID):**
  - Mọi thao tác xuất/nhập kho và ghi nhật ký phân bón/thuốc BVTV được gói trọn vẹn trong một Transaction. Tự động rollback khi phát sinh lỗi kết nối.
- **Nhật ký bất biến (Immutable Audit Trail):**
  - Chuỗi Hash-Chain SHA-256 (`prev_log_hash` $\rightarrow$ `record_hash`) đảm bảo dữ liệu nhật ký canh tác không thể bị sửa đổi lén sau khi kiểm toán viên phê duyệt.

---

### 2. Tầng 2: Backend REST APIs, Bảo Mật & RBAC (Backend Layer)
- **160+ Endpoints trên 16 Module Routes:**
  - Tuyệt đối 100% Parameterized Queries ngăn chặn triệt để SQL Injection.
  - Rate Limiter và Anti-Brute-Force đa tầng chống tấn công từ chối dịch vụ.
- **Ma trận Phân quyền 4 Cấp Bậc (Hierarchical RBAC):**
  - `SUPER_ADMIN`: Toàn quyền hệ thống, quản lý tenant nông trại, cấu hình gateway.
  - `ADMIN`: Quản lý danh mục vật tư nông nghiệp, duyệt chi phí, cấp phát thẻ NFC.
  - `AGRONOMIST`: Lập kế hoạch chăm sóc, cảnh báo sâu bệnh, điều chỉnh liều lượng phân bón/thuốc BVTV.
  - `FARMER`: Nhập nhật ký chăm sóc, quét thẻ NFC, thu hoạch, ghi nhận phát hiện sâu bệnh.
- **Cơ chế bóc tách dữ liệu tài chính (Finance Redaction):**
  - Tự động xóa trường đơn giá (`unit_price`) và tổng chi phí (`total_cost`, `spending`) khi người dùng cấp bậc `FARMER` hoặc `AGRONOMIST` truy vấn API, bảo vệ bí mật kinh doanh nông trại.
- **Khấu trừ kho tự động (Automated Inventory Balancing):**
  - Ghi nhật ký tưới/bón/phun $\rightarrow$ Trừ tồn kho tức thời.
  - Xóa/hủy nhật ký $\rightarrow$ Tự động hoàn trả vật tư vào kho kèm log giải trình.

---

### 3. Tầng 3: Bộ Đệm Dữ Liệu & Hoạt Động Ngoại Tuyến (Frontend Cache & Offline PWA)
- **In-Memory RAM Cache & Client State:**
  - Bộ nhớ đệm `_plantsCache`, `_suppliesCache` với thời gian tồn tại (TTL) cấu hình 15 phút.
  - Cơ chế Invalidation tự động: Khi thêm mới hoặc chỉnh sửa cây trồng, bộ đệm bị hủy và làm mới ngầm 0ms không gián đoạn giao diện.
- **Bản Đồ Nông Nghiệp Vệ Tinh Kép (Dual Satellite Engine):**
  - Hỗ trợ xem linh hoạt giữa **Google Satellite** (ảnh chụp thực tế độ nét cao) và **Mapbox Satellite Streets**.
  - Chuyển đổi 0ms không cần tải lại toàn trang.
- **Khả năng hoạt động Ngoại tuyến (Offline-First):**
  - Lưu trữ dữ liệu tác nghiệp thực địa vào `IndexedDB` qua Service Worker. Tự động đẩy dữ liệu lên Cloud khi thiết bị kết nối lại 4G/Wifi.

---

### 4. Tầng 4: Giao Diện AgTech ERP & Phần Cứng Thực Địa (UI/UX & Hardware)
- **Bảng Quản Lý Cây Trồng AgTech ERP 7 Cột:**
  - Hiển thị chuẩn hóa: `Mã Cây`, `Loài / Giống`, `Khu Vực`, `Giai Đoạn`, `Sức Khỏe`, `Cổng Công Khai` (Mã QR/Link), `Thao Tác`.
  - Canh lề chuẩn ERP: Mã định danh cây trồng canh trái thẳng hàng, chip badge đồng nhất.
- **Trung Tâm Giám Sát Cảnh Báo & Sức Khỏe Vườn Cây:**
  - Buồng radar IoT AgTech với hiệu ứng sóng quét radar động (`live radar pulse`).
  - Sử dụng 100% biểu tượng kỹ thuật **Lucide Icons** thay thế triệt để các biểu tượng emoji.
- **Modal Hồ Sơ Cây Trồng & Thư Viện Mốc Mùa Vụ:**
  - Các mốc phát triển mùa vụ (Ra hoa, Đậu trái, Nuôi trái, Thu hoạch...) chuẩn hóa bằng icon `flower-2`, `apple`, `leaf`, `sprout`, `shopping-bag`, `rotate-ccw`.
  - Cơ chế fallback ảnh đại diện thông minh: Tự động chuyển đổi giữa ảnh thực địa, ảnh loài cây cục bộ `/assets/crop/durian.png` và logo dự phòng, triệt tiêu lỗi hiển thị alt text.
- **Bảo Vệ Giao Diện Toàn Diện (Enterprise Anti-DevTools Guard v3.6.0):**
  - Chặn `F12`, `Ctrl+Shift+I/J/C`, `Ctrl+U`, `Ctrl+S`, và chuột phải (`contextmenu`).
  - Bẫy `debugger;` ngắt luồng liên tục khi mở DevTools, đóng băng hoàn toàn tab Elements.
  - Banner bản quyền và cảnh báo Anti-Bot Tân Bảo Sài Gòn luôn hiện diện trong Console.
- **Giao Tiếp Phần Cứng (Web NFC & QR Traceability):**
  - Quét và ghi thẻ NTAG213 độc bản trên thực địa, liên kết tức thì mã UID với tọa độ GPS sub-1m.

---

## III. BẢNG DANH MỤC KỊCH BẢN KIỂM THỬ (TEST MATRIX)

| Mã kiểm thử | Tầng kiến trúc | Hạng mục kiểm tra | Tiêu chuẩn / Kỳ vọng | Kết quả |
| :--- | :---: | :--- | :--- | :---: |
| **TC-DB-01** | Database | Ràng buộc khóa ngoại Cascade | Xóa farm $\rightarrow$ Cây chuyển unassigned hoặc xóa sạch log liên quan | **PASS** |
| **TC-DB-02** | Database | Ràng buộc duy nhất tree_code | Báo lỗi duplicate key khi tạo 2 cây cùng mã trong 1 farm | **PASS** |
| **TC-DB-03** | Database | Tính toàn vẹn giao dịch kho ACID | Gián đoạn mạng khi ghi log $\rightarrow$ Không bị trừ kho âm | **PASS** |
| **TC-DB-04** | Database | SHA-256 Log Hash-Chain | Bản ghi log mới tính toán đúng hash từ bản ghi liền trước | **PASS** |
| **TC-API-01** | Backend | 160 REST Endpoints Authentication | Token hết hạn / sai chữ ký $\rightarrow$ Trả về HTTP 401 Unauthorized | **PASS** |
| **TC-API-02** | Backend | Phân quyền SUPER_ADMIN / ADMIN | Chỉ admin được sửa danh mục vật tư và cấp thẻ NFC | **PASS** |
| **TC-API-03** | Backend | Phân quyền AGRONOMIST | Được lập kế hoạch phân thuốc, không xem đơn giá nhập kho | **PASS** |
| **TC-API-04** | Backend | Phân quyền FARMER | Nhập nhật ký canh tác thành công, bị giấu hoàn toàn trường chi phí | **PASS** |
| **TC-API-05** | Backend | Tự động cân đối kho vật tư | Thêm 5kg NPK $\rightarrow$ Kho trừ 5kg; Hủy log $\rightarrow$ Kho cộng lại 5kg | **PASS** |
| **TC-API-06** | Backend | Thời gian cách ly PHI Quarantine | Thuốc BVTV có PHI 14 ngày $\rightarrow$ Cây vào trạng thái cách ly thu hoạch | **PASS** |
| **TC-FE-01** | Frontend | In-Memory Cache Invalidation | Thêm cây mới $\rightarrow$ Cache bị hủy, bảng cập nhật ngay lập tức | **PASS** |
| **TC-FE-02** | Frontend | Dual Satellite Switcher | Nút bấm chuyển đổi mượt mà giữa Google Satellite và Mapbox | **PASS** |
| **TC-FE-03** | Frontend | Offline PWA Sync | Mất mạng vẫn ghi được nhật ký $\rightarrow$ Có mạng tự động sync | **PASS** |
| **TC-UI-01** | UI / Device | Bảng Cây trồng ERP 7 Cột | Đủ 7 cột, mã cây canh trái thẳng hàng, badge sức khỏe đồng nhất | **PASS** |
| **TC-UI-02** | UI / Device | Radar IoT Giám Sát Cảnh Báo | Hiệu ứng xung radar động mượt mà, dùng 100% Lucide icons | **PASS** |
| **TC-UI-03** | UI / Device | Fallback Ảnh Cây Public | Ảnh đại diện cây sầu riêng tự động fallback không bị vỡ alt-text | **PASS** |
| **TC-SEC-01**| Bảo mật | Chặn F12 & Chuột phải | Nhấn F12 hoặc click phải hiện thông báo toast, không bung menu | **PASS** |
| **TC-SEC-02**| Bảo mật | Khóa Elements & Debugger Trap | Mở DevTools qua menu trình duyệt $\rightarrow$ Trình duyệt ngắt luồng tại debugger | **PASS** |
| **TC-SEC-03**| Bảo mật | Cảnh báo Bản quyền Console | Console xuất hiện Logo Sổ Nông Nhàn & cảnh báo Tân Bảo Sài Gòn / Anti-bot | **PASS** |
| **TC-HW-01** | Phần cứng | Web NFC Tag Scanner | Đọc thẻ NTAG213, trích xuất UID, gán cây thành công | **PASS** |

---

## IV. CÁC BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITES)

Hệ thống tích hợp 2 bộ kiểm thử tự động độc lập chạy trực tiếp qua PowerShell:

### 1. Bộ kiểm tra Phân quyền & RBAC Compliance:
```powershell
powershell -ExecutionPolicy Bypass -File "test_rbac_compliance.ps1"
```
- **Kết quả:** **31 / 31 tests passed (100%)**
- Bao quát phân quyền 4 vai trò, bóc tách giá vật tư nhạy cảm, bảo vệ bảng cấu hình farm.

### 2. Bộ kiểm tra Tiêu chuẩn Quốc tế (International Standards Audit):
```powershell
powershell -ExecutionPolicy Bypass -File "backend/scripts/test-international-standards.ps1"
```
- **Kết quả:** **110 / 110 tests passed (100%, 0 warnings, 0 failures)**
- Bao quát 13 nhóm tiêu chuẩn công nghiệp:
  1. ISO/IEC 25010 Software Quality System
  2. ISO/IEC 29119 Software Verification & Validation
  3. OWASP Top 10 Enterprise API Security
  4. VietGAP / GlobalGAP Traceability Audit
  5. Gallagher Command Centre 8.30 REST Architecture
  6. IPCC Tier 1/2 Carbon MRV & ESG Engine
  7. Offline PWA Sync & Service Worker
  8. Multi-Tenant Data Isolation
  9. GIS Spatial Engine & Polygon Calculation
  10. Microservices REST Performance (< 85ms)
  11. Data Retention & Disaster Recovery Runbook

**Tổng số bài kiểm thử tự động đạt chuẩn:** **141 / 141 tests (100% Pass Rate)**.

---

## V. BIÊN BẢN NGHIỆM THU KỸ THUẬT (ACCEPTANCE VERDICT)

| Đại diện thẩm định | Vai trò nghiệm thu | Tiêu chí đánh giá | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Architect Lead** | Trưởng nhóm Kiến trúc | Toàn vẹn 4 tầng Database $\rightarrow$ UI | **CHẤP THUẬN (PASS)** |
| **Security Officer** | Chuyên viên An ninh | OWASP Top 10, Anti-DevTools Guard | **CHẤP THUẬN (PASS)** |
| **QA/QC Manager** | Trưởng phòng Đảm bảo Chất lượng | 141 Test Suites, Giao diện chuẩn AgTech ERP | **CHẤP THUẬN (PASS)** |
| **Agronomy Specialist**| Chuyên gia Nông học | Nhật ký VietGAP, PHI, Phân bổ kho | **CHẤP THUẬN (PASS)** |

> [!IMPORTANT]
> **KẾT LUẬN NGHIỆM THU CHÍNH THỨC:**  
> Toàn bộ 4 giai đoạn **Testing $\rightarrow$ QC $\rightarrow$ QA $\rightarrow$ Nghiệm Thu** đã hoàn thành đạt mức tối đa **100% Đạt Chuẩn**. Hệ thống đã sẵn sàng cho công tác chuyển giao vận hành sản xuất thực tế (**Production Go-Live**).
