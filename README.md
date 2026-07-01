# 🌿 Plant Book — Hệ thống Quản lý Vườn Cây Thông minh

> **Tanbao Corp** · Phiên bản 1.0 · Nền tảng Web App (Mobile-first + Desktop)

---

## 📋 Mục lục

1. [Giới thiệu dự án](#1-giới-thiệu-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Sơ đồ cơ sở dữ liệu](#3-sơ-đồ-cơ-sở-dữ-liệu)
4. [API Endpoints](#4-api-endpoints)
5. [Quy trình nghiệp vụ](#5-quy-trình-nghiệp-vụ)
6. [Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
7. [Giao diện người dùng](#7-giao-diện-người-dùng)
8. [Hướng dẫn cài đặt](#8-hướng-dẫn-cài-đặt)
9. [Biến môi trường](#9-biến-môi-trường)
10. [Triển khai sản phẩm](#10-triển-khai-sản-phẩm)
11. [Công nghệ sử dụng](#11-công-nghệ-sử-dụng)

---

## 1. Giới thiệu dự án

**Plant Book** là hệ thống quản lý vườn cây trồng thông minh dành cho **Tanbao Corp**, phục vụ hai nhóm người dùng chính:

| Đối tượng | Giao diện | Thiết bị |
|-----------|-----------|----------|
| **Quản trị viên / Manager** | Admin Dashboard | Máy tính, Laptop |
| **Nông hộ / Người chăm sóc** | User Portal | Điện thoại di động |
| **Khách / Đối tác** | Trang công khai | Bất kỳ thiết bị nào |

### Tính năng cốt lõi

- 🌱 **Quản lý cây trồng**: Theo dõi toàn bộ vòng đời từng cây với mã định danh riêng (`tree_code`)
- 🏡 **Quản lý trang trại**: Vẽ ranh giới trang trại trên bản đồ GIS (Polygon Mapbox)
- 📓 **Nhật ký chăm sóc**: Ghi lại 6 loại hoạt động — Tưới nước, Bón phân, Phun thuốc, Cắt lá, Tỉa hoa, Bệnh cây
- 📸 **Ghi nhận bệnh cây**: Chụp ảnh / quay video thực địa với watermark tự động (Mã cây · Thời gian · Tên bệnh)
- 🗺️ **Bản đồ GIS**: Hiển thị vị trí từng cây trên bản đồ vệ tinh (Mapbox Satellite)
- 🔔 **Nhắc nhở tự động**: Cảnh báo cây chưa tưới, chưa bón phân, phát hiện bệnh
- 📊 **Báo cáo công khai**: Trang thông tin cây trồng (QR Code) có thể chia sẻ

---

## 2. Kiến trúc hệ thống

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NGƯỜI DÙNG (Browser)                         │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Admin Portal   │  │  User Portal    │  │  Public Pages       │  │
│  │  /admin         │  │  /user          │  │  /plant/:slug       │  │
│  │  (PC/Laptop)    │  │  (Điện thoại)   │  │  /plant/:slug/report│  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                      │
            └────────────────────┼──────────────────────┘
                                 │  HTTP / REST API (JWT Bearer Token)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND — Node.js + Express                       │
│                   (Render.com Free Tier / VPS)                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Express Router                                                │  │
│  │  POST /api/auth/login          GET  /api/auth/me               │  │
│  │  GET  /api/plants              POST /api/plants                │  │
│  │  GET  /api/plants/:id/logs     POST /api/plants/:id/logs       │  │
│  │  POST /api/plants/:id/media    GET  /api/plants/logs/recent    │  │
│  │  GET  /api/farms               POST /api/farms                 │  │
│  │  GET  /api/users               POST /api/users                 │  │
│  │  GET  /api/config              PUT  /api/config                │  │
│  │  GET  /api/schemas             POST /api/schemas               │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
│                              │                                       │
│  Middleware: auth.js (JWT verify) → req.user = {id, email, role}    │
│                              │                                       │
│           ┌──────────────────┴──────────────────┐                   │
│           ▼                                      ▼                   │
│  ┌─────────────────┐                  ┌──────────────────────────┐  │
│  │  PostgreSQL      │                  │  Supabase Storage        │  │
│  │  (Neon / Render) │                  │  (S3-compatible CDN)     │  │
│  │                 │                  │  Bucket: plant-media      │  │
│  │  • users        │                  │  • Ảnh bệnh cây          │  │
│  │  • farms        │                  │  • Video thực địa        │  │
│  │  • plants       │                  │  • Media thư viện        │  │
│  │  • plant_logs   │                  └──────────────────────────┘  │
│  │  • plant_media  │                                                 │
│  │  • plant_schemas│                                                 │
│  │  • system_configs│                                                │
│  └─────────────────┘                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Luồng xác thực (Authentication Flow)

```
Người dùng nhập Email + Password
        │
        ▼
POST /api/auth/login
        │
        ├─ Lỗi → Hiển thị thông báo lỗi
        │
        └─ OK → Nhận JWT Token (24h)
                │
                ├─ role = 'admin'  → Điều hướng về /admin
                └─ role = 'user'   → Hiển thị User Portal
                
Token được lưu trong localStorage ('pb_token')
Mỗi request tiếp theo đều gắn: Authorization: Bearer <token>
Token hết hạn → Tự động logout, quay về màn hình đăng nhập
```

---

## 3. Sơ đồ cơ sở dữ liệu

```
┌──────────────────┐         ┌──────────────────────┐
│      users       │         │    plant_schemas      │
├──────────────────┤         ├──────────────────────┤
│ id (PK)          │         │ id (PK)               │
│ email (UNIQUE)   │         │ name                  │
│ password_hash    │         │ description           │
│ full_name        │         │ fields (JSONB)         │
│ role             │         │ created_by → users.id │
│   'admin'|'user' │         │ created_at            │
│ created_at       │         └──────────────────────┘
│ updated_at       │                   │
└──────────────────┘                   │ schema_id
        │ user_id                      │
        │                              ▼
        ▼                    ┌──────────────────────┐
┌──────────────────┐         │        plants        │
│      farms       │         ├──────────────────────┤
├──────────────────┤         │ id (PK)               │
│ id (PK)          │◄────────│ farm_id → farms.id    │
│ name             │  farm_id│ schema_id             │
│ description      │         │ tree_code (Mã cây)    │
│ polygon_coords   │         │ public_slug (UNIQUE)  │
│   (JSONB)        │         │ plant_type            │
│ area (m²)        │         │ plant_variety         │
│ user_id → users  │         │ plant_age             │
│ created_by       │         │ health_status         │
│ created_at       │         │   'Tốt'|'Bình thường' │
└──────────────────┘         │   'Cần chú ý'|'Bệnh' │
                             │ location              │
                             │ latitude, longitude   │
                             │ data (JSONB)          │
                             │ cover_image           │
                             │ is_public             │
                             │ created_by → users.id │
                             └──────────────────────┘
                                        │ plant_id
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
             ┌──────────────────┐           ┌──────────────────┐
             │   plant_logs     │           │   plant_media    │
             ├──────────────────┤           ├──────────────────┤
             │ id (PK)          │           │ id (PK)          │
             │ plant_id → plants│           │ plant_id → plants│
             │ log_date (DATE)  │           │ object_name      │
             │ log_type:        │           │ url (CDN link)   │
             │  'Tưới nước'     │           │ media_type:      │
             │  'Bón phân'      │           │  'image'|'video' │
             │  'Phun thuốc'    │           │ caption          │
             │  'Cắt lá'        │           │ uploaded_at      │
             │  'Tỉa hoa'       │           └──────────────────┘
             │  'Bệnh cây'      │
             │ note (TEXT)      │           ┌──────────────────┐
             │ details (JSONB)  │           │  system_configs  │
             │  Ví dụ:          │           ├──────────────────┤
             │  {method, amount}│           │ key (PK)         │
             │  {disease_name,  │           │  'fertilizers'   │
             │   severity,      │           │  'pesticides'    │
             │   description}   │           │  'water_methods' │
             │ media_urls (JSONB│           │  'leaf_cut_reasons'│
             │ created_by       │           │  'flower_prune_  │
             │ created_at       │           │   reasons'       │
             └──────────────────┘           │ value (JSONB)    │
                                           │ updated_at       │
                                           └──────────────────┘
```

### Chi tiết JSONB `details` theo loại nhật ký

| log_type | Cấu trúc `details` |
|----------|-------------------|
| Tưới nước | `{ method: "Tưới nhỏ giọt", amount: 2, unit: "lít" }` |
| Bón phân | `{ fertilizer_name: "NPK 16-16-8", amount: 100, unit: "gam" }` |
| Phun thuốc | `{ pesticide_name: "Anvil", amount: 50, unit: "ml" }` |
| Cắt lá | `{ reason: "Lá già úa/vàng", amount: 10 }` |
| Tỉa hoa | `{ reason: "Tỉa hoa tàn", amount: 5 }` |
| Bệnh cây | `{ disease_name: "Vàng lá thối rễ", severity: "Trung bình", description: "..." }` |

---

## 4. API Endpoints

### 🔐 Auth
| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/auth/login` | Đăng nhập, trả JWT token | ❌ |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại | ✅ |

### 🌱 Plants
| Method | Endpoint | Mô tả | Admin | User |
|--------|----------|-------|-------|------|
| GET | `/api/plants` | Danh sách cây (User: chỉ cây trong farm mình phụ trách) | ✅ | ✅ |
| POST | `/api/plants` | Tạo cây mới | ✅ | ❌ |
| PUT | `/api/plants/:id` | Cập nhật thông tin cây | ✅ | ❌ |
| DELETE | `/api/plants/:id` | Xóa cây | ✅ | ❌ |
| GET | `/api/plants/markers` | Toạ độ markers cho bản đồ | ✅ | ✅ |
| GET | `/api/plants/logs/recent?days=N` | Nhật ký N ngày gần nhất | ✅ | ✅ |
| GET | `/api/plants/:id/logs` | Lịch sử nhật ký của 1 cây | ✅ | ✅ |
| POST | `/api/plants/:id/logs` | Thêm nhật ký chăm sóc | ✅ | ✅ |
| DELETE | `/api/plants/:id/logs/:logId` | Xóa nhật ký | ✅ | ❌ |
| GET | `/api/plants/:id/media` | Danh sách media của cây | ✅ | ✅ |
| POST | `/api/plants/:id/media` | Upload ảnh/video (multipart) | ✅ | ✅ |
| DELETE | `/api/plants/:id/media/:mediaId` | Xóa media | ✅ | ❌ |
| GET | `/plant/:slug` | Trang công khai thông tin cây | ❌ | ❌ |

### 🏡 Farms
| Method | Endpoint | Mô tả | Admin | User |
|--------|----------|-------|-------|------|
| GET | `/api/farms` | Danh sách trang trại (User: chỉ farm mình) | ✅ | ✅ |
| GET | `/api/farms/:id` | Chi tiết trang trại + danh sách cây | ✅ | ✅ |
| POST | `/api/farms` | Tạo trang trại mới | ✅ | ❌ |
| PUT | `/api/farms/:id` | Cập nhật trang trại | ✅ | ❌ |
| DELETE | `/api/farms/:id` | Xóa trang trại | ✅ | ❌ |

### 👥 Users
| Method | Endpoint | Mô tả | Admin only |
|--------|----------|-------|-----------|
| GET | `/api/users` | Danh sách tài khoản | ✅ |
| POST | `/api/users` | Tạo tài khoản nông hộ | ✅ |
| PUT | `/api/users/:id` | Cập nhật thông tin, đổi mật khẩu | ✅ |
| DELETE | `/api/users/:id` | Xóa tài khoản | ✅ |

### ⚙️ Config
| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/api/config` | Lấy toàn bộ cấu hình hệ thống | ❌ |
| GET | `/api/config/mapbox-token` | Lấy Mapbox token an toàn | ❌ |
| PUT | `/api/config` | Cập nhật cấu hình | Admin |

### 📐 Schemas
| Method | Endpoint | Mô tả | Admin only |
|--------|----------|-------|-----------|
| GET | `/api/schemas` | Danh sách schema loại cây | ✅ |
| POST | `/api/schemas` | Tạo schema mới | ✅ |
| PUT | `/api/schemas/:id` | Cập nhật schema | ✅ |
| DELETE | `/api/schemas/:id` | Xóa schema | ✅ |

---

## 5. Quy trình nghiệp vụ

### 5.1 Quy trình Thiết lập Hệ thống

```
Admin đăng nhập
      │
      ▼
[1] Tạo Schema loại cây
      │ Định nghĩa: Tên loại cây, mô tả, các trường thông tin bổ sung
      │ Ví dụ: "Cây Sầu riêng" – trường thêm: năm thu hoạch, năng suất dự kiến
      │
      ▼
[2] Tạo Trang trại
      │ Vẽ polygon ranh giới trang trại trên bản đồ Mapbox
      │ Gán nông hộ phụ trách (user_id)
      │
      ▼
[3] Thêm Cây trồng
      │ Gán vào trang trại
      │ Đặt toạ độ GPS (latitude, longitude)
      │ Gán tree_code (mã định danh ngắn)
      │ Chọn trạng thái sức khỏe ban đầu
      │
      ▼
[4] Tạo tài khoản Nông hộ
      │ Email + Mật khẩu
      │ Gán phụ trách trang trại (user_id trong bảng farms)
      │
      ▼
Hệ thống sẵn sàng vận hành
```

### 5.2 Quy trình Ghi nhật ký Chăm sóc hàng ngày (User Mobile)

```
Nông hộ mở app điện thoại → Trang chủ
      │
      ▼
Xem Nhắc nhở tự động:
  ├─ 🔴 Cây X bị bệnh Y → Xem ảnh bệnh
  ├─ 💦 Cây chưa tưới hôm nay (Cây 01, 02, 05)
  └─ 🧪 Cây chưa bón phân quá 7 ngày
      │
      ▼
Chọn ghi nhật ký:
  Option A: Nhấn nút [Nhật ký] trực tiếp trên hàng cây
  Option B: Nhấn nút nổi FAB (+) → chọn cây từ dropdown
  Option C: Nhấn [Tưới cả vườn] → ghi loạt cho tất cả cây chưa tưới
      │
      ▼
Modal Nhật ký Chăm sóc:
  ├─ Chọn loại: Tưới nước / Bón phân / Phun thuốc / Cắt lá / Tỉa hoa / Bệnh cây
  │
  ├─ Nếu "Bệnh cây":
  │     ├─ Nhập tên bệnh / triệu chứng
  │     ├─ Chọn mức độ: Nhẹ / Trung bình / Nghiêm trọng
  │     ├─ Mô tả thêm (tuỳ chọn)
  │     └─ [Chụp hình] hoặc [Thư viện]
  │           │
  │           ▼
  │     Watermark tự động (Canvas API):
  │     ┌────────────────────────────────┐
  │     │  [Ảnh gốc]                     │
  │     │                                │
  │     │ ████████████████████████████  │
  │     │ Mã cây: C01                   │
  │     │ Thời gian: 15:30 30/06/2026   │
  │     │ Tên bệnh: Vàng lá thối rễ     │
  │     └────────────────────────────────┘
  │           │
  │           ▼
  │     Upload lên Supabase Storage (CDN)
  │
  ├─ Điền thông tin chi tiết (phương pháp / liều lượng / đơn vị)
  └─ [Lưu nhật ký] → POST /api/plants/:id/logs
      │
      ▼
Dashboard tự động refresh:
  ├─ Cập nhật nhắc nhở (last_watered / last_fertilized)
  ├─ Cập nhật danh sách cây
  └─ Cập nhật Lịch sử nhật ký
```

### 5.3 Quy trình Giám sát (Admin Dashboard)

```
Admin mở Dashboard
      │
      ▼
Thống kê tổng quan:
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ Tổng cây     │ Cây khỏe    │ Cần chú ý   │ Loại cây     │
  │ (tổng số)    │ (Tốt)       │ (Bệnh/Watch)│ (Schema)     │
  └──────────────┴──────────────┴──────────────┴──────────────┘
      │
      ▼
Bản đồ tổng quan (Mapbox Satellite):
  ├─ Polygon xanh: Ranh giới trang trại
  ├─ Marker xanh lá: Cây khỏe mạnh
  ├─ Marker vàng: Cây cần chú ý
  └─ Marker đỏ: Cây đang bệnh
      │
      ▼
Filter theo trạng thái → Bảng nhật ký 3 ngày gần nhất
      │
      ▼
[Trang GIS] → Vẽ / Chỉnh sửa polygon trang trại
              → Thêm / Di chuyển marker cây trồng
```

### 5.4 Quy trình Phân quyền (Role-based Access Control)

```
                    ┌─────────────────────────────┐
                    │         JWT Token            │
                    │  { id, email, role, exp }   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             role = 'admin'               role = 'user'
                    │                             │
         ┌──────────▼──────────┐    ┌────────────▼────────────┐
         │     Admin Portal    │    │      User Portal         │
         │                     │    │                          │
         │ ✅ Xem TẤT CẢ cây  │    │ ✅ Xem cây trong farm    │
         │ ✅ Xem TẤT CẢ farm │    │    mình phụ trách         │
         │ ✅ Tạo/Sửa/Xóa cây │    │ ✅ Ghi nhật ký chăm sóc │
         │ ✅ Quản lý Farm GIS │    │ ✅ Chụp ảnh bệnh cây    │
         │ ✅ Quản lý Schema   │    │ ✅ Xem bản đồ farm mình │
         │ ✅ Quản lý Users    │    │ ❌ Tạo/Sửa/Xóa cây      │
         │ ✅ Cấu hình hệ thống│    │ ❌ Quản lý trang trại   │
         │ ✅ Xem toàn bộ logs │    │ ❌ Quản lý người dùng   │
         └─────────────────────┘    └─────────────────────────┘
```

### 5.5 Quy trình Upload & Lưu trữ Media

```
[Browser - User]
Chọn file ảnh/video
      │
      ├─ Nếu là ảnh bệnh cây:
      │    Canvas.drawImage() → Vẽ watermark text
      │    canvas.toBlob() → File mới có watermark
      │
      ▼
FormData (multipart/form-data)
POST /api/plants/:id/media
      │
      ▼
[Backend - Multer]
memoryStorage (không ghi đĩa)
Limit: 100MB/file
Accept: jpeg, jpg, png, gif, webp, mp4, mov, avi, mkv
      │
      ▼
Supabase Storage.upload()
objectName: plant-media/{uuid}.{ext}
public: true (CDN URL)
      │
      ▼
Lưu record vào plant_media table:
{ plant_id, object_name, url, media_type, uploaded_at }
      │
      ▼
Trả về CDN URL → Frontend hiển thị
```

---

## 6. Cấu trúc thư mục

```
plant-app-deploy/
│
├── 📄 render.yaml                    ← Cấu hình deploy Render.com
├── 📄 setup.bat                      ← Cài đặt lần đầu (Windows)
├── 📄 start.bat                      ← Chạy local (Windows)
│
├── 🔧 backend/                       ← Node.js + Express REST API
│   ├── server.js                     ← Entry point: route binding, static serve, SPA fallback
│   ├── package.json                  ← Dependencies npm
│   ├── .env                          ← Biến môi trường (không commit)
│   ├── .env.example                  ← Template cấu hình
│   │
│   ├── config/
│   │   ├── db.js                     ← PostgreSQL connection pool (SSL)
│   │   └── supabase.js               ← Supabase client, ensureBucket(), upload/delete
│   │
│   ├── db/
│   │   └── init.js                   ← Auto-migration: tạo bảng + seed admin + seed config
│   │
│   ├── middleware/
│   │   └── auth.js                   ← JWT verify middleware → req.user
│   │
│   ├── routes/
│   │   ├── auth.js                   ← Login, /me
│   │   ├── plants.js                 ← CRUD cây + logs + media (file lớn nhất: 452 dòng)
│   │   ├── farms.js                  ← CRUD trang trại
│   │   ├── users.js                  ← CRUD user (Admin only)
│   │   ├── config.js                 ← System config + Mapbox token
│   │   └── schemas.js                ← CRUD plant schema / template
│   │
│   └── scripts/
│       └── seed-user.js              ← Seed tài khoản demo
│
└── 🖥️ frontend/                      ← Vanilla HTML + CSS + JS (ES Modules)
    │
    ├── assets/
    │   ├── logo.png                  ← Logo Tanbao Corp
    │   ├── login-hero.jpg            ← Ảnh nền trang đăng nhập
    │   └── crop/                     ← Hình minh hoạ cây trồng
    │       ├── cacao.png
    │       ├── coffee.png
    │       ├── durian.png
    │       └── rubber.png
    │
    ├── admin/                        ← Admin Dashboard (PC/Laptop)
    │   ├── index.html                ← SPA duy nhất (44KB)
    │   ├── css/
    │   │   ├── admin-layout.css      ← Layout, sidebar, card, table, form
    │   │   ├── admin-components.css  ← Badge, modal, toast, spinner
    │   │   ├── admin-dashboard.css   ← Stat cards, chart area
    │   │   └── admin-gis.css         ← Map container, draw controls
    │   └── js/
    │       ├── app.js                ← Router, globals, sidebar, config tabs
    │       ├── auth.js               ← Login/logout Admin
    │       ├── dashboard.js          ← Thống kê, bản đồ overview, logs
    │       ├── plants.js             ← CRUD cây, modal, phân trang, filter
    │       ├── schemas.js            ← CRUD schema loại cây
    │       ├── users.js              ← CRUD tài khoản nông hộ
    │       ├── gis.js                ← Mapbox GIS: vẽ polygon, marker, draw
    │       ├── media.js              ← Gallery upload, xóa media
    │       └── core/
    │           └── globals.js        ← Extracted shared globals (chuẩn bị ES Module)
    │
    ├── user/                         ← User Portal (Mobile-first Web App)
    │   ├── index.html                ← SPA 4-tab (21KB)
    │   ├── README.md                 ← Hướng dẫn phát triển module
    │   ├── css/
    │   │   └── user-layout.css       ← Mobile CSS (31KB): bottom nav, FAB, lightbox
    │   └── js/
    │       ├── app.js                ← Entry point slim: import + window exposure
    │       ├── auth.js               ← Login/logout User (ES Module)
    │       ├── core/
    │       │   ├── api.js            ← Token, api() fetch helper
    │       │   ├── utils.js          ← toast, esc, healthBadge, formatDate
    │       │   └── router.js         ← showPage, sidebar, tab nav
    │       └── modules/
    │           ├── dashboard.js      ← loadUserDashboard(): data orchestrator
    │           ├── plants.js         ← Render + filter cây trồng
    │           ├── logs.js           ← Render + filter nhật ký
    │           ├── reminders.js      ← Nhắc nhở + cảnh báo bệnh + quickCare
    │           ├── map.js            ← Mapbox GIS (farm polygon + plant markers)
    │           ├── care-modal.js     ← Modal nhật ký 6 loại hoạt động
    │           ├── media.js          ← File select, Canvas watermark, Lightbox
    │           └── fab.js            ← FAB draggable: long-press kéo, tap mở modal
    │
    └── public/                       ← Trang công khai (không cần đăng nhập)
        ├── plant.html                ← Thông tin chi tiết cây (QR Code share)
        ├── report.html               ← Báo cáo nhật ký chăm sóc
        ├── css/
        │   ├── plant.css
        │   └── report.css
        └── js/
            ├── plant.js              ← Fetch + render thông tin cây theo slug
            └── report.js             ← Fetch + render báo cáo, in PDF
```

---

## 7. Giao diện người dùng

### 7.1 Admin Portal (`/admin`)

| Trang | Chức năng |
|-------|-----------|
| **Dashboard** | Thống kê tổng (tổng cây, cây khỏe, cần chú ý), bản đồ tổng quan, nhật ký 3 ngày gần nhất |
| **Danh sách cây** | Bảng CRUD cây trồng, filter theo sức khỏe/loại/trang trại, modal chi tiết có 4 tab: Thông tin / Schema / Media / Nhật ký |
| **GIS Bản đồ** | Vẽ và chỉnh polygon trang trại bằng Mapbox Draw, quản lý marker cây |
| **Người dùng** | CRUD tài khoản nông hộ, gán trang trại phụ trách |
| **Thiết lập** | Quản lý Schema loại cây + Cấu hình quy trình (phân bón, thuốc, phương pháp tưới) |

### 7.2 User Portal (`/user`) — Mobile-first

| Tab | Chức năng |
|-----|-----------|
| 🏠 **Trang chủ** | Lời chào, nhắc nhở (bệnh/tưới/phân), tóm tắt 3 cây, hoạt động 3 ngày gần nhất, FAB (+) |
| 🌾 **Trang trại** | Bản đồ GIS farm, danh sách đầy đủ cây + tìm kiếm |
| 📜 **Lịch sử** | Toàn bộ nhật ký 30 ngày + tìm kiếm + lọc theo loại hoạt động |
| ⚙️ **Cài đặt** | Thông tin tài khoản, đăng xuất |

**FAB (Floating Action Button):**
- Nhấn nhanh → Mở modal ghi nhật ký (chọn cây từ dropdown)
- Nhấn giữ 400ms → Bật chế độ kéo rê (rung điện thoại xác nhận)
- Kéo → Di chuyển đến vị trí tùy ý

### 7.3 Public Pages (`/plant/:slug`)

| Trang | URL | Chức năng |
|-------|-----|-----------|
| Thông tin cây | `/plant/durian-a1b2c3d4` | Ảnh, thông tin loại cây, lịch chăm sóc, gallery |
| Báo cáo cây | `/plant/durian-a1b2c3d4/report` | Nhật ký đầy đủ, thống kê sức khỏe, in/export |

---

## 8. Hướng dẫn cài đặt

### Yêu cầu hệ thống

| Phần mềm | Phiên bản |
|----------|-----------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| PostgreSQL | ≥ 14.x (hoặc dùng Supabase DB) |

### Bước 1: Clone dự án

```bash
git clone https://github.com/Phuc0901-pp/plant-book.git
cd plant-book
```

### Bước 2: Cài đặt dependencies

```bash
cd backend
npm install
```

### Bước 3: Cấu hình biến môi trường

```bash
# Sao chép file mẫu
cp .env.example .env

# Mở và điền đầy đủ thông tin vào .env
```

### Bước 4: Khởi động

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server khởi động tại `http://localhost:3000`

- Admin: `http://localhost:3000/admin`
- User: `http://localhost:3000/user`

> Database schema được tạo **tự động** khi khởi động lần đầu (không cần chạy migration thủ công).

---

## 9. Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `PORT` | ❌ | Port server (mặc định: 3000) |
| `NODE_ENV` | ✅ | `production` hoặc `development` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (với SSL) |
| `JWT_SECRET` | ✅ | Chuỗi bí mật ≥ 32 ký tự |
| `JWT_EXPIRES_IN` | ❌ | Thời hạn token (mặc định: 24h) |
| `SUPABASE_URL` | ✅ | URL project Supabase |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (có quyền Storage) |
| `SUPABASE_BUCKET` | ❌ | Tên bucket (mặc định: plant-media) |
| `MAPBOX_TOKEN` | ✅ | Mapbox public access token |
| `ADMIN_EMAIL` | ✅ | Email tài khoản Admin mặc định |
| `ADMIN_PASSWORD` | ✅ | Mật khẩu Admin (tạo lần đầu) |
| `APP_URL` | ❌ | URL ứng dụng khi deploy |

---

## 10. Triển khai sản phẩm

### Render.com (Cấu hình sẵn)

Dự án đã có file `render.yaml` sẵn sàng deploy 1-click:

```yaml
services:
  - type: web
    name: plant-book
    env: node
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health
```

**Các bước:**
1. Fork repo lên GitHub
2. Kết nối Render.com với GitHub repo
3. Điền các biến môi trường trong Render Dashboard
4. Deploy

### GitHub Actions — Keep-Alive

File `.github/workflows/keep-awake.yml` tự động ping server mỗi 10 phút để tránh Render free tier ngủ đông.

### Sơ đồ Deploy

```
Developer → git push → GitHub
                           │
                           ▼
                    Render.com (Auto Deploy)
                           │
                    npm install → npm start
                           │
                    ┌──────┴──────┐
                    │             │
               PostgreSQL    Supabase
               (Neon DB)    (Storage)
               via DATABASE_URL  via SUPABASE_URL
```

---

## 11. Công nghệ sử dụng

### Backend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| **Node.js** | ≥ 18 | Runtime JavaScript |
| **Express.js** | 4.18 | Web framework, routing |
| **PostgreSQL** | 14+ | Cơ sở dữ liệu chính (quan hệ) |
| **node-postgres (pg)** | 8.11 | PostgreSQL driver |
| **Supabase JS** | 2.39 | Storage SDK (upload ảnh/video) |
| **jsonwebtoken** | 9.0 | JWT xác thực |
| **bcryptjs** | 2.4 | Hash mật khẩu (salt rounds: 12) |
| **multer** | 1.4 LTS | Xử lý multipart file upload (memoryStorage) |
| **uuid** | 9.0 | Tạo unique slug và object name |
| **dotenv** | 16.3 | Load biến môi trường từ .env |
| **cors** | 2.8 | Cross-Origin Resource Sharing |
| **express-rate-limit** | 7.1 | Rate limiting (bảo vệ API) |
| **ws** | 8.21 | WebSocket (Supabase realtime) |
| **nodemon** | 3.0 | Auto-reload khi development |

### Frontend

| Công nghệ | Mục đích |
|-----------|----------|
| **Vanilla HTML5** | Cấu trúc trang |
| **CSS3 (Vanilla)** | Thiết kế, responsive, animation |
| **JavaScript ES2022** | Logic ứng dụng |
| **ES Modules** | Modular architecture (User Portal) |
| **Mapbox GL JS v3.1** | Bản đồ vệ tinh + GIS polygon draw |
| **Mapbox Draw** | Vẽ và chỉnh sửa polygon trang trại |
| **Canvas API** | Watermark ảnh bệnh cây |
| **FileReader API** | Preview ảnh trước khi upload |
| **FontAwesome 6.5** | Icon library |
| **Bootstrap Icons** | Icon bổ sung |
| **Google Fonts (Inter)** | Typography |

### Hạ tầng

| Dịch vụ | Mục đích |
|---------|----------|
| **Render.com** | Hosting Node.js server (Free/Paid) |
| **Supabase** | PostgreSQL database + S3 file storage |
| **GitHub** | Version control + CI/CD trigger |
| **GitHub Actions** | Keep-alive ping tự động |
| **Mapbox** | Bản đồ vệ tinh, geocoding |

---

## 📎 Ghi chú phát triển

### Convention

| Quy tắc | Chi tiết |
|---------|----------|
| Module format | ES Modules (`import/export`) cho User Portal |
| Mỗi module | Tối đa 200 dòng, đơn trách nhiệm |
| HTML handlers | Expose qua `window.xxx = fn` trong `app.js` |
| API auth | JWT Bearer token trong header `Authorization` |
| Upload limit | 100MB/file, định dạng: jpeg, jpg, png, gif, webp, mp4, mov, avi, mkv |
| Password hash | bcrypt salt rounds = 12 |
| Token expire | 24 giờ (có thể cấu hình qua `JWT_EXPIRES_IN`) |

### Thêm tính năng mới — Bảng hướng dẫn nhanh

| Tình huống | File cần sửa |
|------------|-------------|
| Thêm loại hoạt động chăm sóc | `modules/care-modal.js` → `_buildDetailFields()` + `saveCareLog()` |
| Thêm loại filter nhật ký | `modules/logs.js` → `filterUserLogs()` + HTML select |
| Thêm nhắc nhở mới | `modules/reminders.js` → `renderUserReminders()` |
| Thêm API endpoint mới | `backend/routes/xxx.js` + đăng ký trong `server.js` |
| Thêm bảng DB mới | `backend/db/init.js` → thêm `CREATE TABLE IF NOT EXISTS` |
| Thêm cấu hình hệ thống | `backend/db/init.js` → seed vào `system_configs` |
| Thêm loại cây mới | Admin → Thiết lập → Thêm Schema |
| Gán nông hộ mới | Admin → Người dùng → Tạo → Gán farm |

---

*Tài liệu này được tạo tự động từ việc phân tích toàn bộ source code dự án Plant Book — Tanbao Corp.*  
*Cập nhật lần cuối: 30/06/2026*
