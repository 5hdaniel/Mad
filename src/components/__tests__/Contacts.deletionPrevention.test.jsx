/**
 * Integration tests for contact deletion prevention UI
 * Tests the Contacts component blocking modal and user flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Contacts from '../Contacts';

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

      window.api.contacts.remove.mockResolvedValue({
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

      // Click on contact card to view details
      fireEvent.click(screen.getByText('John Doe'));

      // Wait for details view and click delete button
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(btn =>
          btn.textContent.includes('Delete') || btn.title?.includes('Delete')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }
      }, { timeout: 5000 });

      // Should eventually call checkCanDelete
      await waitFor(() => {
        expect(window.api.contacts.checkCanDelete).toHaveBeenCalledWith('contact-1');
      }, { timeout: 5000 });

      // Should show confirmation dialog
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Should call remove API
      expect(window.api.contacts.remove).toHaveBeenCalledWith('contact-1');
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

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on contact card
      fireEvent.click(screen.getByText('John Doe'));

      // Find and click delete button
      await waitFor(async () => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(btn =>
          btn.textContent.includes('Delete') || btn.title?.includes('Delete')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }

        // Wait for blocking modal to appear
        await waitFor(() => {
          expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
        });
      }, { timeout: 5000 });

      // Should show transaction count
      expect(screen.getByText(/associated with.*2 transaction/i)).toBeInTheDocument();

      // Should display transaction addresses
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
    });

    it('should NOT call delete API when blocking modal is shown', async () => {
      render(<Contacts userId={mockUserId} onClose={mockOnClose} />);

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on contact card
      fireEvent.click(screen.getByText('John Doe'));

      // Find and click delete button
      await waitFor(async () => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(btn =>
          btn.textContent.includes('Delete') || btn.title?.includes('Delete')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }

        // Wait for blocking modal
        await waitFor(() => {
          expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
        });
      }, { timeout: 5000 });

      // Should NOT call remove API
      expect(window.api.contacts.remove).not.toHaveBeenCalled();
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

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on contact card
      fireEvent.click(screen.getByText('John Doe'));

      // Find and click delete button
      await waitFor(async () => {
        const deleteButtons = screen.getAllByRole('button');
        const deleteButton = deleteButtons.find(btn =>
          btn.textContent.includes('Delete') || btn.title?.includes('Delete')
        );
        if (deleteButton) {
          fireEvent.click(deleteButton);
        }

        // Wait for error alert
        await waitFor(() => {
          expect(global.alert).toHaveBeenCalled();
        });
      }, { timeout: 5000 });

      // Should not proceed with deletion
      expect(window.api.contacts.remove).not.toHaveBeenCalled();
    });
  });
});
