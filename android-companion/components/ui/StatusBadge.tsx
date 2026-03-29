import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

type BadgeStatus = 'connected' | 'disconnected';

interface StatusBadgeProps {
  status: BadgeStatus;
  /** Override the label text. Defaults to "Connected" / "Disconnected". */
  label?: string;
}

export default function StatusBadge({
  status,
  label,
}: StatusBadgeProps): React.JSX.Element {
  const isConnected = status === 'connected';
  const text = label ?? (isConnected ? 'Connected' : 'Disconnected');

  return (
    <View
      style={[
        styles.badge,
        isConnected ? styles.connectedBg : styles.disconnectedBg,
      ]}
    >
      <View
        style={[
          styles.dot,
          isConnected ? styles.connectedDot : styles.disconnectedDot,
        ]}
      />
      <Text
        style={[
          styles.text,
          isConnected ? styles.connectedText : styles.disconnectedText,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    alignSelf: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
  },
  text: {
    ...textStyles.label,
  },
  connectedBg: {
    backgroundColor: colors.success[50],
  },
  connectedDot: {
    backgroundColor: colors.success[500],
  },
  connectedText: {
    color: colors.success[600],
  },
  disconnectedBg: {
    backgroundColor: colors.gray[100],
  },
  disconnectedDot: {
    backgroundColor: colors.gray[400],
  },
  disconnectedText: {
    color: colors.gray[500],
  },
});
