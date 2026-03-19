/**
 * useAuditSteps Hook
 * Manages step navigation with validation gates for the audit transaction wizard.
 * Extracted from useAuditTransaction.ts (TASK-2261)
 *
 * 3-step flow:
 * - Step 1: Transaction details (address, type, dates)
 * - Step 2: Select contacts
 * - Step 3: Assign roles to selected contacts
 * In edit mode, saves directly from step 1 (no contact steps)
 */
import { useState, useCallback } from "react";
import { SPECIFIC_ROLES } from "../../constants/contactRoles";
import type { AddressData, ContactAssignments } from "./types";

interface UseAuditStepsProps {
  isEditing: boolean;
  addressData: AddressData;
  selectedContactIds: string[];
  contactAssignments: ContactAssignments;
  onSubmit: () => void;
  setError: (error: string | null) => void;
}

export interface UseAuditStepsReturn {
  step: number;
  handleNextStep: () => void;
  handlePreviousStep: () => void;
}

export function useAuditSteps({
  isEditing,
  addressData,
  selectedContactIds,
  contactAssignments,
  onSubmit,
  setError,
}: UseAuditStepsProps): UseAuditStepsReturn {
  const [step, setStep] = useState<number>(1);

  /**
   * Proceed to next step with validation
   */
  const handleNextStep = useCallback((): void => {
    if (step === 1) {
      if (!addressData.property_address.trim()) {
        setError("Property address is required");
        return;
      }
      if (!addressData.started_at) {
        setError("Transaction start date is required");
        return;
      }
      if (addressData.closed_at && addressData.started_at > addressData.closed_at) {
        setError("End date must be after start date");
        return;
      }
      setError(null);
      if (isEditing) {
        onSubmit();
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      if (selectedContactIds.length === 0) {
        setError("Please select at least one contact");
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      if (
        !contactAssignments[SPECIFIC_ROLES.CLIENT] ||
        contactAssignments[SPECIFIC_ROLES.CLIENT].length === 0
      ) {
        setError("At least one contact must be assigned the Buyer (Client) role");
        return;
      }
      setError(null);
      onSubmit();
    }
  }, [step, addressData.property_address, addressData.started_at, addressData.closed_at, selectedContactIds, contactAssignments, onSubmit, isEditing]);

  /**
   * Go back to previous step
   */
  const handlePreviousStep = useCallback((): void => {
    setError(null);
    setStep(step - 1);
  }, [step, setError]);

  return {
    step,
    handleNextStep,
    handlePreviousStep,
  };
}
