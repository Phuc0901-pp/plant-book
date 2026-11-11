# ==============================================================================
# TBSG AGTECH - 1-CLICK IOS IPA DEPLOYMENT HELPER (IPHONE / IPAD)
# Hướng dẫn & Hỗ trợ cài đặt Plant Book Mobile ERP (.ipa) lên thiết bị iOS
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  🍎 TBSG AGTECH - CÀI ĐẶT ỨNG DỤNG MOBILE ERP CHO IOS (IPHONE / IPAD)" -ForegroundColor Green
Write-Host "  Phiên bản: Plant Book Mobile ERP v1.3.5 (Build 19)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Green

Write-Host @"
[QUY TẮC BẢO MẬT CỦA APPLE IOS]:
Khác với Android cho phép bật 'Cài đặt nguồn ngoài' để cài file .apk trực tiếp,
hệ sinh thái Apple iOS yêu cầu file .ipa phải được ký định danh (Code Signing)
với một tài khoản Apple ID để có thể cài đặt và mở được trên iPhone/iPad.

Hệ thống cung cấp 3 giải pháp cài đặt chuẩn chỉ nhất hiện nay:
------------------------------------------------------------------------------
"@ -ForegroundColor Yellow

# 1. Tìm file IPA trong thư mục cục bộ
$buildOutputDir = Join-Path $PSScriptRoot "..\build_output"
if (-not (Test-Path $buildOutputDir)) {
    $buildOutputDir = Join-Path $PSScriptRoot "build_output"
}

$ipaFiles = Get-ChildItem -Path $buildOutputDir -Filter "*.ipa" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

if ($ipaFiles -and $ipaFiles.Count -gt 0) {
    $selectedIpa = $ipaFiles[0]
    Write-Host "[✓] Đã tìm thấy gói cài đặt IPA: $($selectedIpa.FullName) ($([math]::Round($selectedIpa.Length / 1MB, 2)) MB)`n" -ForegroundColor Green
} else {
    $downloadUrl = "https://github.com/Phuc0901-pp/plant-book/releases/download/v1.3.5/PlantBook-Mobile-ERP-v1.3.5-ios.ipa"
    Write-Host "[!] File IPA cục bộ chưa có sẵn." -ForegroundColor Yellow
    Write-Host "    Link tải trực tiếp bản IPA mới nhất từ GitHub Release:" -ForegroundColor White
    Write-Host "    $downloadUrl`n" -ForegroundColor Cyan
}

# 2. Kiểm tra công cụ Sideloadly hoặc AltServer trên máy tính
$sideloadlyPath = "$env:ProgramFiles\Sideloadly\sideloadly.exe"
if (-not (Test-Path $sideloadlyPath)) {
    $sideloadlyPath = "${env:ProgramFiles(x86)}\Sideloadly\sideloadly.exe"
}
if (-not (Test-Path $sideloadlyPath)) {
    $sideloadlyPath = "$env:LOCALAPPDATA\Programs\Sideloadly\sideloadly.exe"
}

Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "CÁCH 1: CÀI ĐẶT 1-CLICK QUA SIDELOADLY (KHUYÊN DÙNG CHO NÔNG HỘ & KỸ THUẬT VIÊN)" -ForegroundColor Green
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "1. Tải công cụ Sideloadly (Miễn phí 100%): https://sideloadly.io" -ForegroundColor White
Write-Host "2. Kết nối iPhone/iPad với máy tính qua cáp Lightning / Type-C (Chọn 'Tin cậy máy tính này')." -ForegroundColor White
Write-Host "3. Mở Sideloadly, kéo thả file .ipa vào ô IPA." -ForegroundColor White
Write-Host "4. Nhập Apple ID cá nhân của bạn (dùng để ký chứng chỉ nhà phát triển miễn phí 7 ngày của Apple)." -ForegroundColor White
Write-Host "5. Bấm 'Start' -> Ứng dụng tự động xuất hiện trên màn hình iPhone!" -ForegroundColor Green
Write-Host "6. Trên iPhone: Vào Cài đặt > Cài đặt chung > Quản lý VPN & Thiết bị > Tin cậy tài khoản của bạn.`n" -ForegroundColor Yellow

if (Test-Path $sideloadlyPath) {
    Write-Host "[✓] Phát hiện Sideloadly đã cài đặt tại: $sideloadlyPath" -ForegroundColor Green
    $runNow = Read-Host "Bạn có muốn mở ngay Sideloadly không? (Y/N)"
    if ($runNow -eq "Y" -or $runNow -eq "y") {
        if ($selectedIpa) {
            Start-Process $sideloadlyPath -ArgumentList "`"$($selectedIpa.FullName)`""
        } else {
            Start-Process $sideloadlyPath
        }
    }
}

Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "CÁCH 2: PHÁT HÀNH CHÍNH THỨC QUA APPLE TESTFLIGHT (DOANH NGHIỆP TBSG)" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Nếu CÔNG TY CỔ PHẦN TÂN BẢO SÀI GÒN có tài khoản Apple Developer ($99/năm):" -ForegroundColor White
Write-Host "1. Cung cấp chứng chỉ Apple Distribution Certificate (.p12) và Provisioning Profile (.mobileprovision)." -ForegroundColor Gray
Write-Host "2. Hệ thống CI/CD GitHub Actions sẽ tự động ký chính thức và đẩy thẳng lên TestFlight." -ForegroundColor Gray
Write-Host "3. Nông hộ & nhân viên chỉ cần mở ứng dụng TestFlight trên iPhone bấm 'Cài đặt' như trên App Store.`n" -ForegroundColor White

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  HOÀN TẤT HƯỚNG DẪN TRIỂN KHAI IOS" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
