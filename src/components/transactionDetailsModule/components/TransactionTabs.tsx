/**
 * TransactionTabs Component
 * Tab navigation for transaction details view
 */
import React from "react";
import type { TransactionTab } from "../types";

interface TransactionTabsProps {
  activeTab: TransactionTab;
  contactCount: number;
  onTabChange: (tab: TransactionTab) => void;
}

export function TransactionTabs({
  activeTab,
  contactCount,
  onTabChange,
}: TransactionTabsProps): React.ReactElement {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 px-6">
      <div className="flex gap-4">
        <button
          onClick={() => onTabChange("details")}
          className={`px-4 py-3 font-medium text-sm transition-all ${
            activeTab === "details"
              ? "border-b-2 border-green-500 text-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Transaction Details
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
      </div>
    </div>
  );
}
