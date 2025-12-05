/**
 * Tests for PhoneTypeSelection.tsx
 * Covers phone type selection UI, platform-specific progress bars, and navigation
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PhoneTypeSelection from '../PhoneTypeSelection';
import { PlatformProvider } from '../../contexts/PlatformContext';

// Store original window.electron
const originalElectron = window.electron;

// Helper to render with PlatformProvider
function renderWithPlatform(ui: React.ReactElement, platform: string = 'darwin') {
  Object.defineProperty(window, 'electron', {
    value: { platform },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

describe('PhoneTypeSelection', () => {
  const mockOnSelectIPhone = jest.fn();
  const mockOnSelectAndroid = jest.fn();

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

  describe('Rendering', () => {
    it('should render the phone type selection screen', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(screen.getByText('What phone do you use?')).toBeInTheDocument();
    });

    it('should show explanation text', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(
        screen.getByText(/magic audit can sync your text messages and contacts/i)
      ).toBeInTheDocument();
    });

    it('should show iPhone option', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(screen.getByText('iPhone')).toBeInTheDocument();
      expect(screen.getByText(/sync messages and contacts from your iphone/i)).toBeInTheDocument();
    });

    it('should show Android option', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(screen.getByText('Android')).toBeInTheDocument();
      expect(screen.getByText(/samsung, google pixel, and other android phones/i)).toBeInTheDocument();
    });

    it('should show privacy info box', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(
        screen.getByText(/your phone data stays private and secure/i)
      ).toBeInTheDocument();
    });

    it('should show disabled Continue button initially', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Phone Selection', () => {
    it('should select iPhone when clicked', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      await userEvent.click(iphoneButton!);

      // Check that the Continue button is now enabled
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('should select Android when clicked', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const androidButton = screen.getByText('Android').closest('button');
      await userEvent.click(androidButton!);

      // Check that the Continue button is now enabled
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('should allow switching selection between iPhone and Android', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      const androidButton = screen.getByText('Android').closest('button');

      // Select iPhone first
      await userEvent.click(iphoneButton!);
      expect(iphoneButton).toHaveClass('border-blue-500');

      // Switch to Android
      await userEvent.click(androidButton!);
      expect(androidButton).toHaveClass('border-green-500');
    });
  });

  describe('Continue Button', () => {
    it('should call onSelectIPhone when Continue is clicked with iPhone selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      await userEvent.click(iphoneButton!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnSelectIPhone).toHaveBeenCalledTimes(1);
      expect(mockOnSelectAndroid).not.toHaveBeenCalled();
    });

    it('should call onSelectAndroid when Continue is clicked with Android selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const androidButton = screen.getByText('Android').closest('button');
      await userEvent.click(androidButton!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnSelectAndroid).toHaveBeenCalledTimes(1);
      expect(mockOnSelectIPhone).not.toHaveBeenCalled();
    });

    it('should not call any handler when Continue is clicked without selection', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      // Button is disabled, clicking should do nothing
      await userEvent.click(continueButton);

      expect(mockOnSelectIPhone).not.toHaveBeenCalled();
      expect(mockOnSelectAndroid).not.toHaveBeenCalled();
    });
  });

  describe('Progress Indicator - macOS', () => {
    it('should show 5 steps on macOS', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        'darwin'
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Phone Type')).toBeInTheDocument();
      expect(screen.getByText('Secure Storage')).toBeInTheDocument();
      expect(screen.getByText('Connect Email')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
    });

    it('should highlight Phone Type as current step on macOS', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        'darwin'
      );

      // Phone Type should have the blue active styling
      const phoneTypeLabel = screen.getByText('Phone Type');
      expect(phoneTypeLabel).toHaveClass('text-blue-600', 'font-medium');
    });

    it('should show Sign In as completed (step 1 < current step 2) on macOS', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        'darwin'
      );

      // Sign In label should not have active styling
      const signInLabel = screen.getByText('Sign In');
      expect(signInLabel).not.toHaveClass('text-blue-600');
    });
  });

  describe('Progress Indicator - Windows', () => {
    it('should show 3 steps on Windows (no Secure Storage or Permissions)', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        'win32'
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Phone Type')).toBeInTheDocument();
      expect(screen.getByText('Connect Email')).toBeInTheDocument();

      // Secure Storage and Permissions should NOT be present
      expect(screen.queryByText('Secure Storage')).not.toBeInTheDocument();
      expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
    });

    it('should highlight Phone Type as current step on Windows', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        'win32'
      );

      const phoneTypeLabel = screen.getByText('Phone Type');
      expect(phoneTypeLabel).toHaveClass('text-blue-600', 'font-medium');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible iPhone button', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      expect(iphoneButton).toBeInTheDocument();
    });

    it('should have accessible Android button', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const androidButton = screen.getByText('Android').closest('button');
      expect(androidButton).toBeInTheDocument();
    });

    it('should have accessible Continue button', () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('should show checkmark when iPhone is selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      await userEvent.click(iphoneButton!);

      // The checkmark SVG should appear within the iPhone button
      const checkmarks = iphoneButton?.querySelectorAll('svg');
      // Should have Apple logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });

    it('should show checkmark when Android is selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const androidButton = screen.getByText('Android').closest('button');
      await userEvent.click(androidButton!);

      // The checkmark SVG should appear within the Android button
      const checkmarks = androidButton?.querySelectorAll('svg');
      // Should have Android logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });

    it('should show blue border ring when iPhone is selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const iphoneButton = screen.getByText('iPhone').closest('button');
      await userEvent.click(iphoneButton!);

      expect(iphoneButton).toHaveClass('ring-2', 'ring-blue-200');
    });

    it('should show green border ring when Android is selected', async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />
      );

      const androidButton = screen.getByText('Android').closest('button');
      await userEvent.click(androidButton!);

      expect(androidButton).toHaveClass('ring-2', 'ring-green-200');
    });
  });
});
