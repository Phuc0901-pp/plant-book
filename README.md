# 🌿 Plant Book — Deploy lên Render + Supabase

## Tổng quan
- **Backend**: Node.js + Express → host trên **Render.com** (free)
- **Database**: PostgreSQL → **Supabase** (free 500MB)
- **Lưu ảnh/video**: **Supabase Storage** (free 1GB)

---

## BƯỚC 1 — Tạo project Supabase

1. Vào https://supabase.com → **Start your project** → đăng ký (miễn phí)
2. Nhấn **New Project** → đặt tên `plant-book` → chọn region gần nhất → đặt mật khẩu DB
3. Chờ ~2 phút để project khởi tạo

### Lấy thông tin cần thiết:
Vào **Settings → API**:
- Copy **Project URL** → đây là `SUPABASE_URL`
- Copy **service_role** key (secret) → đây là `SUPABASE_SERVICE_KEY`

Vào **Settings → Database → Connection string → URI**:
- Copy chuỗi bắt đầu bằng `postgresql://...` → đây là `DATABASE_URL`
- Thay `[YOUR-PASSWORD]` bằng mật khẩu DB bạn đặt lúc tạo project

---

## BƯỚC 2 — Đưa code lên GitHub

1. Tạo repository mới trên https://github.com (đặt tên `plant-book`)
2. Upload toàn bộ thư mục này lên repo đó
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/plant-book.git
   git push -u origin main
   ```

---

## BƯỚC 3 — Deploy trên Render

1. Vào https://render.com → đăng ký / đăng nhập
2. Nhấn **New → Web Service**
3. Kết nối GitHub → chọn repo `plant-book`
4. Cấu hình:
   - **Name**: `plant-book`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Kéo xuống **Environment Variables** → thêm các biến sau:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://...` (từ Supabase) |
| `JWT_SECRET` | Chuỗi bí mật tùy ý (vd: `TanbaoCorp_2024_XyZ!@#$%`) |
| `JWT_EXPIRES_IN` | `24h` |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `service_role key` từ Supabase |
| `SUPABASE_BUCKET` | `plant-media` |
| `ADMIN_EMAIL` | `admin@tanbaocorp.vn` |
| `ADMIN_PASSWORD` | `Tanbao@123` |

6. Nhấn **Create Web Service** → chờ deploy (~3-5 phút)

---

## BƯỚC 4 — Truy cập

Sau khi deploy xong, Render sẽ cấp URL dạng:
```
https://plant-book-xxxx.onrender.com
```

| URL | Mô tả |
|-----|-------|
| `https://plant-book-xxxx.onrender.com` | Admin panel |
| `https://plant-book-xxxx.onrender.com/admin` | Admin panel |
| `https://plant-book-xxxx.onrender.com/plant/{slug}` | Trang công khai cây 🌱 |

**Tài khoản admin:**
- Email: `admin@tanbaocorp.vn`
- Pass: `Tanbao@123`

---

## Cấu trúc thư mục
```
plant-book/
├── backend/
│   ├── config/
│   │   ├── db.js          ← PostgreSQL (hỗ trợ DATABASE_URL)
│   │   └── supabase.js    ← Supabase Storage (thay MinIO)
│   ├── db/init.js         ← Tạo bảng tự động
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── plants.js
│   │   └── schemas.js
│   ├── server.js
│   ├── package.json
│   └── .env.example       ← Mẫu biến môi trường
├── frontend/
│   ├── admin/
│   │   ├── index.html
│   │   └── app.js
│   └── plant.html
├── render.yaml
└── README.md
```

---

## Lưu ý
- Free tier của Render sẽ **sleep sau 15 phút** không có request → lần đầu truy cập sau khi sleep mất ~30 giây để wake up
- Nâng lên $7/tháng để luôn online
- Supabase free: 500MB DB + 1GB Storage + 2GB bandwidth/tháng
