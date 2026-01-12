/**
 * ExportSuccessMessage Component
 * Success message displayed after successful PDF export
 * Includes "Show in Folder" button to reveal the exported file in Finder/Explorer
 */
import React, { useCallback } from "react";

interface ExportSuccessMessageProps {
  message: string;
}

export function ExportSuccessMessage({
  message,
}: ExportSuccessMessageProps): React.ReactElement {
  /**
   * Opens the file manager (Finder on macOS, Explorer on Windows)
   * with the exported file selected
   */
  const handleShowInFolder = useCallback(async () => {
    try {
      // Type assertion needed due to TypeScript type inference limitations
      const systemApi = window.api.system as unknown as {
        showInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      };
      await systemApi.showInFolder(message);
    } catch (error) {
      console.error("Failed to show file in folder:", error);
    }
  }, [message]);

  return (
    <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
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
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">
            PDF exported successfully!
          </p>
          <button
            onClick={handleShowInFolder}
            className="text-xs text-green-700 hover:text-green-900 hover:underline mt-1 break-all text-left cursor-pointer"
            title="Click to open folder"
          >
            {message}
          </button>
          <button
            onClick={handleShowInFolder}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Show in Folder
          </button>
        </div>
      </div>
    </div>
  );
}
