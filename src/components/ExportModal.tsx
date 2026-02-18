import React, { useState, useEffect } from "react";
import type { Transaction } from "../../electron/types/models";

interface ExportModalProps {
  transaction: Transaction;
  userId: string;
  onClose: () => void;
  onExportComplete: (result: unknown) => void;
}

/**
 * ExportModal Component
 * Enhanced export with date verification, content/format selection
 */
function ExportModal({
  transaction,
  userId,
  onClose,
  onExportComplete,
}: ExportModalProps) {
  const [step, setStep] = useState(1); // 1: Date Verification, 2: Export Options, 3: Exporting, 4: Close Prompt, 5: Success

  // Start Date (started_at) - when agent began working on transaction
  const [startDate, setStartDate] = useState(
    transaction.started_at
      ? typeof transaction.started_at === "string"
        ? transaction.started_at.split("T")[0]
        : transaction.started_at.toISOString().split("T")[0]
      : "",
  );

  // Closing Date (closing_deadline) - scheduled/expected closing date
  const [closingDate, setClosingDate] = useState(
    transaction.closing_deadline
      ? typeof transaction.closing_deadline === "string"
        ? transaction.closing_deadline.split("T")[0]
        : transaction.closing_deadline.toISOString().split("T")[0]
      : "",
  );

  // End Date (closed_at) - when transaction actually ended (for filtering)
  const [endDate, setEndDate] = useState(
    transaction.closed_at
      ? typeof transaction.closed_at === "string"
        ? transaction.closed_at.split("T")[0]
        : transaction.closed_at.toISOString().split("T")[0]
      : "",
  );

  const [contentType, setContentType] = useState("both"); // text, email, both
  const [exportFormat, setExportFormat] = useState("folder"); // folder, pdf, excel, csv, json, txt_eml
  const [emailExportMode, setEmailExportMode] = useState<"thread" | "individual">("thread");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  // Formats that are currently implemented
  const implementedFormats = ["pdf", "folder"];

  // Load user preferences to set default export format
  useEffect(() => {
    const loadDefaultFormat = async () => {
      if (userId) {
        try {
          const result = await window.api.preferences.get(userId);
          if (result.success && result.preferences) {
            const prefs = result.preferences as {
              export?: { defaultFormat?: string; emailExportMode?: string };
            };
            // Only use saved preference if it's an implemented format
            if (prefs.export?.defaultFormat && implementedFormats.includes(prefs.export.defaultFormat)) {
              setExportFormat(prefs.export.defaultFormat);
            }
            // Load email export mode preference
            if (prefs.export?.emailExportMode === "thread" || prefs.export?.emailExportMode === "individual") {
              setEmailExportMode(prefs.export.emailExportMode);
            }
          }
        } catch (error) {
          console.error("Failed to load export format preference:", error);
          // If loading fails, keep the default 'folder' format
        }
      }
    };

    loadDefaultFormat();
  }, [userId]);

  // Listen for folder export progress events
  useEffect(() => {
    if (exporting && exportFormat === "folder") {
      const cleanup = window.api.onExportFolderProgress((progress) => {
        setExportProgress(progress);
      });
      return cleanup;
    }
  }, [exporting, exportFormat]);

  const handleDateVerification = () => {
    if (!startDate || !endDate) {
      setError("Please provide Start Date and End Date to continue");
      return;
    }
    // Validate end date is after start date
    if (startDate > endDate) {
      setError("End Date must be after Start Date");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setExportProgress(null);
    setStep(3);

    try {
      // Update transaction dates first
      const updateData = {
        started_at: startDate,
        closing_deadline: closingDate || null,
        closed_at: endDate,
        closing_date_verified: 1,
      };

      const updateResult = await window.api.transactions.update(transaction.id, updateData);

      if (!updateResult.success) {
        setError(`Failed to save dates: ${updateResult.error}`);
        setStep(1);
        setExporting(false);
        return;
      }

      let result;

      if (exportFormat === "folder") {
        // Use folder export for comprehensive audit package
        // Note: Type cast needed due to type inference issue with window.d.ts
        const exportFolderFn = (window.api.transactions as unknown as {
          exportFolder: (id: string, opts: { includeEmails: boolean; includeTexts: boolean; includeAttachments: boolean; emailExportMode?: "thread" | "individual"; startDate?: string; endDate?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        }).exportFolder;
        result = await exportFolderFn(transaction.id, {
          includeEmails: contentType === "email" || contentType === "both",
          includeTexts: contentType === "text" || contentType === "both",
          includeAttachments: true,
          emailExportMode,
          startDate,
          endDate,
        });
      } else {
        // Use enhanced export for single-file formats
        // Pass dates to enable date range filtering for PDF exports
        // summaryOnly: true for "pdf" format means only report + indexes (no full content)
        result = await window.api.transactions.exportEnhanced(
          transaction.id,
          {
            exportFormat,
            startDate,
            endDate,
            summaryOnly: exportFormat === "pdf",
          } as Parameters<typeof window.api.transactions.exportEnhanced>[1],
        );
      }

      if (result.success) {
        // Store the exported path for the success screen
        // Handle both 'path' (folder export) and 'filePath' (PDF export) response shapes
        const exportPath = result.path || (result as { filePath?: string }).filePath || null;
        setExportedPath(exportPath);

        // Check if transaction is already closed - if so, skip to success
        if (transaction.status === "closed") {
          setStep(5); // Go directly to success
        } else {
          setStep(4); // Go to close prompt
        }
      } else {
        setError(result.error || "Export failed");
        setStep(2);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      setError(errorMessage);
      setStep(2);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  // Handle closing transaction after export
  const handleCloseTransaction = async (shouldClose: boolean) => {
    if (shouldClose) {
      try {
        await window.api.transactions.update(transaction.id, { status: "closed" });
      } catch (err) {
        console.error("Failed to close transaction:", err);
        // Continue to success screen even if closing fails
      }
    }
    setStep(5); // Move to success screen
  };

  // Handle opening the exported file in Finder
  const handleOpenInFinder = () => {
    if (exportedPath) {
      window.api.shell.openFolder(exportedPath);
    }
  };

  // Handle final dismissal - call onExportComplete and close
  const handleDismissSuccess = () => {
    onExportComplete({ success: true, path: exportedPath });
  };

  const formatConfidence = (confidence?: number) => {
    if (!confidence) return null;
    if (confidence >= 80)
      return { text: "High", color: "text-green-600 bg-green-50" };
    if (confidence >= 50)
      return { text: "Medium", color: "text-yellow-600 bg-yellow-50" };
    return { text: "Low", color: "text-red-600 bg-red-50" };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">
              Export Transaction Audit
            </h3>
            <p className="text-purple-100 text-sm">
              {transaction.property_address}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all disabled:opacity-50"
          >
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
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Step 1: Date Verification */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Verify Transaction Dates
                </h4>
                <p className="text-sm text-gray-600 mb-6">
                  Communications will be filtered to only include those between
                  Start Date and End Date.
                </p>
              </div>

              <div className="space-y-4">
                {/* Start Date */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Start Date *
                    </label>
                    {transaction.representation_start_confidence &&
                      formatConfidence(
                        transaction.representation_start_confidence,
                      ) && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${formatConfidence(transaction.representation_start_confidence)!.color}`}
                        >
                          Confidence:{" "}
                          {
                            formatConfidence(
                              transaction.representation_start_confidence,
                            )!.text
                          }
                        </span>
                      )}
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    When did you sign the representation agreement with the
                    client?
                  </p>
                </div>

                {/* Closing Date (optional) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Closing Date
                    </label>
                    {transaction.closing_date_confidence &&
                      formatConfidence(transaction.closing_date_confidence) && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${formatConfidence(transaction.closing_date_confidence)!.color}`}
                        >
                          Confidence:{" "}
                          {
                            formatConfidence(
                              transaction.closing_date_confidence,
                            )!.text
                          }
                        </span>
                      )}
                  </div>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Scheduled closing date (optional)
                  </p>
                </div>

                {/* End Date */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      End Date *
                    </label>
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    When did the transaction end? (Used to filter communications)
                  </p>
                </div>
              </div>

              {transaction.first_communication_date &&
                transaction.last_communication_date && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Communication Date Range
                    </p>
                    <p className="text-xs text-blue-700">
                      We found communications from{" "}
                      <span className="font-semibold">
                        {new Date(
                          transaction.first_communication_date,
                        ).toLocaleDateString()}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold">
                        {new Date(
                          transaction.last_communication_date,
                        ).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Step 2: Export Options */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  Export Options
                </h4>
                <p className="text-sm text-gray-600 mb-6">
                  Choose what content and format you'd like to export.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Active export formats */}
                  <button
                    onClick={() => setExportFormat("folder")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === "folder"
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Audit Package</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        exportFormat === "folder"
                          ? "bg-purple-400 text-white"
                          : "bg-green-100 text-green-700"
                      }`}>Recommended</span>
                    </div>
                    <div className="text-xs opacity-80">
                      Folder with individual PDFs
                    </div>
                  </button>
                  <button
                    onClick={() => setExportFormat("pdf")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                      exportFormat === "pdf"
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="font-semibold">Summary PDF</div>
                    <div className="text-xs opacity-80">
                      Transaction report only
                    </div>
                  </button>
                  {/* One PDF - Coming Soon */}
                  <button
                    disabled
                    className="px-4 py-3 rounded-lg font-medium text-left bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">One PDF</span>
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Coming Soon</span>
                    </div>
                    <div className="text-xs opacity-80">Combined PDF with all content</div>
                  </button>
                  {/* Emails Only - Coming Soon */}
                  <button
                    disabled
                    className="px-4 py-3 rounded-lg font-medium text-left bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Emails Only</span>
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Coming Soon</span>
                    </div>
                    <div className="text-xs opacity-80">Export only email communications</div>
                  </button>
                  {/* Texts Only - Coming Soon */}
                  <button
                    disabled
                    className="px-4 py-3 rounded-lg font-medium text-left bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Texts Only</span>
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Coming Soon</span>
                    </div>
                    <div className="text-xs opacity-80">Export only text messages</div>
                  </button>
                </div>
                {exportFormat === "folder" && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">Audit Package includes:</p>
                    <ul className="mt-2 text-xs text-blue-700 space-y-1">
                      <li>Summary_Report.pdf - Transaction overview</li>
                      <li>emails/ - Each email as individual PDF</li>
                      <li>texts/ - Text conversations by contact</li>
                      <li>attachments/ - All attachments with manifest</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Exporting */}
          {step === 3 && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {exportFormat === "folder" ? "Creating Audit Package..." : "Exporting..."}
              </h4>
              <p className="text-sm text-gray-600">
                {exportProgress
                  ? exportProgress.message
                  : "Creating your compliance audit export. This may take a moment."}
              </p>
              {/* Progress bar removed for cleaner UX - spinner and message are sufficient */}
            </div>
          )}

          {/* Step 4: Close Transaction Prompt */}
          {step === 4 && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Export Complete!
              </h4>
              <p className="text-sm text-gray-600 mb-6">
                Would you like to mark this transaction as closed?
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleCloseTransaction(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  No, Keep Open
                </button>
                <button
                  onClick={() => handleCloseTransaction(true)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                >
                  Yes, Close Transaction
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success with Finder Link */}
          {step === 5 && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Export Complete!
              </h4>
              <p className="text-sm text-gray-600 mb-6">
                Your {exportFormat === "folder" ? "Audit Package" : "export"} has been saved successfully.
              </p>
              {/* Buttons side by side */}
              <div className="flex justify-center gap-4">
                {exportedPath && (
                  <button
                    onClick={handleOpenInFinder}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                    Open in Finder
                  </button>
                )}
                <button
                  onClick={handleDismissSuccess}
                  className="px-8 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 3 && step !== 4 && step !== 5 && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-between">
            <button
              onClick={step === 1 ? onClose : () => setStep(1)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>

            <button
              onClick={step === 1 ? handleDateVerification : handleExport}
              disabled={
                step === 1 && (!startDate || !endDate)
              }
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                step === 1 && (!startDate || !endDate)
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
              }`}
            >
              {step === 1 ? "Next" : "Export"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportModal;
