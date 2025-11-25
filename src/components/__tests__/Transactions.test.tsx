/**
 * Tests for Transactions.tsx
 * Covers transaction listing, CRUD operations, filtering, and export
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Transactions from '../Transactions';

describe('Transactions', () => {
  const mockUserId = 'user-123';
  const mockProvider = 'google';
  const mockOnClose = jest.fn();

  const mockTransactions = [
    {
      id: 'txn-1',
      user_id: mockUserId,
      property_address: '123 Main Street',
      transaction_type: 'purchase',
      status: 'active',
      sale_price: 450000,
      closing_date: '2024-03-15',
      total_communications_count: 25,
      extraction_confidence: 85,
    },
    {
      id: 'txn-2',
      user_id: mockUserId,
      property_address: '456 Oak Avenue',
      transaction_type: 'sale',
      status: 'closed',
      sale_price: 325000,
      closing_date: '2024-01-20',
      total_communications_count: 18,
      extraction_confidence: 92,
    },
    {
      id: 'txn-3',
      user_id: mockUserId,
      property_address: '789 Pine Road',
      transaction_type: 'purchase',
      status: 'active',
      sale_price: 550000,
      closing_date: null,
      total_communications_count: 12,
      extraction_confidence: 78,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: return transactions
    window.api.transactions.getAll.mockResolvedValue({
      success: true,
      transactions: mockTransactions,
    });
    window.api.onTransactionScanProgress.mockReturnValue(jest.fn());
  });

  describe('Transaction Listing', () => {
    it('should render transactions list when loaded', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      // Wait for transactions to load
      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Verify API was called
      expect(window.api.transactions.getAll).toHaveBeenCalledWith(mockUserId);

      // All active transactions should be visible (default filter is 'active')
      expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      expect(screen.getByText('789 Pine Road')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      // Delay the API response
      window.api.transactions.getAll.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
    });

    it('should show empty state when no transactions', async () => {
      window.api.transactions.getAll.mockResolvedValue({
        success: true,
        transactions: [],
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
      });
    });

    it('should show error when API fails', async () => {
      window.api.transactions.getAll.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
      });
    });

    it('should display transaction count in header', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/3 properties found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Filtering', () => {
    it('should filter by active status by default', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Active transactions visible
      expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      expect(screen.getByText('789 Pine Road')).toBeInTheDocument();

      // Closed transaction not visible
      expect(screen.queryByText('456 Oak Avenue')).not.toBeInTheDocument();
    });

    it('should filter by closed status when clicked', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Click closed filter
      const closedButton = screen.getByRole('button', { name: /closed/i });
      await userEvent.click(closedButton);

      // Closed transaction visible
      await waitFor(() => {
        expect(screen.getByText('456 Oak Avenue')).toBeInTheDocument();
      });

      // Active transactions not visible
      expect(screen.queryByText('123 Main Street')).not.toBeInTheDocument();
      expect(screen.queryByText('789 Pine Road')).not.toBeInTheDocument();
    });

    it('should show all transactions when all filter is clicked', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Click all filter
      const allButton = screen.getByRole('button', { name: /all \(/i });
      await userEvent.click(allButton);

      // All transactions visible
      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Avenue')).toBeInTheDocument();
        expect(screen.getByText('789 Pine Road')).toBeInTheDocument();
      });
    });

    it('should filter by search query', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText(/search by address/i);
      await userEvent.type(searchInput, 'Main');

      // Only matching transaction visible
      expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      expect(screen.queryByText('789 Pine Road')).not.toBeInTheDocument();
    });

    it('should show no matching transactions message', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Type non-matching search
      const searchInput = screen.getByPlaceholderText(/search by address/i);
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no matching transactions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Display', () => {
    it('should display transaction type correctly', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      expect(screen.getAllByText('Purchase').length).toBeGreaterThan(0);
    });

    it('should format sale price as currency', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Check for formatted currency
      expect(screen.getByText('$450,000')).toBeInTheDocument();
    });

    it('should display email count', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      expect(screen.getByText(/25 emails/i)).toBeInTheDocument();
    });
  });

  describe('New Transaction', () => {
    it('should open audit transaction modal when new transaction button is clicked', async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [],
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const newTransactionButton = screen.getByRole('button', { name: /new transaction/i });
      await userEvent.click(newTransactionButton);

      // Audit modal should open
      await waitFor(() => {
        expect(screen.getByText(/audit new transaction/i)).toBeInTheDocument();
      });
    });
  });

  describe('Email Scan', () => {
    it('should start scan when scan button is clicked', async () => {
      window.api.transactions.scan.mockResolvedValue({
        success: true,
        transactionsFound: 5,
        emailsScanned: 100,
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const scanButton = screen.getByRole('button', { name: /scan emails/i });
      await userEvent.click(scanButton);

      expect(window.api.transactions.scan).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          provider: mockProvider,
        })
      );
    });

    it('should disable scan button while scanning', async () => {
      window.api.transactions.scan.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const scanButton = screen.getByRole('button', { name: /scan emails/i });
      await userEvent.click(scanButton);

      // Button should show scanning state
      expect(screen.getByText(/scanning/i)).toBeInTheDocument();
    });

    it('should show scan results on completion', async () => {
      window.api.transactions.scan.mockResolvedValue({
        success: true,
        transactionsFound: 5,
        emailsScanned: 100,
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const scanButton = screen.getByRole('button', { name: /scan emails/i });
      await userEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/found 5 transactions/i)).toBeInTheDocument();
      });
    });

    it('should show error when scan fails', async () => {
      window.api.transactions.scan.mockResolvedValue({
        success: false,
        error: 'Email API connection failed',
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const scanButton = screen.getByRole('button', { name: /scan emails/i });
      await userEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/email api connection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Export', () => {
    it('should show export button on each transaction', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Export buttons should be visible
      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      expect(exportButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('should call onClose when back button is clicked', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await userEvent.click(backButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should open transaction details when clicking on a transaction', async () => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransactions[0],
          communications: [],
          contact_assignments: [],
        },
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Click on transaction
      const transactionCard = screen.getByText('123 Main Street').closest('div[class*="cursor-pointer"]');
      if (transactionCard) {
        await userEvent.click(transactionCard);
      }

      // Transaction details modal should open
      await waitFor(() => {
        expect(screen.getAllByText(/transaction details/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Transaction Details Modal', () => {
    const mockTransactionWithDetails = {
      ...mockTransactions[0],
      communications: [
        {
          id: 'comm-1',
          subject: 'RE: Property Offer',
          sender: 'agent@example.com',
          sent_at: '2024-03-10',
          body_plain: 'Thank you for your offer on the property...',
        },
      ],
      contact_assignments: [
        {
          id: 'assign-1',
          contact_id: 'contact-1',
          contact_name: 'John Agent',
          contact_email: 'john@realty.com',
          role: 'buyer_agent',
          specific_role: 'Buyer Agent',
          is_primary: 1,
        },
      ],
    };

    beforeEach(() => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: mockTransactionWithDetails,
      });
    });

    it('should display transaction price and closing date', async () => {
      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Click on transaction
      const transactionCard = screen.getByText('123 Main Street').closest('div[class*="cursor-pointer"]');
      if (transactionCard) {
        await userEvent.click(transactionCard);
      }

      await waitFor(() => {
        expect(screen.getByText(/\$450,000/)).toBeInTheDocument();
      });
    });
  });

  describe('Delete Transaction', () => {
    it('should have delete button in transaction details', async () => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransactions[0],
          communications: [],
          contact_assignments: [],
        },
      });

      render(<Transactions userId={mockUserId} provider={mockProvider} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      });

      // Click on transaction
      const transactionCard = screen.getByText('123 Main Street').closest('div[class*="cursor-pointer"]');
      if (transactionCard) {
        await userEvent.click(transactionCard);
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should have getAll API available', () => {
      expect(window.api.transactions.getAll).toBeDefined();
      expect(typeof window.api.transactions.getAll).toBe('function');
    });

    it('should have scan API available', () => {
      expect(window.api.transactions.scan).toBeDefined();
      expect(typeof window.api.transactions.scan).toBe('function');
    });

    it('should have delete API available', () => {
      expect(window.api.transactions.delete).toBeDefined();
      expect(typeof window.api.transactions.delete).toBe('function');
    });

    it('should have update API available', () => {
      expect(window.api.transactions.update).toBeDefined();
      expect(typeof window.api.transactions.update).toBe('function');
    });
  });
});
