import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  performSync,
  isBackgroundSyncActive,
  getBackgroundFetchStatus,
} from "../../services/backgroundSync";
import type { SyncOperationResult } from "../../services/backgroundSync";
import { getSyncStats, getQueueSize } from "../../services/smsQueueService";
import type { SyncStats } from "../../services/smsQueueService";
import {
  checkSmsPermissions,
  requestSmsPermissions,
} from "../../services/permissions";
import type { SmsPermissionResult } from "../../services/permissions";
import * as BackgroundFetch from "expo-background-fetch";

/** Stored pairing info matching the format saved by the pairing screen */
interface StoredPairing {
  ip: string;
  port: number;
  secret: string;
  deviceName: string;
  pairedAt: string;
}

const PAIRING_STORAGE_KEY = "@keepr/pairing";

export default function StatusScreen(): React.JSX.Element {
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [bgSyncActive, setBgSyncActive] = useState(false);
  const [permissions, setPermissions] = useState<SmsPermissionResult | null>(
    null
  );
  const [lastSyncResult, setLastSyncResult] =
    useState<SyncOperationResult | null>(null);
  const [bgFetchStatus, setBgFetchStatus] =
    useState<BackgroundFetch.BackgroundFetchStatus | null>(null);

  const loadAllData = useCallback(async (): Promise<void> => {
    try {
      const [stored, stats, queue, bgActive, perms, fetchStatus] =
        await Promise.all([
          AsyncStorage.getItem(PAIRING_STORAGE_KEY),
          getSyncStats(),
          getQueueSize(),
          isBackgroundSyncActive(),
          checkSmsPermissions(),
          getBackgroundFetchStatus(),
        ]);

      setPairing(stored ? (JSON.parse(stored) as StoredPairing) : null);
      setSyncStats(stats);
      setQueueSize(queue);
      setBgSyncActive(bgActive);
      setPermissions(perms);
      setBgFetchStatus(fetchStatus);
    } catch (error) {
      console.error("[Status] Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload data every time the tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleSyncNow = useCallback(async (): Promise<void> => {
    if (syncing) return;
    setSyncing(true);

    try {
      const result = await performSync();
      setLastSyncResult(result);

      // Refresh stats after sync
      const [stats, queue] = await Promise.all([
        getSyncStats(),
        getQueueSize(),
      ]);
      setSyncStats(stats);
      setQueueSize(queue);

      if (result.error) {
        Alert.alert("Sync Issue", result.error);
      } else if (result.sentMessages > 0) {
        Alert.alert(
          "Sync Complete",
          `Sent ${result.sentMessages} message${result.sentMessages !== 1 ? "s" : ""} to desktop.`
        );
      } else if (result.newMessages === 0 && result.sentMessages === 0) {
        Alert.alert("Up to Date", "No new messages to sync.");
      }
    } catch (error) {
      Alert.alert(
        "Sync Failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const handleRequestPermissions = useCallback(async (): Promise<void> => {
    const result = await requestSmsPermissions();
    setPermissions(result);

    if (result.readSms === "never_ask_again") {
      Alert.alert(
        "Permission Required",
        "SMS permission was permanently denied. Please enable it in Settings > Apps > Keepr Companion > Permissions.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "android") {
                Linking.openSettings();
              }
            },
          },
        ]
      );
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
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
  const bgFetchAvailable =
    bgFetchStatus === BackgroundFetch.BackgroundFetchStatus.Available;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      {/* Connection Status Badge */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, styles.statusBadgePaired]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusBadgeText}>Paired</Text>
        </View>
      </View>

      {/* Device Info Card */}
      <View style={styles.infoCard}>
        <InfoRow label="Desktop" value={pairing.deviceName} />
        <View style={styles.divider} />
        <InfoRow
          label="Address"
          value={`${pairing.ip}:${pairing.port}`}
          mono
        />
        <View style={styles.divider} />
        <InfoRow
          label="Paired Since"
          value={pairedDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        />
      </View>

      {/* Sync Stats Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Sync Status</Text>
        <View style={styles.divider} />
        <InfoRow
          label="Messages Synced"
          value={String(syncStats?.totalSynced ?? 0)}
        />
        <View style={styles.divider} />
        <InfoRow
          label="Last Sync"
          value={
            syncStats?.lastSyncTime
              ? formatRelativeTime(syncStats.lastSyncTime)
              : "Never"
          }
        />
        <View style={styles.divider} />
        <InfoRow label="Queue Size" value={String(queueSize)} />
        <View style={styles.divider} />
        <InfoRow
          label="Sync Attempts"
          value={`${syncStats?.successfulSyncs ?? 0} / ${syncStats?.syncAttempts ?? 0}`}
        />
      </View>

      {/* Background Sync Status */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Background Sync</Text>
        <View style={styles.divider} />
        <InfoRow
          label="Status"
          value={bgSyncActive ? "Active" : "Inactive"}
          valueColor={bgSyncActive ? "#16a34a" : "#94a3b8"}
        />
        <View style={styles.divider} />
        <InfoRow
          label="System Support"
          value={bgFetchAvailable ? "Available" : "Restricted"}
          valueColor={bgFetchAvailable ? "#16a34a" : "#f59e0b"}
        />
      </View>

      {/* SMS Permissions Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Permissions</Text>
        <View style={styles.divider} />
        <InfoRow
          label="Read SMS"
          value={formatPermissionStatus(permissions?.readSms)}
          valueColor={
            permissions?.readSms === "granted" ? "#16a34a" : "#ef4444"
          }
        />
        <View style={styles.divider} />
        <InfoRow
          label="Receive SMS"
          value={formatPermissionStatus(permissions?.receiveSms)}
          valueColor={
            permissions?.receiveSms === "granted" ? "#16a34a" : "#ef4444"
          }
        />
        {permissions && !permissions.allGranted && (
          <TouchableOpacity
            style={styles.grantButton}
            onPress={handleRequestPermissions}
          >
            <Text style={styles.grantButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Last Sync Result */}
      {lastSyncResult && (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Last Manual Sync</Text>
          <View style={styles.divider} />
          <InfoRow
            label="New Messages"
            value={String(lastSyncResult.newMessages)}
          />
          <View style={styles.divider} />
          <InfoRow
            label="Sent to Desktop"
            value={String(lastSyncResult.sentMessages)}
          />
          <View style={styles.divider} />
          <InfoRow
            label="Desktop Reachable"
            value={lastSyncResult.desktopReachable ? "Yes" : "No"}
            valueColor={
              lastSyncResult.desktopReachable ? "#16a34a" : "#ef4444"
            }
          />
          {lastSyncResult.error && (
            <>
              <View style={styles.divider} />
              <InfoRow label="Error" value={lastSyncResult.error} />
            </>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={handleSyncNow}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.syncButtonText}>Sync Now</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadAllData}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ============================================
// HELPERS
// ============================================

function formatPermissionStatus(status: string | undefined): string {
  switch (status) {
    case "granted":
      return "Granted";
    case "denied":
      return "Not Granted";
    case "never_ask_again":
      return "Blocked";
    case "unavailable":
      return "N/A (not Android)";
    default:
      return "Unknown";
  }
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InfoRow({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          mono && styles.monoText,
          valueColor ? { color: valueColor } : undefined,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 48,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusIconText: {
    fontSize: 24,
    color: "#94a3b8",
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1e293b",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#64748b",
    lineHeight: 24,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgePaired: {
    backgroundColor: "#f0fdf4",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748b",
    flexShrink: 0,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  monoText: {
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  grantButton: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  grantButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  syncButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  refreshButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "600",
  },
});
