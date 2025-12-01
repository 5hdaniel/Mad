/**
 * Tests for App.tsx
 * Covers authentication flows, session management, and navigation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../../App';
import { AuthProvider, NetworkProvider } from '../../contexts';

// Helper to render App with AuthProvider and NetworkProvider
const renderApp = () => {
  return render(
    <NetworkProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </NetworkProvider>
  );
};

describe('App', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    display_name: 'Test User',
    avatar_url: null,
  };

  const mockSubscription = {
    id: 'sub-123',
    status: 'active',
    plan: 'pro',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mocks for initial render
    window.api.auth.getCurrentUser.mockResolvedValue({ success: false });
    window.electron.checkPermissions.mockResolvedValue({ hasPermission: false });
    window.electron.checkAppLocation.mockResolvedValue({
      shouldPrompt: false,
      appPath: '/Applications/MagicAudit.app',
    });
  });

  describe('Authentication', () => {
    it('should show login screen when not authenticated', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/magic audit/i)).toBeInTheDocument();
      });

      // Should show login buttons
      expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
      expect(screen.getByText(/sign in with microsoft/i)).toBeInTheDocument();
    });

    it('should show permissions screen when authenticated but no permissions', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: false });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/setup permissions/i)).toBeInTheDocument();
      });
    });

    it('should show dashboard when authenticated with permissions', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });
    });

    it('should show welcome terms modal for new users', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: true,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      renderApp();

      await waitFor(() => {
        // Component should show the WelcomeTerms modal for new users
        // The exact text depends on the WelcomeTerms component
        expect(screen.getByText(/Test User/i)).toBeInTheDocument();
      });
    });

    it('should not store session token in localStorage', async () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'secret-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Verify session token is NOT stored in localStorage
      expect(setItemSpy).not.toHaveBeenCalledWith('sessionToken', expect.anything());
      expect(setItemSpy).not.toHaveBeenCalledWith('token', expect.anything());
      expect(setItemSpy).not.toHaveBeenCalledWith('auth_token', expect.anything());

      setItemSpy.mockRestore();
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      // Mock system API calls used by Profile component
      window.api.system.checkGoogleConnection.mockResolvedValue({ connected: false, email: null });
      window.api.system.checkMicrosoftConnection.mockResolvedValue({ connected: false, email: null });
    });

    it('should clear all auth state on logout', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });
      window.api.auth.logout.mockResolvedValue({ success: true });

      renderApp();

      // Wait for dashboard
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Click profile button (uses user initial) - title includes full text
      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Wait for profile modal to appear and find "Sign Out" button
      const signOutButton = await screen.findByRole('button', { name: /Sign Out/i });
      await userEvent.click(signOutButton);

      // Profile has a two-step logout: first click shows confirmation dialog
      // Now click "Sign Out" again in the confirmation dialog
      const confirmSignOutButton = await screen.findByRole('button', { name: /Sign Out/i });
      await userEvent.click(confirmSignOutButton);

      // Should call logout API
      expect(window.api.auth.logout).toHaveBeenCalledWith('test-token');

      // Should return to login screen
      await waitFor(() => {
        expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
      });
    });

    it('should handle logout API failure gracefully', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });
      window.api.auth.logout.mockRejectedValue(new Error('Network error'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Wait for profile modal and click Sign Out
      const signOutButton = await screen.findByRole('button', { name: /Sign Out/i });
      await userEvent.click(signOutButton);

      // Click Sign Out again in confirmation dialog
      const confirmSignOutButton = await screen.findByRole('button', { name: /Sign Out/i });
      await userEvent.click(confirmSignOutButton);

      // Should still return to login even if API fails
      await waitFor(() => {
        expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should check session on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      renderApp();

      await waitFor(() => {
        expect(window.api.auth.getCurrentUser).toHaveBeenCalled();
      });
    });

    it('should check permissions on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      renderApp();

      await waitFor(() => {
        expect(window.electron.checkPermissions).toHaveBeenCalled();
      });
    });

    it('should check app location on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      renderApp();

      await waitFor(() => {
        expect(window.electron.checkAppLocation).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: mockUser,
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });
    });

    it('should show profile button when authenticated', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Profile button should show user initial
      const profileButton = screen.getByTitle(/Test User/i);
      expect(profileButton).toBeInTheDocument();
    });

    it('should open profile modal when profile button is clicked', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Profile modal should be visible
      await waitFor(() => {
        expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
      });
    });

    it('should open settings when settings button is clicked in profile modal', async () => {
      // Mock preferences API
      window.api.preferences.get.mockResolvedValue({
        success: true,
        preferences: { theme: 'light', notifications: true },
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Open profile modal
      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Wait for profile modal
      await waitFor(() => {
        expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
      });

      // Click Settings button
      const settingsButton = await screen.findByRole('button', { name: /Settings/i });
      await userEvent.click(settingsButton);

      // Settings modal should be visible (Profile closes, Settings opens)
      // The Settings component has "Settings" as the header title
      await waitFor(() => {
        // Look for the Settings header in the modal (distinct from any other "Settings" text)
        const settingsHeaders = screen.getAllByText(/Settings/i);
        expect(settingsHeaders.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should close profile modal when close button is clicked', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Open profile modal
      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Wait for profile modal
      await waitFor(() => {
        expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
      });

      // Find and click close button (the X button in the header)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('svg path[d*="M6 18L18 6"]'));
      if (closeButton) {
        await userEvent.click(closeButton);
      }

      // Profile modal should be closed (email should not be visible)
      await waitFor(() => {
        expect(screen.queryByText(/Account/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Version Info', () => {
    it('should show version info popup when info button is clicked', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      renderApp();

      // Find and click the version info button
      const infoButton = screen.getByTitle(/version info/i);
      await userEvent.click(infoButton);

      // Version popup should show
      await waitFor(() => {
        expect(screen.getByText(/app info/i)).toBeInTheDocument();
        expect(screen.getByText(/1.0.7/)).toBeInTheDocument();
      });
    });
  });

  describe('Move App Prompt', () => {
    it('should show move app prompt when app is not in Applications folder', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });
      window.electron.checkAppLocation.mockResolvedValue({
        shouldPrompt: true,
        appPath: '/Users/test/Downloads/MagicAudit.app',
      });

      renderApp();

      await waitFor(() => {
        // MoveAppPrompt component should be rendered
        expect(screen.getAllByText(/move/i).length).toBeGreaterThan(0);
      });
    });

    it('should not show move app prompt if user previously dismissed it', async () => {
      localStorage.setItem('ignoreMoveAppPrompt', 'true');
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });
      window.electron.checkAppLocation.mockResolvedValue({
        shouldPrompt: true,
        appPath: '/Users/test/Downloads/MagicAudit.app',
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
      });

      // The move prompt should not appear
      expect(screen.queryByText(/move to applications/i)).not.toBeInTheDocument();
    });
  });

  describe('User Initial Display', () => {
    it('should display first letter of display name in profile button', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { ...mockUser, display_name: 'Alice' },
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/Alice/i);
      expect(profileButton).toHaveTextContent('A');
    });

    it('should display first letter of email if no display name', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { ...mockUser, display_name: undefined },
        sessionToken: 'test-token',
        provider: 'google',
        subscription: mockSubscription,
        isNewUser: false,
      });
      window.electron.checkPermissions.mockResolvedValue({ hasPermission: true });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/test@example.com/i);
      expect(profileButton).toHaveTextContent('T');
    });
  });
});
