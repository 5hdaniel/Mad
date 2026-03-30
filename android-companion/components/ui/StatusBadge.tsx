import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

type BadgeStatus = 'connected' | 'disconnected' | 'warning';

interface StatusBadgeProps {
  status: BadgeStatus;
  /** Override the label text. Defaults to "Connected" / "Disconnected" / "Warning". */
  label?: string;
}

const defaultLabels: Record<BadgeStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  warning: 'Warning',
};

const bgStyles: Record<BadgeStatus, object> = {
  connected: { backgroundColor: colors.success[50] },
  disconnected: { backgroundColor: colors.gray[100] },
  warning: { backgroundColor: colors.warning[50] },
};

const dotStyles: Record<BadgeStatus, object> = {
  connected: { backgroundColor: colors.success[500] },
  disconnected: { backgroundColor: colors.gray[400] },
  warning: { backgroundColor: colors.warning[500] },
};

const textColorStyles: Record<BadgeStatus, object> = {
  connected: { color: colors.success[600] },
  disconnected: { color: colors.gray[500] },
  warning: { color: colors.warning[600] },
};

export default function StatusBadge({
  status,
  label,
}: StatusBadgeProps): React.JSX.Element {
  const text = label ?? defaultLabels[status];

  return (
    <View style={[styles.badge, bgStyles[status]]}>
      <View style={[styles.dot, dotStyles[status]]} />
      <Text style={[styles.text, textColorStyles[status]]}>{text}</Text>
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
});
