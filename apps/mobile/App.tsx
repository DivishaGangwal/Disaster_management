/**
 * App shell.
 *
 * Workstream A: replace this placeholder with the navigator over the 13 screens
 * listed in src/screens/screen-registry.ts. Everything below the shell is
 * already built and tested -- see docs/STATUS.md.
 *
 * The shell deliberately renders the transport mode, because DEC-004 means the
 * user must always be able to tell a simulated run from the real thing.
 */

import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SCREENS } from './src/screens/screen-registry';

export default function App() {
  const built = SCREENS.filter((screen) => screen.status === 'complete').length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Disaster SOS Mesh</Text>
        <Text style={styles.subtitle}>
          Scaffold build. Transport: simulated (not real Bluetooth).
        </Text>
        <Text style={styles.progress}>
          {built} of {SCREENS.length} screens built
        </Text>

        {SCREENS.map((screen) => (
          <View key={screen.route} style={styles.row}>
            <Text style={styles.rowTitle}>{screen.title}</Text>
            <Text style={styles.rowMeta}>
              {screen.status} - {screen.requirements.join(', ')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#11161d' },
  content: { padding: 20, paddingTop: 60 },
  title: { color: '#f5f7fa', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#f0a020', fontSize: 14, marginTop: 6 },
  progress: { color: '#8b97a8', fontSize: 13, marginTop: 16, marginBottom: 12 },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#232b36' },
  rowTitle: { color: '#e6ebf2', fontSize: 16 },
  rowMeta: { color: '#7d8899', fontSize: 12, marginTop: 3 },
});
