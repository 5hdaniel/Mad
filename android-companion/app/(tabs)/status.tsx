import { StyleSheet, Text, View } from 'react-native';

export default function StatusScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Status</Text>
      <Text style={styles.description}>
        View the current connection status and sync progress with the Keepr
        desktop application.
      </Text>
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
});
