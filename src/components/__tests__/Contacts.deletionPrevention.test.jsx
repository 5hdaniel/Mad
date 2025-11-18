/**
 * Integration tests for contact deletion prevention UI
 * Tests the Contacts component blocking modal and user flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Contacts from '../Contacts';

// Mock the child components
jest.mock('../ImportContactsModal', () => {
  return function MockImportContactsModal({ onClose }) {
    return (
      <div data-testid="import-modal">
        <button onClick={onClose}>Close Import</button>
      </div>
    );
  };
});

jest.mock('../ContactModal', () => {
  return function MockContactModal({ onClose }) {
    return (
      <div data-testid="contact-modal">
        <button onClick={onClose}>Close Contact Modal</button>
      </div>
    );
  };
});

jest.mock('../ContactDetailsModal', () => {
  return function MockContactDetailsModal({ onClose, onRemove }) {
    return (
      <div data-testid="contact-details-modal">
        <button onClick={onRemove}>Remove Contact</button>
        <button onClick={onClose}>Close Details</button>
      </div>
    );
  };
});

describe('Contacts - Deletion Prevention', () => {
  const mockUserId = 'user-123';
  const mockOnClose = jest.fn();

  const mockContact = {
    id: 'contact-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    company: 'ABC Real Estate',
    source: 'manual',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: no contacts initially
    window.api.contacts.getAll.mockResolvedValue({
      success: true,
      contacts: [],
    });
  });

  describe('Delete contact with NO associated transactions', () => {
    beforeEach(() => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContact],
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: true,
        transactions: [],
        count: 0,
      });

      window.api.contacts.delete.mockResolvedValue({
        success: true,
      });
    });

    it('should allow deletion when contact has no transactions', async () => {
      // Mock window.confirm to return true
      global.confirm = jest.fn(() => true);

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on contact card to open details
      fireEvent.click(screen.getByText('John Doe'));

      // Wait for details modal
      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      // Click remove button
      fireEvent.click(screen.getByText('Remove Contact'));

      // Should call checkCanDelete first
      await waitFor(() => {
        expect(window.api.contacts.checkCanDelete).toHaveBeenCalledWith('contact-1');
      });

      // Should show confirmation dialog
      expect(global.confirm).toHaveBeenCalled();

      // Should call remove API
      expect(window.api.contacts.remove).toHaveBeenCalledWith('contact-1');

      // Should reload contacts
      expect(window.api.contacts.getAll).toHaveBeenCalledTimes(2); // Initial load + reload after delete
    });

    it('should not delete if user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false);

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(window.api.contacts.checkCanDelete).toHaveBeenCalled();
      });

      // User cancels
      expect(global.confirm).toHaveBeenCalled();

      // Should NOT call remove API
      expect(window.api.contacts.remove).not.toHaveBeenCalled();
    });
  });

  describe('Delete contact WITH associated transactions', () => {
    const mockTransactions = [
      {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        roles: 'Buyer Agent',
      },
      {
        id: 'txn-2',
        property_address: '456 Oak Ave',
        closing_date: '2024-02-20',
        transaction_type: 'sale',
        status: 'closed',
        roles: 'Seller Agent, Inspector',
      },
    ];

    beforeEach(() => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContact],
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: mockTransactions,
        count: 2,
      });
    });

    it('should show blocking modal when contact has associated transactions', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      // Wait for blocking modal to appear
      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Should show transaction count
      expect(screen.getByText(/associated with.*2 transactions/i)).toBeInTheDocument();

      // Should display transaction details
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      expect(screen.getByText('Buyer Agent')).toBeInTheDocument();
      expect(screen.getByText('Seller Agent, Inspector')).toBeInTheDocument();
    });

    it('should NOT call delete API when blocking modal is shown', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Should NOT call remove API
      expect(window.api.contacts.remove).not.toHaveBeenCalled();
    });

    it('should display transaction type badges correctly', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Check for transaction type badges
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText('Sale')).toBeInTheDocument();
    });

    it('should display transaction status badges correctly', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Check for status badges
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('should close blocking modal when close button is clicked', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Click the Close button in the modal footer
      const closeButtons = screen.getAllByText('Close');
      fireEvent.click(closeButtons[closeButtons.length - 1]);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText('Cannot Delete Contact')).not.toBeInTheDocument();
      });
    });

    it('should show "... and X more transactions" when more than 20 transactions', async () => {
      const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
        id: `txn-${i}`,
        property_address: `${i + 1} Test St`,
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        roles: 'Buyer Agent',
      }));

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: manyTransactions,
        count: 25,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Should show message about additional transactions
      expect(screen.getByText(/... and 5 more transactions/i)).toBeInTheDocument();

      // Should only display first 20
      expect(screen.getByText('1 Test St')).toBeInTheDocument();
      expect(screen.getByText('20 Test St')).toBeInTheDocument();
      expect(screen.queryByText('21 Test St')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContact],
      });
    });

    it('should show error alert if checkCanDelete fails', async () => {
      global.alert = jest.fn();

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to check contact: Database connection failed'
        );
      });

      // Should not proceed with deletion
      expect(window.api.contacts.remove).not.toHaveBeenCalled();
    });

    it('should show error alert if checkCanDelete throws exception', async () => {
      global.alert = jest.fn();

      window.api.contacts.checkCanDelete.mockRejectedValue(
        new Error('Network error')
      );

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to remove contact: Network error'
        );
      });
    });
  });

  describe('Singular vs plural text handling', () => {
    it('should use singular "transaction" when count is 1', async () => {
      window.api.contacts.getAll.mockResolvedValue({
        success: true,
        contacts: [mockContact],
      });

      window.api.contacts.checkCanDelete.mockResolvedValue({
        success: true,
        canDelete: false,
        transactions: [
          {
            id: 'txn-1',
            property_address: '123 Main St',
            closing_date: '2024-01-15',
            transaction_type: 'purchase',
            status: 'active',
            roles: 'Buyer Agent',
          },
        ],
        count: 1,
      });

      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('contact-details-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Remove Contact'));

      await waitFor(() => {
        expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
      });

      // Should use singular form
      expect(screen.getByText(/associated with.*1 transaction\.$/i)).toBeInTheDocument();
    });
  });
});
