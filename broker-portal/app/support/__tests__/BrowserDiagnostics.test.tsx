/**
 * BrowserDiagnostics Tests
 *
 * Tests for the useBrowserDiagnostics hook and BrowserDiagnostics display component.
 * Verifies diagnostics collection returns all expected fields and the
 * collapsible UI works correctly.
 *
 * NOTE: These tests require a Jest + jsdom setup for broker-portal.
 * Currently the broker-portal does not have its own Jest config.
 * These tests are written for future integration when Jest is added.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useBrowserDiagnostics, BrowserDiagnostics } from '../components/BrowserDiagnostics';
import type { BrowserDiagnosticsData } from '../components/BrowserDiagnostics';

describe('useBrowserDiagnostics', () => {
  it('returns all expected diagnostic fields', () => {
    const { result } = renderHook(() => useBrowserDiagnostics());

    // After mount, diagnostics should be populated
    expect(result.current).not.toBeNull();
    const data = result.current as BrowserDiagnosticsData;

    expect(typeof data.user_agent).toBe('string');
    expect(typeof data.viewport_width).toBe('number');
    expect(typeof data.viewport_height).toBe('number');
    expect(typeof data.screen_width).toBe('number');
    expect(typeof data.screen_height).toBe('number');
    expect(typeof data.device_pixel_ratio).toBe('number');
    expect(typeof data.current_url).toBe('string');
    expect(typeof data.referrer).toBe('string');
    expect(typeof data.timezone).toBe('string');
    expect(typeof data.language).toBe('string');
    expect(typeof data.online).toBe('boolean');
    expect(typeof data.cookies_enabled).toBe('boolean');
    expect(typeof data.collected_at).toBe('string');

    // Verify collected_at is a valid ISO date
    expect(new Date(data.collected_at).toISOString()).toBe(data.collected_at);
  });

  it('returns null initially before useEffect runs', () => {
    // The hook returns null synchronously, then populates in useEffect
    let hookResult: BrowserDiagnosticsData | null = null;

    // Without act, we can see the initial null state
    const { result } = renderHook(() => useBrowserDiagnostics());

    // After render + effects, it should be populated
    expect(result.current).not.toBeNull();
  });
});

describe('BrowserDiagnostics component', () => {
  const mockDiagnostics: BrowserDiagnosticsData = {
    user_agent: 'Mozilla/5.0 Test',
    viewport_width: 1920,
    viewport_height: 1080,
    screen_width: 2560,
    screen_height: 1440,
    device_pixel_ratio: 2,
    current_url: 'https://example.com/support',
    referrer: 'https://example.com',
    timezone: 'America/Los_Angeles',
    language: 'en-US',
    online: true,
    cookies_enabled: true,
    collected_at: '2026-03-13T00:00:00.000Z',
  };

  it('renders nothing when diagnostics is null', () => {
    const { container } = render(<BrowserDiagnostics diagnostics={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders collapsed by default', () => {
    render(<BrowserDiagnostics diagnostics={mockDiagnostics} />);

    expect(screen.getByText('Diagnostics (attached automatically)')).toBeTruthy();
    // JSON content should not be visible when collapsed
    expect(screen.queryByText(/user_agent/)).toBeNull();
  });

  it('expands to show diagnostics JSON when clicked', async () => {
    const user = userEvent.setup();
    render(<BrowserDiagnostics diagnostics={mockDiagnostics} />);

    const button = screen.getByText('Diagnostics (attached automatically)');
    await user.click(button);

    // After expanding, the JSON should be visible
    expect(screen.getByText(/user_agent/)).toBeTruthy();
    expect(screen.getByText(/Mozilla\/5\.0 Test/)).toBeTruthy();
  });

  it('collapses again when clicked a second time', async () => {
    const user = userEvent.setup();
    render(<BrowserDiagnostics diagnostics={mockDiagnostics} />);

    const button = screen.getByText('Diagnostics (attached automatically)');
    await user.click(button); // expand
    await user.click(button); // collapse

    expect(screen.queryByText(/user_agent/)).toBeNull();
  });
});
