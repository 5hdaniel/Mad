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

  it("should show auto-detected hint when date is found", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate="2024-06-15"
      />,
    );

    expect(screen.getByText(/auto-detected from earliest client communication/i)).toBeInTheDocument();
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

    expect(screen.getByText(/no communications found/i)).toBeInTheDocument();
  });

  it("should show select-contacts hint in auto mode with no detection yet", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate={undefined}
        isAutoDetecting={false}
      />,
    );

    expect(screen.getByText(/select contacts in step 2/i)).toBeInTheDocument();
  });

  it("should disable date input when auto mode has detected date", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate="2024-06-15"
      />,
    );

    const dateInputs = screen.getAllByDisplayValue(defaultAddressData.started_at);
    const startDateInput = dateInputs[0];
    expect(startDateInput).toBeDisabled();
  });

  it("should not disable date input in manual mode", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    const dateInputs = screen.getAllByDisplayValue(defaultAddressData.started_at);
    const startDateInput = dateInputs[0];
    expect(startDateInput).not.toBeDisabled();
  });

  it("should show manual help text in manual mode", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="manual"
        onStartDateModeChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/required - the date you began/i)).toBeInTheDocument();
  });

  it("should apply indigo border when auto-detected date is set", () => {
    render(
      <AddressVerificationStep
        {...defaultProps}
        startDateMode="auto"
        onStartDateModeChange={jest.fn()}
        autoDetectedDate="2024-06-15"
      />,
    );

    const dateInputs = screen.getAllByDisplayValue(defaultAddressData.started_at);
    const startDateInput = dateInputs[0];
    expect(startDateInput.className).toContain("border-indigo-300");
    expect(startDateInput.className).toContain("bg-indigo-50");
  });
});
