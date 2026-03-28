/**
 * useExportFlow Hook
 *
 * Manages export-related state and handlers.
 * Handles Outlook exports, conversation selection, and export results.
 */

import { useState, useCallback, useMemo } from "react";
import type { AppStep, AppExportResult, Conversation } from "../types";

export interface UseExportFlowOptions {
  onSetCurrentStep: (step: AppStep) => void;
  hasPermissions: boolean;
}

export interface UseExportFlowReturn {
  // State
  exportResult: AppExportResult | null;
  conversations: Conversation[];
  selectedConversationIds: Set<string>;
  outlookConnected: boolean;
  googleConnected: boolean;

  // Setters
  setExportResult: (result: AppExportResult | null) => void;
  setOutlookConnected: (value: boolean) => void;
  setGoogleConnected: (value: boolean) => void;

  // Handlers
  handleExportComplete: (result: unknown) => void;
  handleOutlookExport: (selectedIds: Set<string>) => Promise<void>;
  handleOutlookCancel: () => void;
  handleGoogleExport: (selectedIds: Set<string>) => Promise<void>;
  handleGoogleCancel: () => void;
  handleStartOver: () => void;
  handleMicrosoftLogin: (userInfo: unknown) => void;
  handleMicrosoftSkip: () => void;
  handleConnectOutlook: () => void;
}

export function useExportFlow({
  onSetCurrentStep,
  hasPermissions,
}: UseExportFlowOptions): UseExportFlowReturn {
  const [exportResult, setExportResult] = useState<AppExportResult | null>(
    null,
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<
    Set<string>
  >(new Set());
  const [outlookConnected, setOutlookConnected] = useState<boolean>(false);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);

  const handleExportComplete = useCallback(
    (result: unknown): void => {
      setExportResult(result as AppExportResult);
      onSetCurrentStep("complete");
    },
    [onSetCurrentStep],
  );

  const handleOutlookExport = useCallback(
    async (selectedIds: Set<string>): Promise<void> => {
      if (conversations.length === 0) {
        const result = await window.api.messages.getConversations();
        if (result.success && result.conversations) {
          setConversations(result.conversations as Conversation[]);
        }
      }
      setSelectedConversationIds(selectedIds);
      onSetCurrentStep("outlook");
    },
    [conversations.length, onSetCurrentStep],
  );

  const handleOutlookCancel = useCallback((): void => {
    onSetCurrentStep("dashboard");
  }, [onSetCurrentStep]);

  const handleGoogleExport = useCallback(
    async (selectedIds: Set<string>): Promise<void> => {
      if (conversations.length === 0) {
        const result = await window.api.messages.getConversations();
        if (result.success && result.conversations) {
          setConversations(result.conversations as Conversation[]);
        }
      }
      setSelectedConversationIds(selectedIds);
      onSetCurrentStep("google-export");
    },
    [conversations.length, onSetCurrentStep],
  );

  const handleGoogleCancel = useCallback((): void => {
    onSetCurrentStep("dashboard");
  }, [onSetCurrentStep]);

  const handleStartOver = useCallback((): void => {
    setExportResult(null);
    setSelectedConversationIds(new Set());
    onSetCurrentStep("dashboard");
  }, [onSetCurrentStep]);

  const handleMicrosoftLogin = useCallback(
    (_userInfo: unknown): void => {
      setOutlookConnected(true);
      if (hasPermissions) {
        onSetCurrentStep("dashboard");
      } else {
        onSetCurrentStep("permissions");
      }
    },
    [hasPermissions, onSetCurrentStep],
  );

  const handleMicrosoftSkip = useCallback((): void => {
    setOutlookConnected(false);
    if (hasPermissions) {
      onSetCurrentStep("dashboard");
    } else {
      onSetCurrentStep("permissions");
    }
  }, [hasPermissions, onSetCurrentStep]);

  const handleConnectOutlook = useCallback((): void => {
    onSetCurrentStep("microsoft-login");
  }, [onSetCurrentStep]);

  return useMemo(
    () => ({
      exportResult,
      conversations,
      selectedConversationIds,
      outlookConnected,
      googleConnected,
      setExportResult,
      setOutlookConnected,
      setGoogleConnected,
      handleExportComplete,
      handleOutlookExport,
      handleOutlookCancel,
      handleGoogleExport,
      handleGoogleCancel,
      handleStartOver,
      handleMicrosoftLogin,
      handleMicrosoftSkip,
      handleConnectOutlook,
    }),
    [
      exportResult,
      conversations,
      selectedConversationIds,
      outlookConnected,
      googleConnected,
      handleExportComplete,
      handleOutlookExport,
      handleOutlookCancel,
      handleGoogleExport,
      handleGoogleCancel,
      handleStartOver,
      handleMicrosoftLogin,
      handleMicrosoftSkip,
      handleConnectOutlook,
    ],
  );
}
