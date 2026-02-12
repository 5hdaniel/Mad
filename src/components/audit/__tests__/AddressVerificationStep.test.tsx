/**
 * Tests for AddressVerificationStep component (TASK-1974)
 * Covers the Auto/Manual start date toggle feature
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import AddressVerificationStep from "../AddressVerificationStep";
import type { AddressData } from "../../../hooks/useAuditTransaction";

describe("AddressVerificationStep - Start Date Auto/Manual Toggle", () => {
  const defaultAddressData: AddressData = {
    property_address: "123 Main St",
    property_street: "123 Main St",
    property_city: "Anytown",
    property_state: "CA",
    property_zip: "90210",
    property_coordinates: null,
    transaction_type: "purchase",
    started_at: "2025-01-15",
    closing_deadline: undefined,
    closed_at: undefined,
  };

  const defaultProps = {
    addressData: defaultAddressData,
    onAddressChange: jest.fn(),
    onTransactionTypeChange: jest.fn(),
    onStartDateChange: jest.fn(),
    onClosingDateChange: jest.fn(),
    onEndDateChange: jest.fn(),
    showAutocomplete: false,
    suggestions: [],
    onSelectSuggestion: jest.fn(),
  };

  it("should render without toggle when onStartDateModeChange is not provided", () => {
    render(<AddressVerificationStep {...defaultProps} />);

    expect(screen.queryByRole("button", { name: /auto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manual/i })).not.toBeInTheDocument();
  });

  it("should render Auto/Manual toggle when onStartDateModeChange is provided", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^auto$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^manual$/i })).toBeInTheDocument();
  });

  it("should highlight Auto button when in auto mode", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
      />,
    );

    const autoBtn = screen.getByRole("button", { name: /^auto$/i });
    expect(autoBtn.className).toContain("bg-indigo-500");
    expect(autoBtn.className).toContain("text-white");
  });

  it("should highlight Manual button when in manual mode", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    const manualBtn = screen.getByRole("button", { name: /^manual$/i });
    expect(manualBtn.className).toContain("bg-indigo-500");
    expect(manualBtn.className).toContain("text-white");
  });

  it("should call onStartDateModeChange when clicking toggle buttons", async () => {
    const onModeChange = jest.fn();
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={onModeChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^manual$/i }));
    expect(onModeChange).toHaveBeenCalledWith("manual");

    await userEvent.click(screen.getByRole("button", { name: /^auto$/i }));
    expect(onModeChange).toHaveBeenCalledWith("auto");
  });

  it("should show spinner when auto-detecting", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        isAutoDetecting={true}
      />,
    );

    expect(screen.getByText(/detecting from communications/i)).toBeInTheDocument();
  });

  it("should show formatted audit period with auto-detected date", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        addressData={{ ...defaultAddressData, started_at: "2024-06-15" }}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate="2024-06-15"
      />,
    );

    // Should show the formatted date and "Based on earliest"
    expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/based on earliest client communication/i)).toBeInTheDocument();
  });

  it("should show no-communications hint in auto mode with null date", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate={null}
        isAutoDetecting={false}
      />,
    );

    expect(screen.getByText(/no communications found.*60 days/i)).toBeInTheDocument();
  });

  it("should show pending state when awaiting contact selection", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate={undefined}
        isAutoDetecting={false}
      />,
    );

    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/start date will be set after selecting contacts/i)).toBeInTheDocument();
  });

  it("should hide date inputs in auto mode and show them in manual mode", () => {
    const { rerender } = render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate={undefined}
      />,
    );

    // Auto mode: no date inputs visible
    expect(screen.queryByLabelText(/representation start date/i)).not.toBeInTheDocument();

    rerender(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    // Manual mode: date inputs visible
    expect(screen.getByText(/representation start date/i)).toBeInTheDocument();
  });

  it("should show manual help text in manual mode", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/required.*the date you began/i)).toBeInTheDocument();
  });

  it("should show Audit Period label in auto mode and Transaction Dates in manual", () => {
    const { rerender } = render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Audit Period")).toBeInTheDocument();

    rerender(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Transaction Dates")).toBeInTheDocument();
  });
});
