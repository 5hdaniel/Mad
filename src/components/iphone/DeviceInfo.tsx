import React from "react";
import type { DeviceInfoProps } from "../../types/iphone";

/**
 * Maps iPhone product types to human-readable names
 */
function formatProductType(productType: string): string {
  const models: Record<string, string> = {
    // iPhone 16 series
    "iPhone17,1": "iPhone 16 Pro",
    "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,3": "iPhone 16",
    "iPhone17,4": "iPhone 16 Plus",
    // iPhone 15 series
    "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone15,4": "iPhone 15",
    "iPhone15,5": "iPhone 15 Plus",
    // iPhone 14 series
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus",
    // iPhone 13 series
    "iPhone14,2": "iPhone 13 Pro",
    "iPhone14,3": "iPhone 13 Pro Max",
    "iPhone14,5": "iPhone 13",
    "iPhone14,4": "iPhone 13 mini",
    // iPhone 12 series
    "iPhone13,2": "iPhone 12",
    "iPhone13,1": "iPhone 12 mini",
    "iPhone13,3": "iPhone 12 Pro",
    "iPhone13,4": "iPhone 12 Pro Max",
    // iPhone 11 series
    "iPhone12,1": "iPhone 11",
    "iPhone12,3": "iPhone 11 Pro",
    "iPhone12,5": "iPhone 11 Pro Max",
    // iPhone XS/XR series
    "iPhone11,2": "iPhone XS",
    "iPhone11,4": "iPhone XS Max",
    "iPhone11,6": "iPhone XS Max",
    "iPhone11,8": "iPhone XR",
    // iPhone X and earlier
    "iPhone10,3": "iPhone X",
    "iPhone10,6": "iPhone X",
    "iPhone10,1": "iPhone 8",
    "iPhone10,4": "iPhone 8",
    "iPhone10,2": "iPhone 8 Plus",
    "iPhone10,5": "iPhone 8 Plus",
    // iPhone SE series
    "iPhone14,6": "iPhone SE (3rd generation)",
    "iPhone12,8": "iPhone SE (2nd generation)",
  };
  return models[productType] || productType;
}

/**
 * DeviceInfo Component
 * Displays detailed information about a connected iOS device
 */
export const DeviceInfo: React.FC<DeviceInfoProps> = ({ device }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-500">Device Name</span>
        <span className="text-sm text-gray-800">{device.name}</span>
      </div>
      <div className="flex items-center justify-between py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-500">iOS Version</span>
        <span className="text-sm text-gray-800">{device.productVersion}</span>
      </div>
      <div className="flex items-center justify-between py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-500">Model</span>
        <span className="text-sm text-gray-800">
          {formatProductType(device.productType)}
        </span>
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-gray-500">Serial Number</span>
        <span className="text-sm text-gray-800 font-mono">
          {device.serialNumber}
        </span>
      </div>
    </div>
  );
};

export default DeviceInfo;
