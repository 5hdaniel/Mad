import React from "react";

interface SettingsTab {
  id: string;
  label: string;
}

interface SettingsTabBarProps {
  tabs: SettingsTab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
}

export function SettingsTabBar({ tabs, activeTabId, onTabClick }: SettingsTabBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
      <div className="flex gap-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTabId === tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTabId === tab.id
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
