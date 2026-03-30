import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getSession } from '../../services/authService';
import { checkSmsPermissions, checkContactsPermissions } from '../../services/permissions';
import { getLastSuccessTime } from '../../services/pairingManager';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

const PAIRING_STORAGE_KEY = '@keepr/pairing';

type Category = 'Bug Report' | 'Feature Request' | 'Question' | 'Other';

const CATEGORIES: Category[] = ['Bug Report', 'Feature Request', 'Question', 'Other'];

interface Diagnostics {
  appVersion: string;
  deviceModel: string;
  osVersion: string;
  paired: boolean;
  pairedDeviceName: string | null;
  lastSyncTime: string | null;
  smsPermission: string;
  contactsPermission: string;
}

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpModal({
  visible,
  onClose,
}: HelpModalProps): React.JSX.Element {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<Category>('Question');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const collectDiagnostics = useCallback(async (): Promise<void> => {
    const appVersion =
      Constants.expoConfig?.version ??
      Constants.manifest2?.extra?.expoClient?.version ??
      '1.0.0';

    // Device info from Platform API (no extra dependency needed)
    const deviceModel = `${Platform.OS} ${Platform.Version}`;
    const osVersion = `${Platform.OS === 'android' ? 'Android' : 'iOS'} ${String(Platform.Version)}`;

    // Pairing status
    const pairingRaw = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
    let paired = false;
    let pairedDeviceName: string | null = null;
    if (pairingRaw) {
      paired = true;
      try {
        const pairingData = JSON.parse(pairingRaw) as { deviceName?: string };
        pairedDeviceName = pairingData.deviceName ?? null;
      } catch {
        // Ignore parse errors
      }
    }

    // Last sync time
    const lastSyncTime = await getLastSuccessTime();

    // Permission status
    const smsResult = await checkSmsPermissions();
    const contactsResult = await checkContactsPermissions();

    setDiagnostics({
      appVersion,
      deviceModel,
      osVersion,
      paired,
      pairedDeviceName,
      lastSyncTime,
      smsPermission: smsResult.allGranted ? 'Granted' : 'Not Granted',
      contactsPermission: contactsResult.granted ? 'Granted' : 'Not Granted',
    });
  }, []);

  const loadUserInfo = useCallback(async (): Promise<void> => {
    const session = await getSession();
    if (session?.user) {
      const user = session.user;
      const userEmail = user.email ?? '';
      const userName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        '';
      setEmail(userEmail);
      setName(String(userName));
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void collectDiagnostics();
      void loadUserInfo();
    } else {
      // Reset form when modal closes
      setSubject('');
      setDescription('');
      setCategory('Question');
      setShowCategoryPicker(false);
      setSubmitting(false);
    }
  }, [visible, collectDiagnostics, loadUserInfo]);

  const handleSubmit = async (): Promise<void> => {
    if (!subject.trim()) {
      Alert.alert('Required', 'Please enter a subject.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }

    setSubmitting(true);

    // Build the email body with form data and diagnostics
    const diagLines = diagnostics
      ? [
          `App Version: ${diagnostics.appVersion}`,
          `Device: ${diagnostics.deviceModel}`,
          `OS: ${diagnostics.osVersion}`,
          `Paired: ${diagnostics.paired ? 'Yes' : 'No'}${diagnostics.pairedDeviceName ? ` (${diagnostics.pairedDeviceName})` : ''}`,
          `Last Sync: ${diagnostics.lastSyncTime ?? 'Never'}`,
          `SMS Permission: ${diagnostics.smsPermission}`,
          `Contacts Permission: ${diagnostics.contactsPermission}`,
        ]
      : [];

    const body = [
      `Category: ${category}`,
      `Name: ${name || 'Not provided'}`,
      `Email: ${email || 'Not provided'}`,
      '',
      '--- Description ---',
      description,
      '',
      '--- Device Diagnostics ---',
      ...diagLines,
    ].join('\n');

    const mailtoUrl =
      `mailto:support@keeprcompliance.com` +
      `?subject=${encodeURIComponent(`[${category}] ${subject}`)}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        onClose();
      } else {
        Alert.alert('No Email Client', 'Could not find an email app on this device.');
      }
    } catch {
      Alert.alert('Error', 'Could not open email client.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Submit Support Ticket</Text>

            {/* Category selector */}
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={styles.selectButtonText}>{category}</Text>
              <Text style={styles.selectChevron}>{showCategoryPicker ? '\u25B2' : '\u25BC'}</Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.pickerDropdown}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerOption,
                      cat === category && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        cat === category && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Subject */}
            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.textInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief summary of your issue"
              placeholderTextColor={colors.gray[400]}
              maxLength={200}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* User info */}
            <Text style={styles.fieldLabel}>Your Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.gray[400]}
            />

            <Text style={styles.fieldLabel}>Your Email</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Diagnostics (read-only) */}
            {diagnostics && (
              <View style={styles.diagnosticsSection}>
                <Text style={styles.diagnosticsTitle}>Device Diagnostics</Text>
                <Text style={styles.diagnosticsNote}>
                  Auto-collected and included with your ticket
                </Text>
                <View style={styles.diagnosticsGrid}>
                  <DiagnosticRow label="App Version" value={diagnostics.appVersion} />
                  <DiagnosticRow label="Device" value={diagnostics.deviceModel} />
                  <DiagnosticRow label="OS" value={diagnostics.osVersion} />
                  <DiagnosticRow
                    label="Paired"
                    value={
                      diagnostics.paired
                        ? `Yes${diagnostics.pairedDeviceName ? ` (${diagnostics.pairedDeviceName})` : ''}`
                        : 'No'
                    }
                  />
                  <DiagnosticRow
                    label="Last Sync"
                    value={diagnostics.lastSyncTime ? formatDate(diagnostics.lastSyncTime) : 'Never'}
                  />
                  <DiagnosticRow label="SMS" value={diagnostics.smsPermission} />
                  <DiagnosticRow label="Contacts" value={diagnostics.contactsPermission} />
                </View>
              </View>
            )}

            {/* Spacer for bottom buttons */}
            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Action buttons (fixed at bottom) */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Opening...' : 'Submit via Email'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Single diagnostic row component */
function DiagnosticRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.diagRow}>
      <Text style={styles.diagLabel}>{label}</Text>
      <Text style={styles.diagValue}>{value}</Text>
    </View>
  );
}

/** Format an ISO date string to a readable short format */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
  },
  title: {
    ...textStyles.heading,
    color: colors.gray[900],
    marginBottom: spacing[5],
  },
  fieldLabel: {
    ...textStyles.label,
    color: colors.gray[700],
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  textInput: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...textStyles.body,
    color: colors.gray[900],
  },
  textArea: {
    minHeight: 100,
  },
  selectButton: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    ...textStyles.body,
    color: colors.gray[900],
  },
  selectChevron: {
    fontSize: 12,
    color: colors.gray[500],
  },
  pickerDropdown: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    marginTop: spacing[1],
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  pickerOptionText: {
    ...textStyles.body,
    color: colors.gray[700],
  },
  pickerOptionTextSelected: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  diagnosticsSection: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  diagnosticsTitle: {
    ...textStyles.label,
    color: colors.gray[700],
    marginBottom: spacing['0.5'],
  },
  diagnosticsNote: {
    ...textStyles.caption,
    color: colors.gray[400],
    marginBottom: spacing[3],
  },
  diagnosticsGrid: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagLabel: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  diagValue: {
    ...textStyles.caption,
    color: colors.gray[700],
    fontWeight: '500',
  },
  bottomSpacer: {
    height: spacing[4],
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray[100],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...textStyles.button,
    color: colors.gray[700],
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...textStyles.button,
    color: colors.white,
  },
});
