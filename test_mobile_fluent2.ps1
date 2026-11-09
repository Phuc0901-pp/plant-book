# ==============================================================================
# TBSG AGTECH - AUTOMATED QC / QA VERIFICATION SUITE FOR MICROSOFT FLUENT 2
# Tests Flutter mobile implementation: Tokens, Lucide Icons, Chibi Weather & Labor
# ==============================================================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$passed = 0
$failed = 0
$totalTests = 0

function Assert-Test {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Details = ""
    )
    $script:totalTests++
    if ($Condition) {
        $script:passed++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "  [FAIL] $Name - $Details" -ForegroundColor Red
    }
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " TBSG AGTECH - MICROSOFT FLUENT 2 MOBILE AUTOMATED QA SUITE" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

$mobileDir = Join-Path $PSScriptRoot "mobile_app\lib"
Assert-Test "Mobile App lib directory exists" (Test-Path $mobileDir)

# -----------------------------------------------------------------------------
# 1. FLUENT 2 THEME & DESIGN TOKENS
# -----------------------------------------------------------------------------
Write-Host "`n1. Kiem tra Microsoft Fluent 2 Design Tokens (utils/theme.dart)..." -ForegroundColor Yellow
$themeFile = Join-Path $mobileDir "utils\theme.dart"
Assert-Test "utils/theme.dart file exists" (Test-Path $themeFile)

if (Test-Path $themeFile) {
    $themeContent = Get-Content $themeFile -Raw -Encoding UTF8
    Assert-Test "Version is v1.3.5" ($themeContent -match "appVersion = 'v1.3.5'")
    Assert-Test "fluentSurface = 0xFFFAF9F8 (Alabaster)" ($themeContent -match "fluentSurface = Color\(0xFFFAF9F8\)")
    Assert-Test "fluentEmerald = 0xFF107C41" ($themeContent -match "fluentEmerald = Color\(0xFF107C41\)")
    Assert-Test "fluentBorder = 0xFFEDEBE9" ($themeContent -match "fluentBorder = Color\(0xFFEDEBE9\)")
    Assert-Test "mintPastel = 0xFFE6F4EA" ($themeContent -match "mintPastel = Color\(0xFFE6F4EA\)")
    Assert-Test "skyPastel = 0xFFE8F0FE" ($themeContent -match "skyPastel = Color\(0xFFE8F0FE\)")
    Assert-Test "butterPastel = 0xFFFEF7E0" ($themeContent -match "butterPastel = Color\(0xFFFEF7E0\)")
    Assert-Test "lavenderPastel = 0xFFF3E8FF" ($themeContent -match "lavenderPastel = Color\(0xFFF3E8FF\)")
    Assert-Test "rosePastel = 0xFFFCE8E6" ($themeContent -match "rosePastel = Color\(0xFFFCE8E6\)")
    Assert-Test "fluentShadow defined" ($themeContent -match "fluentShadow")
    Assert-Test "FluentCard widget provided" ($themeContent -match "class FluentCard extends StatelessWidget")
    Assert-Test "FluentSquircleIcon widget provided" ($themeContent -match "class FluentSquircleIcon extends StatelessWidget")
}

# -----------------------------------------------------------------------------
# 2. LUCIDE ICONS & CUTE CHIBI WEATHER (core/theme/fluent_icons.dart)
# -----------------------------------------------------------------------------
Write-Host "`n2. Kiem tra Thu vien Lucide Icons & Chibi Weather (fluent_icons.dart)..." -ForegroundColor Yellow
$iconsFile = Join-Path $mobileDir "core\theme\fluent_icons.dart"
Assert-Test "core/theme/fluent_icons.dart file exists" (Test-Path $iconsFile)

if (Test-Path $iconsFile) {
    $iconsContent = Get-Content $iconsFile -Raw -Encoding UTF8
    Assert-Test "LucideIcon widget exists" ($iconsContent -match "class LucideIcon extends StatelessWidget")
    Assert-Test "LucideIconName enum contains search, scan, users, droplet, beaker" ($iconsContent -match "users" -and $iconsContent -match "droplet" -and $iconsContent -match "beaker" -and $iconsContent -match "scan")
    Assert-Test "ChibiWeatherWidget exists" ($iconsContent -match "class ChibiWeatherWidget extends StatefulWidget")
    Assert-Test "Chibi Weather types defined" ($iconsContent -match "enum ChibiWeatherType")
    Assert-Test "Chibi Sun cute blushing cheeks (0xFFFB7185)" ($iconsContent -match "0xFFFB7185")
    Assert-Test "Chibi Rain Cloud smiling drawn" ($iconsContent -match "_drawChibiRain")
    Assert-Test "Chibi Humidity drawn" ($iconsContent -match "_drawChibiHumidity")
    Assert-Test "Official Be Mam Mascot widget exists" ($iconsContent -match "class BeMamMascotWidget extends StatefulWidget")
    Assert-Test "Be Mam Mascot breathing animation implemented" ($iconsContent -match "_BeMamPainter")
}

# -----------------------------------------------------------------------------
# 3. VIVA WELCOME BANNER & CHIBI WEATHER (welcome_banner.dart)
# -----------------------------------------------------------------------------
Write-Host "`n3. Kiem tra Microsoft Viva Welcome Banner (welcome_banner.dart)..." -ForegroundColor Yellow
$bannerFile = Join-Path $mobileDir "components\common\welcome_banner.dart"
Assert-Test "welcome_banner.dart file exists" (Test-Path $bannerFile)

if (Test-Path $bannerFile) {
    $bannerContent = Get-Content $bannerFile -Raw -Encoding UTF8
    Assert-Test "Uses Viva pastel gradient (0xFFE6F4EA -> 0xFFFEF9C3)" ($bannerContent -match "0xFFE6F4EA" -and $bannerContent -match "0xFFFEF9C3")
    Assert-Test "Embeds ChibiWeatherWidget" ($bannerContent -match "ChibiWeatherWidget")
    Assert-Test "Embeds BeMamMascotWidget" ($bannerContent -match "BeMamMascotWidget")
    Assert-Test "Supports Pro/Normal badge" ($bannerContent -match "isPro \?" -and $bannerContent -match "NORMAL")
}

# -----------------------------------------------------------------------------
# 4. USER DASHBOARD BENTO GRID & MICA HEADER (user_dashboard_page.dart)
# -----------------------------------------------------------------------------
Write-Host "`n4. Kiem tra User Dashboard Bento Grid & Command Bar..." -ForegroundColor Yellow
$dashFile = Join-Path $mobileDir "pages\user\user_dashboard_page.dart"
Assert-Test "user_dashboard_page.dart file exists" (Test-Path $dashFile)

if (Test-Path $dashFile) {
    $dashContent = Get-Content $dashFile -Raw -Encoding UTF8
    Assert-Test "Fluent Command / Search bar present" ($dashContent -match "_buildFluentSearchBar")
    Assert-Test "Bento Grid 2x2 with Lucide icons" ($dashContent -match "_buildBentoKpiCard" -and $dashContent -match "LucideIconName.sprout" -and $dashContent -match "LucideIconName.dollarSign")
    Assert-Test "Chibi Weather Advisory Card present" ($dashContent -match "_buildWeatherAdvisoryCard" -and $dashContent -match "ChibiWeatherWidget")
    Assert-Test "Quick Actions 4 pastel buttons with Lucide icons" ($dashContent -match "_buildQuickActionButton" -and $dashContent -match "LucideIconName.users")
    Assert-Test "Preserves RBAC finance redaction" ($dashContent -match "RbacPolicy.isFinanceRedacted")
}

# -----------------------------------------------------------------------------
# 5. CARE LOG SHEET & LABOR (NHAN CONG) WORKFLOW (log_edit_dialog.dart)
# -----------------------------------------------------------------------------
Write-Host "`n5. Kiem tra Ghi Nhat Ky & Nghiep Vu Nhan Cong (log_edit_dialog.dart)..." -ForegroundColor Yellow
$logDialogFile = Join-Path $mobileDir "components\log_edit_dialog.dart"
Assert-Test "log_edit_dialog.dart file exists" (Test-Path $logDialogFile)

if (Test-Path $logDialogFile) {
    $logContent = Get-Content $logDialogFile -Raw -Encoding UTF8
    Assert-Test "Consolidates care types into Labor activity" ($logContent -match "_laborWorkContentController" -and $logContent -match "_activityTypes")
    Assert-Test "5 Default blank controllers for Labor exist" (
        $logContent -match "_laborWorkContentController" -and
        $logContent -match "_laborWorkerCountController" -and
        $logContent -match "_laborCostController" -and
        $logContent -match "_laborStartTimeController" -and
        $logContent -match "_laborEndTimeController"
    )
    Assert-Test "6 Quick suggestion chips defined" ($logContent -match "_laborQuickChips = \[" -and $logContent -match "Wrap\(")
    Assert-Test "Worker count and cost on same horizontal row" ($logContent -match "Row" -and $logContent -match "_buildLaborModePill")
    Assert-Test "Real-time calculation & tree allocation preview card" ($logContent -match "_buildLaborCostPreviewCard" -and $logContent -match "_getCalculatedLaborCost")
    Assert-Test "Slide-up bottom sheet drag handle present" ($logContent -match "Drag Handle for Fluent Bottom Sheet" -or $logContent -match "0xFFD1D5DB")
    Assert-Test "Supports Vietnamese voice dictation" ($logContent -match "_toggleVoiceDictation")
}

# -----------------------------------------------------------------------------
# 6. PLANT CARD, LOGS TIMELINE & NAVIGATION BAR
# -----------------------------------------------------------------------------
Write-Host "`n6. Kiem tra Plant Card, User Logs Timeline & UserBottomNav..." -ForegroundColor Yellow
$plantCardFile = Join-Path $mobileDir "components\plant_card.dart"
$userLogsFile = Join-Path $mobileDir "pages\user\user_logs_page.dart"
$navFile = Join-Path $mobileDir "components\navigation\user_bottom_nav.dart"

Assert-Test "plant_card.dart uses LucideIcon" ((Get-Content $plantCardFile -Raw -Encoding UTF8) -match "LucideIcon")
Assert-Test "user_logs_page.dart supports Labor filter and details" ((Get-Content $userLogsFile -Raw -Encoding UTF8) -match "LucideIconName.users" -and (Get-Content $userLogsFile -Raw -Encoding UTF8) -match "workContent")
Assert-Test "user_bottom_nav.dart uses LucideIcon" ((Get-Content $navFile -Raw -Encoding UTF8) -match "LucideIcon")

# -----------------------------------------------------------------------------
# 7. DART SYNTAX & INTEGRITY CHECK (Balanced Braces & Valid Imports)
# -----------------------------------------------------------------------------
Write-Host "`n7. Kiem tra Toan ven cu phap Dart (Syntax Integrity)..." -ForegroundColor Yellow
$allDartFiles = Get-ChildItem -Path $mobileDir -Filter "*.dart" -Recurse

$syntaxErrors = 0
foreach ($file in $allDartFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $openBraces = ($content.ToCharArray() | Where-Object { $_ -eq '{' }).Count
    $closeBraces = ($content.ToCharArray() | Where-Object { $_ -eq '}' }).Count
    if ($openBraces -ne $closeBraces) {
        $syntaxErrors++
        Write-Host "  [FAIL-SYNTAX] Unbalanced braces in $($file.Name): open=$openBraces, close=$closeBraces" -ForegroundColor Red
    }
}
Assert-Test "Tat ca $($allDartFiles.Count) file Dart can bang dau ngoac nhon ({})" ($syntaxErrors -eq 0)

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host " KET QUA KIEM THU AUTOMATED QC/QA: $passed/$totalTests PASS" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
