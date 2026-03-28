import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

/** Stored pairing info matching the format saved by the pairing screen */
interface StoredPairing {
  ip: string;
  port: number;
  secret: string;
  deviceName: string;
  pairedAt: string;
}

const PAIRING_STORAGE_KEY = '@keepr/pairing';

export default function StatusScreen(): React.JSX.Element {
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPairing = useCallback(async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
      if (stored) {
        setPairing(JSON.parse(stored) as StoredPairing);
      } else {
        setPairing(null);
      }
    } catch (error) {
      console.error('[Status] Failed to load pairing data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload pairing state every time the tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadPairing();
    }, [loadPairing]),
  );

  // Initial load
  useEffect(() => {
    loadPairing();
  }, [loadPairing]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!pairing) {
    return (
      <View style={styles.container}>
        <View style={styles.statusIcon}>
          <Text style={styles.statusIconText}>--</Text>
        </View>
        <Text style={styles.title}>Not Paired</Text>
        <Text style={styles.description}>
          Go to the Pairing tab to scan a QR code and connect with the Keepr
          desktop application.
        </Text>
      </View>
    );
  }

  const pairedDate = new Date(pairing.pairedAt);

  return (
    <View style={styles.container}>
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, styles.statusBadgePaired]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusBadgeText}>Paired</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="Desktop" value={pairing.deviceName} />
        <View style={styles.divider} />
        <InfoRow label="Address" value={`${pairing.ip}:${pairing.port}`} mono />
        <View style={styles.divider} />
        <InfoRow
          label="Paired Since"
          value={pairedDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        />
        <View style={styles.divider} />
        <InfoRow
          label="Last Sync"
          value="Not yet synced"
        />
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={loadPairing}>
        <Text style={styles.refreshButtonText}>Refresh Status</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.monoText]}>{value}</Text>
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
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusIconText: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '700',
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
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgePaired: {
    backgroundColor: '#f0fdf4',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  monoText: {
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
});
