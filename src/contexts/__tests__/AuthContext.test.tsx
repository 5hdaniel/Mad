/**
 * Tests for AuthContext
 * Verifies authentication state management and context behavior
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth, useIsAuthenticated, useCurrentUser } from '../AuthContext';

// Mock the window.api object
const mockApi = {
  auth: {
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
    acceptTerms: jest.fn(),
  },
};

// Setup global window.api mock
beforeAll(() => {
  (window as any).api = mockApi;
});

afterAll(() => {
  delete (window as any).api;
});

// Test component that uses useAuth
function TestAuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="is-authenticated">{auth.isAuthenticated.toString()}</span>
      <span data-testid="is-loading">{auth.isLoading.toString()}</span>
      <span data-testid="user-email">{auth.currentUser?.email || 'none'}</span>
      <span data-testid="needs-terms">{auth.needsTermsAcceptance.toString()}</span>
      <button onClick={() => auth.login(
        { id: 'test-id', email: 'test@example.com' },
        'test-token',
        'google',
        undefined,
        false
      )}>
        Login
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

// Test component for useIsAuthenticated hook
function TestIsAuthenticatedConsumer() {
  const { isAuthenticated, isLoading } = useIsAuthenticated();
  return (
    <div>
      <span data-testid="simple-auth">{isAuthenticated.toString()}</span>
      <span data-testid="simple-loading">{isLoading.toString()}</span>
    </div>
  );
}

// Test component for useCurrentUser hook
function TestCurrentUserConsumer() {
  const user = useCurrentUser();
  return <span data-testid="current-user">{user?.email || 'null'}</span>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing session
    mockApi.auth.getCurrentUser.mockResolvedValue({ success: false });
  });

  describe('AuthProvider', () => {
    it('should provide default unauthenticated state', async () => {
      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId('is-loading').textContent).toBe('true');

      // After session check completes
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-email').textContent).toBe('none');
    });

    it('should restore session on mount when user has existing session', async () => {
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'existing-user', email: 'existing@example.com' },
        sessionToken: 'existing-token',
        provider: 'google',
        subscription: { tier: 'pro' },
        isNewUser: false,
      });

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      expect(screen.getByTestId('user-email').textContent).toBe('existing@example.com');
      expect(screen.getByTestId('needs-terms').textContent).toBe('false');
    });

    it('should set needsTermsAcceptance for new users', async () => {
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'new-user', email: 'new@example.com' },
        sessionToken: 'new-token',
        provider: 'microsoft',
        isNewUser: true,
      });

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('needs-terms').textContent).toBe('true');
      });
    });
  });

  describe('login', () => {
    it('should update auth state when login is called', async () => {
      const user = userEvent.setup();

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      // Click login button
      await user.click(screen.getByText('Login'));

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
    });
  });

  describe('logout', () => {
    it('should clear auth state on logout', async () => {
      const user = userEvent.setup();
      mockApi.auth.logout.mockResolvedValue({ success: true });

      // Start with authenticated user
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'user-1', email: 'user@example.com' },
        sessionToken: 'token-123',
        provider: 'google',
      });

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      // Wait for session restore
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      // Click logout
      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      });
      expect(screen.getByTestId('user-email').textContent).toBe('none');
      expect(mockApi.auth.logout).toHaveBeenCalledWith('token-123');
    });

    it('should clear state even if API logout fails', async () => {
      const user = userEvent.setup();
      mockApi.auth.logout.mockRejectedValue(new Error('Network error'));

      // Start with authenticated user
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'user-1', email: 'user@example.com' },
        sessionToken: 'token-123',
        provider: 'google',
      });

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await user.click(screen.getByText('Logout'));

      // Should still clear local state
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Suppress jsdom's VirtualConsole error logging for expected errors
      const errorHandler = (event: ErrorEvent) => {
        event.preventDefault();
      };
      window.addEventListener('error', errorHandler);

      expect(() => {
        render(<TestAuthConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      window.removeEventListener('error', errorHandler);
      consoleSpy.mockRestore();
    });
  });

  describe('useIsAuthenticated hook', () => {
    it('should return auth status', async () => {
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'user', email: 'test@example.com' },
        sessionToken: 'token',
        provider: 'google',
      });

      render(
        <AuthProvider>
          <TestIsAuthenticatedConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('simple-auth').textContent).toBe('true');
      });
    });
  });

  describe('useCurrentUser hook', () => {
    it('should return current user when authenticated', async () => {
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: 'user', email: 'current@example.com' },
        sessionToken: 'token',
        provider: 'google',
      });

      render(
        <AuthProvider>
          <TestCurrentUserConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-user').textContent).toBe('current@example.com');
      });
    });

    it('should return null when not authenticated', async () => {
      render(
        <AuthProvider>
          <TestCurrentUserConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-user').textContent).toBe('null');
      });
    });
  });

  describe('session recovery', () => {
    it('should handle session check failure gracefully', async () => {
      mockApi.auth.getCurrentUser.mockRejectedValue(new Error('Network error'));

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      // Should remain unauthenticated
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    it('should handle missing window.api gracefully', async () => {
      const originalApi = (window as any).api;
      delete (window as any).api;

      render(
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');

      // Restore
      (window as any).api = originalApi;
    });
  });
});
