import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

const PAIRING_STORAGE_KEY = '@keepr/pairing';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpModal({
  visible,
  onClose,
}: HelpModalProps): React.JSX.Element {
  const [paired, setPaired] = useState(false);
  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem(PAIRING_STORAGE_KEY).then((val) => {
        setPaired(val != null);
      });
    }
  }, [visible]);

  const handleContactSupport = (): void => {
    Linking.openURL('mailto:support@keepr.com?subject=Keepr%20Companion%20Support').catch(() => {
      Alert.alert('Unable to Open', 'Could not open email client.');
    });
  };

  const handleSendDiagnostics = (): void => {
    // Stub for future implementation
    Alert.alert('Coming Soon', 'Diagnostic reporting will be available in a future update.');
  };

  const handleHelpCenter = (): void => {
    Linking.openURL('https://keepr.com/help').catch(() => {
      Alert.alert('Unable to Open', 'Could not open browser.');
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <Text style={styles.title}>Help & Support</Text>

          {/* Options */}
          <TouchableOpacity style={styles.option} onPress={handleContactSupport}>
            <Text style={styles.optionIcon}>{'✉️'}</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Contact Support</Text>
              <Text style={styles.optionDescription}>Send us an email</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleSendDiagnostics}>
            <Text style={styles.optionIcon}>{'📊'}</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Send Diagnostics</Text>
              <Text style={styles.optionDescription}>
                Share device info for troubleshooting
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleHelpCenter}>
            <Text style={styles.optionIcon}>{'📖'}</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Help Center</Text>
              <Text style={styles.optionDescription}>
                Browse articles and guides
              </Text>
            </View>
          </TouchableOpacity>

          {/* Device info footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Keepr Companion v{appVersion}
            </Text>
            <Text style={styles.footerText}>
              {paired ? 'Device paired' : 'Device not paired'}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    alignSelf: 'center',
    marginBottom: spacing[5],
  },
  title: {
    ...textStyles.heading,
    color: colors.gray[900],
    marginBottom: spacing[6],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing[4],
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...textStyles.label,
    color: colors.gray[800],
    marginBottom: 2,
  },
  optionDescription: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  footer: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    alignItems: 'center',
    gap: spacing[1],
  },
  footerText: {
    ...textStyles.caption,
    color: colors.gray[400],
  },
  closeButton: {
    marginTop: spacing[5],
    backgroundColor: colors.gray[100],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  closeButtonText: {
    ...textStyles.button,
    color: colors.gray[700],
  },
});
