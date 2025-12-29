import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIStatusCard } from "../AIStatusCard";

describe("AIStatusCard", () => {
  const mockOnViewPending = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders loading skeleton when isLoading is true", () => {
      render(
        <AIStatusCard
          pendingCount={0}
          onViewPending={mockOnViewPending}
          isLoading={true}
        />
      );

      expect(screen.getByTestId("ai-status-card-loading")).toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-status-card-pending")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-status-card-empty")
      ).not.toBeInTheDocument();
    });

    it("does not show Review Now button when loading", () => {
      render(
        <AIStatusCard
          pendingCount={5}
          onViewPending={mockOnViewPending}
          isLoading={true}
        />
      );

      expect(
        screen.queryByTestId("ai-status-review-button")
      ).not.toBeInTheDocument();
    });
  });

  describe("Zero State (No Pending Items)", () => {
    it('renders "All Caught Up" message when pendingCount is 0', () => {
      render(
        <AIStatusCard
          pendingCount={0}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(screen.getByTestId("ai-status-card-empty")).toBeInTheDocument();
      expect(screen.getByText("All Caught Up")).toBeInTheDocument();
      expect(
        screen.getByText(/No transactions awaiting review/)
      ).toBeInTheDocument();
    });

    it("does not show Review Now button when no pending items", () => {
      render(
        <AIStatusCard
          pendingCount={0}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(
        screen.queryByTestId("ai-status-review-button")
      ).not.toBeInTheDocument();
    });
  });

  describe("Pending Items State", () => {
    it("renders pending state when there are pending transactions", () => {
      render(
        <AIStatusCard
          pendingCount={3}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(screen.getByTestId("ai-status-card-pending")).toBeInTheDocument();
      expect(screen.getByText("AI Transaction Detection")).toBeInTheDocument();
      expect(screen.getByText("3 transactions awaiting review")).toBeInTheDocument();
    });

    it("shows correct singular form for 1 transaction", () => {
      render(
        <AIStatusCard
          pendingCount={1}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(screen.getByText("1 transaction awaiting review")).toBeInTheDocument();
    });

    it("shows correct plural form for multiple transactions", () => {
      render(
        <AIStatusCard
          pendingCount={5}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(screen.getByText("5 transactions awaiting review")).toBeInTheDocument();
    });

    it("renders Review Now button when there are pending items", () => {
      render(
        <AIStatusCard
          pendingCount={2}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      const button = screen.getByTestId("ai-status-review-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Review Now");
    });
  });

  describe("User Interactions", () => {
    it("calls onViewPending when Review Now button is clicked", () => {
      render(
        <AIStatusCard
          pendingCount={3}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      const button = screen.getByTestId("ai-status-review-button");
      fireEvent.click(button);

      expect(mockOnViewPending).toHaveBeenCalledTimes(1);
    });

    it("does not call onViewPending if button is not clicked", () => {
      render(
        <AIStatusCard
          pendingCount={3}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      expect(mockOnViewPending).not.toHaveBeenCalled();
    });
  });

  describe("Default Props", () => {
    it("defaults isLoading to false when not provided", () => {
      render(
        <AIStatusCard pendingCount={0} onViewPending={mockOnViewPending} />
      );

      // Should show empty state, not loading
      expect(screen.getByTestId("ai-status-card-empty")).toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-status-card-loading")
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible button with visible text", () => {
      render(
        <AIStatusCard
          pendingCount={2}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      const button = screen.getByRole("button", { name: /review now/i });
      expect(button).toBeInTheDocument();
    });

    it("has aria-hidden on decorative icons", () => {
      render(
        <AIStatusCard
          pendingCount={2}
          onViewPending={mockOnViewPending}
          isLoading={false}
        />
      );

      const svgs = document.querySelectorAll("svg");
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });
  });
});
