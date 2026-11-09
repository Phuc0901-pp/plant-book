# ══════════════════════════════════════════════════════════════════════
# Plant Book AgTech — Container ứng dụng Web (Backend API + Frontend)
# Dùng cho NAS công ty (Synology / QNAP / TrueNAS / Ubuntu Server)
# Build: docker compose -f docker-compose.nas.yml --env-file .env.nas build
# ══════════════════════════════════════════════════════════════════════
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=10000 \
    STORAGE_DRIVER=local \
    TZ=Asia/Ho_Chi_Minh

RUN apk add --no-cache tzdata

WORKDIR /app

# 1. Cài thư viện trước (tận dụng cache Docker khi chỉ sửa code)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# 2. Mã nguồn
COPY config ./config
COPY scripts ./scripts
COPY frontend ./frontend
COPY backend ./backend

# 3. Lắp ráp HTML từ các template modular + thư mục ảnh tải lên (mount volume NAS)
RUN cd backend && node scripts/build-html.js \
 && mkdir -p /app/frontend/assets/uploads /app/build_output \
 && chown -R node:node /app/frontend /app/build_output

# 4. Chạy bằng user không phải root
USER node
WORKDIR /app/backend
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "--dns-result-order=ipv4first", "server.js"]
