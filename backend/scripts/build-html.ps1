# Plant Book AgTech (c) 2026 TBSG Agtech - PowerShell HTML Builder
$rootDir = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$frontendDir = Join-Path $rootDir "frontend"
$configPath = Join-Path $rootDir "config\app.config.json"

Write-Host "[build-html.ps1] Reading configuration from: $configPath" -ForegroundColor Cyan
$configJson = Get-Content -Raw -Path $configPath -Encoding UTF8 | ConvertFrom-Json

$versionTag  = $configJson.app.versionTag
$appName     = $configJson.app.name
$copyright   = $configJson.brand.copyright
$owner       = $configJson.brand.owner
$company     = $configJson.brand.company
$userTitle   = $configJson.brand.userPortalTitle
$adminTitle  = $configJson.brand.adminPortalTitle
$swCache     = $configJson.cache.swCacheName

function Apply-Placeholders($content) {
    return $content `
        -replace '\{\{APP_VERSION\}\}', $versionTag `
        -replace '\{\{APP_NAME\}\}', $appName `
        -replace '\{\{APP_COPYRIGHT\}\}', $copyright `
        -replace '\{\{APP_OWNER\}\}', $owner `
        -replace '\{\{COMPANY_NAME\}\}', $company `
        -replace '\{\{USER_PORTAL_TITLE\}\}', $userTitle `
        -replace '\{\{ADMIN_PORTAL_TITLE\}\}', $adminTitle `
        -replace '\{\{SW_CACHE_NAME\}\}', $swCache
}

function Resolve-Includes($filePath, [System.Collections.Generic.HashSet[string]]$seen) {
    if ($seen.Contains($filePath)) {
        return "<!-- Circular include: $filePath -->"
    }
    $seen.Add($filePath) | Out-Null

    if (-not (Test-Path $filePath)) {
        Write-Warning "File not found: $filePath"
        return "<!-- Missing include: $filePath -->"
    }

    $content = Get-Content -Raw -Path $filePath -Encoding UTF8
    $baseDir = Split-Path $filePath -Parent

    # Match <!-- @include '...' -->
    $regex = '<!--\s*@include\s+[''"]([^''"]+)[''"]\s*-->'
    $result = [System.Text.RegularExpressions.Regex]::Replace($content, $regex, {
        param($match)
        $relPath = $match.Groups[1].Value
        $targetPath = [System.IO.Path]::GetFullPath((Join-Path $baseDir $relPath))
        return Resolve-Includes $targetPath (New-Object 'System.Collections.Generic.HashSet[string]' -ArgumentList @(,$seen))
    })

    return $result
}

# 1. Build User Portal
$userTemplate = Join-Path $frontendDir "user\src\index.template.html"
$userOutput   = Join-Path $frontendDir "user\index.html"
if (Test-Path $userTemplate) {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $assembledUser = Resolve-Includes $userTemplate $seen
    $assembledUser = Apply-Placeholders $assembledUser
    [System.IO.File]::WriteAllText($userOutput, $assembledUser, [System.Text.Encoding]::UTF8)
    Write-Host "[build-html.ps1] Successfully built user/index.html ($($assembledUser.Length) bytes)" -ForegroundColor Green
}

# 2. Build Admin Portal
$adminTemplate = Join-Path $frontendDir "admin\src\index.template.html"
$adminOutput   = Join-Path $frontendDir "admin\index.html"
if (Test-Path $adminTemplate) {
    $seenAdmin = New-Object 'System.Collections.Generic.HashSet[string]'
    $assembledAdmin = Resolve-Includes $adminTemplate $seenAdmin
    $assembledAdmin = Apply-Placeholders $assembledAdmin
    [System.IO.File]::WriteAllText($adminOutput, $assembledAdmin, [System.Text.Encoding]::UTF8)
    Write-Host "[build-html.ps1] Successfully built admin/index.html ($($assembledAdmin.Length) bytes)" -ForegroundColor Green
}

Write-Host "[build-html.ps1] All HTML portals assembled and verified." -ForegroundColor Cyan
