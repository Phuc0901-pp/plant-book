# Automated QC/QA Verification Script for RBAC & Role-Adaptive Architecture (v1.3.5)
$rootDir = (Get-Item $PSScriptRoot).FullName
$userHtml = Join-Path $rootDir "frontend\user\index.html"
$suppliesJs = Join-Path $rootDir "frontend\user\js\supplies.js"
$logsJs = Join-Path $rootDir "frontend\user\js\modules\logs.js"
$settingsJs = Join-Path $rootDir "frontend\user\js\modules\settings.js"
$appJs = Join-Path $rootDir "frontend\user\js\app.js"
$routerJs = Join-Path $rootDir "frontend\user\js\core\router.js"
$backendPlants = Join-Path $rootDir "backend\routes\plants.js"
$backendSupplies = Join-Path $rootDir "backend\routes\supplies.js"
$appConfig = Join-Path $rootDir "config\app.config.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   QC / QA VERIFICATION SUITE - PLANT BOOK AGTECH v1.3.5  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$passed = 0
$total = 0

function Assert-Contains($filePath, $pattern, $testName) {
    $script:total++
    if (-not (Test-Path $filePath)) {
        Write-Host "[FAIL] $testName : File not found ($filePath)" -ForegroundColor Red
        return
    }
    $content = Get-Content -Raw -Path $filePath -Encoding UTF8
    if ($content -match $pattern) {
        Write-Host "[PASS] $testName" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "[FAIL] $testName : Pattern not matched ($pattern)" -ForegroundColor Red
    }
}

# --- REQUIREMENT 1: Supplies & Inventory Role-Adaptive UI & Defense-in-depth ---
Assert-Contains $suppliesJs "applySuppliesRoleArchitecture" "Supplies.js has applySuppliesRoleArchitecture"
Assert-Contains $suppliesJs "isFinanceRedacted" "Supplies.js checks isFinanceRedacted"
Assert-Contains $suppliesJs "canDeleteUsage" "Supplies.js enforces canDeleteUsage on usages"
Assert-Contains $backendSupplies "isSupplyFinanceRedacted" "Backend supplies.js has isSupplyFinanceRedacted"
Assert-Contains $backendSupplies "lastReconcileByUserMap" "Backend supplies.js has autoReconcile throttle optimization"
Assert-Contains $backendSupplies "care_worker.*auditor_readonly" "Backend supplies.js blocks write permissions for care_worker and auditor"
Assert-Contains $userHtml "supplies-role-architecture-banner" "Compiled user/index.html includes supplies role architecture banner"
Assert-Contains $userHtml "th-supply-unit-price" "Compiled user/index.html has dynamic unit price th"

# --- REQUIREMENT 2: Care History / Logs assigned scope & Finance redaction ---
Assert-Contains $logsJs "applyLogsRoleArchitecture" "Logs.js has applyLogsRoleArchitecture"
Assert-Contains $logsJs "viewPlantsScope === 'assigned'" "Logs.js filters logs by assigned plants"
Assert-Contains $logsJs "isFinanceRedacted && detailsStr" "Logs.js strips revenue/costs from detailsStr when redacted"
Assert-Contains $logsJs "canDelete" "Logs.js restricts deleteCareLog & deleteDayLogs"
Assert-Contains $backendPlants "isUserFinanceRedacted" "Backend plants.js has isUserFinanceRedacted"
Assert-Contains $backendPlants "sanitizeLogRowForUser" "Backend plants.js has sanitizeLogRowForUser"
Assert-Contains $backendPlants "p\.assigned_to_user_id" "Backend plants.js scopes recent logs to assigned user"
Assert-Contains $userHtml "logs-role-scope-banner" "Compiled user/index.html has logs-role-scope-banner"

# --- REQUIREMENT 3: Guide / Wiki Role-Adaptive SOP ---
Assert-Contains $userHtml "btn-wiki-sub-roles" "Compiled user/index.html has btn-wiki-sub-roles subtab"
Assert-Contains $userHtml "guide-role-pane-owner" "Compiled user/index.html has farm_owner guide pane"
Assert-Contains $userHtml "guide-role-pane-manager" "Compiled user/index.html has manager guide pane"
Assert-Contains $userHtml "guide-role-pane-worker" "Compiled user/index.html has care_worker guide pane"
Assert-Contains $userHtml "guide-role-pane-auditor" "Compiled user/index.html has auditor_readonly guide pane"
Assert-Contains $appJs "selectGuideRole" "App.js implements selectGuideRole"
Assert-Contains $appJs "initGuideRoleView" "App.js implements initGuideRoleView"
Assert-Contains $routerJs "targetPage === 'wiki'" "Router.js triggers wiki role initialization"

# --- REQUIREMENT 4: Settings sub-account restrictions ---
Assert-Contains $settingsJs "isSubAccount" "Settings.js checks isSubAccount"
Assert-Contains $settingsJs "btnThresholds\.style\.display = 'none'" "Settings.js hides thresholds tab for sub-accounts"
Assert-Contains $settingsJs "btnTeamRbac\.style\.display = 'none'" "Settings.js hides team rbac tab for sub-accounts"
Assert-Contains $settingsJs "settings-subaccount-privilege-card" "Settings.js renders subaccount privilege card"
Assert-Contains $userHtml "settings-subaccount-privilege-card" "Compiled user/index.html has settings privilege card container"

# --- REQUIREMENT 5: Performance & App Version 1.3.5 ---
Assert-Contains $appConfig '"version": "1.3.5"' "App config is bumped to version 1.3.5"
Assert-Contains $userHtml "v1.3.5" "Compiled user/index.html reflects version 1.3.5"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SUMMARY: $passed / $total TESTS PASSED ($([math]::Round(($passed/$total)*100, 1))%)" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host "==========================================================" -ForegroundColor Cyan
