/**
 * Tests for NetworkContext
 * Verifies network state management and offline detection
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { NetworkProvider, useNetwork } from '../NetworkContext';

// Test component that uses useNetwork
function TestNetworkConsumer() {
  const network = useNetwork();
  return (
    <div>
      <span data-testid="is-online">{network.isOnline.toString()}</span>
      <span data-testid="is-checking">{network.isChecking.toString()}</span>
      <span data-testid="connection-error">{network.connectionError || 'none'}</span>
      <button data-testid="check-connection" onClick={() => network.checkConnection()}>
        Check
      </button>
      <button data-testid="clear-error" onClick={() => network.clearError()}>
        Clear
      </button>
      <button data-testid="set-error" onClick={() => network.setConnectionError('Test error')}>
        Set Error
      </button>
    </div>
  );
}

describe('NetworkContext', () => {
  // Store original navigator.onLine
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  describe('NetworkProvider', () => {
    it('should provide online state when browser is online', () => {
      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('true');
      expect(screen.getByTestId('is-checking').textContent).toBe('false');
      expect(screen.getByTestId('connection-error').textContent).toBe('none');
    });

    it('should provide offline state when browser is offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('false');
    });

    it('should respond to online event', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('false');

      // Simulate going online
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(screen.getByTestId('is-online').textContent).toBe('true');
    });

    it('should respond to offline event', async () => {
      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('true');

      // Simulate going offline
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(screen.getByTestId('is-online').textContent).toBe('false');
    });
  });

  describe('checkConnection', () => {
    it('should check connection and update state', async () => {
      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      await act(async () => {
        screen.getByTestId('check-connection').click();
      });

      // After check, should still be online (navigator.onLine is true)
      await waitFor(() => {
        expect(screen.getByTestId('is-checking').textContent).toBe('false');
      });
      expect(screen.getByTestId('is-online').textContent).toBe('true');
    });

    it('should set error when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      await act(async () => {
        screen.getByTestId('check-connection').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-error').textContent).toBe('No internet connection');
      });
    });
  });

  describe('clearError', () => {
    it('should clear connection error', async () => {
      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      // First set an error
      await act(async () => {
        screen.getByTestId('set-error').click();
      });

      expect(screen.getByTestId('connection-error').textContent).toBe('Test error');

      // Now clear it
      await act(async () => {
        screen.getByTestId('clear-error').click();
      });

      expect(screen.getByTestId('connection-error').textContent).toBe('none');
    });
  });

  describe('setConnectionError', () => {
    it('should set connection error', async () => {
      render(
        <NetworkProvider>
          <TestNetworkConsumer />
        </NetworkProvider>
      );

      await act(async () => {
        screen.getByTestId('set-error').click();
      });

      expect(screen.getByTestId('connection-error').textContent).toBe('Test error');
    });
  });

  describe('useNetwork hook', () => {
    it('should throw error when used outside NetworkProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Suppress jsdom's VirtualConsole error logging for expected errors
      const errorHandler = (event: ErrorEvent) => {
        event.preventDefault();
      };
      window.addEventListener('error', errorHandler);

      expect(() => {
        render(<TestNetworkConsumer />);
      }).toThrow('useNetwork must be used within a NetworkProvider');

      window.removeEventListener('error', errorHandler);
      consoleSpy.mockRestore();
    });
  });
});
