/**
 * WindowApi Pairing sub-interface
 * Android companion app QR code pairing (TASK-1428)
 */

/**
 * Pairing API for Android companion app
 */
export interface WindowApiPairing {
  /** Generate a QR code for pairing with the Android companion app */
  generateQR: () => Promise<{
    success: boolean;
    error?: string;
    result?: {
      qrDataUrl: string;
      pairingInfo: {
        ip: string;
        port: number;
        secret: string;
        deviceName: string;
      };
    };
  }>;

  /** Get the current pairing status including paired devices */
  getStatus: () => Promise<{
    success: boolean;
    error?: string;
    status?: {
      isPaired: boolean;
      devices: Array<{
        deviceId: string;
        deviceName: string;
        secret: string;
        pairedAt: string;
        lastSeen: string;
      }>;
    };
  }>;

  /** Disconnect a paired device */
  disconnect: (deviceId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}
