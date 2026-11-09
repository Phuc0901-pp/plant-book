# HƯỚNG DẪN TRIỂN KHAI PLANT BOOK ERP v1.3.5 LÊN MÁY CHỦ NAS CÔNG TY (HƯỚNG B)

Tài liệu này cung cấp quy trình chuẩn kỹ thuật để đưa toàn bộ **Cơ sở dữ liệu PostgreSQL**, **Bộ nhớ đệm Redis**, **Hệ thống Web Node.js** và **Kho hình ảnh cây trồng** về chạy trực tiếp bên trong máy chủ NAS của Công ty Cổ phần Tân Bảo Sài Gòn (Synology, QNAP, TrueNAS hoặc Linux Server).

---

## 1. CÁC THÀNH PHẦN KIẾN TRÚC TRÊN NAS

Gói Docker Compose (`docker-compose.nas.yml`) khởi chạy 4 dịch vụ độc lập và 1 dịch vụ kết nối Internet tùy chọn:

| Tên Container | Dịch vụ & Công nghệ | Cổng nội bộ | Thư mục lưu trữ vật lý trên NAS |
| :--- | :--- | :--- | :--- |
| **`tanbao-postgres-nas`** | PostgreSQL 16 + PostGIS + pg_trgm | `5432` | `./nas_storage/postgres_data` (Ổ đĩa RAID) |
| **`tanbao-redis-nas`** | Redis 7 Alpine (In-Memory Cache) | `6379` | `./nas_storage/redis_data` |
| **`tanbao-plantbook-web`** | Node.js v20 Backend API + Frontend | `10000` | `./nas_storage/uploads` (Lưu ảnh trực tiếp) |
| **`tanbao-pgadmin-nas`** | pgAdmin 4 (Quản trị CSDL trên web) | `5050` | `./nas_storage/pgadmin_data` |
| **`tanbao-cloudflared-nas`** | Cloudflare Tunnel *(Tùy chọn --profile tunnel)* | Không cần mở cổng | Kết nối bảo mật HTTPS ra Internet |

---

## 2. QUY TRÌNH 4 BƯỚC TRIỂN KHAI THỰC TẾ

### Bước 1: Sao chép mã nguồn và thiết lập file cấu hình môi trường (.env.nas)

1. Tải hoặc sao chép thư mục `plant-app-deploy` lên máy chủ NAS (ví dụ: `/volume1/docker/plant-app-deploy`).
2. Mở Terminal / SSH trên NAS và tạo file `.env.nas` từ mẫu:
   ```bash
   cd /volume1/docker/plant-app-deploy
   cp .env.nas.example .env.nas
   ```
3. Chỉnh sửa mật khẩu bảo mật trong `.env.nas`:
   - `POSTGRES_PASSWORD`: Mật khẩu CSDL PostgreSQL.
   - `REDIS_PASSWORD`: Mật khẩu Redis Cache.
   - `PGADMIN_PASSWORD`: Mật khẩu đăng nhập pgAdmin.
   - `JWT_SECRET`: Chuỗi bí mật ký Token xác thực người dùng.

---

### Bước 2: Khởi chạy cụm dịch vụ Docker trên NAS

#### Cách A — Dùng Dòng lệnh (CLI / SSH):
```bash
# Tạo các thư mục lưu trữ dữ liệu an toàn trên ổ cứng NAS
mkdir -p nas_storage/postgres_data nas_storage/redis_data nas_storage/uploads nas_storage/pgadmin_data

# Khởi chạy toàn bộ cụm dịch vụ
docker compose -f docker-compose.nas.yml --env-file .env.nas up -d --build
```

#### Cách B — Dùng Giao diện Synology (Container Manager):
1. Mở **Container Manager** trên DSM.
2. Vào mục **Project** -> Bấm **Create**.
3. Đặt tên Project: `plantbook-nas`, đường dẫn trỏ tới thư mục mã nguồn.
4. Chọn **Use existing docker-compose.yml** và chọn file `docker-compose.nas.yml`.
5. Bấm **Next** -> **Done** để hệ thống tự động build và chạy.

---

### Bước 3: Di chuyển (Migrate) toàn bộ dữ liệu từ Cloud hiện tại sang NAS

Để đảm bảo toàn bộ tài khoản, nông trại, cây trồng, thẻ NFC, lịch sử nhật ký canh tác và hạch toán vật tư được chuyển nguyên vẹn 100%:

1. Chạy thử nghiệm kiểm tra tính tương thích (Dry-run - Không ghi đè):
   ```bash
   node backend/scripts/migrate_to_nas.js postgres://plantbook:<MAT_KHAU_NAS>@<IP_NAS>:5432/plant_book?sslmode=disable
   ```
2. Thực thi di chuyển dữ liệu chính thức:
   ```bash
   node backend/scripts/migrate_to_nas.js postgres://plantbook:<MAT_KHAU_NAS>@<IP_NAS>:5432/plant_book?sslmode=disable --yes
   ```
   *Công cụ sẽ tự động sao chép toàn bộ bảng, nạp dữ liệu theo lô có kiểm soát transaction (ACID), đồng bộ chuỗi tự tăng (Sequence ID) và đối soát Checksum MD5 từng bảng.*

---

### Bước 4: Kiểm tra hoạt động & Nghiệm thu (Cut-over)

1. **Truy cập ứng dụng nội bộ**:
   - Cổng Nông hộ & Trang chủ: `http://<IP_NAS>:10000/`
   - Cổng Quản trị Admin: `http://<IP_NAS>:10000/admin`
   - Quản trị CSDL pgAdmin: `http://<IP_NAS>:5050/`
2. **Kiểm tra Telemetry**:
   - Đăng nhập quyền Admin -> Vào mục **Cơ sở dữ liệu** -> Chọn tab **Thanh tra CSDL (Schema & Tables)**.
   - Kiểm tra thẻ **Hạ tầng CSDL & Máy chủ NAS**: Hệ thống sẽ hiển thị biểu tượng ổ cứng màu xanh lá `Máy chủ NAS Công ty (Local / On-Premise)`, SSL tắt (LAN) và dung lượng CSDL chính xác.
3. **Đưa ứng dụng ra Internet an toàn cho Nông hộ ngoài vườn (Không mở Port Router)**:
   - Đăng ký tên miền trên Cloudflare -> Tạo Cloudflare Tunnel miễn phí trỏ về dịch vụ `http://web:10000`.
   - Lấy `TUNNEL_TOKEN` điền vào `.env.nas`.
   - Khởi chạy tunnel:
     ```bash
     docker compose -f docker-compose.nas.yml --env-file .env.nas --profile tunnel up -d
     ```
   - Nông hộ và đối tác xuất khẩu có thể quét mã QR qua tên miền HTTPS an toàn 24/7.

---

## 3. CƠ CHẾ SAO LƯU DỰ PHÒNG TỰ ĐỘNG (BACKUP CRON) TRÊN NAS

Để phòng ngừa sự cố phần cứng, thiết lập 1 tác vụ tự động sao lưu trong **Task Scheduler** của NAS:

```bash
#!/bin/bash
BACKUP_DIR="/volume1/backups/plantbook_daily"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Sao lưu cơ sở dữ liệu dạng nén gz
docker exec tanbao-postgres-nas pg_dump -U plantbook -d plant_book | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Giữ lại bản sao lưu trong 30 ngày gần nhất
find "$BACKUP_DIR" -type f -name "db_*.sql.gz" -mtime +30 -delete
```

---

*Tài liệu kỹ thuật nội bộ Công ty Cổ phần Tân Bảo Sài Gòn — Cập nhật phiên bản v1.3.5.*
