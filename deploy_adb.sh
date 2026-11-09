#!/usr/bin/env bash
# ==============================================================================
# TBSG AGTECH - 1-CLICK ADB DEPLOYMENT SCRIPT (Linux / macOS)
# Cai dat tu dong Plant Book Mobile ERP (.apk) co chu ky TBSG AgTech qua ADB
# ==============================================================================

set -e

echo "=============================================================================="
echo "  🌱 TBSG AGTECH - CAI DAT UNG DUNG MOBILE ERP QUA ADB (ANDROID)"
echo "  Chu ky phat hanh: CONG TY CO PHAN TAN BAO SAI GON (TBSG AgTech)"
echo "=============================================================================="

# 1. Kiem tra ADB
if ! command -v adb &> /dev/null; then
    echo "[!] Khong tim thay lenh 'adb' trong PATH."
    echo "    Vui long cai dat Android platform-tools hoac them vao PATH."
    exit 1
fi

echo "[1/4] Da tim thay ADB: $(which adb)"

# 2. Kiem tra thiet bi
echo "[2/4] Dang quet thiet bi Android..."
DEVICE=$(adb devices | grep -w "device" | awk '{print $1}' | head -n 1)

if [ -z "$DEVICE" ]; then
    echo "[!] Chua phat hien thiet bi Android ket noi qua USB Debugging."
    echo "    Vui long bat 'Gỡ lỗi USB' tren dien thoai va thu lai."
    exit 1
fi

echo "--> Phat hien thiet bi: $DEVICE"

# 3. Tim file APK
BUILD_DIR="../build_output"
if [ ! -d "$BUILD_DIR" ]; then
    BUILD_DIR="build_output"
fi

APK_FILE=$(ls -t "$BUILD_DIR"/*.apk 2>/dev/null | grep -i "universal" | head -n 1 || true)
if [ -z "$APK_FILE" ]; then
    APK_FILE=$(ls -t "$BUILD_DIR"/*.apk 2>/dev/null | head -n 1 || true)
fi

if [ -z "$APK_FILE" ]; then
    echo "[!] Chua tim thay file APK trong $BUILD_DIR"
    exit 1
fi

echo "--> File duoc chon: $APK_FILE"

# 4. Cai dat qua ADB
echo "[4/4] Dang cai dat len thiet bi $DEVICE..."
adb -s "$DEVICE" install -r -d "$APK_FILE"

echo "✅ CAI DAT THANH CONG!"
echo "--> Dang khoi dong ung dung..."
adb -s "$DEVICE" shell am start -n "com.tanbaocorp.plantbook.mobile_app/.MainActivity" || true
