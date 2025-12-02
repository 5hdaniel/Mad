# libimobiledevice Binaries for Windows

This directory should contain pre-built libimobiledevice binaries for Windows.

## Required Binaries

Download the following binaries from the official releases:
https://github.com/libimobiledevice-win32/imobiledevice-net/releases

### Executables
- `idevice_id.exe` - List connected iOS devices
- `ideviceinfo.exe` - Get device information
- `idevicebackup2.exe` - Create/restore iOS backups

### Required DLLs
- `libimobiledevice.dll`
- `libplist.dll`
- `libusbmuxd.dll`
- `libssl-3-x64.dll` (OpenSSL)
- `libcrypto-3-x64.dll` (OpenSSL)
- `vcruntime140.dll` (Visual C++ Runtime)
- Other dependencies as needed

## Installation Instructions

1. Go to https://github.com/libimobiledevice-win32/imobiledevice-net/releases
2. Download the latest release ZIP (e.g., `iMobileDevice-v1.3.x-win-x64.zip`)
3. Extract the contents
4. Copy the required `.exe` and `.dll` files to this directory

## License

These binaries are distributed under the LGPL-2.1 license.
See `../LIBIMOBILEDEVICE_LICENSE.txt` for the full license text.

## Verification

After placing binaries, verify they work by running:
```
idevice_id.exe --help
```

This should display the help text without errors.
