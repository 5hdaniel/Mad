/**
 * Tests for PermissionsScreen.tsx
 * Covers permissions UI, Full Disk Access flow, and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PermissionsScreen from '../PermissionsScreen';

describe('PermissionsScreen', () => {
  const mockOnPermissionsGranted = jest.fn();
  const mockOnCheckAgain = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    window.electron.checkPermissions.mockResolvedValue({ hasPermission: false });
    window.electron.getMacOSVersion.mockResolvedValue({ version: 15, name: 'Sequoia' });
    window.electron.getAppInfo.mockResolvedValue({ version: '1.0.0', name: 'Real Estate Archive' });
    window.electron.openSystemSettings.mockResolvedValue(undefined);
    window.electron.triggerFullDiskAccess.mockResolvedValue(undefined);
  });

  describe('Step 1: Grant Permission Prompt', () => {
    it('should render the grant permission title', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByText('Grant Full Disk Access')).toBeInTheDocument();
    });

    it('should render the permission explanation', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByText(/to read your messages database/i)).toBeInTheDocument();
    });

    it('should show why we need this section', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByText('Why do we need this?')).toBeInTheDocument();
      expect(screen.getByText(/access your imessage database/i)).toBeInTheDocument();
      expect(screen.getByText(/macos security requirement/i)).toBeInTheDocument();
    });

    it('should show privacy note', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByText(/your privacy matters/i)).toBeInTheDocument();
      expect(screen.getByText(/all data stays on your device/i)).toBeInTheDocument();
    });

    it('should show Grant Permission button', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByRole('button', { name: /grant permission/i })).toBeInTheDocument();
    });

    it('should trigger full disk access and go to step 2 when Grant Permission is clicked', async () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      const grantButton = screen.getByRole('button', { name: /grant permission/i });
      await userEvent.click(grantButton);

      expect(window.electron.triggerFullDiskAccess).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByText('Follow These Steps')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Follow These Steps', () => {
    beforeEach(async () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      // Move to step 2
      const grantButton = screen.getByRole('button', { name: /grant permission/i });
      await userEvent.click(grantButton);
    });

    it('should show the step header', async () => {
      await waitFor(() => {
        expect(screen.getByText('Follow These Steps')).toBeInTheDocument();
        expect(screen.getByText(/complete the checklist below/i)).toBeInTheDocument();
      });
    });

    it('should show Open System Settings button', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open system settings/i })).toBeInTheDocument();
      });
    });

    it('should call openSystemSettings when button is clicked', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open system settings/i })).toBeInTheDocument();
      });

      const openSettingsButton = screen.getByRole('button', { name: /open system settings/i });
      await userEvent.click(openSettingsButton);

      expect(window.electron.openSystemSettings).toHaveBeenCalled();
    });

    it('should show manual open option', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /i've opened settings manually/i })).toBeInTheDocument();
      });
    });

    it('should progress to step 2 when settings are opened', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open system settings/i })).toBeInTheDocument();
      });

      const openSettingsButton = screen.getByRole('button', { name: /open system settings/i });
      await userEvent.click(openSettingsButton);

      await waitFor(() => {
        expect(screen.getByText(/find privacy & security/i)).toBeInTheDocument();
      });
    });

    it('should allow completing checklist steps', async () => {
      // Complete step 1
      const openSettingsButton = screen.getByRole('button', { name: /open system settings/i });
      await userEvent.click(openSettingsButton);

      // Complete step 2
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done - found privacy & security/i })).toBeInTheDocument();
      });
      const step2Button = screen.getByRole('button', { name: /done - found privacy & security/i });
      await userEvent.click(step2Button);

      // Complete step 3
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done - found full disk access/i })).toBeInTheDocument();
      });
      const step3Button = screen.getByRole('button', { name: /done - found full disk access/i });
      await userEvent.click(step3Button);

      // Complete step 4
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done - clicked plus button/i })).toBeInTheDocument();
      });
      const step4Button = screen.getByRole('button', { name: /done - clicked plus button/i });
      await userEvent.click(step4Button);

      // Complete step 5
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done - selected the app/i })).toBeInTheDocument();
      });
      const step5Button = screen.getByRole('button', { name: /done - selected the app/i });
      await userEvent.click(step5Button);

      // Complete step 6
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done - app restarted/i })).toBeInTheDocument();
      });
      const step6Button = screen.getByRole('button', { name: /done - app restarted/i });
      await userEvent.click(step6Button);

      // Should show completion
      await waitFor(() => {
        expect(screen.getByText('All Steps Complete!')).toBeInTheDocument();
      });
    });

    it('should show back buttons on subsequent steps', async () => {
      // Complete step 1
      const openSettingsButton = screen.getByRole('button', { name: /open system settings/i });
      await userEvent.click(openSettingsButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });
    });
  });

  describe('Progress Indicator', () => {
    it('should show 4 setup steps', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Secure Storage')).toBeInTheDocument();
      expect(screen.getByText('Connect Email')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
    });

    it('should highlight step 4 (Permissions) as current step', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      const permissionsLabel = screen.getByText('Permissions');
      expect(permissionsLabel).toHaveClass('text-blue-600', 'font-medium');
    });
  });

  describe('Auto-check Permissions', () => {
    it('should check permissions on mount', async () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      await waitFor(() => {
        expect(window.electron.checkPermissions).toHaveBeenCalled();
      });
    });

    it('should call onPermissionsGranted if already has permission', async () => {
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      await waitFor(() => {
        expect(mockOnPermissionsGranted).toHaveBeenCalled();
      });
    });

    it('should not call onPermissionsGranted if no permission', async () => {
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: false });

      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      await waitFor(() => {
        expect(window.electron.checkPermissions).toHaveBeenCalled();
      });

      expect(mockOnPermissionsGranted).not.toHaveBeenCalled();
    });
  });

  describe('macOS Version Detection', () => {
    it('should detect macOS version on mount', async () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      await waitFor(() => {
        expect(window.electron.getMacOSVersion).toHaveBeenCalled();
      });
    });

    it('should handle macOS version detection error gracefully', async () => {
      window.electron.getMacOSVersion.mockRejectedValue(new Error('Detection failed'));

      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Grant Full Disk Access')).toBeInTheDocument();
      });
    });
  });

  describe('App Info Detection', () => {
    it('should detect app info on mount', async () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      await waitFor(() => {
        expect(window.electron.getAppInfo).toHaveBeenCalled();
      });
    });

    it('should handle app info detection error gracefully', async () => {
      window.electron.getAppInfo.mockRejectedValue(new Error('Detection failed'));

      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Grant Full Disk Access')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible Grant Permission button', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByRole('button', { name: /grant permission/i })).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(
        <PermissionsScreen
          onPermissionsGranted={mockOnPermissionsGranted}
          onCheckAgain={mockOnCheckAgain}
        />
      );

      expect(screen.getByRole('heading', { name: /grant full disk access/i })).toBeInTheDocument();
    });
  });
});
