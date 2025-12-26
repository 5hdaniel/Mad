/**
 * ExportSuccessMessage Component
 * Success message displayed after successful PDF export
 */
import React from "react";

interface ExportSuccessMessageProps {
  message: string;
}

export function ExportSuccessMessage({
  message,
}: ExportSuccessMessageProps): React.ReactElement {
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
          <p className="text-xs text-green-700 mt-1 break-all">{message}</p>
        </div>
      </div>
    </div>
  );
}
