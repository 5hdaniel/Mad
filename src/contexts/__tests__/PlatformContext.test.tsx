/**
 * Tests for PlatformContext
 * Verifies platform context provider and hook functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlatformProvider, usePlatform } from '../PlatformContext';

// Store original window.electron
const originalElectron = window.electron;

// Test component that uses usePlatform
function TestPlatformConsumer() {
  const platform = usePlatform();
  return (
    <div>
      <span data-testid="platform">{platform.platform}</span>
      <span data-testid="is-macos">{platform.isMacOS.toString()}</span>
      <span data-testid="is-windows">{platform.isWindows.toString()}</span>
      <span data-testid="is-linux">{platform.isLinux.toString()}</span>
      <span data-testid="local-messages">{platform.isFeatureAvailable('localMessagesAccess').toString()}</span>
      <span data-testid="usb-sync">{platform.isFeatureAvailable('iPhoneUSBSync').toString()}</span>
      <span data-testid="email">{platform.isFeatureAvailable('emailIntegration').toString()}</span>
    </div>
  );
}

describe('PlatformContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, 'electron', {
      value: originalElectron,
      writable: true,
      configurable: true,
    });
  });

  describe('PlatformProvider', () => {
    it('should provide macOS context when platform is darwin', () => {
      Object.defineProperty(window, 'electron', {
        value: { platform: 'darwin' },
        writable: true,
        configurable: true,
      });

      render(
        <PlatformProvider>
          <TestPlatformConsumer />
        </PlatformProvider>
      );

      expect(screen.getByTestId('platform').textContent).toBe('macos');
      expect(screen.getByTestId('is-macos').textContent).toBe('true');
      expect(screen.getByTestId('is-windows').textContent).toBe('false');
      expect(screen.getByTestId('is-linux').textContent).toBe('false');
      expect(screen.getByTestId('local-messages').textContent).toBe('true');
      expect(screen.getByTestId('usb-sync').textContent).toBe('false');
      expect(screen.getByTestId('email').textContent).toBe('true');
    });

    it('should provide Windows context when platform is win32', () => {
      Object.defineProperty(window, 'electron', {
        value: { platform: 'win32' },
        writable: true,
        configurable: true,
      });

      render(
        <PlatformProvider>
          <TestPlatformConsumer />
        </PlatformProvider>
      );

      expect(screen.getByTestId('platform').textContent).toBe('windows');
      expect(screen.getByTestId('is-macos').textContent).toBe('false');
      expect(screen.getByTestId('is-windows').textContent).toBe('true');
      expect(screen.getByTestId('is-linux').textContent).toBe('false');
      expect(screen.getByTestId('local-messages').textContent).toBe('false');
      expect(screen.getByTestId('usb-sync').textContent).toBe('true');
      expect(screen.getByTestId('email').textContent).toBe('true');
    });

    it('should provide Linux context when platform is linux', () => {
      Object.defineProperty(window, 'electron', {
        value: { platform: 'linux' },
        writable: true,
        configurable: true,
      });

      render(
        <PlatformProvider>
          <TestPlatformConsumer />
        </PlatformProvider>
      );

      expect(screen.getByTestId('platform').textContent).toBe('linux');
      expect(screen.getByTestId('is-macos').textContent).toBe('false');
      expect(screen.getByTestId('is-windows').textContent).toBe('false');
      expect(screen.getByTestId('is-linux').textContent).toBe('true');
      expect(screen.getByTestId('local-messages').textContent).toBe('false');
      expect(screen.getByTestId('usb-sync').textContent).toBe('true');
      expect(screen.getByTestId('email').textContent).toBe('true');
    });

    it('should default to Windows when platform is unknown', () => {
      Object.defineProperty(window, 'electron', {
        value: { platform: 'unknown' },
        writable: true,
        configurable: true,
      });

      render(
        <PlatformProvider>
          <TestPlatformConsumer />
        </PlatformProvider>
      );

      expect(screen.getByTestId('platform').textContent).toBe('windows');
      expect(screen.getByTestId('is-windows').textContent).toBe('true');
    });
  });

  describe('usePlatform hook', () => {
    it('should throw error when used outside PlatformProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Suppress jsdom's VirtualConsole error logging for expected errors
      const errorHandler = (event: ErrorEvent) => {
        event.preventDefault();
      };
      window.addEventListener('error', errorHandler);

      expect(() => {
        render(<TestPlatformConsumer />);
      }).toThrow('usePlatform must be used within PlatformProvider');

      window.removeEventListener('error', errorHandler);
      consoleSpy.mockRestore();
    });
  });
});
