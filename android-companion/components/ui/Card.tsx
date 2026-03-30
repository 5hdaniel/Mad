import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({
  title,
  children,
  style,
}: CardProps): React.JSX.Element {
  return (
    <View style={[styles.card, style]}>
      {title != null && (
        <>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.divider} />
        </>
      )}
      {children}
    </View>
  );
}

/** Horizontal divider for use between card rows. */
export function CardDivider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

/** Label + value row commonly used inside cards. */
export function CardRow({
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
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          mono && styles.mono,
          valueColor ? { color: valueColor } : undefined,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing[4],
    marginBottom: spacing[4],
    // shadow-sm equivalent
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    ...textStyles.cardTitle,
    color: colors.gray[600],
    marginBottom: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  label: {
    ...textStyles.label,
    color: colors.gray[600],
    flexShrink: 0,
    marginRight: spacing[3],
  },
  value: {
    ...textStyles.label,
    color: colors.gray[900],
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: {
    fontFamily: 'monospace',
  },
});
