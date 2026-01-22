# BACKLOG-374: Add App Logo and Branding

**Created**: 2026-01-21
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

The app currently doesn't have proper logo/branding - it uses the default Electron icon. Need to add a custom logo throughout the app including the app icon, header, loading screen, and about screen.

## User Story

As a user, I want to see a professional branded app with a custom logo, so that the application feels polished and trustworthy for professional real estate auditing work.

## Current Behavior

- App shows default Electron icon in dock (Mac) / taskbar (Windows)
- No logo in app header
- No logo on loading/splash screen
- No logo on about screen

## Desired Behavior

- Custom Magic Audit logo in dock/taskbar
- Logo visible in app header or title area
- Logo displayed during app startup/loading
- Logo on the about/settings page
- (Optional) Logo on exported PDFs/audit packages

## Feature Requirements

1. **App Icon** - Logo for dock (Mac) / taskbar (Windows) / desktop shortcut
2. **Title Bar/Header** - Logo in the app header or title area
3. **Loading/Splash Screen** - Logo displayed during app startup
4. **About Screen** - Logo on the about/settings page
5. **Export Branding** - Logo on exported PDFs/audit packages (optional/stretch goal)

## Technical Approach

### Icon Sizes Required

Multiple icon sizes needed for different contexts:
- 16x16 (small icons, menus)
- 32x32 (small taskbar)
- 64x64 (medium icons)
- 128x128 (large icons)
- 256x256 (Windows, high-DPI)
- 512x512 (macOS dock)
- 1024x1024 (macOS App Store, high-DPI)

### Platform-Specific Formats

| Platform | Format | Tool/Process |
|----------|--------|--------------|
| Windows | `.ico` (multi-resolution) | Use `icon-gen` or similar to create ICO with all sizes |
| macOS | `.icns` | Use `iconutil` or `makeicns` to create ICNS bundle |
| In-app | `.svg` | Scalable for any size, clean rendering |
| Fallback | `.png` | Various sizes for web/renderer contexts |

### Electron Configuration

```javascript
// electron-builder.config.js or package.json
{
  "build": {
    "appId": "com.magicaudit.app",
    "mac": {
      "icon": "build/icons/icon.icns"
    },
    "win": {
      "icon": "build/icons/icon.ico"
    },
    "linux": {
      "icon": "build/icons"  // folder with PNG files
    }
  }
}
```

### In-App Logo Component

```tsx
// src/components/common/Logo.tsx
interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className }) => {
  const sizes = { sm: 24, md: 48, lg: 96 };
  return (
    <img
      src="/assets/logo.svg"
      alt="Magic Audit"
      width={sizes[size]}
      height={sizes[size]}
      className={className}
    />
  );
};
```

## Files to Create/Modify

| File | Change |
|------|--------|
| `build/icons/icon.icns` | macOS app icon |
| `build/icons/icon.ico` | Windows app icon |
| `build/icons/*.png` | PNG icons at various sizes |
| `src/assets/logo.svg` | In-app SVG logo |
| `src/assets/logo-*.png` | PNG fallbacks |
| `src/components/common/Logo.tsx` | Reusable logo component |
| `electron-builder.config.js` | Icon configuration |
| `src/components/AppShell.tsx` | Add logo to header |
| `src/components/LoadingScreen.tsx` | Add logo to loading screen |
| `src/components/Settings.tsx` | Add logo to about section |

## Acceptance Criteria

- [ ] App has custom icon in dock (Mac) - not default Electron icon
- [ ] App has custom icon in taskbar (Windows)
- [ ] Logo visible in app header
- [ ] Logo displayed on loading/splash screen
- [ ] Logo on about/settings page
- [ ] Logo assets properly sized for all platforms (Mac + Windows)
- [ ] SVG logo available for in-app scalable use

## Estimate

~25K-40K tokens

- Icon generation and configuration: ~10K
- Logo component creation: ~5K
- Integration into header/loading/about screens: ~10K-15K
- Testing across platforms: ~5K-10K

## Dependencies

- Logo design asset (SVG source file) must be provided
- Design review/approval before implementation

## Notes

- This is a polish/branding task, not a functional blocker
- Recommend getting logo design finalized before starting implementation
- Consider accessibility (logo should work on both light and dark backgrounds if dark mode is planned)
- ICO files should contain multiple resolutions in a single file for Windows compatibility
- See BACKLOG-028 which was a placeholder for this work

## Related

- BACKLOG-028: Create App Logo & Branding (original placeholder)
- BACKLOG-006: Dark Mode (logo should work with both themes)
