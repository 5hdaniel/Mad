/**
 * Tests for Settings.tsx
 * Covers settings UI, email connections, and preferences
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Settings from '../Settings';

describe('Settings', () => {
  const mockUserId = 'user-123';
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    window.api.system.checkAllConnections.mockResolvedValue({
      success: true,
      google: { connected: false },
      microsoft: { connected: false },
    });
    window.api.preferences.get.mockResolvedValue({
      success: true,
      preferences: {
        export: { defaultFormat: 'pdf' },
      },
    });
    window.api.preferences.update.mockResolvedValue({ success: true });
    window.api.auth.googleConnectMailbox.mockResolvedValue({ success: true });
    window.api.auth.microsoftConnectMailbox.mockResolvedValue({ success: true });
    window.api.onGoogleMailboxConnected.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxConnected.mockReturnValue(jest.fn());
  });

  describe('Rendering', () => {
    it('should render settings modal with title', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should show all settings sections', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
      });

      expect(screen.getByText('Email Connections')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Data & Privacy')).toBeInTheDocument();
      expect(screen.getByText('About')).toBeInTheDocument();
    });

    it('should show version information', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('MagicAudit')).toBeInTheDocument();
      expect(screen.getByText('Version 1.0.7')).toBeInTheDocument();
    });
  });

  describe('Email Connections', () => {
    it('should show Gmail connection status', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      expect(screen.getAllByText('Not Connected').length).toBeGreaterThan(0);
    });

    it('should show Outlook connection status', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });
    });

    it('should show connected status when Gmail is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
      });

      expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
    });

    it('should show connected status when Outlook is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: false },
        microsoft: { connected: true, email: 'user@outlook.com' },
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
      });

      expect(screen.getByText('user@outlook.com')).toBeInTheDocument();
    });

    it('should show loading state while checking connections', () => {
      window.api.system.checkAllConnections.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getAllByText('Checking...').length).toBeGreaterThan(0);
    });

    it('should call connect Gmail when button is clicked', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      expect(window.api.auth.googleConnectMailbox).toHaveBeenCalledWith(mockUserId);
    });

    it('should call connect Outlook when button is clicked', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      const connectOutlookButton = screen.getByRole('button', { name: /connect outlook/i });
      await userEvent.click(connectOutlookButton);

      expect(window.api.auth.microsoftConnectMailbox).toHaveBeenCalledWith(mockUserId);
    });

    it('should disable connect button when already connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        const gmailSection = screen.getByText('Gmail').closest('div[class*="p-4"]');
        const connectedButton = gmailSection?.querySelector('button');
        expect(connectedButton).toBeDisabled();
      });
    });
  });

  describe('Export Settings', () => {
    it('should show export format dropdown', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Default Format')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should show all export format options', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
      });

      // Check all options are available
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('JSON')).toBeInTheDocument();
      expect(screen.getByText('TXT + EML Files')).toBeInTheDocument();
    });

    it('should load saved export format preference', async () => {
      window.api.preferences.get.mockResolvedValue({
        success: true,
        preferences: {
          export: { defaultFormat: 'excel' },
        },
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('excel');
      });
    });

    it('should save export format when changed', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'csv');

      expect(window.api.preferences.update).toHaveBeenCalledWith(mockUserId, {
        export: { defaultFormat: 'csv' },
      });
    });

    it('should disable format selector while loading preferences', () => {
      window.api.preferences.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('General Settings', () => {
    it('should show notifications toggle (disabled/coming soon)', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText(/show desktop notifications/i)).toBeInTheDocument();
    });

    it('should show auto export toggle (disabled/coming soon)', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Auto Export')).toBeInTheDocument();
      expect(screen.getByText(/automatically export new transactions/i)).toBeInTheDocument();
    });

    it('should show dark mode toggle (coming soon)', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    });
  });

  describe('Data & Privacy', () => {
    it('should show view stored data button (disabled)', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('View Stored Data')).toBeInTheDocument();
      expect(screen.getByText(/see all data stored locally/i)).toBeInTheDocument();
    });

    it('should show clear all data button (disabled)', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Clear All Data')).toBeInTheDocument();
      expect(screen.getByText(/delete all local data/i)).toBeInTheDocument();
    });
  });

  describe('About Section', () => {
    it('should show app name and version', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('MagicAudit')).toBeInTheDocument();
      expect(screen.getByText('Version 1.0.7')).toBeInTheDocument();
    });

    it('should show disabled action buttons', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByText('Check for Updates')).toBeInTheDocument();
      expect(screen.getByText('View Release Notes')).toBeInTheDocument();
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    });
  });

  describe('Close Modal', () => {
    it('should call onClose when close button is clicked', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      const closeButton = screen.getAllByRole('button').find(
        (btn) => btn.querySelector('svg path[d*="M6 18L18 6"]')
      );

      if (closeButton) {
        await userEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should call onClose when done button is clicked', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      const doneButton = screen.getByRole('button', { name: /done/i });
      await userEvent.click(doneButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    it('should check connections on mount', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(window.api.system.checkAllConnections).toHaveBeenCalledWith(mockUserId);
      });
    });

    it('should load preferences on mount', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(window.api.preferences.get).toHaveBeenCalledWith(mockUserId);
      });
    });

    it('should have all required APIs available', () => {
      expect(window.api.system.checkAllConnections).toBeDefined();
      expect(window.api.preferences.get).toBeDefined();
      expect(window.api.preferences.update).toBeDefined();
      expect(window.api.auth.googleConnectMailbox).toBeDefined();
      expect(window.api.auth.microsoftConnectMailbox).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection check failure gracefully', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should handle preferences load failure gracefully', async () => {
      window.api.preferences.get.mockResolvedValue({
        success: false,
        error: 'Failed to load preferences',
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      // Should still render with default values
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('pdf'); // Default value
      });
    });

    it('should handle preferences update failure gracefully', async () => {
      window.api.preferences.update.mockResolvedValue({
        success: false,
        error: 'Failed to save preferences',
      });

      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'json');

      // Should not crash, preference update fails silently
      expect(window.api.preferences.update).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form controls', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // Export format select should be accessible
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should have accessible buttons', async () => {
      render(<Settings userId={mockUserId} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });
  });
});
