/**
 * SyncProgress Component Tests
 * Tests for the reusable SyncProgress component with all three variants.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncProgress } from '../SyncProgress';
import { SyncProgressSteps } from '../SyncProgressSteps';
import type { SyncProgressStep } from '../types';

describe('SyncProgress', () => {
  describe('compact variant', () => {
    it('renders compact variant correctly', () => {
      render(
        <SyncProgress
          variant="compact"
          progress={50}
          title="Syncing..."
        />
      );

      expect(screen.getByTestId('sync-progress-compact')).toBeInTheDocument();
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('renders compact variant with progress text', () => {
      render(
        <SyncProgress
          variant="compact"
          progress={75}
          title="Downloading"
          progressText="2.5 GB / 3.0 GB"
        />
      );

      expect(screen.getByText('Downloading')).toBeInTheDocument();
      expect(screen.getByText('2.5 GB / 3.0 GB')).toBeInTheDocument();
    });

    it('renders compact variant cancel button when handler provided', async () => {
      const onCancel = jest.fn();
      const user = userEvent.setup();

      render(
        <SyncProgress
          variant="compact"
          progress={50}
          title="Processing"
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();

      await user.click(cancelButton);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('hides cancel button when error occurs', () => {
      render(
        <SyncProgress
          variant="compact"
          title="Failed"
          error="Connection lost"
          onCancel={() => {}}
        />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.getByText('Connection lost')).toBeInTheDocument();
    });
  });

  describe('standard variant', () => {
    it('renders standard variant correctly', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={78}
          title="Syncing iPhone..."
          subtitle="Keep connected"
        />
      );

      expect(screen.getByTestId('sync-progress-standard')).toBeInTheDocument();
      expect(screen.getByText('Syncing iPhone...')).toBeInTheDocument();
      expect(screen.getByText('Keep connected')).toBeInTheDocument();
    });

    it('renders standard variant with progress text', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={60}
          title="Backing up..."
          progressText="6.2 GB / 8.0 GB"
        />
      );

      expect(screen.getByText('Backing up...')).toBeInTheDocument();
      expect(screen.getByText('6.2 GB / 8.0 GB')).toBeInTheDocument();
    });

    it('renders complete state when progress is 100', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={100}
          title="Sync complete!"
        />
      );

      expect(screen.getByText('Sync complete!')).toBeInTheDocument();
      // Progress bar should not be visible when complete
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('displays last sync info when provided', () => {
      const lastSyncDate = new Date(Date.now() - 3600000); // 1 hour ago

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing..."
          lastSyncDate={lastSyncDate}
          lastSyncInfo="46.9 GB"
        />
      );

      expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
      expect(screen.getByText(/1h ago/)).toBeInTheDocument();
      expect(screen.getByText(/46\.9 GB/)).toBeInTheDocument();
    });
  });

  describe('detailed variant', () => {
    const sampleSteps: SyncProgressStep[] = [
      { label: 'Connecting to iPhone', status: 'complete', duration: '0.2s' },
      { label: 'Waiting for passcode', status: 'complete', duration: '45s' },
      { label: 'Transferring files', status: 'active', duration: '8m 14s' },
      { label: 'Reading messages', status: 'pending' },
      { label: 'Saving to database', status: 'pending' },
    ];

    it('renders detailed variant with steps', () => {
      render(
        <SyncProgress
          variant="detailed"
          progress={60}
          title="Syncing iPhone..."
          steps={sampleSteps}
        />
      );

      expect(screen.getByTestId('sync-progress-detailed')).toBeInTheDocument();
      expect(screen.getByText('Syncing iPhone...')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /progress steps/i })).toBeInTheDocument();
    });

    it('renders step statuses correctly (pending, active, complete, error)', () => {
      const stepsWithError: SyncProgressStep[] = [
        { label: 'Step 1', status: 'complete' },
        { label: 'Step 2', status: 'error', error: 'Connection timeout' },
        { label: 'Step 3', status: 'pending' },
      ];

      render(
        <SyncProgress
          variant="detailed"
          title="Processing"
          steps={stepsWithError}
          error="Sync failed"
        />
      );

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Step 3')).toBeInTheDocument();
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });

    it('renders step durations when provided', () => {
      render(
        <SyncProgress
          variant="detailed"
          progress={50}
          title="Processing"
          steps={sampleSteps}
        />
      );

      expect(screen.getByText('0.2s')).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument();
      expect(screen.getByText('8m 14s')).toBeInTheDocument();
    });
  });

  describe('progress states', () => {
    it('shows indeterminate progress when progress is undefined', () => {
      render(
        <SyncProgress
          variant="standard"
          title="Connecting..."
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-busy', 'true');
      expect(progressbar).not.toHaveAttribute('aria-valuenow');
    });

    it('shows determinate progress with 0%', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={0}
          title="Starting..."
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('shows determinate progress with 50%', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Processing..."
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows determinate progress with 100%', () => {
      render(
        <SyncProgress
          variant="compact"
          progress={100}
          title="Complete"
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('clamps progress values below 0 to 0', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={-10}
          title="Processing..."
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });

    it('clamps progress values above 100 to 100', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={150}
          title="Processing..."
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('error state', () => {
    it('renders error state with diagnostic button', async () => {
      const onCopyDiagnostics = jest.fn();
      const user = userEvent.setup();

      render(
        <SyncProgress
          variant="standard"
          title="Sync Failed"
          error="Connection refused: Unable to connect to device"
          onCopyDiagnostics={onCopyDiagnostics}
        />
      );

      expect(screen.getByText('Sync Failed')).toBeInTheDocument();
      expect(screen.getByText('Connection refused: Unable to connect to device')).toBeInTheDocument();

      const diagnosticsButton = screen.getByRole('button', { name: /copy diagnostic/i });
      expect(diagnosticsButton).toBeInTheDocument();

      await user.click(diagnosticsButton);
      expect(onCopyDiagnostics).toHaveBeenCalledTimes(1);
    });

    it('renders error state with Error object', () => {
      const error = new Error('Network timeout');

      render(
        <SyncProgress
          variant="standard"
          title="Error"
          error={error}
        />
      );

      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });

    it('renders error state in detailed variant with error box', () => {
      render(
        <SyncProgress
          variant="detailed"
          title="Sync Failed"
          error="Device disconnected"
          onCopyDiagnostics={() => {}}
        />
      );

      expect(screen.getByText('Device disconnected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy diagnostic/i })).toBeInTheDocument();
    });

    it('hides diagnostic button when no handler provided', () => {
      render(
        <SyncProgress
          variant="standard"
          title="Error"
          error="Something went wrong"
        />
      );

      expect(screen.queryByRole('button', { name: /copy diagnostic/i })).not.toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('calls onCancel when cancel button clicked', async () => {
      const onCancel = jest.fn();
      const user = userEvent.setup();

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing..."
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry when retry button clicked', async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();

      render(
        <SyncProgress
          variant="standard"
          title="Sync Failed"
          error="Connection lost"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows retry button only in error state', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing..."
          onRetry={() => {}}
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('hides cancel button when progress is 100 (complete)', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={100}
          title="Complete"
          onCancel={() => {}}
        />
      );

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Testing"
          className="custom-class"
        />
      );

      const root = screen.getByTestId('sync-progress-standard');
      expect(root).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA progressbar role', () => {
      render(
        <SyncProgress
          variant="standard"
          progress={75}
          title="Processing"
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', 'Progress');
    });

    it('uses aria-busy for indeterminate state', () => {
      render(
        <SyncProgress
          variant="standard"
          title="Loading"
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('last sync formatting', () => {
    it('shows "Just now" for recent syncs', () => {
      const justNow = new Date();

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing"
          lastSyncDate={justNow}
        />
      );

      expect(screen.getByText(/Just now/)).toBeInTheDocument();
    });

    it('shows minutes ago for syncs within an hour', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing"
          lastSyncDate={thirtyMinAgo}
        />
      );

      expect(screen.getByText(/30m ago/)).toBeInTheDocument();
    });

    it('shows hours ago for syncs within a day', () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing"
          lastSyncDate={sixHoursAgo}
        />
      );

      expect(screen.getByText(/6h ago/)).toBeInTheDocument();
    });

    it('shows "Yesterday" for syncs from yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      render(
        <SyncProgress
          variant="standard"
          progress={50}
          title="Syncing"
          lastSyncDate={yesterday}
        />
      );

      expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
    });
  });
});

describe('SyncProgressSteps', () => {
  it('renders empty state correctly', () => {
    const { container } = render(<SyncProgressSteps steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all steps', () => {
    const steps: SyncProgressStep[] = [
      { label: 'Step 1', status: 'complete' },
      { label: 'Step 2', status: 'active' },
      { label: 'Step 3', status: 'pending' },
    ];

    render(<SyncProgressSteps steps={steps} />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('renders step error messages', () => {
    const steps: SyncProgressStep[] = [
      { label: 'Failed Step', status: 'error', error: 'Something went wrong' },
    ];

    render(<SyncProgressSteps steps={steps} />);

    expect(screen.getByText('Failed Step')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    const steps: SyncProgressStep[] = [
      { label: 'Step 1', status: 'complete' },
    ];

    render(<SyncProgressSteps steps={steps} />);

    expect(screen.getByRole('list', { name: /progress steps/i })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const steps: SyncProgressStep[] = [
      { label: 'Step 1', status: 'pending' },
    ];

    render(<SyncProgressSteps steps={steps} className="custom-steps" />);

    const list = screen.getByRole('list');
    expect(list).toHaveClass('custom-steps');
  });
});
