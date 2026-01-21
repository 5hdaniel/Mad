/**
 * TransactionTabs Component
 * Tab navigation for transaction details view
 *
 * Tab order: Overview | Messages | Emails | Contacts
 */
import React from "react";
import type { TransactionTab } from "../types";

interface TransactionTabsProps {
  activeTab: TransactionTab;
  contactCount: number;
  messageCount: number;
  emailCount: number;
  attachmentCount: number;
  onTabChange: (tab: TransactionTab) => void;
}

export function TransactionTabs({
  activeTab,
  contactCount,
  messageCount,
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
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "messages"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Messages ({messageCount})
        </button>
        <button
          onClick={() => onTabChange("emails")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "emails"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Emails ({emailCount})
        </button>
        <button
          onClick={() => onTabChange("contacts")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "contacts"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Roles & Contacts ({contactCount})
        </button>
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
