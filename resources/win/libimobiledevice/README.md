# libimobiledevice Windows Binaries

This directory contains pre-built Windows binaries for libimobiledevice.

## Source

Binaries should be downloaded from the official imobiledevice-net releases:
https://github.com/libimobiledevice-win32/imobiledevice-net/releases

Download the latest `imobiledevice-net-x.x.x-win-x64.zip` release.

## Required Files

Extract and copy the following files to this directory:

### Executables
- `idevice_id.exe` - List connected iOS devices
- `ideviceinfo.exe` - Get device information
- `idevicebackup2.exe` - Create/restore device backups

### Required DLLs
- `libimobiledevice.dll`
- `libplist.dll`
- `libusbmuxd.dll`
- `libcrypto-3-x64.dll` (or similar OpenSSL crypto library)
- `libssl-3-x64.dll` (or similar OpenSSL SSL library)
- `pthreadVC3.dll` (or similar pthreads library)

## Verification

After copying the binaries, verify they work by running:

```cmd
idevice_id.exe --help
```

## License

libimobiledevice is licensed under LGPL-2.1. See `../LIBIMOBILEDEVICE_LICENSE.txt` for the full license text.
