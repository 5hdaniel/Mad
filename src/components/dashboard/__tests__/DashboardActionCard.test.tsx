/**
 * DashboardActionCard Tests
 *
 * BACKLOG-294: Tests for the reusable dashboard action card component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardActionCard } from "../DashboardActionCard";

// Test icon component
const TestIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
  </svg>
);

describe("DashboardActionCard", () => {
  const defaultProps = {
    title: "Test Action",
    onClick: jest.fn(),
    icon: <TestIcon />,
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-600",
    accentColor: "blue",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render with title", () => {
    render(<DashboardActionCard {...defaultProps} />);

    expect(screen.getByText("Test Action")).toBeInTheDocument();
  });

  it("should render with description when provided", () => {
    render(
      <DashboardActionCard {...defaultProps} description="Test description" />
    );

    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    render(<DashboardActionCard {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it("should render badge when provided", () => {
    render(<DashboardActionCard {...defaultProps} badge="3 new" />);

    expect(screen.getByText("3 new")).toBeInTheDocument();
  });

  it("should not render badge when null", () => {
    render(<DashboardActionCard {...defaultProps} badge={null} />);

    expect(screen.queryByText("new")).not.toBeInTheDocument();
  });

  it("should apply data-tour attribute when provided", () => {
    render(<DashboardActionCard {...defaultProps} dataTour="test-tour" />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "data-tour",
      "test-tour"
    );
  });

  it("should render children", () => {
    render(
      <DashboardActionCard {...defaultProps}>
        <span data-testid="child-element">Child content</span>
      </DashboardActionCard>
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
  });

  describe("variants", () => {
    it("should render primary variant by default", () => {
      render(<DashboardActionCard {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("shadow-xl");
    });

    it("should render secondary variant when specified", () => {
      render(<DashboardActionCard {...defaultProps} variant="secondary" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-opacity-70");
    });
  });

  describe("highlighted state", () => {
    it("should apply highlighted styles when highlighted is true", () => {
      render(<DashboardActionCard {...defaultProps} highlighted />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("ring-2");
    });
  });
});
