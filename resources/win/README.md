# Windows Resources

This directory contains Windows-specific resources for the application.

## 7za.exe - 7-Zip Standalone CLI

The `7za.exe` file is required to extract Apple drivers from the iTunes installer on-demand.

### How to Obtain

1. Download 7-Zip Extra from the official website:
   https://www.7-zip.org/download.html

   Look for "7-Zip Extra: standalone console version" (7z*.extra.7z)

2. Extract the archive and copy `7za.exe` to this directory

### License

7-Zip is free software with open source. The unRAR code is under a mixed license with restrictions.
See https://www.7-zip.org/license.txt for full license details.

7za.exe can be freely distributed as part of applications under the LGPL license.

### Alternative

If 7za.exe is not bundled, users will need to have 7-Zip installed on their system
to use the on-demand driver download feature. Otherwise, they can install iTunes
from the Microsoft Store to get the required drivers.

## apple-drivers/

Contains the Apple Mobile Device Support drivers. See the README in that directory.

## libimobiledevice/

Contains the libimobiledevice binaries for iPhone communication.
