/**
 * Platform-Aware Component Wrappers
 *
 * Components that conditionally render children based on the current platform.
 * Use these for platform-specific UI elements.
 */

import React, { ReactNode } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import { Platform } from "../../utils/platform";

interface PlatformOnlyProps {
  /** List of platforms where children should be rendered */
  platforms: Platform[];
  /** Content to render when platform matches */
  children: ReactNode;
  /** Optional fallback content when platform doesn't match */
  fallback?: ReactNode;
}

/**
 * Renders children only on specified platforms.
 * @example
 * <PlatformOnly platforms={['macos']}>
 *   <LocalMessagesButton />
 * </PlatformOnly>
 */
export const PlatformOnly: React.FC<PlatformOnlyProps> = ({
  platforms,
  children,
  fallback = null,
}) => {
  const { platform } = usePlatform();

  if (platforms.includes(platform)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

interface ConvenienceProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only on macOS.
 * @example
 * <MacOSOnly>
 *   <LocalMessagesButton />
 * </MacOSOnly>
 */
export const MacOSOnly: React.FC<ConvenienceProps> = (props) => (
  <PlatformOnly platforms={["macos"]} {...props} />
);

/**
 * Renders children only on Windows.
 * @example
 * <WindowsOnly>
 *   <USBSyncButton />
 * </WindowsOnly>
 */
export const WindowsOnly: React.FC<ConvenienceProps> = (props) => (
  <PlatformOnly platforms={["windows"]} {...props} />
);

/**
 * Renders children only on Linux.
 * @example
 * <LinuxOnly>
 *   <LinuxSpecificComponent />
 * </LinuxOnly>
 */
export const LinuxOnly: React.FC<ConvenienceProps> = (props) => (
  <PlatformOnly platforms={["linux"]} {...props} />
);

/**
 * Renders children on all desktop platforms (macOS, Windows, Linux).
 * @example
 * <DesktopOnly>
 *   <DesktopFeature />
 * </DesktopOnly>
 */
export const DesktopOnly: React.FC<ConvenienceProps> = (props) => (
  <PlatformOnly platforms={["macos", "windows", "linux"]} {...props} />
);
