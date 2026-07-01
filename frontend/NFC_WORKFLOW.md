# 📱 Quy trình NFC → Plant Book
> **Tanbao Corp** · Hệ thống Quản lý Vườn Cây Thông minh

Tài liệu này mô tả toàn bộ luồng kỹ thuật từ khi **người dùng chạm thẻ NFC** vào điện thoại cho đến khi dữ liệu canh tác được **lưu trữ thành công vào cơ sở dữ liệu**.

---

## 1. Tổng quan quy trình

```mermaid
flowchart TD
    A([📱 Người dùng chạm thẻ NFC\nvào điện thoại]) --> B[Điện thoại đọc\nNFC Tag]
    B --> C{Tag hợp lệ?}
    C -- ❌ Không --> D([⚠️ Báo lỗi:\nThẻ không nhận diện được])
    C -- ✅ Có --> E[Mở trình duyệt\ntới URL nhúng trong Tag]
    E --> F[/plant/:public_slug]
    F --> G[GET /api/plant/:slug\nLấy thông tin cây]
    G --> H{Cây tồn tại\nvà is_public = true?}
    H -- ❌ Không --> I([🚫 Trang 404:\nCây không tìm thấy])
    H -- ✅ Có --> J[🌿 Hiển thị trang\nThông tin Cây trồng]
    J --> K[Người dùng xem:\nLoại cây · Sức khỏe · Lịch sử chăm sóc]
    K --> L{Muốn ghi\nnhật ký canh tác?}
    L -- Không --> M([👀 Chỉ xem thông tin])
    L -- Có --> N[Nhấn nút\n✏️ Ghi nhật ký canh tác]
    N --> O{Đã đăng nhập?}
    O -- ❌ Chưa --> P[Chuyển hướng\ntới trang đăng nhập]
    P --> Q[Nhập Email + Mật khẩu]
    Q --> R[POST /api/auth/login]
    R --> S{Xác thực\nthành công?}
    S -- ❌ Thất bại --> T([🔒 Thông báo lỗi\nĐăng nhập])
    S -- ✅ --> U[Nhận JWT Token\nLưu vào localStorage]
    O -- ✅ Rồi --> V[Mở Modal\nGhi nhật ký chăm sóc]
    U --> V
    V --> W[Chọn loại hoạt động]
    W --> X[Điền thông tin\nchi tiết canh tác]
    X --> Y{Có ảnh/video\nbệnh cây?}
    Y -- Có --> Z[📸 Chụp ảnh / Chọn thư viện]
    Z --> AA[🖼️ Đóng dấu Watermark\nMã cây · Thời gian · Tên bệnh]
    AA --> AB[☁️ Upload lên\nSupabase Storage CDN]
    AB --> AC[Nhận CDN URL]
    AC --> AD
    Y -- Không --> AD[Nhấn\n💾 Lưu nhật ký]
    AD --> AE[POST /api/plants/:id/logs\nBearer JWT Token]
    AE --> AF{Server\nxác thực token?}
    AF -- ❌ --> AG([🔒 401 Unauthorized\nToken hết hạn / không hợp lệ])
    AF -- ✅ --> AH[Lưu vào\nPostgreSQL Database]
    AH --> AI[✅ Ghi nhận thành công!\nDashboard tự động cập nhật]
```

---

## 2. Chi tiết: NFC Tag & URL Scheme

```mermaid
sequenceDiagram
    actor User as 👤 Nông hộ
    participant Phone as 📱 Điện thoại
    participant NFC as 🏷️ NFC Tag
    participant Browser as 🌐 Trình duyệt
    participant Server as ⚙️ Backend Server
    participant DB as 🗄️ PostgreSQL

    User->>Phone: Chạm điện thoại vào thẻ NFC gắn trên cây
    Phone->>NFC: Đọc tín hiệu RF 13.56 MHz
    NFC-->>Phone: Trả về NDEF Record URL tanbaocorp.vn/plant/durian-a1b2c3d4
    Phone->>Browser: Tự động mở URL
    Browser->>Server: GET /plant/durian-a1b2c3d4
    Server->>DB: SELECT FROM plants WHERE public_slug = durian-a1b2c3d4 AND is_public = true
    DB-->>Server: Trả dữ liệu cây
    Server-->>Browser: Render trang thông tin cây
    Browser-->>User: Hiển thị trang cây trồng
```

---

## 3. Chi tiết: Ghi nhật ký Canh tác

```mermaid
sequenceDiagram
    actor User as 👤 Nông hộ
    participant App as 📱 User Portal
    participant API as ⚙️ REST API
    participant Auth as 🔐 JWT Middleware
    participant DB as 🗄️ PostgreSQL
    participant CDN as ☁️ Supabase Storage

    User->>App: Nhấn "Ghi nhật ký canh tác"
    App->>App: Kiểm tra localStorage pb_token

    alt Chưa đăng nhập
        App->>User: Chuyển tới trang đăng nhập
        User->>App: Nhập email + mật khẩu
        App->>API: POST /api/auth/login
        API-->>App: token JWT + thông tin user
        App->>App: Lưu token vào localStorage
    end

    User->>App: Chọn loại hoạt động
    App->>User: Hiển thị form chi tiết theo loại
    User->>App: Điền thông tin canh tác

    alt Hoạt động là Bệnh cây
        User->>App: Chụp ảnh thực địa
        App->>App: Canvas API vẽ watermark lên ảnh
        App->>API: POST /api/plants/:id/media multipart + Bearer Token
        API->>Auth: Xác thực JWT Token
        Auth-->>API: OK req.user = id + role
        API->>CDN: supabase.storage.upload objectName uuid.jpg
        CDN-->>API: CDN Public URL
        API-->>App: url CDN + type image
        App->>App: Lưu CDN URL vào media_urls
    end

    User->>App: Nhấn Lưu nhật ký
    App->>API: POST /api/plants/:id/logs Authorization Bearer token
    API->>Auth: Xác thực JWT Token
    Auth-->>API: Hợp lệ
    API->>DB: INSERT INTO plant_logs log_type log_date note details media_urls created_by
    DB-->>API: Record đã tạo
    API-->>App: 201 Created
    App->>User: Toast Ghi nhật ký thành công
    App->>App: Tự động reload Dashboard
```

---

## 4. Phân nhánh theo Loại hoạt động

```mermaid
flowchart LR
    A[🌾 Chọn loại\nhoạt động] --> B{log_type}

    B --> C[💧 Tưới nước]
    B --> D[🧪 Bón phân]
    B --> E[🌫️ Phun thuốc]
    B --> F[✂️ Cắt lá]
    B --> G[🌸 Tỉa hoa]
    B --> H[🦠 Bệnh cây]

    C --> C1["method: Tưới nhỏ giọt\namount: 2\nunit: lít"]
    D --> D1["fertilizer: NPK 16-16-8\namount: 100\nunit: gam"]
    E --> E1["pesticide: Anvil\namount: 50\nunit: ml"]
    F --> F1["reason: Lá già úa vàng\namount: 10"]
    G --> G1["reason: Tỉa hoa tàn\namount: 5"]
    H --> H1["disease: Vàng lá thối rễ\nseverity: Trung bình"]

    H1 --> H2[📸 Bắt buộc\nchụp ảnh / quay video]
    H2 --> H3[🖼️ Watermark\ntự động]
    H3 --> H4[☁️ Upload CDN\nSupabase Storage]

    C1 & D1 & E1 & F1 & G1 & H4 --> Z[💾 POST /api/plants/:id/logs]
    Z --> ZZ[(🗄️ PostgreSQL\nplant_logs)]
```

---

## 5. Cấu trúc dữ liệu lưu vào Database

```mermaid
erDiagram
    plants {
        int id PK
        varchar public_slug UK "Nhúng vào NFC Tag"
        varchar tree_code "Mã cây hiển thị"
        varchar plant_type "Loại cây"
        varchar health_status "Tốt / Bệnh / Cần chú ý"
        numeric latitude "Toạ độ GPS"
        numeric longitude "Toạ độ GPS"
        boolean is_public "true = NFC công khai"
    }

    plant_logs {
        int id PK
        int plant_id FK
        date log_date "Ngày canh tác"
        varchar log_type "Tưới nước / Bệnh cây ..."
        text note "Ghi chú tự do"
        jsonb details "Chi tiết theo loại hoạt động"
        jsonb media_urls "URL ảnh/video từ CDN"
        int created_by FK "ID người ghi nhật ký"
        timestamptz created_at
    }

    plant_media {
        int id PK
        int plant_id FK
        varchar object_name "Tên file trên Supabase"
        text url "CDN Public URL"
        varchar media_type "image / video"
        timestamptz uploaded_at
    }

    users {
        int id PK
        varchar email
        varchar role "admin / user"
        varchar full_name "Họ tên nông hộ"
    }

    plants ||--o{ plant_logs : "has many"
    plants ||--o{ plant_media : "has many"
    users ||--o{ plant_logs : "created by"
```

---

## 6. Trạng thái hệ thống & xử lý lỗi

```mermaid
stateDiagram-v2
    [*] --> QuetNFC : Chạm thẻ NFC

    QuetNFC --> DocTag : Điện thoại đọc Tag
    DocTag --> TagLoi : Tag lỗi / không hợp lệ
    TagLoi --> [*] : Thông báo lỗi

    DocTag --> MoTrang : Mở URL trong Tag
    MoTrang --> TimCay : GET /plant/:slug

    TimCay --> KhongTimThay : 404 - Cây không tồn tại
    KhongTimThay --> [*]

    TimCay --> HienThiCay : Hiển thị thông tin cây
    HienThiCay --> ChiXem : Người dùng chỉ xem
    ChiXem --> [*]

    HienThiCay --> GhiNhatKy : Nhấn ghi nhật ký

    GhiNhatKy --> ChuaDangNhap : Chưa có token
    ChuaDangNhap --> DangNhap : Chuyển màn đăng nhập
    DangNhap --> DangNhapLoi : Sai email / mật khẩu
    DangNhapLoi --> DangNhap : Thử lại
    DangNhap --> CoToken : Đăng nhập thành công

    GhiNhatKy --> CoToken : Đã có token hợp lệ

    CoToken --> DienForm : Điền thông tin canh tác
    DienForm --> UploadMedia : Có ảnh bệnh cây
    UploadMedia --> WatermarkAnh : Xử lý watermark
    WatermarkAnh --> GuiLenCDN : Upload Supabase
    GuiLenCDN --> CDNLoi : Upload thất bại
    CDNLoi --> DienForm : Thử lại

    GuiLenCDN --> LuuNhatKy
    DienForm --> LuuNhatKy : Không có media

    LuuNhatKy --> GuiAPI : POST /api/plants/:id/logs
    GuiAPI --> TokenHetHan : 401 Unauthorized
    TokenHetHan --> DangNhap : Đăng nhập lại

    GuiAPI --> LuuDB : Server xác thực OK
    LuuDB --> ThanhCong : 201 Created
    ThanhCong --> RefreshUI : Cập nhật giao diện
    RefreshUI --> [*] : ✅ Hoàn tất
```

---

## 7. Kiến trúc tổng thể hệ thống NFC

```mermaid
graph TB
    subgraph Field["🌿 Thực địa - Vườn cây"]
        NFC1[🏷️ NFC Tag - Cây C01\nURL: /plant/cacao-xxx]
        NFC2[🏷️ NFC Tag - Cây C02\nURL: /plant/durian-yyy]
        NFC3[🏷️ NFC Tag - Cây C03\nURL: /plant/rubber-zzz]
    end

    subgraph Mobile["📱 Điện thoại Nông hộ"]
        Browser[Trình duyệt\nChrome / Safari]
        LocalStorage[(localStorage\npb_token JWT)]
    end

    subgraph Backend["⚙️ Backend — Render.com"]
        Express[Express.js Server]
        JWT[🔐 JWT Middleware]
        Router[REST API Router]
    end

    subgraph Storage["☁️ Cloud Storage"]
        Supabase[(Supabase S3\nplant-media bucket)]
        Postgres[(PostgreSQL\nNeon DB)]
    end

    subgraph Admin["🖥️ Admin Dashboard"]
        AdminUI[Admin Portal /admin]
        GIS[Bản đồ GIS Mapbox]
    end

    NFC1 & NFC2 & NFC3 -->|Tap NFC| Browser
    Browser <-->|HTTPS REST API| Express
    Browser <-->|Lưu / Đọc Token| LocalStorage
    Express --> JWT --> Router
    Router <-->|Query / Insert| Postgres
    Router <-->|Upload / Get URL| Supabase
    AdminUI <-->|HTTPS REST API| Express
    AdminUI --> GIS
```

---

## 8. Tóm tắt nhanh (Quick Reference)

| # | Bước | Hành động | Kỹ thuật sử dụng | API Endpoint |
|---|------|-----------|-----------------|-------------|
| 1 | Quét NFC | Chạm điện thoại vào thẻ | NFC NDEF · 13.56 MHz | — |
| 2 | Mở trang cây | Trình duyệt tự mở URL | Web Intent / URL Scheme | `GET /plant/:slug` |
| 3 | Xem thông tin | Hiển thị thông tin công khai | Public API — không cần auth | `GET /api/plant/:slug` |
| 4 | Đăng nhập | Xác thực tài khoản nông hộ | JWT · bcrypt · localStorage | `POST /api/auth/login` |
| 5 | Chụp ảnh bệnh | Watermark tự động lên ảnh | Canvas API · FileReader API | — |
| 6 | Upload media | Lưu ảnh/video lên CDN | Multipart · Supabase Storage | `POST /api/plants/:id/media` |
| 7 | Ghi nhật ký | Lưu hoạt động canh tác | Bearer JWT · JSONB details | `POST /api/plants/:id/logs` |
| 8 | Lưu database | Ghi vào PostgreSQL | INSERT plant_logs | `plant_logs` table |
| 9 | Cập nhật UI | Refresh dashboard tự động | Auto-reload · Toast notify | — |

---

> 💡 **Lưu ý triển khai NFC Tag:**
>
> Mỗi thẻ NFC được lập trình với **1 URL duy nhất** theo định dạng:
> ```
> https://app.tanbaocorp.vn/plant/{public_slug}
> ```
> Trong đó `public_slug` được tạo tự động khi admin thêm cây vào hệ thống.
>
> **Ví dụ:**
> - `https://app.tanbaocorp.vn/plant/cacao-a1b2c3d4`
> - `https://app.tanbaocorp.vn/plant/durian-e5f6g7h8`
>
> Thẻ NFC khuyến nghị: **NTAG213** (137 bytes — đủ chứa URL), chống nước, dán trực tiếp lên thân cây hoặc cọc nhãn.

---

*Plant Book — Tanbao Corp · Cập nhật: 30/06/2026*
