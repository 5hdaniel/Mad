import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { stopBackgroundSync } from '../../services/backgroundSync';
import { resetAllSyncData } from '../../services/smsQueueService';
import { signOut, getSession } from '../../services/authService';
import type { Session } from '@supabase/supabase-js';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import {
  Header,
  Button,
  Card,
  CardDivider,
  CardRow,
} from '../../components/ui';

interface StoredPairing {
  ip: string;
  port: number;
  secret: string;
  deviceName: string;
  pairedAt: string;
}

const PAIRING_STORAGE_KEY = '@keepr/pairing';

export default function AccountScreen(): React.JSX.Element {
  const router = useRouter();
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PAIRING_STORAGE_KEY),
      getSession(),
    ])
      .then(([stored, currentSession]) => {
        if (stored) {
          setPairing(JSON.parse(stored) as StoredPairing);
        }
        setSession(currentSession);
      })
      .catch((error) => {
        console.error('[Account] Failed to load data:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleUnpair = useCallback((): void => {
    Alert.alert(
      'Unpair Device',
      'This will disconnect from the desktop app and clear all sync data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopBackgroundSync();
              await resetAllSyncData();
            } catch (error) {
              console.error('[Account] Failed to stop background sync:', error);
            }
            await AsyncStorage.removeItem(PAIRING_STORAGE_KEY);
            setPairing(null);
          },
        },
      ],
    );
  }, []);

  const handleSignOut = useCallback((): void => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to use the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopBackgroundSync();
            } catch (error) {
              console.error('[Account] Failed to stop background sync:', error);
            }
            const result = await signOut();
            if (result.error) {
              Alert.alert('Sign Out Failed', result.error);
            }
            // Auth state change listener in _layout.tsx will redirect to login
          },
        },
      ],
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header
          title="Account"
          leftActions={[
            {
              icon: '\u2190',
              onPress: () => router.back(),
              accessibilityLabel: 'Back',
            },
          ]}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title="Account"
        leftActions={[
          {
            icon: '\u2190',
            onPress: () => router.back(),
            accessibilityLabel: 'Back',
          },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* User info */}
        <Card title="User">
          <CardRow
            label="Name"
            value={
              session?.user?.user_metadata?.full_name ??
              session?.user?.user_metadata?.name ??
              '--'
            }
          />
          <CardDivider />
          <CardRow
            label="Email"
            value={session?.user?.email ?? '--'}
          />
          <CardDivider />
          <CardRow
            label="Provider"
            value={session?.user?.app_metadata?.provider ?? '--'}
          />
        </Card>

        {/* Paired device info */}
        {pairing ? (
          <Card title="Paired Device">
            <CardRow label="Device Name" value={pairing.deviceName} />
            <CardDivider />
            <CardRow
              label="Address"
              value={`${pairing.ip}:${pairing.port}`}
              mono
            />
            <CardDivider />
            <CardRow
              label="Paired Date"
              value={new Date(pairing.pairedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          </Card>
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No device paired</Text>
              <Text style={styles.emptyDescription}>
                Go to the home screen and scan a QR code to pair with the Keepr
                desktop app.
              </Text>
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {pairing && (
            <Button
              title="Unpair Device"
              variant="danger"
              onPress={handleUnpair}
              fullWidth
            />
          )}
          <View style={styles.actionSpacer} />
          <Button
            title="Sign Out"
            variant="secondary"
            onPress={handleSignOut}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  emptyState: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  emptyText: {
    ...textStyles.label,
    color: colors.gray[500],
    marginBottom: spacing[1],
  },
  emptyDescription: {
    ...textStyles.caption,
    color: colors.gray[400],
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing[4],
  },
  actionSpacer: {
    height: spacing[3],
  },
});
