#Requires -Version 5.1
<#
.SYNOPSIS
    MagicAudit Cleanup Script for Windows
    Removes all app data, caches, and credential entries

.DESCRIPTION
    This script performs a full cleanup of MagicAudit on Windows:
    - Kills any running MagicAudit processes
    - Removes application data from AppData (Roaming and Local)
    - Removes the application from Program Files
    - Clears Windows Credential Manager entries for magic-audit
    - Prints verification status

.NOTES
    Usage: Right-click this file and select "Run with PowerShell"
    Or run from an elevated PowerShell prompt: .\cleanup-windows.ps1
#>

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MagicAudit Cleanup Tool (Windows)"       -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# --- Kill any running MagicAudit processes ---
Write-Host "Stopping MagicAudit if running..."
$processes = Get-Process -Name "MagicAudit" -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  Processes stopped." -ForegroundColor Green
} else {
    Write-Host "  No running processes found." -ForegroundColor Gray
}

# --- Remove application data directories ---
Write-Host "Removing application data..."

$dataPaths = @(
    "$env:APPDATA\magic-audit",
    "$env:APPDATA\Magic Audit",
    "$env:APPDATA\MagicAudit",
    "$env:LOCALAPPDATA\magic-audit",
    "$env:LOCALAPPDATA\Magic Audit",
    "$env:LOCALAPPDATA\MagicAudit"
)

foreach ($path in $dataPaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "  Removed: $path" -ForegroundColor Green
    }
}

# --- Remove the application from Program Files ---
Write-Host "Removing application..."

$appPaths = @(
    "$env:ProgramFiles\MagicAudit",
    "$env:ProgramFiles\Magic Audit",
    "${env:ProgramFiles(x86)}\MagicAudit",
    "${env:ProgramFiles(x86)}\Magic Audit"
)

foreach ($path in $appPaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "  Removed: $path" -ForegroundColor Green
    }
}

# --- Clear Windows Credential Manager entries ---
Write-Host "Removing credential entries..."

# Use cmdkey to list and delete magic-audit credentials
$credTargets = @("magic-audit", "MagicAudit", "magic-audit Safe Storage")
foreach ($target in $credTargets) {
    $result = cmdkey /delete:$target 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Removed credential: $target" -ForegroundColor Green
    }
}

# Also try to remove from the generic credential store via rundll32
# This handles Electron safeStorage credentials
try {
    $creds = cmdkey /list 2>&1 | Select-String -Pattern "magic-audit|MagicAudit" -SimpleMatch
    foreach ($cred in $creds) {
        $line = $cred.ToString().Trim()
        if ($line -match "Target:\s*(.+)") {
            $credName = $Matches[1].Trim()
            cmdkey /delete:$credName 2>&1 | Out-Null
            Write-Host "  Removed credential: $credName" -ForegroundColor Green
        }
    }
} catch {
    # Silently continue if credential enumeration fails
}

# --- Verification ---
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Verification"                             -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$remainingPaths = @()
foreach ($path in ($dataPaths + $appPaths)) {
    if (Test-Path $path) {
        $remainingPaths += $path
    }
}

if ($remainingPaths.Count -eq 0) {
    Write-Host "Status: All MagicAudit data removed" -ForegroundColor Green
} else {
    Write-Host "Warning: Some files may remain:" -ForegroundColor Yellow
    foreach ($path in $remainingPaths) {
        Write-Host "  $path" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Cleanup complete. You can now reinstall MagicAudit." -ForegroundColor Cyan
Write-Host ""
