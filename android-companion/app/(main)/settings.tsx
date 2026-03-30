import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import {
  checkSmsPermissions,
  checkContactsPermissions,
  requestSmsPermissions,
  requestContactsPermissions,
} from '../../services/permissions';
import type {
  SmsPermissionResult,
  ContactsPermissionResult,
} from '../../services/permissions';
import {
  isBackgroundSyncActive,
  getBackgroundFetchStatus,
} from '../../services/backgroundSync';
import * as BackgroundFetch from 'expo-background-fetch';
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

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const [permissions, setPermissions] = useState<SmsPermissionResult | null>(
    null,
  );
  const [contactsPermissions, setContactsPermissions] =
    useState<ContactsPermissionResult | null>(null);
  const [bgSyncActive, setBgSyncActive] = useState(false);
  const [bgFetchStatus, setBgFetchStatus] =
    useState<BackgroundFetch.BackgroundFetchStatus | null>(null);

  const appVersion =
    Constants.expoConfig?.version ??
    Constants.manifest2?.extra?.expoClient?.version ??
    '1.0.0';

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      const [perms, contactsPerms, bgActive, fetchStatus] = await Promise.all([
        checkSmsPermissions(),
        checkContactsPermissions(),
        isBackgroundSyncActive(),
        getBackgroundFetchStatus(),
      ]);
      setPermissions(perms);
      setContactsPermissions(contactsPerms);
      setBgSyncActive(bgActive);
      setBgFetchStatus(fetchStatus);
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  const handleRequestPermissions = useCallback(async (): Promise<void> => {
    const result = await requestSmsPermissions();
    await requestContactsPermissions();
    setPermissions(result);

    if (result.readSms === 'never_ask_again') {
      Alert.alert(
        'Permission Required',
        'SMS permission was permanently denied. Please enable it in Settings > Apps > Keepr Companion > Permissions.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'android') {
                Linking.openSettings();
              }
            },
          },
        ],
      );
    }
  }, []);

  const bgFetchAvailable =
    bgFetchStatus === BackgroundFetch.BackgroundFetchStatus.Available;

  return (
    <View style={styles.screen}>
      <Header
        title="Settings"
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
        {/* Sync Settings */}
        <Card title="Sync">
          <CardRow label="Sync Interval" value="Every 15 minutes" />
          <CardDivider />
          <CardRow
            label="Background Sync"
            value={bgSyncActive ? 'Active' : 'Inactive'}
            valueColor={bgSyncActive ? colors.success[600] : colors.gray[400]}
          />
          <CardDivider />
          <CardRow
            label="System Support"
            value={bgFetchAvailable ? 'Available' : 'Restricted'}
            valueColor={
              bgFetchAvailable ? colors.success[600] : colors.warning[500]
            }
          />
        </Card>

        {/* Permissions */}
        <Card title="Permissions">
          <CardRow
            label="Read SMS"
            value={formatPermissionStatus(permissions?.readSms)}
            valueColor={
              permissions?.readSms === 'granted'
                ? colors.success[600]
                : colors.danger[500]
            }
          />
          <CardDivider />
          <CardRow
            label="Receive SMS"
            value={formatPermissionStatus(permissions?.receiveSms)}
            valueColor={
              permissions?.receiveSms === 'granted'
                ? colors.success[600]
                : colors.danger[500]
            }
          />
          <CardDivider />
          <CardRow
            label="Contacts"
            value={formatPermissionStatus(contactsPermissions?.readContacts)}
            valueColor={
              contactsPermissions?.readContacts === 'granted'
                ? colors.success[600]
                : colors.danger[500]
            }
          />
          {permissions &&
            (!permissions.allGranted ||
              (contactsPermissions && !contactsPermissions.granted)) && (
            <View style={styles.permissionAction}>
              <Button
                title="Grant Permissions"
                size="sm"
                onPress={handleRequestPermissions}
                fullWidth
              />
            </View>
          )}
        </Card>

        {/* About */}
        <Card title="About">
          <CardRow label="App" value="Keepr Companion" />
          <CardDivider />
          <CardRow label="Version" value={appVersion} />
          <CardDivider />
          <CardRow
            label="Package"
            value={Constants.expoConfig?.android?.package ?? 'com.keepr.companion'}
            mono
          />
        </Card>
      </ScrollView>
    </View>
  );
}

function formatPermissionStatus(status: string | undefined): string {
  switch (status) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Not Granted';
    case 'never_ask_again':
      return 'Blocked';
    case 'unavailable':
      return 'N/A';
    default:
      return 'Unknown';
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  permissionAction: {
    marginTop: spacing[3],
  },
});
