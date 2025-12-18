import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  TransactionSkeleton,
  LLMProcessingIndicator,
  LLMProgressIndicator,
  LLMProgressBar,
  LLMStatusMessage,
  LLMErrorState,
  LLMStatus,
} from '../LLMLoadingStates';

describe('TransactionSkeleton', () => {
  it('should render skeleton placeholder', () => {
    render(<TransactionSkeleton />);
    const skeleton = document.querySelector('.transaction-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('should have animate-pulse class for loading effect', () => {
    render(<TransactionSkeleton />);
    const skeleton = document.querySelector('.transaction-skeleton');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('should have accessible loading status', () => {
    render(<TransactionSkeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Loading transaction');
  });

  it('should have screen reader text', () => {
    render(<TransactionSkeleton />);
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });
});

describe('LLMProcessingIndicator', () => {
  it('should render with default message', () => {
    render(<LLMProcessingIndicator />);
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LLMProcessingIndicator message="Processing emails..." />);
    expect(screen.getByText('Processing emails...')).toBeInTheDocument();
  });

  it('should render step description when provided', () => {
    render(
      <LLMProcessingIndicator
        message="Analyzing..."
        stepDescription="Step 1 of 3: Extracting data"
      />
    );
    expect(screen.getByText('Step 1 of 3: Extracting data')).toBeInTheDocument();
  });

  it('should have spinner animation', () => {
    render(<LLMProcessingIndicator />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should have accessible status role', () => {
    render(<LLMProcessingIndicator />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('LLMProgressIndicator', () => {
  it('should render progress text with current/total', () => {
    render(<LLMProgressIndicator current={5} total={10} />);
    expect(screen.getByText('Analyzing with AI... 5/10')).toBeInTheDocument();
  });

  it('should calculate and display correct progress percentage', () => {
    render(<LLMProgressIndicator current={5} total={10} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
  });

  it('should display estimated time remaining when provided', () => {
    render(<LLMProgressIndicator current={5} total={10} estimatedTimeRemaining={30} />);
    expect(screen.getByText('~30s remaining')).toBeInTheDocument();
  });

  it('should not display time remaining when zero', () => {
    render(<LLMProgressIndicator current={5} total={10} estimatedTimeRemaining={0} />);
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('should not display time remaining when not provided', () => {
    render(<LLMProgressIndicator current={5} total={10} />);
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('should display step description when provided', () => {
    render(
      <LLMProgressIndicator
        current={5}
        total={10}
        stepDescription="Analyzing email content"
      />
    );
    expect(screen.getByText('Analyzing email content')).toBeInTheDocument();
  });

  it('should handle zero total gracefully', () => {
    render(<LLMProgressIndicator current={0} total={0} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
  });

  it('should cap progress at 100%', () => {
    render(<LLMProgressIndicator current={15} total={10} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });

  it('should have accessible aria attributes', () => {
    render(<LLMProgressIndicator current={5} total={10} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-label', 'Processing 5 of 10');
  });
});

describe('LLMProgressBar', () => {
  it('should render progress bar with correct percentage', () => {
    render(<LLMProgressBar progress={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should clamp progress to 0-100 range', () => {
    const { rerender } = render(<LLMProgressBar progress={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();

    rerender(<LLMProgressBar progress={-50} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should render step description when provided', () => {
    render(<LLMProgressBar progress={50} stepDescription="Extracting addresses" />);
    expect(screen.getByText('Extracting addresses')).toBeInTheDocument();
  });

  it('should render step indicators when steps provided', () => {
    render(
      <LLMProgressBar
        progress={50}
        steps={['Parse', 'Analyze', 'Extract']}
        currentStep={1}
      />
    );
    expect(screen.getByText('Parse')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByText('Extract')).toBeInTheDocument();
  });

  it('should highlight current and completed steps', () => {
    render(
      <LLMProgressBar
        progress={66}
        steps={['Step 1', 'Step 2', 'Step 3']}
        currentStep={1}
      />
    );
    // Step 1 (completed) and Step 2 (current) should have blue text
    const step1 = screen.getByText('Step 1');
    const step2 = screen.getByText('Step 2');
    expect(step1.parentElement).toHaveClass('text-blue-600', 'font-medium');
    expect(step2.parentElement).toHaveClass('text-blue-600', 'font-medium');
  });

  it('should have accessible progressbar role', () => {
    render(<LLMProgressBar progress={50} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });
});

describe('LLMStatusMessage', () => {
  const statuses: LLMStatus[] = ['analyzing', 'complete', 'fallback'];

  it.each(statuses)('should render correctly for %s status', (status) => {
    render(<LLMStatusMessage status={status} />);
    const statusElement = document.querySelector('.llm-status');
    expect(statusElement).toBeInTheDocument();
  });

  it('should display analyzing message', () => {
    render(<LLMStatusMessage status="analyzing" />);
    expect(screen.getByText('Analyzing emails with AI...')).toBeInTheDocument();
  });

  it('should display complete message', () => {
    render(<LLMStatusMessage status="complete" />);
    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
  });

  it('should display fallback message', () => {
    render(<LLMStatusMessage status="fallback" />);
    expect(screen.getByText('Using pattern matching (LLM unavailable)')).toBeInTheDocument();
  });

  it('should display custom message when provided', () => {
    render(<LLMStatusMessage status="analyzing" customMessage="Custom processing message" />);
    expect(screen.getByText('Custom processing message')).toBeInTheDocument();
  });

  it('should show spinner for analyzing status', () => {
    render(<LLMStatusMessage status="analyzing" />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show check icon for complete status', () => {
    render(<LLMStatusMessage status="complete" />);
    const svg = document.querySelector('svg.text-green-600');
    expect(svg).toBeInTheDocument();
  });

  it('should show info icon for fallback status', () => {
    render(<LLMStatusMessage status="fallback" />);
    const svg = document.querySelector('svg.text-yellow-600');
    expect(svg).toBeInTheDocument();
  });

  it('should have accessible status role', () => {
    render(<LLMStatusMessage status="analyzing" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('LLMErrorState', () => {
  it('should render error message', () => {
    render(<LLMErrorState message="An error occurred" />);
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
  });

  it('should have alert role', () => {
    render(<LLMErrorState message="Error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should show retry button when onRetry provided and showRetry is true', () => {
    const onRetry = jest.fn();
    render(<LLMErrorState message="Error" onRetry={onRetry} showRetry={true} />);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<LLMErrorState message="Error" onRetry={onRetry} />);
    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button when showRetry is false', () => {
    const onRetry = jest.fn();
    render(<LLMErrorState message="Error" onRetry={onRetry} showRetry={false} />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should not show retry button when onRetry is not provided', () => {
    render(<LLMErrorState message="Error" showRetry={true} />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should show retry button by default when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<LLMErrorState message="Error" onRetry={onRetry} />);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should have error icon', () => {
    render(<LLMErrorState message="Error" />);
    const svg = document.querySelector('svg.text-red-600');
    expect(svg).toBeInTheDocument();
  });
});
