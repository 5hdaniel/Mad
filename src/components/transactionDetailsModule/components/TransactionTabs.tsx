/**
 * TransactionTabs Component
 * Tab navigation for transaction details view
 *
 * Tab order: Overview | Messages | Emails
 */
import React from "react";
import type { TransactionTab } from "../types";

interface TransactionTabsProps {
  activeTab: TransactionTab;
  conversationCount: number;
  emailCount: number;
  attachmentCount: number;
  onTabChange: (tab: TransactionTab) => void;
}

export function TransactionTabs({
  activeTab,
  conversationCount,
  emailCount,
  attachmentCount: _attachmentCount, // Temporarily unused while attachments tab is hidden
  onTabChange,
}: TransactionTabsProps): React.ReactElement {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 px-6">
      <div className="flex gap-4">
        <button
          onClick={() => onTabChange("overview")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "overview"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => onTabChange("messages")}
          className={`px-4 py-3 font-medium text-sm transition-all flex items-center gap-1.5 ${
            activeTab === "messages"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Texts ({conversationCount})
        </button>
        <button
          onClick={() => onTabChange("emails")}
          className={`px-4 py-3 font-medium text-sm transition-all flex items-center gap-1.5 ${
            activeTab === "emails"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
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
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Emails ({emailCount})
        </button>
{/* Contacts tab removed - contacts now shown in Overview tab
        <button
          onClick={() => onTabChange("contacts")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "contacts"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Roles & Contacts
        </button>
*/}
{/* Attachments tab temporarily hidden - BACKLOG-321, re-enable with BACKLOG-322
        <button
          onClick={() => onTabChange("attachments")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "attachments"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Attachments ({_attachmentCount})
        </button>
*/}
      </div>
    </div>
  );
}
