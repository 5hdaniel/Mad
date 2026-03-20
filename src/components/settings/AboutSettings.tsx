import React, { useState } from "react";
import { authService } from '../../services';
import { SupportTicketDialog } from '../support/SupportTicketDialog';

export function AboutSettings() {
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportUserEmail, setSupportUserEmail] = useState("");
  const [supportUserName, setSupportUserName] = useState("");

  const handleContactSupport = async (): Promise<void> => {
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.data) {
        const user = result.data.user;
        setSupportUserEmail(user.email || "");
        setSupportUserName(
          user.display_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || ""
        );
      } else {
        setSupportUserEmail("");
        setSupportUserName("");
      }
    } catch {
      setSupportUserEmail("");
      setSupportUserName("");
    }
    setShowSupportDialog(true);
  };

  return (
    <>
      <div id="settings-about">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          About
        </h3>
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <div className="space-y-2 text-xs">
            <button
              onClick={() => window.open("https://github.com/5hdaniel/Mad/releases", "_blank")}
              className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              View Release Notes
            </button>
            <button
              onClick={() => window.open("https://www.keeprcompliance.com/legal#privacy", "_blank")}
              className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => window.open("https://www.keeprcompliance.com/legal#terms", "_blank")}
              className="w-full text-left text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
          {/* TASK-2180: Contact Support */}
          <button
            onClick={handleContactSupport}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
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
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Contact Support
          </button>
          <p className="mt-3 text-xs text-gray-500">
            &copy; 2026 Blue Spaces LLC. All rights reserved.
          </p>
        </div>
      </div>

      {/* Support Ticket Dialog */}
      {showSupportDialog && (
        <SupportTicketDialog
          onClose={() => setShowSupportDialog(false)}
          userEmail={supportUserEmail}
          userName={supportUserName}
        />
      )}
    </>
  );
}
