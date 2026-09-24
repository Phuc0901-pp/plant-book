$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location }
$root = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($scriptDir, "..", ".."))
if (-not (Test-Path (Join-Path $root "frontend"))) {
    $root = Get-Location
}

function Resolve-Includes {
    param(
        [string]$FilePath,
        [System.Collections.Generic.HashSet[string]]$Seen
    )
    if ($Seen.Contains($FilePath)) {
        Write-Warning "Circular include detected: $FilePath"
        return "<!-- Circular include: $FilePath -->"
    }
    [void]$Seen.Add($FilePath)

    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $FilePath"
        return "<!-- Missing include: $FilePath -->"
    }

    $content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    $baseDir = Split-Path $FilePath

    $regex = [regex]'<!--\s*@include\s+[''"]([^''"]+)[''"]\s*-->'
    $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)
        $incPath = $match.Groups[1].Value
        $targetPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($baseDir, $incPath))
        return Resolve-Includes -FilePath $targetPath -Seen (New-Object 'System.Collections.Generic.HashSet[string]' (,$Seen))
    }

    return $regex.Replace($content, $evaluator)
}

function Apply-Placeholders {
    param(
        [string]$Content,
        $Config
    )
    $versionTag = if ($Config.app.versionTag) { $Config.app.versionTag } else { "v" + $Config.app.version }
    $appName = if ($Config.app.name) { $Config.app.name } else { "Sổ Nông Tân Bảo Agtech" }
    $copyright = if ($Config.brand.copyright) { $Config.brand.copyright } else { "Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech" }
    $owner = if ($Config.brand.owner) { $Config.brand.owner } else { "TBSG Agtech © 2026" }
    $company = if ($Config.brand.company) { $Config.brand.company } else { "TBSG Agtech" }
    $userTitle = if ($Config.brand.userPortalTitle) { $Config.brand.userPortalTitle } else { "$appName $versionTag" }
    $adminTitle = if ($Config.brand.adminPortalTitle) { $Config.brand.adminPortalTitle } else { "$appName $versionTag - Admin" }
    $swCache = if ($Config.cache.swCacheName) { $Config.cache.swCacheName } else { "pb-farmer-cache-$versionTag" }

    $res = $Content.Replace("{{APP_VERSION}}", $versionTag)
    $res = $res.Replace("{{APP_NAME}}", $appName)
    $res = $res.Replace("{{APP_COPYRIGHT}}", $copyright)
    $res = $res.Replace("{{APP_OWNER}}", $owner)
    $res = $res.Replace("{{COMPANY_NAME}}", $company)
    $res = $res.Replace("{{USER_PORTAL_TITLE}}", $userTitle)
    $res = $res.Replace("{{ADMIN_PORTAL_TITLE}}", $adminTitle)
    $res = $res.Replace("{{SW_CACHE_NAME}}", $swCache)
    return $res
}

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location }
$root = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($scriptDir, "..", ".."))
if (-not (Test-Path (Join-Path $root "frontend"))) {
    $root = Get-Location
}

$configPath = Join-Path $root "config\app.config.json"
$config = $null
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $config = @{
        app = @{ name = "Plant Book Agtech"; version = "1.2.4"; versionTag = "v1.2.4" };
        brand = @{
            copyright = "Plant Book (c) 2026 TBSG Agtech";
            company = "TBSG Agtech";
            userPortalTitle = "Plant Book Agtech v1.2.4";
            adminPortalTitle = "Plant Book Agtech v1.2.4 - Admin"
        };
        cache = @{ swCacheName = "pb-farmer-cache-v1.2.4" }
    }
}

# Build Admin
$adminTpl = Join-Path $root "frontend\admin\src\index.template.html"
$adminOut = Join-Path $root "frontend\admin\index.html"
if (Test-Path $adminTpl) {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $assembled = Resolve-Includes -FilePath $adminTpl -Seen $seen
    $assembled = Apply-Placeholders -Content $assembled -Config $config
    [System.IO.File]::WriteAllText($adminOut, $assembled, [System.Text.Encoding]::UTF8)
    Write-Host "[build-html] Built admin/index.html ($($assembled.Length) bytes, $(($assembled -split "`n").Count) lines)"
}

# Build User
$userTpl = Join-Path $root "frontend\user\src\index.template.html"
$userOut = Join-Path $root "frontend\user\index.html"
if (Test-Path $userTpl) {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $assembled = Resolve-Includes -FilePath $userTpl -Seen $seen
    $assembled = Apply-Placeholders -Content $assembled -Config $config
    [System.IO.File]::WriteAllText($userOut, $assembled, [System.Text.Encoding]::UTF8)
    Write-Host "[build-html] Built user/index.html ($($assembled.Length) bytes, $(($assembled -split "`n").Count) lines)"
}

Write-Host "[build-html] All HTML portals assembled successfully."
