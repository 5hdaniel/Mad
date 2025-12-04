/**
 * Tests for Login.tsx
 * Covers login UI, OAuth flows, and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Login from '../Login';

describe('Login', () => {
  const mockOnLoginSuccess = jest.fn();
  const mockOnLoginPending = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    window.api.auth.googleLogin.mockResolvedValue({ success: true });
    window.api.auth.microsoftLogin.mockResolvedValue({ success: true });
    window.api.auth.googleCompleteLogin.mockResolvedValue({ success: true });
    window.api.auth.microsoftCompleteLogin.mockResolvedValue({ success: true });
    window.api.onGoogleLoginComplete.mockReturnValue(jest.fn());
    window.api.onGoogleLoginPending.mockReturnValue(jest.fn());
    window.api.onMicrosoftLoginComplete.mockReturnValue(jest.fn());
    window.api.onMicrosoftLoginPending.mockReturnValue(jest.fn());
  });

  describe('Rendering', () => {
    it('should render the welcome title', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByText('Welcome to Real Estate Archive')).toBeInTheDocument();
    });

    it('should render the tagline', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByText('Export your client conversations with just a few clicks')).toBeInTheDocument();
    });

    it('should render Google sign in button', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should render Microsoft sign in button', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    });

    it('should render trial info', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
    });
  });

  describe('Google Login Flow', () => {
    it('should call googleLogin when Google button is clicked', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      expect(window.api.auth.googleLogin).toHaveBeenCalled();
    });

    it('should show loading state when Google login is in progress', async () => {
      window.api.auth.googleLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      expect(screen.getByText(/authenticating with google/i)).toBeInTheDocument();
    });

    it('should register login complete listener when Google login starts', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} onLoginPending={mockOnLoginPending} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      expect(window.api.onGoogleLoginComplete).toHaveBeenCalled();
    });

    it('should register login pending listener when onLoginPending is provided', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} onLoginPending={mockOnLoginPending} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      expect(window.api.onGoogleLoginPending).toHaveBeenCalled();
    });

    it('should show error when Google login fails', async () => {
      window.api.auth.googleLogin.mockResolvedValue({
        success: false,
        error: 'Google login failed',
      });

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/google login failed/i)).toBeInTheDocument();
      });
    });

    it('should handle Google login exception gracefully', async () => {
      window.api.auth.googleLogin.mockRejectedValue(new Error('Network error'));

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Microsoft Login Flow', () => {
    it('should call microsoftLogin when Microsoft button is clicked', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      expect(window.api.auth.microsoftLogin).toHaveBeenCalled();
    });

    it('should show loading state when Microsoft login is in progress', async () => {
      window.api.auth.microsoftLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      expect(screen.getByText(/authenticating with microsoft/i)).toBeInTheDocument();
    });

    it('should register login complete listener when Microsoft login starts', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} onLoginPending={mockOnLoginPending} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      expect(window.api.onMicrosoftLoginComplete).toHaveBeenCalled();
    });

    it('should register login pending listener when onLoginPending is provided', async () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} onLoginPending={mockOnLoginPending} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      expect(window.api.onMicrosoftLoginPending).toHaveBeenCalled();
    });

    it('should show error when Microsoft login fails', async () => {
      window.api.auth.microsoftLogin.mockResolvedValue({
        success: false,
        error: 'Microsoft login failed',
      });

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      await waitFor(() => {
        expect(screen.getByText(/microsoft login failed/i)).toBeInTheDocument();
      });
    });

    it('should handle Microsoft login exception gracefully', async () => {
      window.api.auth.microsoftLogin.mockRejectedValue(new Error('Network error'));

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
      await userEvent.click(microsoftButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Button State', () => {
    it('should disable buttons during loading', async () => {
      window.api.auth.googleLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
      );

      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });

      expect(googleButton).not.toBeDisabled();
      expect(microsoftButton).not.toBeDisabled();

      await userEvent.click(googleButton);

      // During loading, buttons should be disabled (hidden in this case due to loading UI)
      expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible Google sign in button', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should have accessible Microsoft sign in button', () => {
      render(<Login onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
    });
  });
});
