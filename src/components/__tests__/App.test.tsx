/**
 * Tests for App.tsx
 * Covers authentication flows, session management, and navigation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../../App';

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

      render(<App />);

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

      render(<App />);

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

      render(<App />);

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

      render(<App />);

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

      render(<App />);

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

      render(<App />);

      // Wait for dashboard
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Click profile button (uses user initial)
      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      // Find and click logout button in profile modal
      const logoutButton = await screen.findByRole('button', { name: /log out|sign out/i });
      await userEvent.click(logoutButton);

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

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/Test User/i);
      await userEvent.click(profileButton);

      const logoutButton = await screen.findByRole('button', { name: /log out|sign out/i });
      await userEvent.click(logoutButton);

      // Should still return to login even if API fails
      await waitFor(() => {
        expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should check session on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      render(<App />);

      await waitFor(() => {
        expect(window.api.auth.getCurrentUser).toHaveBeenCalled();
      });
    });

    it('should check permissions on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      render(<App />);

      await waitFor(() => {
        expect(window.electron.checkPermissions).toHaveBeenCalled();
      });
    });

    it('should check app location on mount', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      render(<App />);

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
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Profile button should show user initial
      const profileButton = screen.getByTitle(/Test User/i);
      expect(profileButton).toBeInTheDocument();
    });

    it('should open profile modal when profile button is clicked', async () => {
      render(<App />);

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
  });

  describe('Version Info', () => {
    it('should show version info popup when info button is clicked', async () => {
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });

      render(<App />);

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

      render(<App />);

      await waitFor(() => {
        // MoveAppPrompt component should be rendered
        expect(screen.getByText(/move/i)).toBeInTheDocument();
      });
    });

    it('should not show move app prompt if user previously dismissed it', async () => {
      localStorage.setItem('ignoreMoveAppPrompt', 'true');
      window.api.auth.getCurrentUser.mockResolvedValue({ success: false });
      window.electron.checkAppLocation.mockResolvedValue({
        shouldPrompt: true,
        appPath: '/Users/test/Downloads/MagicAudit.app',
      });

      render(<App />);

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

      render(<App />);

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

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle(/test@example.com/i);
      expect(profileButton).toHaveTextContent('T');
    });
  });
});
