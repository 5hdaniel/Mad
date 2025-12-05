# Test Apple Driver Extraction Script
# Run this to verify the CI/CD extraction will work

Write-Host "=== Testing Apple Driver Extraction ===" -ForegroundColor Cyan

# Variables
$iTunesUrl = "https://www.apple.com/itunes/download/win64"
$installerPath = "$env:TEMP\iTunes64Setup.exe"
$extractPath = "$env:TEMP\iTunes-extracted"
$targetPath = "resources\win\apple-drivers"

# Download
Write-Host "Downloading iTunes installer (~200MB)..." -ForegroundColor Yellow
Write-Host "URL: $iTunesUrl"
Invoke-WebRequest -Uri $iTunesUrl -OutFile $installerPath -UseBasicParsing
$size = [math]::Round((Get-Item $installerPath).Length / 1MB, 2)
Write-Host "Download complete. Size: $size MB" -ForegroundColor Green

# Extract
Write-Host "Extracting with 7-Zip..." -ForegroundColor Yellow
& "C:\Program Files\7-Zip\7z.exe" x $installerPath -o"$extractPath" -y

# Find MSI
Write-Host "Looking for AppleMobileDeviceSupport MSI..." -ForegroundColor Yellow
$msi = Get-ChildItem -Path $extractPath -Recurse -Filter "AppleMobileDeviceSupport*.msi" | Select-Object -First 1

if ($msi) {
    Write-Host "Found: $($msi.FullName)" -ForegroundColor Green

    # Create target directory
    New-Item -ItemType Directory -Force -Path $targetPath | Out-Null

    # Copy MSI
    Copy-Item $msi.FullName -Destination "$targetPath\AppleMobileDeviceSupport64.msi"

    # Create version file
    $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($msi.FullName).FileVersion
    if (-not $version) { $version = "unknown" }
    Set-Content -Path "$targetPath\version.txt" -Value $version

    Write-Host ""
    Write-Host "=== SUCCESS ===" -ForegroundColor Green
    Write-Host "MSI copied to: $targetPath\AppleMobileDeviceSupport64.msi"
    Write-Host "Version: $version"

    # Show files
    Write-Host ""
    Write-Host "Files in ${targetPath}:" -ForegroundColor Cyan
    Get-ChildItem $targetPath
} else {
    Write-Host "ERROR: MSI not found!" -ForegroundColor Red
    Write-Host "Extracted contents:"
    Get-ChildItem -Path $extractPath -Recurse | Select-Object FullName
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up temp files..." -ForegroundColor Yellow
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green
