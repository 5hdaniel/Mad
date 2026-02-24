import React, { useState } from "react";
import logger from '../utils/logger';

interface MoveAppPromptProps {
  appPath: string;
  onDismiss: () => void;
  onNotNow: () => void;
}

export default function MoveAppPrompt({
  appPath,
  onDismiss,
  onNotNow,
}: MoveAppPromptProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleNotNow = () => {
    if (dontShowAgain) {
      localStorage.setItem("ignoreMoveAppPrompt", "true");
    }
    onNotNow();
  };

  const handleMoveToApplications = async () => {
    // Open Finder to Applications folder so user can drag the app
    try {
      await window.api.shell.openFolder("/Applications");
      // Also dismiss the dialog
      if (dontShowAgain) {
        localStorage.setItem("ignoreMoveAppPrompt", "true");
      }
      onDismiss();
    } catch (error) {
      logger.error("Error opening Applications folder:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Warning Icon */}
        <div className="flex items-center justify-center w-14 h-14 bg-yellow-100 rounded-full mb-4 mx-auto">
          <svg
            className="w-8 h-8 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
          Move to Applications Folder?
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-4 text-center text-sm leading-relaxed">
          We've detected that you're not running Keepr from the
          Applications folder of your machine. This could cause problems with
          the app, including impacting your ability to sign in.
        </p>

        <p className="text-gray-700 mb-4 text-center text-sm font-medium">
          Do you want to move Keepr to the Applications folder now? This
          will also restart the app.
        </p>

        {/* Current Location Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5">
          <p className="text-xs text-yellow-800 font-medium mb-1">
            Current location:
          </p>
          <p className="text-xs text-yellow-900 font-mono break-all">
            {appPath}
          </p>
        </div>

        {/* Don't show again checkbox */}
        <div className="flex items-center mb-5">
          <input
            type="checkbox"
            id="dontShowAgain"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="dontShowAgain"
            className="ml-2 text-sm text-gray-700 select-none cursor-pointer"
          >
            Do not show this message again
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNotNow}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Not Now
          </button>
          <button
            onClick={handleMoveToApplications}
            className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-md"
          >
            Move and Restart
          </button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Clicking "Move and Restart" will open the Applications folder. Please
          drag the app there and restart it.
        </p>
      </div>
    </div>
  );
}
