# Apple Mobile Device Support Drivers

This directory should contain the Apple Mobile Device Support MSI installer.

## How to Obtain

1. Download iTunes installer from Apple:
   https://www.apple.com/itunes/download/win64

2. Extract the MSI from the iTunes installer:
   ```cmd
   # Using 7-Zip or similar
   7z x iTunes64Setup.exe -oextracted

   # Or use Windows built-in expand command
   expand iTunes64Setup.exe -F:* extracted
   ```

3. Copy `AppleMobileDeviceSupport64.msi` to this directory

## Required File

- `AppleMobileDeviceSupport64.msi` - The Apple Mobile Device Support installer

## What This Contains

The Apple Mobile Device Support package includes:
- USB drivers for iPhone/iPad/iPod communication
- Apple Mobile Device Service (background service)
- usbaapl64.sys driver

## Licensing Note

These drivers are Apple's proprietary software. By including them in your installer:

1. The user must consent to installation (we show a prompt)
2. Apple's license terms apply to the drivers
3. We are facilitating installation at user's request, not redistributing

## Alternative

If bundled drivers are not available, users will be prompted to:
1. Install iTunes from Microsoft Store, OR
2. Download iTunes from apple.com

Both options install the required drivers automatically.

## CI/CD Integration

To automate driver extraction in CI/CD:

```yaml
# GitHub Actions example
- name: Download iTunes
  run: |
    curl -L -o iTunes64Setup.exe "https://www.apple.com/itunes/download/win64"
    7z x iTunes64Setup.exe -oextracted
    cp extracted/AppleMobileDeviceSupport64.msi resources/win/apple-drivers/
```
