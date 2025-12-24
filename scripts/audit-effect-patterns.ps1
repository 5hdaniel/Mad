#!/usr/bin/env pwsh
# Audit script for React effect anti-patterns
# Run this periodically to catch potential infinite loop issues

Write-Host "=== React Effect Pattern Audit ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check for callback effects without ref guards
Write-Host "1. Checking for callback effects without ref guards..." -ForegroundColor Yellow
Write-Host "   (useEffect with on*Change/on*Update callbacks that might lack ref protection)" -ForegroundColor Gray
Write-Host ""

$callbackEffects = Get-ChildItem -Path "src" -Recurse -Include "*.tsx" |
    Select-String -Pattern "useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*on[A-Z][a-zA-Z]*\(" |
    Where-Object { $_.Line -notmatch "useRef|\.current" }

if ($callbackEffects) {
    Write-Host "   POTENTIAL ISSUES FOUND:" -ForegroundColor Red
    $callbackEffects | ForEach-Object {
        Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Red
        Write-Host "      $($_.Line.Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host "   No obvious issues found" -ForegroundColor Green
}

Write-Host ""

# 2. Check for flow components returning null without navigation
Write-Host "2. Checking for flow components returning null without navigation..." -ForegroundColor Yellow
Write-Host "   (Files with 'Flow' in name that return null without goToStep)" -ForegroundColor Gray
Write-Host ""

$flowFiles = Get-ChildItem -Path "src" -Recurse -Include "*Flow*.tsx"
$flowIssues = @()

foreach ($file in $flowFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "return\s+null" -and $content -notmatch "goToStep") {
        $flowIssues += $file.FullName
    }
}

if ($flowIssues) {
    Write-Host "   POTENTIAL ISSUES FOUND:" -ForegroundColor Red
    $flowIssues | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Red
    }
} else {
    Write-Host "   No obvious issues found" -ForegroundColor Green
}

Write-Host ""

# 3. Check for incomplete boolean checks in routing
Write-Host "3. Checking for incomplete boolean checks..." -ForegroundColor Yellow
Write-Host "   (needsX patterns that might miss related state checks)" -ForegroundColor Gray
Write-Host ""

$booleanPatterns = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" |
    Select-String -Pattern "const\s+needs[A-Z][a-zA-Z]*\s*=\s*!" |
    Where-Object { $_.Line -notmatch "&&" }

if ($booleanPatterns) {
    Write-Host "   REVIEW THESE (may need additional conditions):" -ForegroundColor Yellow
    $booleanPatterns | ForEach-Object {
        Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Yellow
        Write-Host "      $($_.Line.Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host "   No obvious issues found" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Audit Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: This script catches obvious patterns. Manual review is still required." -ForegroundColor Gray
Write-Host "See PR-SOP.md Phase 2.4 for full anti-pattern documentation." -ForegroundColor Gray
