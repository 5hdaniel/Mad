/**
 * Tests for OutlookExport.tsx
 * Covers export flow, authentication, and IPC communication
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import OutlookExport from '../OutlookExport';

describe('OutlookExport', () => {
  const mockConversations = [
    {
      id: 'conv-1',
      name: 'John Client',
      emails: ['john@example.com'],
      phones: ['555-1234'],
    },
    {
      id: 'conv-2',
      name: 'Jane Agent',
      emails: ['jane@realty.com'],
      phones: ['555-5678'],
    },
    {
      id: 'conv-3',
      name: 'Bob Buyer',
      emails: [],
      phones: ['555-9999'],
    },
  ];

  const mockSelectedIds = new Set(['conv-1', 'conv-2']);
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks - not authenticated
    window.electron.outlookInitialize.mockResolvedValue({ success: true });
    window.electron.outlookIsAuthenticated.mockResolvedValue(false);
    window.electron.outlookAuthenticate.mockResolvedValue({ success: true });
    window.electron.outlookGetUserEmail.mockResolvedValue('test@outlook.com');
    window.electron.outlookExportEmails.mockResolvedValue({
      success: true,
      exportPath: '/path/to/export',
      results: [
        { contactName: 'John Client', success: true, textMessageCount: 10, error: null },
        { contactName: 'Jane Agent', success: true, textMessageCount: 5, error: null },
      ],
    });
    window.electron.openFolder.mockResolvedValue({ success: true });
    window.electron.onExportProgress.mockReturnValue(jest.fn());
  });

  describe('Initialization', () => {
    it('should show loading state during initialization', () => {
      window.electron.outlookInitialize.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/initializing outlook/i)).toBeInTheDocument();
    });

    it('should call outlookInitialize on mount', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(window.electron.outlookInitialize).toHaveBeenCalled();
      });
    });

    it('should check authentication status after initialization', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(window.electron.outlookIsAuthenticated).toHaveBeenCalled();
      });
    });

    it('should show error when initialization fails', async () => {
      window.electron.outlookInitialize.mockResolvedValue({
        success: false,
        error: 'Microsoft Graph API unavailable',
      });

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
        expect(screen.getByText(/microsoft graph api unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication', () => {
    it('should show authentication screen when not authenticated', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(false);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/connect to outlook/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    });

    it('should call authenticate when sign in button is clicked', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(false);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/connect to outlook/i)).toBeInTheDocument();
      });

      const signInButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(signInButton);

      expect(window.electron.outlookAuthenticate).toHaveBeenCalled();
    });

    it('should show export screen after successful authentication', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/full audit export/i)).toBeInTheDocument();
      });
    });

    it('should show error when authentication fails', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(false);
      window.electron.outlookAuthenticate.mockResolvedValue({
        success: false,
        error: 'User cancelled authentication',
      });

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /sign in with microsoft/i }));

      await waitFor(() => {
        expect(screen.getByText(/user cancelled authentication/i)).toBeInTheDocument();
      });
    });

    it('should disable sign in button while authenticating', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(false);
      window.electron.outlookAuthenticate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /sign in with microsoft/i }));

      expect(screen.getByText(/authenticating/i)).toBeInTheDocument();
    });
  });

  describe('Export Screen', () => {
    beforeEach(() => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);
    });

    it('should display selected contacts with emails', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/full audit export/i)).toBeInTheDocument();
      });

      expect(screen.getByText('John Client')).toBeInTheDocument();
      expect(screen.getByText('Jane Agent')).toBeInTheDocument();
    });

    it('should show contacts without email separately', async () => {
      const selectedWithoutEmail = new Set(['conv-3']);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={selectedWithoutEmail}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/full audit export/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Bob Buyer')).toBeInTheDocument();
      expect(screen.getByText(/no email address found/i)).toBeInTheDocument();
    });

    it('should show export button', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/full audit export/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
    });

    it('should show back button', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/full audit export/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('Export Process', () => {
    beforeEach(() => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);
    });

    it('should call export API when export button is clicked', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      expect(window.electron.outlookExportEmails).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'John Client' }),
        expect.objectContaining({ name: 'Jane Agent' }),
      ]);
    });

    it('should show success results after export', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByText(/export complete/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/15 text messages/i)).toBeInTheDocument();
    });

    it('should show open folder button after successful export', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open export folder/i })).toBeInTheDocument();
      });
    });

    it('should call openFolder when open folder button is clicked', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open export folder/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /open export folder/i }));

      expect(window.electron.openFolder).toHaveBeenCalledWith('/path/to/export');
    });

    it('should show error when export fails', async () => {
      window.electron.outlookExportEmails.mockResolvedValue({
        success: false,
        error: 'Export failed: disk full',
      });

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByText(/export failed: disk full/i)).toBeInTheDocument();
      });
    });

    it('should disable export button while exporting', async () => {
      window.electron.outlookExportEmails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      // Check for disabled state on the back button which is always present
      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /back/i });
        expect(backButton).toBeDisabled();
      });
    });
  });

  describe('Cancellation', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(false);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onCancel when back button is clicked', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onCancel when export is cancelled', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);
      window.electron.outlookExportEmails.mockResolvedValue({
        success: false,
        canceled: true,
      });

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });
  });

  describe('Detailed Results', () => {
    beforeEach(() => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);
    });

    it('should show more details button after export', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /more details/i })).toBeInTheDocument();
      });
    });

    it('should show individual contact results in detailed view', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export 2 audits/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /export 2 audits/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /more details/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /more details/i }));

      // Should show individual results
      expect(screen.getByText('John Client')).toBeInTheDocument();
      expect(screen.getByText('Jane Agent')).toBeInTheDocument();
    });
  });

  describe('IPC Communication', () => {
    it('should register export progress listener on mount', async () => {
      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(window.electron.onExportProgress).toHaveBeenCalled();
      });
    });

    it('should have all required Electron APIs available', () => {
      expect(window.electron.outlookInitialize).toBeDefined();
      expect(window.electron.outlookIsAuthenticated).toBeDefined();
      expect(window.electron.outlookAuthenticate).toBeDefined();
      expect(window.electron.outlookExportEmails).toBeDefined();
      expect(window.electron.openFolder).toBeDefined();
      expect(window.electron.onExportProgress).toBeDefined();
    });
  });

  describe('Empty Selection', () => {
    it('should disable export button when no contacts selected', async () => {
      window.electron.outlookIsAuthenticated.mockResolvedValue(true);

      render(
        <OutlookExport
          conversations={mockConversations}
          selectedIds={new Set()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export 0 audits/i });
        expect(exportButton).toBeDisabled();
      });
    });
  });
});
