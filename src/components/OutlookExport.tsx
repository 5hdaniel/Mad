import React, { useState, useEffect } from "react";
import type { Conversation } from "@/hooks/useConversations";
import logger from '../utils/logger';

interface DeviceCodeInfo {
  verificationUri: string;
  userCode: string;
}

interface ContactExportResult {
  contactName: string;
  success: boolean;
  textMessageCount: number;
  emailCount?: number;
  error: string | null;
}

interface ExportResults {
  success: boolean;
  exportPath?: string;
  results?: ContactExportResult[];
  error?: string;
  canceled?: boolean;
}

interface ExportProgress {
  stage?: string;
  message?: string;
  current?: number;
  total?: number;
  contactName?: string;
}

interface OutlookExportProps {
  conversations: Conversation[];
  selectedIds: Set<string>;
  onComplete: (results: ExportResults | null) => void;
  onCancel: () => void;
}

function OutlookExport({
  conversations,
  selectedIds,
  onComplete,
  onCancel,
}: OutlookExportProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [_userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [exportResults, setExportResults] = useState<ExportResults | null>(
    null,
  );
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(
    null,
  );
  const [showDetailedResults, setShowDetailedResults] = useState(false);

  useEffect(() => {
    initializeOutlook();

    // Listen for export progress updates
    const progressListener = (progress: unknown) => {
      setExportProgress(progress as ExportProgress);
    };

    let cleanup: (() => void) | undefined;
    if (window.api.outlook.onExportProgress) {
      cleanup = window.api.outlook.onExportProgress(progressListener);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const initializeOutlook = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Initialize Outlook service
      const initResult = await window.api.outlook.initialize();

      if (!initResult.success) {
        setError(initResult.error || "Failed to initialize Outlook");
        return;
      }

      // Check if already authenticated
      const isAuth = await window.api.outlook.isAuthenticated();

      if (isAuth) {
        setIsAuthenticated(true);
        await loadUserEmail();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsInitializing(false);
    }
  };

  const loadUserEmail = async () => {
    try {
      const email = await window.api.outlook.getUserEmail();
      if (email) {
        setUserEmail(email);
      }
    } catch (err) {
      logger.error("Error loading user email:", err);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);
    setDeviceCode(null);

    try {
      const result = await window.api.outlook.authenticate();

      if (result.success) {
        setIsAuthenticated(true);
        await loadUserEmail(); // Load email after successful authentication
      } else {
        setError(result.error || "Authentication failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Get selected conversations with their email addresses
      const selectedConversations = conversations.filter((c: Conversation) =>
        selectedIds.has(c.id),
      );

      const contactsToExport = selectedConversations.map(
        (conv: Conversation) => ({
          name: conv.name,
          chatId: conv.id, // Include chatId for text message export
          emails: conv.emails || [],
          phones: conv.phones || [], // Include phones for finding group chats
        }),
      );

      const result =
        await window.api.outlook.exportEmails(contactsToExport);

      if (result.success && !result.canceled) {
        setExportResults(result);
      } else if (result.canceled) {
        onCancel();
      } else {
        setError(result.error || "Export failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenFolder = () => {
    if (exportResults?.exportPath) {
      window.api.shell.openFolder(exportResults.exportPath);
    }
  };

  const handleDone = () => {
    onComplete(exportResults);
  };

  const selectedConversations = conversations.filter((c: Conversation) =>
    selectedIds.has(c.id),
  );
  const contactsWithEmail = selectedConversations.filter(
    (c: Conversation) => c.emails && c.emails.length > 0,
  );
  const contactsWithoutEmail = selectedConversations.filter(
    (c: Conversation) => !c.emails || c.emails.length === 0,
  );

  // Initialization screen
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Initializing Outlook integration...</p>
        </div>
      </div>
    );
  }

  // Configuration error screen
  if (error && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Configuration Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={onCancel}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Export results screen
  if (exportResults) {
    const successCount =
      exportResults.results?.filter((r: ContactExportResult) => r.success)
        .length || 0;
    const failureCount =
      exportResults.results?.filter((r: ContactExportResult) => !r.success)
        .length || 0;
    const totalTexts =
      exportResults.results?.reduce(
        (sum: number, r: ContactExportResult) =>
          sum + (r.textMessageCount || 0),
        0,
      ) || 0;

    // Detailed results view
    if (showDetailedResults) {
      return (
        <div className="flex flex-col min-h-full">
          <div className="bg-white border-b border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Export Complete!
            </h1>
            <p className="text-sm text-gray-600">
              Detailed export results for {exportResults.results?.length || 0}{" "}
              contact{exportResults.results?.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {exportResults.results?.map(
                (result: ContactExportResult, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      result.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {result.contactName}
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>Text messages: {result.textMessageCount || 0}</p>
                        </div>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-2">
                            Error: {result.error}
                          </p>
                        )}
                      </div>
                      <div
                        className={`flex-shrink-0 ml-4 ${result.success ? "text-green-600" : "text-red-600"}`}
                      >
                        {result.success ? (
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <button
                onClick={handleOpenFolder}
                className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Open Export Folder
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Export More
                </button>
                <button
                  onClick={handleDone}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Simple success screen
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Full Audit Export Complete
          </h2>
          <p className="text-gray-600 mb-6">
            Successfully exported {totalTexts} text messages from {successCount}{" "}
            contact{successCount !== 1 ? "s" : ""}
            {failureCount > 0 && ` (${failureCount} failed)`}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleOpenFolder}
              className="w-full bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Open Export Folder
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-green-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Export More
            </button>
            <button
              onClick={() => setShowDetailedResults(true)}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              More Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Connect to Outlook
            </h2>
            <p className="text-gray-600">
              To export emails, you need to authenticate with your Microsoft
              account.
            </p>
          </div>

          {deviceCode && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                Go to{" "}
                <a
                  href={deviceCode.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  {deviceCode.verificationUri}
                </a>
              </p>
              <p className="text-sm text-blue-800">
                and enter code:{" "}
                <span className="font-mono font-bold text-lg">
                  {deviceCode.userCode}
                </span>
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleAuthenticate}
              disabled={isAuthenticating}
              className="w-full bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthenticating
                ? "Authenticating..."
                : "Sign in with Microsoft"}
            </button>
            <button
              onClick={onCancel}
              disabled={isAuthenticating}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Export screen (authenticated)
  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Full Audit Export (Messages + Emails)
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Full Audit Export
                </p>
                <p className="text-sm text-blue-800">
                  Exporting text messages and emails for{" "}
                  {selectedConversations.length} contact
                  {selectedConversations.length !== 1 ? "s" : ""}.
                  {contactsWithoutEmail.length > 0 &&
                    contactsWithEmail.length > 0 && (
                      <>
                        {" "}
                        {contactsWithoutEmail.length} contact
                        {contactsWithoutEmail.length !== 1 ? "s" : ""} without
                        email addresses will have only text messages exported.
                      </>
                    )}
                </p>
              </div>
            </div>
          </div>

          {/* Contacts with emails */}
          {contactsWithEmail.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Contacts to Export
              </h3>
              <div className="space-y-2">
                {contactsWithEmail.map((conv: Conversation) => (
                  <div
                    key={conv.id}
                    className="p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <p className="font-semibold text-gray-900">{conv.name}</p>
                    {conv.emails && conv.emails.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {conv.emails.map((email: string, index: number) => (
                          <p key={index} className="text-sm text-gray-600">
                            {email}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts without emails */}
          {contactsWithoutEmail.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Contacts Without Email
              </h3>
              <div className="space-y-2">
                {contactsWithoutEmail.map((conv: Conversation) => (
                  <div
                    key={conv.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <p className="font-semibold text-gray-600">{conv.name}</p>
                    <p className="text-sm text-gray-500">
                      No email address found
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Export Progress */}
          {isExporting && exportProgress && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-blue-900">
                  {exportProgress.contactName &&
                    `Exporting ${exportProgress.contactName}...`}
                </p>
                {exportProgress.total && (
                  <p className="text-sm text-blue-700">
                    Contact {exportProgress.current} of {exportProgress.total}
                  </p>
                )}
              </div>
              {exportProgress.message && (
                <p className="text-sm text-blue-800 mb-3">
                  {exportProgress.message}
                </p>
              )}
              {exportProgress.total && (
                <div className="w-full bg-blue-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${((exportProgress.current || 0) / exportProgress.total) * 100}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isExporting}
              className="px-6 py-3 border-2 border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold text-gray-700"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || selectedConversations.length === 0}
              className="flex-1 bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting
                ? "Exporting..."
                : `Export ${selectedConversations.length} Audit${selectedConversations.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutlookExport;
