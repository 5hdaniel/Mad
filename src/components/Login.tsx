/**
 * Login Component
 * Handles user authentication via Google or Microsoft OAuth
 * Two-step flow: Login first, connect mailboxes later
 */

import React, { useState } from 'react';
import type { User, Subscription } from '../../electron/types/models';

interface LoginProps {
  onLoginSuccess: (
    user: User,
    sessionToken: string,
    provider: string,
    subscription: Subscription,
    isNewUser: boolean
  ) => void;
}

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [provider, setProvider] = useState<'google' | 'microsoft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle Google Sign In (Redirect Flow)
   * Popup window opens, user logs in, redirects to local server, app handles automatically
   */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setProvider('google');

    // Listen for login completion from main process
    let cleanup: (() => void) | undefined;
    if (window.api.onGoogleLoginComplete) {
      cleanup = window.api.onGoogleLoginComplete((result) => {
        if (result.success && result.user && result.sessionToken && result.subscription && onLoginSuccess) {
          onLoginSuccess(result.user, result.sessionToken, 'google', result.subscription, result.isNewUser || false);
        } else {
          setError(result.error || 'Failed to complete Google login');
          setLoading(false);
          setProvider(null);
        }

        // Clean up listener after handling the event
        if (cleanup) cleanup();
      });
    }

    try {
      // Start login - auth popup window will open automatically
      const result = await window.api.auth.googleLogin();

      if (result.success) {
        // Auth popup is already open - keep loading=true while waiting for redirect
        // The popup will close automatically after successful authentication
      } else {
        setError(result.error || 'Failed to start Google login');
        setLoading(false);
        setProvider(null);
        if (cleanup) cleanup();
      }
    } catch (err) {
      console.error('Google login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Google login';
      setError(errorMessage);
      setLoading(false);
      setProvider(null);
      if (cleanup) cleanup();
    }
  };

  /**
   * Handle Microsoft Sign In (Redirect Flow)
   * Browser opens, user logs in, redirects to local server, app handles automatically
   */
  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    setProvider('microsoft');

    // Listen for login completion from main process
    let cleanup: (() => void) | undefined;
    if (window.api.onMicrosoftLoginComplete) {
      cleanup = window.api.onMicrosoftLoginComplete((result) => {
        if (result.success && result.user && result.sessionToken && result.subscription && onLoginSuccess) {
          onLoginSuccess(result.user, result.sessionToken, 'microsoft', result.subscription, result.isNewUser || false);
        } else {
          setError(result.error || 'Failed to complete Microsoft login');
          setLoading(false);
          setProvider(null);
        }

        // Clean up listener after handling the event
        if (cleanup) cleanup();
      });
    }

    try {
      // Start login - auth popup window will open automatically
      const result = await window.api.auth.microsoftLogin();

      if (result.success) {
        // Auth popup is already open - keep loading=true while waiting for redirect
        // The popup will close automatically after successful authentication
      } else {
        setError(result.error || 'Failed to start Microsoft login');
        setLoading(false);
        setProvider(null);
        if (cleanup) cleanup();
      }
    } catch (err) {
      console.error('Microsoft login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Microsoft login';
      setError(errorMessage);
      setLoading(false);
      setProvider(null);
      if (cleanup) cleanup();
    }
  };

  /**
   * Handle authorization code submission
   */
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (provider === 'google') {
        result = await window.api.auth.googleCompleteLogin(authCode.trim());
      } else if (provider === 'microsoft') {
        result = await window.api.auth.microsoftCompleteLogin(authCode.trim());
      }

      if (result && result.success && result.user && result.sessionToken && provider && result.subscription && onLoginSuccess) {
        // Call parent callback with user, session token, provider, subscription, and isNewUser flag
        onLoginSuccess(result.user, result.sessionToken, provider, result.subscription, result.isNewUser || false);
      } else if (result && !result.success) {
        setError(result.error || 'Login failed');
        setLoading(false);
      }
    } catch (err) {
      console.error('Code exchange error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete login';
      setError(errorMessage);
      setLoading(false);
    }
  };

  /**
   * Cancel login flow
   */
  const handleCancel = () => {
    setLoading(false);
    setAuthUrl(null);
    setAuthCode('');
    setProvider(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Magic Audit</h1>
          <p className="text-gray-600">
            Real Estate Compliance Made Simple
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Google Authentication in Progress */}
        {provider === 'google' && loading && (
          <div className="mb-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-blue-900 font-semibold mb-2">
                  Authenticating with Google...
                </p>
                <p className="text-xs text-blue-700">
                  A popup window will open. Complete sign-in there and it will close automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Microsoft Authentication in Progress */}
        {provider === 'microsoft' && loading && (
          <div className="mb-6">
            <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-purple-900 font-semibold mb-2">
                  Authenticating with Microsoft...
                </p>
                <p className="text-xs text-purple-700">
                  A popup window will open. Complete sign-in there and it will close automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auth URL Display (after clicking sign in) - Google only */}
        {authUrl && !loading && provider === 'google' && (
          <div className="mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-sm text-blue-900 mb-2 font-semibold">
                Step 1: Sign in with {provider === 'google' ? 'Google' : 'Microsoft'}
              </p>
              <p className="text-xs text-blue-700 mb-3">
                A browser window has been opened. After signing in, copy the authorization code and paste it below.
              </p>
              <button
                onClick={() => window.api.shell.openExternal(authUrl)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Click here if the browser didn't open
              </button>
            </div>

            <form onSubmit={handleCodeSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="authCode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Authorization Code
                </label>
                <input
                  type="text"
                  id="authCode"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste code here"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !authCode.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Completing...' : 'Complete Sign In'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Initial Login Buttons */}
        {!authUrl && !((provider === 'microsoft' || provider === 'google') && loading) && (
          <div>
            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mb-3 flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-medium">Sign in with Google</span>
            </button>

            {/* Microsoft Sign In */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M0 0h11v11H0z" />
                <path fill="#81bc06" d="M12 0h11v11H12z" />
                <path fill="#05a6f0" d="M0 12h11v11H0z" />
                <path fill="#ffba08" d="M12 12h11v11H12z" />
              </svg>
              <span className="font-medium">Sign in with Microsoft</span>
            </button>

            {/* Trial Info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                🎉 Start your 14-day free trial
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
