/**
 * Pairing Bridge
 * Handles QR code generation and device pairing for Android companion app
 */

import { ipcRenderer } from "electron";

export const pairingBridge = {
  /**
   * Generates a QR code for pairing with the Android companion app.
   * @returns QR code data URL and pairing info
   */
  generateQR: () => ipcRenderer.invoke("pairing:generate-qr"),

  /**
   * Gets the current pairing status including paired devices.
   * @returns Pairing status
   */
  getStatus: () => ipcRenderer.invoke("pairing:get-status"),

  /**
   * Disconnects a paired device.
   * @param deviceId - The device to disconnect
   * @returns Disconnect result
   */
  disconnect: (deviceId: string) =>
    ipcRenderer.invoke("pairing:disconnect", deviceId),
};
