import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { useAppStore, type RuntimeDiagnostic } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

type TransportFilter = 'all' | 'ble' | 'classic' | 'gateway' | 'wavepx' | 'local';
const FILTERS: readonly TransportFilter[] = ['all', 'ble', 'classic', 'gateway', 'wavepx', 'local'];

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TransportFilter>('all');
  const [clearing, setClearing] = useState(false);
  const diagnosticEvents = useAppStore((s) => s.diagnosticEvents);
  const relayQueueDepth = useAppStore((s) => s.relayQueueDepth);
  const forwardedPackets = useAppStore((s) => s.forwardedPackets);
  const batteryBand = useAppStore((s) => s.batteryBand);
  const peersRecentlySeen = useAppStore((s) => s.peersRecentlySeen);
  const queueEpoch = useAppStore((s) => s.queueEpoch);

  const filtered = useMemo(() => diagnosticEvents.filter((event) => filter === 'all' || transportKey(event.transport) === filter), [filter, diagnosticEvents]);
  const latestAt = diagnosticEvents[0]?.atMs;
  const ArrowLeftIcon = icons.arrowLeft;
  const confirmClear = () => Alert.alert(
    'Clear local operational history?',
    'This permanently removes stored packets, previous SOS alerts, chats, shared locations, peers, and received files from this phone. It cannot recall copies already relayed to other phones.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear this phone', style: 'destructive', onPress: () => void (async () => {
        setClearing(true);
        try {
          await mobileController.clearLocalOperationalHistory();
          Alert.alert('Local history cleared', 'Stored packets and their derived SOS, chat, and map history were removed from this phone.');
        } catch (reason) {
          Alert.alert('Could not clear history', reason instanceof Error ? reason.message : String(reason));
        } finally { setClearing(false); }
      })() },
    ],
  );

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}><ArrowLeftIcon size={20} color="#00F2FE" /></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>SYSTEM DIAGNOSTICS</Text><Text style={styles.headerTitle}>Queue Ledger</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Export diagnostic event ledger" onPress={() => void Share.share({ title: 'Disaster SOS Mesh diagnostics', message: JSON.stringify(diagnosticEvents, null, 2) })} style={styles.exportButton}><Text style={styles.exportText}>EXPORT</Text></TouchableOpacity>
    </View>
    <FlatList
      data={filtered}
      keyExtractor={(event, index) => `${event.atMs}-${event.category}-${event.name}-${event.packetId ?? event.sessionId ?? index}`}
      renderItem={({ item }) => <EventRow event={item} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.summary}>
          <Summary label="QUEUED" value={relayQueueDepth} />
          <Summary label="SENT" value={forwardedPackets} tone="green" />
          <Summary label="BATTERY" value={batteryBand === undefined ? '—' : `${batteryBand}/3`} tone={batteryBand === 0 ? 'red' : undefined} />
          <Summary label="PEERS" value={peersRecentlySeen} />
        </View>
        <Text style={styles.refreshNote}>{latestAt ? `Refreshed from runtime event ${formatTime(latestAt)}` : 'Waiting for the first runtime event'} · queue epoch {queueEpoch}</Text>
        <View style={styles.clearPanel}><Text style={styles.clearTitle}>LOCAL DATA CONTROL</Text><Text style={styles.clearCopy}>Remove previous SOS alerts, chats, shared locations, packets, peers, and received files from this phone only.</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear local packet and alert history" disabled={clearing} onPress={confirmClear} style={[styles.clearButton, clearing && styles.clearButtonDisabled]}><Text style={styles.clearButtonText}>{clearing ? 'CLEARING…' : 'CLEAR LOCAL HISTORY'}</Text></TouchableOpacity></View>
        <FlatList horizontal data={FILTERS} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} renderItem={({ item }) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: filter === item }} accessibilityLabel={`Show ${item} diagnostic events`} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'wavepx' ? 'WAVEPX' : item.toUpperCase()}</Text></TouchableOpacity>} />
        <View style={styles.listHeading}><Text style={styles.listTitle}>RUNTIME EVENTS</Text><Text style={styles.listCount}>{filtered.length} shown</Text></View>
      </>}
      ListEmptyComponent={<Text style={styles.empty}>No matching events yet. Keep relay active on both phones and watch for peer, session, inventory, transfer, or error events here.</Text>}
    />
  </SafeAreaView>;
}

function Summary({ label, value, tone }: { label: string; value: string | number; tone?: 'green' | 'red' }) {
  return <View style={styles.summaryCell}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, tone === 'green' && styles.green, tone === 'red' && styles.red]}>{value}</Text></View>;
}

function EventRow({ event }: { event: RuntimeDiagnostic }) {
  const failed = event.severity === 'warn' || event.severity === 'error';
  const detail = event.reason ?? event.result ?? metricsText(event.metrics) ?? (event.bytes !== undefined ? `${event.bytes} bytes` : event.severity);
  return <View style={[styles.event, failed && styles.eventFailed]}>
    <View style={styles.eventTop}><Text style={styles.transport}>{transportLabel(event.transport)}</Text><Text style={styles.time}>{formatTime(event.atMs)}</Text></View>
    <Text style={styles.eventName}>{event.category} · {event.name}</Text>
    <Text style={[styles.detail, failed && styles.red]}>{detail}</Text>
    {(event.packetId || event.peerToken || event.sessionId) && <View style={styles.ids}>
      {event.packetId && <Text style={styles.id}>packet {shortId(event.packetId)}</Text>}
      {event.peerToken && <Text style={styles.id}>peer {shortId(event.peerToken)}</Text>}
      {event.sessionId && <Text style={styles.id}>session {shortId(event.sessionId)}</Text>}
    </View>}
  </View>;
}

function transportKey(value?: string): Exclude<TransportFilter, 'all'> {
  if (value === 'tier1-ble') return 'ble';
  if (value === 'tier1-classic') return 'classic';
  if (value === 'gateway') return 'gateway';
  if (value === 'tier2-mic' || value === 'tier2-direct') return 'wavepx';
  return 'local';
}
function transportLabel(value?: string): string { return ({ ble: 'BLE', classic: 'CLASSIC', gateway: 'GATEWAY', wavepx: 'WAVEPX', local: 'LOCAL / ENGINE' })[transportKey(value)]; }
function shortId(value: string): string { return value.length > 18 ? `${value.slice(0, 18)}…` : value; }
function formatTime(atMs: number): string { return new Date(atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function metricsText(metrics?: Readonly<Record<string, number>>): string | undefined { if (!metrics) return undefined; const entries = Object.entries(metrics); return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join(' · ') : undefined; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050811' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.15)' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 4 },
  eyebrow: { color: '#00F2FE', fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  exportButton: { minHeight: 40, borderRadius: 4, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#00F2FE' },
  exportText: { color: '#00F2FE', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  content: { padding: 20, paddingBottom: 60 },
  summary: { flexDirection: 'row', backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, overflow: 'hidden' },
  summaryCell: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#1E293B' },
  summaryLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryValue: { marginTop: 4, color: '#F8FAFC', fontSize: 22, fontWeight: '900' },
  green: { color: '#00E676' }, red: { color: '#FF0055' },
  refreshNote: { marginTop: 10, color: '#64748B', fontSize: 11, lineHeight: 16 },
  clearPanel: { marginTop: 14, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#6D1B37', backgroundColor: '#160B16' },
  clearTitle: { color: '#FF6B92', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  clearCopy: { marginTop: 5, color: '#C9A6B0', fontSize: 11, lineHeight: 17 },
  clearButton: { marginTop: 11, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: '#9F1239' },
  clearButtonDisabled: { opacity: .5 },
  clearButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  filters: { gap: 8, paddingVertical: 14 },
  filter: { minHeight: 38, borderRadius: 3, justifyContent: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderColor: '#26334C' },
  filterActive: { borderColor: '#00F2FE' },
  filterText: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: .7 },
  filterTextActive: { color: '#00F2FE' },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  listTitle: { color: '#00F2FE', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  listCount: { color: '#64748B', fontSize: 11 },
  event: { marginBottom: 9, padding: 13, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#18243B', borderRadius: 8 },
  eventFailed: { borderColor: '#6D1B37', backgroundColor: '#160B16' },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transport: { color: '#00F2FE', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  time: { color: '#64748B', fontSize: 11, fontVariant: ['tabular-nums'] },
  eventName: { marginTop: 6, color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  detail: { marginTop: 4, color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  ids: { marginTop: 8, gap: 3 },
  id: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
  empty: { padding: 16, color: '#94A3B8', fontSize: 13, lineHeight: 20, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 8 },
});
