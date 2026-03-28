import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startBackgroundSync,
  stopBackgroundSync,
} from '../../services/backgroundSync';
import { resetAllSyncData } from '../../services/smsQueueService';
import { requestSmsPermissions } from '../../services/permissions';

/** Data encoded in the QR code from the desktop app */
interface PairingData {
  ip: string;
  port: number;
  secret: string;
  deviceName: string;
}

/** Stored pairing info in AsyncStorage */
interface StoredPairing {
  ip: string;
  port: number;
  secret: string;
  deviceName: string;
  pairedAt: string;
}

const PAIRING_STORAGE_KEY = '@keepr/pairing';

export default function PairingScreen(): React.JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing pairing on mount
  useEffect(() => {
    loadPairing();
  }, []);

  const loadPairing = async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
      if (stored) {
        setPairing(JSON.parse(stored) as StoredPairing);
      }
    } catch (error) {
      console.error('[Pairing] Failed to load pairing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePairing = async (data: PairingData): Promise<void> => {
    const storedPairing: StoredPairing = {
      ...data,
      pairedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      PAIRING_STORAGE_KEY,
      JSON.stringify(storedPairing),
    );
    setPairing(storedPairing);

    // Request SMS permissions and start background sync after pairing
    try {
      await requestSmsPermissions();
      await startBackgroundSync();
    } catch (error) {
      console.error('[Pairing] Failed to start background sync:', error);
    }
  };

  const handleBarCodeScanned = useCallback(
    async (result: { data: string }): Promise<void> => {
      // Prevent double-scanning
      if (!scanning) return;
      setScanning(false);

      try {
        const data = JSON.parse(result.data) as PairingData;

        // Validate the QR code data has the expected fields
        if (!data.ip || !data.port || !data.secret || !data.deviceName) {
          Alert.alert(
            'Invalid QR Code',
            'This QR code does not contain valid pairing data. Please scan the QR code shown in the Keepr desktop application.',
          );
          return;
        }

        // Validate secret is a 64-char hex string (32 bytes)
        if (!/^[0-9a-f]{64}$/i.test(data.secret)) {
          Alert.alert(
            'Invalid QR Code',
            'The pairing code is not in the expected format.',
          );
          return;
        }

        await savePairing(data);
        Alert.alert(
          'Paired Successfully',
          `Connected to ${data.deviceName} at ${data.ip}:${data.port}`,
        );
      } catch {
        Alert.alert(
          'Invalid QR Code',
          'Could not read the QR code. Please try again with the QR code from the Keepr desktop application.',
        );
      }
    },
    [scanning],
  );

  const handleUnpair = useCallback(async (): Promise<void> => {
    Alert.alert('Unpair Device', 'Are you sure you want to unpair?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          // Stop background sync and clear all sync data
          try {
            await stopBackgroundSync();
            await resetAllSyncData();
          } catch (error) {
            console.error('[Pairing] Failed to stop background sync:', error);
          }
          await AsyncStorage.removeItem(PAIRING_STORAGE_KEY);
          setPairing(null);
        },
      },
    ]);
  }, []);

  const handleStartScanning = useCallback(async (): Promise<void> => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera access in Settings to scan QR codes.',
        );
        return;
      }
    }
    setScanning(true);
  }, [permission, requestPermission]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Camera scanning view
  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>
            Point camera at the QR code on your Keepr desktop app
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setScanning(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Paired state
  if (pairing) {
    return (
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTitle}>Paired</Text>
        </View>
        <Text style={styles.deviceName}>{pairing.deviceName}</Text>
        <Text style={styles.deviceInfo}>
          {pairing.ip}:{pairing.port}
        </Text>
        <Text style={styles.pairedSince}>
          Paired {new Date(pairing.pairedAt).toLocaleDateString()}
        </Text>
        <TouchableOpacity style={styles.unpairButton} onPress={handleUnpair}>
          <Text style={styles.unpairButtonText}>Unpair Device</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Not paired state
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair with Keepr</Text>
      <Text style={styles.description}>
        Scan the QR code displayed in the Keepr desktop application to connect
        this device as an SMS companion.
      </Text>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={handleStartScanning}
      >
        <Text style={styles.scanButtonText}>Scan QR Code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1e293b',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 32,
  },
  scanButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 16,
  },
  scannerText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 40,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
  },
  deviceName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  deviceInfo: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  pairedSince: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 32,
  },
  unpairButton: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  unpairButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
