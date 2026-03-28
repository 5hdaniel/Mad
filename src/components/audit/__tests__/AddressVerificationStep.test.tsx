/**
 * Tests for AddressVerificationStep component (TASK-1974)
 * Covers the Auto/Manual start date toggle feature
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddressVerificationStep from "../AddressVerificationStep";
import type { AddressData } from "../../../hooks/useAuditTransaction";

describe("AddressVerificationStep - Manual Mode (Auto/Manual toggle removed)", () => {
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

  it("should render without Auto/Manual toggle", () => {
    render(<AddressVerificationStep {...defaultProps} />);

    expect(screen.queryByRole("button", { name: /auto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manual/i })).not.toBeInTheDocument();
  });

  it("should show date inputs in manual mode", () => {
    render(<AddressVerificationStep {...defaultProps} startDateMode="manual" />);

    expect(screen.getByText(/representation start date/i)).toBeInTheDocument();
  });

  it("should show Transaction Dates label", () => {
    render(<AddressVerificationStep {...defaultProps} startDateMode="manual" />);

    expect(screen.getByText("Transaction Dates")).toBeInTheDocument();
  });
});
