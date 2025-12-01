/**
 * Tests for EmailOnboardingScreen.tsx
 * Covers email onboarding UI, connection flows, and navigation
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmailOnboardingScreen from '../EmailOnboardingScreen';

describe('EmailOnboardingScreen', () => {
  const mockUserId = 'user-123';
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mocks
    window.api.system.checkAllConnections.mockResolvedValue({
      success: true,
      google: { connected: false },
      microsoft: { connected: false },
    });
    window.api.auth.googleConnectMailbox.mockResolvedValue({ success: true });
    window.api.auth.microsoftConnectMailbox.mockResolvedValue({ success: true });
    window.api.onGoogleMailboxConnected.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxConnected.mockReturnValue(jest.fn());
  });

  describe('Rendering', () => {
    it('should render the email onboarding screen with title for Microsoft user', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Connect Your Outlook')).toBeInTheDocument();
    });

    it('should render the email onboarding screen with title for Google user', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Connect Your Gmail')).toBeInTheDocument();
    });

    it('should show explanation text', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(
        screen.getByText(/connect your outlook account to export email communications/i)
      ).toBeInTheDocument();
    });

    it('should show benefits list', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Why connect your email?')).toBeInTheDocument();
      expect(
        screen.getByText(/export complete communication history with clients/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/include emails in your audit documentation/i)).toBeInTheDocument();
    });

    it('should show primary provider (Outlook) prominently for Microsoft user', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      // Primary provider should show "Recommended - matches your login"
      expect(screen.getByText(/recommended - matches your login/i)).toBeInTheDocument();
      // Secondary provider should show "Optional"
      expect(screen.getByText('Gmail')).toBeInTheDocument();
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    it('should show primary provider (Gmail) prominently for Google user', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      // Primary provider should show "Recommended - matches your login"
      expect(screen.getByText(/recommended - matches your login/i)).toBeInTheDocument();
      // Secondary provider should show "Optional"
      expect(screen.getByText('Outlook')).toBeInTheDocument();
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    it('should show skip button when no connections', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
      });
    });

    it('should show helper text about connecting later', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/you can always connect your email later in settings/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Connection Status', () => {
    it('should show loading state while checking connections', () => {
      window.api.system.checkAllConnections.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getAllByText('Checking...').length).toBeGreaterThan(0);
    });

    it('should show "Optional" for secondary provider when not connected', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        // Primary shows "Recommended - matches your login", secondary shows "Optional"
        expect(screen.getByText('Optional')).toBeInTheDocument();
      });
    });

    it('should show connected status when Gmail is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Connected: user@gmail.com/i)).toBeInTheDocument();
      });
    });

    it('should show connected status when Outlook is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: false },
        microsoft: { connected: true, email: 'user@outlook.com' },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Connected: user@outlook.com/i)).toBeInTheDocument();
      });
    });

    it('should show Continue button when any connection is made', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
    });

    it('should disable Continue button when no email is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: false },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /continue/i });
        expect(continueButton).toBeDisabled();
      });
    });

    it('should enable Continue button when email is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /continue/i });
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('should hide Connect button when Gmail is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /connect gmail/i })).not.toBeInTheDocument();
      });
    });

    it('should hide Connect button when Outlook is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: false },
        microsoft: { connected: true, email: 'user@outlook.com' },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /connect outlook/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Connect Gmail', () => {
    it('should call googleConnectMailbox when Connect Gmail is clicked', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      expect(window.api.auth.googleConnectMailbox).toHaveBeenCalledWith(mockUserId);
    });

    it('should show connecting state when Gmail connection is in progress', async () => {
      window.api.auth.googleConnectMailbox.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should disable Gmail button while connecting', async () => {
      window.api.auth.googleConnectMailbox.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      const connectingButton = screen.getByRole('button', { name: /connecting/i });
      expect(connectingButton).toBeDisabled();
    });

    it('should register mailbox connected listener when connecting Gmail', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      expect(window.api.onGoogleMailboxConnected).toHaveBeenCalled();
    });
  });

  describe('Connect Outlook', () => {
    it('should call microsoftConnectMailbox when Connect Outlook is clicked', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      const connectOutlookButton = screen.getByRole('button', { name: /connect outlook/i });
      await userEvent.click(connectOutlookButton);

      expect(window.api.auth.microsoftConnectMailbox).toHaveBeenCalledWith(mockUserId);
    });

    it('should show connecting state when Outlook connection is in progress', async () => {
      window.api.auth.microsoftConnectMailbox.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      const connectOutlookButton = screen.getByRole('button', { name: /connect outlook/i });
      await userEvent.click(connectOutlookButton);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should register mailbox connected listener when connecting Outlook', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      const connectOutlookButton = screen.getByRole('button', { name: /connect outlook/i });
      await userEvent.click(connectOutlookButton);

      expect(window.api.onMicrosoftMailboxConnected).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should call onSkip when Skip for Now is clicked', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await userEvent.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('should call onComplete when Continue is clicked with connection', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('should show "Skip additional connections" when one provider is connected', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /skip additional connections/i })
        ).toBeInTheDocument();
      });
    });

    it('should call onSkip when "Skip additional connections" is clicked', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: 'user@gmail.com' },
        microsoft: { connected: false },
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /skip additional connections/i })
        ).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /skip additional connections/i });
      await userEvent.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    it('should check connections on mount', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(window.api.system.checkAllConnections).toHaveBeenCalledWith(mockUserId);
      });
    });

    it('should have all required APIs available', () => {
      expect(window.api.system.checkAllConnections).toBeDefined();
      expect(window.api.auth.googleConnectMailbox).toBeDefined();
      expect(window.api.auth.microsoftConnectMailbox).toBeDefined();
      expect(window.api.onGoogleMailboxConnected).toBeDefined();
      expect(window.api.onMicrosoftMailboxConnected).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection check failure gracefully', async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      // Should still render without crashing (shows provider-specific title)
      await waitFor(() => {
        expect(screen.getByText('Connect Your Outlook')).toBeInTheDocument();
      });
    });

    it('should handle Gmail connection failure gracefully', async () => {
      window.api.auth.googleConnectMailbox.mockRejectedValue(new Error('Connection failed'));

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Gmail')).toBeInTheDocument();
      });

      const connectGmailButton = screen.getByRole('button', { name: /connect gmail/i });
      await userEvent.click(connectGmailButton);

      // Should not crash, screen should still be functional
      await waitFor(() => {
        expect(screen.getByText('Connect Your Outlook')).toBeInTheDocument();
      });
    });

    it('should handle Outlook connection failure gracefully', async () => {
      window.api.auth.microsoftConnectMailbox.mockRejectedValue(new Error('Connection failed'));

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Outlook')).toBeInTheDocument();
      });

      const connectOutlookButton = screen.getByRole('button', { name: /connect outlook/i });
      await userEvent.click(connectOutlookButton);

      // Should not crash, screen should still be functional
      await waitFor(() => {
        expect(screen.getByText('Connect Your Outlook')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', async () => {
      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /connect outlook/i })).toBeInTheDocument();
    });

    it('should indicate loading state accessibly', () => {
      window.api.system.checkAllConnections.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      // Loading indicators should be visible
      expect(screen.getAllByText('Checking...').length).toBeGreaterThan(0);
    });
  });
});
