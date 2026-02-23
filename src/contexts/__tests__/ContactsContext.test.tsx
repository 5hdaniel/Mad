/**
 * ContactsContext Tests
 * Verifies contacts loading is centralized and prevents duplicate API calls.
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ContactsProvider, useContacts } from "../ContactsContext";

jest.mock("../NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: true,
    isChecking: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
    connectionError: null,
    checkConnection: jest.fn(),
    clearError: jest.fn(),
    setConnectionError: jest.fn(),
  }),
}));

// Mock window.api
const mockGetAll = jest.fn();
const mockGetSortedByActivity = jest.fn();

beforeAll(() => {
  (window as unknown as { api: unknown }).api = {
    contacts: {
      getAll: mockGetAll,
      getSortedByActivity: mockGetSortedByActivity,
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAll.mockResolvedValue({
    success: true,
    contacts: [
      { id: "1", name: "John Doe", email: "john@example.com" },
      { id: "2", name: "Jane Smith", email: "jane@example.com" },
    ],
  });
  mockGetSortedByActivity.mockResolvedValue({
    success: true,
    contacts: [
      { id: "2", name: "Jane Smith", email: "jane@example.com" },
      { id: "1", name: "John Doe", email: "john@example.com" },
    ],
  });
});

// Test component that uses the context
function TestConsumer() {
  const { contacts, loading, error } = useContacts();
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <div>
      <div data-testid="contact-count">{contacts.length} contacts</div>
      {contacts.map((c) => (
        <div key={c.id} data-testid={`contact-${c.id}`}>
          {c.name}
        </div>
      ))}
    </div>
  );
}

describe("ContactsContext", () => {
  describe("ContactsProvider", () => {
    it("loads contacts on mount using getAll when no propertyAddress", async () => {
      render(
        <ContactsProvider userId="user-1" propertyAddress="">
          <TestConsumer />
        </ContactsProvider>
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("contact-count")).toHaveTextContent(
          "2 contacts"
        );
      });

      expect(mockGetAll).toHaveBeenCalledWith("user-1");
      expect(mockGetSortedByActivity).not.toHaveBeenCalled();
    });

    it("loads contacts using getSortedByActivity when propertyAddress provided", async () => {
      render(
        <ContactsProvider userId="user-1" propertyAddress="123 Main St">
          <TestConsumer />
        </ContactsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("contact-count")).toHaveTextContent(
          "2 contacts"
        );
      });

      expect(mockGetSortedByActivity).toHaveBeenCalledWith(
        "user-1",
        "123 Main St"
      );
      expect(mockGetAll).not.toHaveBeenCalled();
    });

    it("handles API errors gracefully", async () => {
      mockGetAll.mockResolvedValueOnce({
        success: false,
        error: "Database connection failed",
      });

      render(
        <ContactsProvider userId="user-1" propertyAddress="">
          <TestConsumer />
        </ContactsProvider>
      );

      await waitFor(() => {
        expect(
          screen.getByText("Error: Database connection failed")
        ).toBeInTheDocument();
      });
    });

    it("handles network exceptions gracefully", async () => {
      mockGetAll.mockRejectedValueOnce(new Error("Network timeout"));

      render(
        <ContactsProvider userId="user-1" propertyAddress="">
          <TestConsumer />
        </ContactsProvider>
      );

      // Service layer captures the original error message and passes it through
      await waitFor(() => {
        expect(screen.getByText("Error: Network timeout")).toBeInTheDocument();
      });
    });

    it("only loads contacts once even with multiple consumers", async () => {
      render(
        <ContactsProvider userId="user-1" propertyAddress="">
          <TestConsumer />
          <TestConsumer />
          <TestConsumer />
        </ContactsProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByTestId("contact-count")).toHaveLength(3);
      });

      // API should only be called once despite 3 consumers
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("useContacts hook", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useContacts must be used within a ContactsProvider");

      consoleSpy.mockRestore();
    });

    it("provides refreshContacts function", async () => {
      function RefreshTestConsumer() {
        const { contacts, refreshContacts } = useContacts();
        return (
          <div>
            <div data-testid="count">{contacts.length}</div>
            <button onClick={() => refreshContacts()}>Refresh</button>
          </div>
        );
      }

      render(
        <ContactsProvider userId="user-1" propertyAddress="">
          <RefreshTestConsumer />
        </ContactsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("2");
      });

      expect(mockGetAll).toHaveBeenCalledTimes(1);

      // Update mock to return different data
      mockGetAll.mockResolvedValueOnce({
        success: true,
        contacts: [
          { id: "1", name: "John Doe", email: "john@example.com" },
          { id: "2", name: "Jane Smith", email: "jane@example.com" },
          { id: "3", name: "New Contact", email: "new@example.com" },
        ],
      });

      // Click refresh
      await act(async () => {
        screen.getByText("Refresh").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count")).toHaveTextContent("3");
      });

      expect(mockGetAll).toHaveBeenCalledTimes(2);
    });
  });
});
