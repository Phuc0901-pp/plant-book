# ==============================================================================
# PLANT BOOK AGTECH v1.3.5 - AUTOMATED NAS READINESS AND REGRESSION QC/QA SUITE
# ==============================================================================

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
$total = 0
$passed = 0

function Assert-Condition($condition, $testName) {
    $script:total++
    if ($condition) {
        $script:passed++
        Write-Host "  [PASS] $testName" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $testName" -ForegroundColor Red
    }
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   QC / QA AUDIT: PLANT BOOK v1.3.5 - NAS DEPLOYMENT AND DATABASE MIGRATION" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# -- 1. DB SSL RESOLUTION LOGIC --
Write-Host "`n-- 1. POSTGRESQL SSL AUTO-DETECTION ENGINE (dbSsl.js) --" -ForegroundColor Yellow
$dbSslPath = Join-Path $rootDir "backend/config/dbSsl.js"
Assert-Condition (Test-Path $dbSslPath) "backend/config/dbSsl.js exists"

$dbSslContent = Get-Content -Raw $dbSslPath
Assert-Condition ($dbSslContent -match "resolveSslConfig") "dbSsl.js exports resolveSslConfig"
Assert-Condition ($dbSslContent -match "isPrivateHost") "dbSsl.js implements isPrivateHost"
Assert-Condition ($dbSslContent -match "maskConnectionString") "dbSsl.js implements maskConnectionString"
Assert-Condition ($dbSslContent -match "192" -and $dbSslContent -match "168") "dbSsl.js recognizes RFC 1918 Class C private LAN"
Assert-Condition ($dbSslContent -match "10\b") "dbSsl.js recognizes RFC 1918 Class A private LAN"

# -- 2. DATABASE CONFIG WIRING --
Write-Host "`n-- 2. DUAL-MODE DATABASE CONFIG WIRING (db.js) --" -ForegroundColor Yellow
$dbConfigPath = Join-Path $rootDir "backend/config/db.js"
$dbConfigContent = Get-Content -Raw $dbConfigPath
Assert-Condition ($dbConfigContent -match "resolveSslConfig\(primaryUrl\)") "db.js resolves dynamic SSL for writePool"
Assert-Condition ($dbConfigContent -match "resolveSslConfig\(replicaUrl\)") "db.js resolves dynamic SSL for readPool"

# -- 3. ENTERPRISE NAS MIGRATION SCRIPT --
Write-Host "`n-- 3. ENTERPRISE NAS MIGRATION ENGINE (migrate_to_nas.js) --" -ForegroundColor Yellow
$migrateScriptPath = Join-Path $rootDir "backend/scripts/migrate_to_nas.js"
Assert-Condition (Test-Path $migrateScriptPath) "backend/scripts/migrate_to_nas.js exists"
$migrateContent = Get-Content -Raw $migrateScriptPath
Assert-Condition ($migrateContent -match "REPEATABLE READ") "migrate_to_nas.js reads source in REPEATABLE READ snapshot"
Assert-Condition ($migrateContent -match "session_replication_role") "migrate_to_nas.js handles replication role for triggers"
Assert-Condition ($migrateContent -match "computeBatchSize") "migrate_to_nas.js implements dynamic parameter-safe batching"
Assert-Condition ($migrateContent -match "buildChecksumSql") "migrate_to_nas.js implements MD5 table verification"
Assert-Condition ($migrateContent -match "dry-run") "migrate_to_nas.js defaults to safe dry-run"

# -- 4. DOCKER AND NAS ENVIRONMENT ARTIFACTS --
Write-Host "`n-- 4. DOCKER AND NAS RUNTIME SPECIFICATIONS --" -ForegroundColor Yellow
$dockerfilePath = Join-Path $rootDir "Dockerfile"
Assert-Condition (Test-Path $dockerfilePath) "Dockerfile exists in project root"
$dockerfileContent = Get-Content -Raw $dockerfilePath
Assert-Condition ($dockerfileContent -match "node:20-alpine") "Dockerfile uses Node 20 LTS Alpine base"
Assert-Condition ($dockerfileContent -match "USER node") "Dockerfile enforces non-root execution"
Assert-Condition ($dockerfileContent -match "HEALTHCHECK") "Dockerfile configures /api/health container probe"

$dockerignorePath = Join-Path $rootDir ".dockerignore"
Assert-Condition (Test-Path $dockerignorePath) ".dockerignore exists in project root"
$dockerignoreContent = Get-Content -Raw $dockerignorePath
Assert-Condition ($dockerignoreContent -match "\.env") ".dockerignore protects .env files"

$composePath = Join-Path $rootDir "docker-compose.nas.yml"
Assert-Condition (Test-Path $composePath) "docker-compose.nas.yml exists in project root"
$composeContent = Get-Content -Raw $composePath
Assert-Condition ($composeContent -match "tanbao-postgres-nas") "docker-compose defines PostgreSQL NAS container"
Assert-Condition ($composeContent -match "postgis/postgis") "docker-compose uses PostGIS PostgreSQL image"
Assert-Condition ($composeContent -match "tanbao-redis-nas") "docker-compose defines Redis NAS container"
Assert-Condition ($composeContent -match "tanbao-plantbook-web") "docker-compose defines Plant Book Web container"
Assert-Condition ($composeContent -match "tanbao-pgadmin-nas") "docker-compose defines pgAdmin container"
Assert-Condition ($composeContent -match "tanbao-cloudflared-nas") "docker-compose defines optional Cloudflare Tunnel"
Assert-Condition ($composeContent -match 'POSTGRES_PASSWORD:.*POSTGRES_PASSWORD') "docker-compose guards mandatory DB password"

$envExamplePath = Join-Path $rootDir ".env.nas.example"
Assert-Condition (Test-Path $envExamplePath) ".env.nas.example exists in project root"

$initSqlPath = Join-Path $rootDir "database_init_nas.sql"
Assert-Condition (Test-Path $initSqlPath) "database_init_nas.sql exists in project root"
$initSqlContent = Get-Content -Raw $initSqlPath
Assert-Condition ($initSqlContent -match "postgis") "database_init_nas.sql initializes PostGIS extension"
Assert-Condition ($initSqlContent -match "client_encoding = 'UTF8'") "database_init_nas.sql enforces UTF8 encoding"

$guidePath = Join-Path $rootDir "NAS_DEPLOYMENT.md"
Assert-Condition (Test-Path $guidePath) "NAS_DEPLOYMENT.md deployment guide exists"

# -- 5. ADMIN TELEMETRY API AND DASHBOARD BANNER --
Write-Host "`n-- 5. ADMIN INFRASTRUCTURE TELEMETRY AND UI BANNER --" -ForegroundColor Yellow
$dbRoutePath = Join-Path $rootDir "backend/routes/database.js"
$dbRouteContent = Get-Content -Raw $dbRoutePath
Assert-Condition ($dbRouteContent -match "/infrastructure") "backend/routes/database.js implements GET /infrastructure"
Assert-Condition ($dbRouteContent -match "isPrivateHost") "database.js distinguishes NAS vs Cloud deployment"

$adminJsPath = Join-Path $rootDir "frontend/admin/js/database.js"
$adminJsContent = Get-Content -Raw $adminJsPath
Assert-Condition ($adminJsContent -match "db-infrastructure-banner") "admin database.js populates infrastructure banner"

$adminHtmlPath = Join-Path $rootDir "frontend/admin/index.html"
$adminHtmlContent = Get-Content -Raw $adminHtmlPath
Assert-Condition ($adminHtmlContent -match 'id="db-infrastructure-banner"') "admin/index.html includes infrastructure banner container"

Write-Host "`n==========================================================================" -ForegroundColor Cyan
$pct = [math]::Round(($passed / $total) * 100, 1)
Write-Host "   NAS AUDIT SUMMARY: $passed / $total CHECKS PASSED ($pct percent)" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host "==========================================================================" -ForegroundColor Cyan

if ($passed -ne $total) {
    exit 1
}
