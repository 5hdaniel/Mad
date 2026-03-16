/**
 * ScreenshotCapture Component
 * TASK-2180: Screenshot capture and preview for the support ticket dialog.
 *
 * Allows users to capture a screenshot via desktopCapturer and preview/remove it.
 */

import React from "react";

interface ScreenshotCaptureProps {
  screenshot: string | null;
  loading: boolean;
  onCapture: () => void;
  onRemove: () => void;
}

/**
 * Screenshot capture button with preview.
 * Shows a thumbnail of the captured screenshot with option to remove.
 */
export function ScreenshotCapture({
  screenshot,
  loading,
  onCapture,
  onRemove,
}: ScreenshotCaptureProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Capturing screenshot...
      </div>
    );
  }

  if (screenshot) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Screenshot captured
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Remove
          </button>
        </div>
        <div className="relative rounded overflow-hidden border border-gray-300 bg-white">
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Screenshot preview"
            className="w-full h-auto max-h-40 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCapture}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      Capture Screenshot
    </button>
  );
}
