# ==============================================================================
# TBSG AGTECH - 1-CLICK ADB DEPLOYMENT SCRIPT
# Cài đặt tự động Plant Book Mobile ERP (.apk) có chữ ký TBSG AgTech qua ADB
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  🌱 TBSG AGTECH - CÀI ĐẶT ỨNG DỤNG MOBILE ERP QUA ADB (ANDROID)" -ForegroundColor Green
Write-Host "  Chữ ký phát hành: CONG TY CO PHAN TAN BAO SAI GON (TBSG AgTech)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Green

# 1. Tìm kiếm công cụ ADB
$adbPath = $null
$possibleAdbPaths = @(
    "adb",
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ProgramFiles\Android\platform-tools\adb.exe",
    "C:\Android\platform-tools\adb.exe",
    "$PSScriptRoot\platform-tools\adb.exe"
)

foreach ($path in $possibleAdbPaths) {
    try {
        $testResult = & $path version 2>$null
        if ($LASTEXITCODE -eq 0) {
            $adbPath = $path
            break
        }
    } catch {}
}

if (-not $adbPath) {
    Write-Host "`n[!] Không tìm thấy công cụ 'adb' trong hệ thống." -ForegroundColor Yellow
    Write-Host "    Hướng dẫn cài đặt nhanh Android Platform Tools (ADB):" -ForegroundColor White
    Write-Host "    1. Tải bộ công cụ ADB tại: https://developer.android.com/tools/releases/platform-tools" -ForegroundColor Gray
    Write-Host "    2. Giải nén vào thư mục C:\Android\platform-tools hoặc thêm vào PATH." -ForegroundColor Gray
    Write-Host "`n    Hoặc cài đặt tự động bằng lệnh winget:" -ForegroundColor Cyan
    Write-Host "    winget install Google.PlatformTools" -ForegroundColor Cyan
    Write-Host "`n[INFO] Nếu bạn muốn cài trực tiếp trên điện thoại:" -ForegroundColor Yellow
    Write-Host "    Tải file APK từ thư mục 'build_output/' và chép vào điện thoại để cài đặt trực tiếp!" -ForegroundColor White
    exit 1
}

Write-Host "[1/4] Đã tìm thấy ADB: $adbPath" -ForegroundColor Green

# 2. Kiểm tra thiết bị Android kết nối qua cáp USB / Wi-Fi
Write-Host "`n[2/4] Đang quét thiết bị Android kết nối qua USB/Wi-Fi..." -ForegroundColor Yellow
& $adbPath devices | Out-Host

$devicesRaw = & $adbPath devices
$deviceList = @()
foreach ($line in $devicesRaw) {
    if ($line -match "^\s*([a-zA-Z0-9_\.\:\-]+)\s+device\s*$") {
        $deviceList += $matches[1]
    }
}

if ($deviceList.Count -eq 0) {
    Write-Host "`n[!] Chưa phát hiện thiết bị Android nào được kết nối và cấp quyền." -ForegroundColor Yellow
    Write-Host "    Vui lòng kiểm tra:" -ForegroundColor White
    Write-Host "    1. Đã cắm cáp USB kết nối điện thoại với máy tính." -ForegroundColor Gray
    Write-Host "    2. Đã bật 'Tùy chọn cho nhà phát triển' (Developer Options)." -ForegroundColor Gray
    Write-Host "    3. Đã bật 'Gỡ lỗi USB' (USB Debugging)." -ForegroundColor Gray
    Write-Host "    4. Mở màn hình điện thoại và chọn 'Luôn cho phép gỡ lỗi USB từ máy tính này'." -ForegroundColor Gray
    exit 1
}

$targetDevice = $deviceList[0]
Write-Host "--> Phát hiện thiết bị: $targetDevice (Tổng số: $($deviceList.Count))" -ForegroundColor Green

# 3. Tìm file APK release có chữ ký TBSG Agtech
Write-Host "`n[3/4] Tìm kiếm gói cài đặt .apk có chữ ký TBSG AgTech..." -ForegroundColor Yellow

$buildOutputDir = Join-Path $PSScriptRoot "..\build_output"
if (-not (Test-Path $buildOutputDir)) {
    $buildOutputDir = Join-Path $PSScriptRoot "build_output"
}

$apkFiles = Get-ChildItem -Path $buildOutputDir -Filter "*.apk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

if (-not $apkFiles -or $apkFiles.Count -eq 0) {
    Write-Host "[!] Chưa tìm thấy file .apk trong $buildOutputDir" -ForegroundColor Yellow
    Write-Host "    Hệ thống CI/CD GitHub Actions đang đóng gói bản phát hành có chữ ký." -ForegroundColor White
    Write-Host "    Bạn có thể tải file APK mới nhất từ mục GitHub Releases:" -ForegroundColor Cyan
    Write-Host "    https://github.com/Phuc0901-pp/plant-book/releases" -ForegroundColor Cyan
    exit 1
}

# Ưu tiên Universal hoặc ARM64
$selectedApk = $apkFiles | Where-Object { $_.Name -match "universal" } | Select-Object -First 1
if (-not $selectedApk) {
    $selectedApk = $apkFiles | Where-Object { $_.Name -match "arm64" } | Select-Object -First 1
}
if (-not $selectedApk) {
    $selectedApk = $apkFiles[0]
}

Write-Host "--> File được chọn: $($selectedApk.Name) ($([math]::Round($selectedApk.Length / 1MB, 2)) MB)" -ForegroundColor Green

# 4. Tiến hành cài đặt ứng dụng qua ADB
Write-Host "`n[4/4] Đang cài đặt gói ứng dụng lên thiết bị $targetDevice..." -ForegroundColor Yellow
Write-Host "    Lệnh thực thi: adb -s $targetDevice install -r -d `"$($selectedApk.FullName)`"" -ForegroundColor Gray

& $adbPath -s $targetDevice install -r -d "$($selectedApk.FullName)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n==============================================================================" -ForegroundColor Green
    Write-Host "  ✅ CÀI ĐẶT THÀNH CÔNG PLANT BOOK MOBILE ERP (TBSG AGTECH)!" -ForegroundColor Green
    Write-Host "==============================================================================" -ForegroundColor Green

    # Tự động mở ứng dụng trên điện thoại
    Write-Host "`n--> Đang khởi động ứng dụng trên điện thoại..." -ForegroundColor Cyan
    & $adbPath -s $targetDevice shell am start -n "com.tanbaocorp.plantbook.mobile_app/.MainActivity" 2>$null
    Write-Host "--> Ứng dụng đã được mở trên màn hình thiết bị!" -ForegroundColor Green
} else {
    Write-Host "`n[FAIL] Quá trình cài đặt qua ADB gặp lỗi (Mã thoát: $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "Vui lòng mở màn hình điện thoại và bấm 'Cho phép cài đặt từ nguồn tin cậy' nếu có thông báo bảo mật." -ForegroundColor Yellow
}
