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

/** Map Supabase provider identifiers to user-friendly display names. */
function formatProvider(provider: string | undefined): string {
  if (!provider) return '--';
  switch (provider) {
    case 'azure':
      return 'Microsoft';
    case 'google':
      return 'Google';
    case 'email':
      return 'Email';
    default:
      return provider;
  }
}

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

  const handleRepair = useCallback((): void => {
    router.replace('/(main)/home');
  }, [router]);

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
            value={formatProvider(session?.user?.app_metadata?.provider)}
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
                Scan a QR code to pair with the Keepr desktop app.
              </Text>
              <View style={styles.repairButtonWrapper}>
                <Button
                  title="Re-pair Device"
                  onPress={handleRepair}
                  fullWidth
                />
              </View>
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
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
  repairButtonWrapper: {
    marginTop: spacing[3],
    width: '100%',
  },
  actions: {
    marginTop: spacing[4],
  },
});
