/**
 * Tests for Transactions component
 * Tests transaction loading, error handling, and user interactions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Transactions from '../Transactions';

// Mock the window.api
const mockApi = {
  transactions: {
    getAll: jest.fn(),
    scan: jest.fn(),
  },
  onTransactionScanProgress: jest.fn(() => () => {}), // Returns cleanup function
};

describe('Transactions Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    window.api = mockApi;
  });

  afterEach(() => {
    delete window.api;
  });

  describe('Transaction Loading', () => {
    it('should display loading state initially', () => {
      mockApi.transactions.getAll.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should load and display transactions successfully', async () => {
      const mockTransactions = [
        {
          id: '1',
          property_address: '123 Main St',
          closing_date: '2024-01-15',
          status: 'active',
          transaction_type: 'purchase',
        },
        {
          id: '2',
          property_address: '456 Oak Ave',
          closing_date: '2024-02-20',
          status: 'closed',
          transaction_type: 'sale',
        },
      ];

      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: mockTransactions,
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      });
    });

    // FIXED: Test now properly expects the error message to be displayed
    it('should display "failed to load" error message when loading fails', async () => {
      mockApi.transactions.getAll.mockResolvedValue({
        success: false,
        error: 'Failed to load transactions',
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      // Wait for and verify the error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should display error when API call throws exception', async () => {
      mockApi.transactions.getAll.mockRejectedValue(new Error('Network error'));

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Scanning', () => {
    it('should start scan when scan button is clicked', async () => {
      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: [],
      });

      mockApi.transactions.scan.mockResolvedValue({
        success: true,
        transactionsFound: 5,
        emailsScanned: 100,
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const scanButton = screen.getByText(/scan emails/i);
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(mockApi.transactions.scan).toHaveBeenCalledWith('test-user', expect.any(Object));
      });
    });

    it('should display scan progress', async () => {
      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: [],
      });

      mockApi.transactions.scan.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const scanButton = screen.getByText(/scan emails/i);
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/scanning/i)).toBeInTheDocument();
      });
    });

    it('should display scan results', async () => {
      mockApi.transactions.getAll
        .mockResolvedValueOnce({ success: true, transactions: [] })
        .mockResolvedValueOnce({ success: true, transactions: [] });

      mockApi.transactions.scan.mockResolvedValue({
        success: true,
        transactionsFound: 5,
        emailsScanned: 100,
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const scanButton = screen.getByText(/scan emails/i);
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/found 5 transactions/i)).toBeInTheDocument();
      });
    });

    it('should handle scan errors', async () => {
      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: [],
      });

      mockApi.transactions.scan.mockResolvedValue({
        success: false,
        error: 'Scan failed due to API error',
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const scanButton = screen.getByText(/scan emails/i);
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/scan failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Filtering', () => {
    beforeEach(async () => {
      const mockTransactions = [
        {
          id: '1',
          property_address: '123 Main St',
          status: 'active',
          transaction_type: 'purchase',
        },
        {
          id: '2',
          property_address: '456 Oak Ave',
          status: 'closed',
          transaction_type: 'sale',
        },
      ];

      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: mockTransactions,
      });
    });

    it('should filter transactions by status', async () => {
      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      });

      // Click the "Closed" filter button
      const closedButton = screen.getByText(/closed \(/i);
      fireEvent.click(closedButton);

      // Should only show closed transaction
      await waitFor(() => {
        expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      });
    });

    it('should filter transactions by search query', async () => {
      render(<Transactions userId="test-user" provider="gmail" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText(/search by address/i);
      fireEvent.change(searchInput, { target: { value: 'Main' } });

      // Should only show matching transaction
      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.queryByText('456 Oak Ave')).not.toBeInTheDocument();
      });
    });
  });

  describe('Component Navigation', () => {
    it('should call onClose when back button is clicked', async () => {
      const mockOnClose = jest.fn();

      mockApi.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: [],
      });

      render(<Transactions userId="test-user" provider="gmail" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const backButton = screen.getByText(/back to dashboard/i);
      fireEvent.click(backButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
