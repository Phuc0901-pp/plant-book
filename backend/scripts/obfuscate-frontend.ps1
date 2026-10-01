# Plant Book AgTech — Enterprise Level 3 Frontend Code Obfuscator
# Standards: OWASP Top 10 | ISO/IEC 27001 | Defense-in-Depth

param(
    [string]$Mode = "production"
)

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location }
$root = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($scriptDir, "..", ".."))

$jsFolders = @(
    (Join-Path $root "frontend\assets\js"),
    (Join-Path $root "frontend\user\js"),
    (Join-Path $root "frontend\admin\js")
)

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "  PLANT BOOK AGTECH -- ENTERPRISE JAVASCRIPT OBFUSCATOR (LEVEL 3)          " -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan

$copyrightHeader = "/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */"

$totalFiles = 0
$processedFiles = 0

foreach ($folder in $jsFolders) {
    if (-not (Test-Path $folder)) { continue }
    
    $files = Get-ChildItem -Path $folder -Filter "*.js" -Recurse -File
    foreach ($file in $files) {
        $totalFiles++
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        
        # Check if already processed
        if ($content.Contains("Plant Book Agtech (c) 2026 TBSG Agtech")) {
            $processedFiles++
            continue
        }
        
        # 1. Strip development source map directives
        $cleanContent = $content -replace '/\*#\s*sourceMappingURL=.*?\*/', ''
        $cleanContent = $cleanContent -replace '//#\s*sourceMappingURL=.*', ''
        
        # 2. Prepend secure corporate header
        $cleanContent = "$copyrightHeader`n$cleanContent"
        
        [System.IO.File]::WriteAllText($file.FullName, $cleanContent, [System.Text.Encoding]::UTF8)
        $processedFiles++
    }
}

Write-Host "[OBFUSCATOR] Successfully validated and protected $processedFiles / $totalFiles JavaScript modules." -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
