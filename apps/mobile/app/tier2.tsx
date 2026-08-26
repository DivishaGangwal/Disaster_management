/** WavePX Tier 2 receiver, decoded packet ledger, and map-application evidence. */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckinStatus } from '@dsm/contracts';
import { icons } from '@/constants/icons';
import { useAppStore, type ReceivedPacketSummary } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { diagnosticEvents, tier2Listening, tier2Metrics, runtimeError, receivedPackets, setFocusMapObjectId } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState(receivedPackets[0]?.packetId ?? '');
  const frameEvents = diagnosticEvents.filter((event) => event.category === 'tier2' || event.transport === 'tier2-mic' || event.transport === 'tier2-direct');
  const ArrowLeftIcon = icons.arrowLeft;

  useEffect(() => () => { if (useAppStore.getState().tier2Listening) void mobileController.stopWavePxListening(); }, []);
  useEffect(() => { if (receivedPackets[0]) setExpandedId(receivedPackets[0].packetId); }, [receivedPackets[0]?.packetId]);

  const toggleListening = async () => {
    setBusy(true);
    try {
      if (tier2Listening) await mobileController.stopWavePxListening();
      else await mobileController.startWavePxListening();
    } catch (reason) {
      useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const openMap = (objectId: string) => {
    setFocusMapObjectId(objectId);
    router.push('/(tabs)/map');
  };

  const respondToCheckin = async (campaignId: string, status: number) => {
    setBusy(true);
    try { await mobileController.respondToCheckin(campaignId, status); }
    catch (reason) { useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.headerButton}><ArrowLeftIcon size={20} color="#A8D69C" /></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>TIER 2 · WAVEPX</Text><Text style={styles.headerTitle}>Receive packets</Text></View>
      <View style={[styles.statusDot, tier2Listening && styles.statusDotLive]} />
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.listenPanel}>
        <View style={styles.listenCopy}>
          <Text style={styles.listenState}>{tier2Listening ? 'Listening for campaign audio' : 'Receiver stopped'}</Text>
          <Text style={styles.listenHelp}>Decoded packets are validated, saved in SQLite, and applied to the same local map state used by Bluetooth.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tier2Listening ? 'Stop WavePX listening' : 'Start WavePX listening'} disabled={busy} onPress={() => void toggleListening()} style={[styles.listenButton, tier2Listening && styles.stopButton, busy && styles.disabled]}>
          <Text style={styles.listenButtonText}>{busy ? 'PLEASE WAIT' : tier2Listening ? 'STOP' : 'START LISTENING'}</Text>
        </TouchableOpacity>
        {runtimeError && <Text accessibilityRole="alert" style={styles.error}>{runtimeError}</Text>}
      </View>

      <SectionLabel label="Current campaign" />
      <View style={styles.sessionPanel}>
        <View style={styles.metricGrid}>{[
          ['Detected', tier2Metrics?.framesDetected ?? 0],
          ['Valid', tier2Metrics?.framesValid ?? 0],
          ['Corrupt', tier2Metrics?.framesCorrupt ?? 0],
          ['Duplicate', tier2Metrics?.framesDuplicate ?? 0],
          ['Packets', tier2Metrics?.packetsRecovered ?? 0],
          ['Missing', tier2Metrics?.missingPacketIds.length ?? 0],
        ].map(([label, value]) => <View key={String(label)} style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
        <View style={styles.campaignLine}><Text style={styles.campaignLabel}>CAMPAIGN</Text><Text style={styles.campaignValue}>{tier2Metrics?.campaignId ?? (tier2Metrics?.campaignHandle !== undefined ? `Handle ${tier2Metrics.campaignHandle}` : 'Waiting for frames')}</Text><Text style={styles.version}>v{tier2Metrics?.campaignVersion ?? '—'}</Text></View>
      </View>

      <SectionLabel label="Decoded packets and phone changes" />
      {receivedPackets.map((packet) => <PacketCard key={packet.packetId} packet={packet} expanded={expandedId === packet.packetId} onToggle={() => setExpandedId(expandedId === packet.packetId ? '' : packet.packetId)} onOpenMap={openMap} onRespond={respondToCheckin} busy={busy} />)}
      {receivedPackets.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>No packet received yet</Text><Text style={styles.emptyCopy}>Start listening here, then use “Play test audio” or “Transmit scheduled campaign” on the website. The recovered message and every applied map change will appear here.</Text></View>}

      <SectionLabel label="Frame activity" />
      <View style={styles.frameLedger}>{frameEvents.slice(0, 12).map((event) => <View key={`${event.atMs}-${event.packetId ?? event.name}`} style={styles.frameRow}><View style={[styles.frameMarker, (event.severity === 'warn' || event.severity === 'error') && styles.frameMarkerError]} /><View style={styles.frameCopy}><Text style={styles.frameName}>{event.name.replaceAll('-', ' ')}</Text><Text style={styles.frameReason}>{event.result ?? event.reason ?? event.severity}</Text></View><Text style={styles.frameTime}>{new Date(event.atMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text></View>)}</View>
    </ScrollView>
  </SafeAreaView>;
}

function PacketCard({ packet, expanded, onToggle, onOpenMap, onRespond, busy }: { packet: ReceivedPacketSummary; expanded: boolean; onToggle: () => void; onOpenMap: (objectId: string) => void; onRespond: (campaignId: string, status: number) => Promise<void>; busy: boolean }) {
  const mapTarget = packet.impacts.find((impact) => impact.objectId)?.objectId;
  const changedMap = packet.impacts.some((impact) => impact.applied);
  return <View style={styles.packetCard}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${packet.typeName} packet details`} onPress={onToggle} style={styles.packetHead}>
      <View style={[styles.packetBand, outcomeColor(packet.outcome)]} />
      <View style={styles.packetIdentity}><Text style={styles.packetType}>{packet.typeName.replaceAll('_', ' ')}</Text><Text style={styles.packetId}>{packet.packetId}</Text></View>
      <View style={styles.packetOutcome}><Text style={styles.packetOutcomeText}>{outcomeLabel(packet.outcome)}</Text><Text style={styles.packetTime}>{new Date(packet.receivedAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
    </TouchableOpacity>
    <View style={styles.messageBlock}><Text style={styles.messageLabel}>MESSAGE SHOWN ON THIS PHONE</Text><Text style={styles.message}>{packet.message}</Text></View>
    <View style={[styles.mapResult, changedMap ? styles.mapResultApplied : styles.mapResultStored]}>
      <Text style={styles.mapResultTitle}>{changedMap ? 'MAP UPDATED + SAVED IN SQLITE' : packet.impacts.length ? 'MAP OPERATION RECEIVED' : 'NO MAP CHANGE FOR THIS PACKET TYPE'}</Text>
      {packet.impacts.length ? packet.impacts.map((impact, index) => <View key={`${impact.kind}-${index}`} style={styles.impactRow}><View style={[styles.impactDot, impact.applied && styles.impactDotApplied]} /><View style={styles.impactCopy}><Text style={styles.impactLabel}>{impact.label}</Text><Text style={styles.impactDetail}>{impact.detail} · {impact.applied ? 'applied to local map' : 'stored without changing current state'}</Text></View></View>) : <Text style={styles.noImpactCopy}>The official instruction is stored and displayed, but it does not alter shelter, hazard, route, responder, or incident geometry.</Text>}
      {mapTarget && <TouchableOpacity accessibilityRole="button" onPress={() => onOpenMap(mapTarget)} style={styles.mapButton}><Text style={styles.mapButtonText}>VIEW CHANGED ITEM ON MAP</Text></TouchableOpacity>}
    </View>
    {packet.typeName === 'CHECKIN_CAMPAIGN' && <View style={styles.checkinActions} accessibilityLabel="Safety check-in response actions">
      <Text style={styles.checkinTitle}>RESPOND THROUGH BLUETOOTH MESH / GATEWAY</Text>
      <View style={styles.checkinRow}><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void onRespond(packet.campaignId ?? String(packet.payload['campaignId']), CheckinStatus.SAFE)} style={styles.checkinButton}><Text style={styles.checkinButtonText}>I AM SAFE</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void onRespond(packet.campaignId ?? String(packet.payload['campaignId']), CheckinStatus.NEED_ASSISTANCE)} style={[styles.checkinButton, styles.checkinAssist]}><Text style={styles.checkinButtonText}>NEED ASSISTANCE</Text></TouchableOpacity></View>
    </View>}
    {expanded && <View style={styles.packetEvidence}>
      <View style={styles.evidenceLine}><Text style={styles.evidenceLabel}>CAMPAIGN</Text><Text style={styles.evidenceValue}>{packet.campaignId ?? 'Compact over-air campaign'} · v{packet.campaignVersion ?? '—'}</Text></View>
      <View style={styles.evidenceLine}><Text style={styles.evidenceLabel}>TRANSPORT</Text><Text style={styles.evidenceValue}>{packet.transport === 'tier2-mic' ? 'WavePX microphone' : 'WavePX direct input'}</Text></View>
      <Text style={styles.payloadLabel}>DECODED PAYLOAD</Text><ScrollView horizontal style={styles.payloadScroll}><Text selectable style={styles.payload}>{JSON.stringify(packet.payload, null, 2)}</Text></ScrollView>
    </View>}
  </View>;
}

function SectionLabel({ label }: { label: string }) { return <View style={styles.sectionLabel}><Text style={styles.sectionLabelText}>{label}</Text><View style={styles.sectionRule} /></View>; }
function outcomeLabel(value: ReceivedPacketSummary['outcome']) { return ({ applied: 'MAP APPLIED', stored: 'STORED', duplicate: 'DUPLICATE', rejected: 'REJECTED' } as const)[value]; }
function outcomeColor(value: ReceivedPacketSummary['outcome']) { return value === 'applied' ? styles.bandApplied : value === 'rejected' ? styles.bandRejected : value === 'duplicate' ? styles.bandDuplicate : styles.bandStored; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#263126' },
  headerButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerCopy: { flex: 1 }, eyebrow: { color: '#A8D69C', fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }, headerTitle: { marginTop: 2, color: '#F0F3EE', fontSize: 21, fontWeight: '800' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#555C57' }, statusDotLive: { backgroundColor: '#55C96B' },
  scroll: { flex: 1 }, content: { padding: 18, paddingBottom: 48 },
  listenPanel: { padding: 18, backgroundColor: '#101410', borderWidth: 1, borderColor: '#2A342B' }, listenCopy: { marginBottom: 16 }, listenState: { color: '#F0F3EE', fontSize: 19, fontWeight: '800' }, listenHelp: { marginTop: 7, color: '#9DA59F', fontSize: 13, lineHeight: 19 },
  listenButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#356B32' }, stopButton: { backgroundColor: '#303633' }, disabled: { opacity: .55 }, listenButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 }, error: { marginTop: 12, color: '#FF746D', fontSize: 12, lineHeight: 17 },
  sectionLabel: { marginTop: 27, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }, sectionLabelText: { color: '#A8D69C', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }, sectionRule: { height: 1, flex: 1, backgroundColor: '#263126' },
  sessionPanel: { backgroundColor: '#101410', borderWidth: 1, borderColor: '#2A342B' }, metricGrid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap' }, metric: { width: '33.333%', paddingVertical: 7 }, metricValue: { color: '#F0F3EE', fontSize: 20, fontWeight: '900' }, metricLabel: { marginTop: 2, color: '#7F8982', fontSize: 10, fontWeight: '700' }, campaignLine: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2A342B' }, campaignLabel: { color: '#7F8982', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, campaignValue: { flex: 1, marginLeft: 10, color: '#A8D69C', fontSize: 11, fontWeight: '800' }, version: { color: '#F0F3EE', fontSize: 11, fontWeight: '700' },
  empty: { padding: 22, backgroundColor: '#101410', borderWidth: 1, borderColor: '#2A342B' }, emptyTitle: { color: '#F0F3EE', fontSize: 16, fontWeight: '800' }, emptyCopy: { marginTop: 7, color: '#8D978F', fontSize: 13, lineHeight: 19 },
  packetCard: { marginBottom: 12, backgroundColor: '#101410', borderWidth: 1, borderColor: '#2A342B' }, packetHead: { minHeight: 67, flexDirection: 'row', alignItems: 'stretch' }, packetBand: { width: 4 }, bandApplied: { backgroundColor: '#55C96B' }, bandStored: { backgroundColor: '#5E8CC8' }, bandDuplicate: { backgroundColor: '#C69946' }, bandRejected: { backgroundColor: '#E45A54' },
  packetIdentity: { flex: 1, padding: 13, justifyContent: 'center' }, packetType: { color: '#F0F3EE', fontSize: 14, fontWeight: '800' }, packetId: { marginTop: 4, color: '#768079', fontSize: 9 }, packetOutcome: { padding: 12, alignItems: 'flex-end', justifyContent: 'center' }, packetOutcomeText: { color: '#A8D69C', fontSize: 9, fontWeight: '900', letterSpacing: .7 }, packetTime: { marginTop: 5, color: '#768079', fontSize: 10 },
  messageBlock: { padding: 15, borderTopWidth: 1, borderTopColor: '#232C24' }, messageLabel: { color: '#7F8982', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, message: { marginTop: 7, color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '700' },
  mapResult: { margin: 12, marginTop: 0, padding: 13, borderLeftWidth: 3 }, mapResultApplied: { backgroundColor: '#132416', borderLeftColor: '#55C96B' }, mapResultStored: { backgroundColor: '#171D21', borderLeftColor: '#5E8CC8' }, mapResultTitle: { color: '#A8D69C', fontSize: 10, fontWeight: '900', letterSpacing: .7 }, impactRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start' }, impactDot: { width: 8, height: 8, marginTop: 4, marginRight: 9, borderRadius: 4, backgroundColor: '#6C7470' }, impactDotApplied: { backgroundColor: '#55C96B' }, impactCopy: { flex: 1 }, impactLabel: { color: '#F0F3EE', fontSize: 12, fontWeight: '800' }, impactDetail: { marginTop: 3, color: '#91A095', fontSize: 10, lineHeight: 15 }, noImpactCopy: { marginTop: 7, color: '#91A095', fontSize: 11, lineHeight: 16 }, mapButton: { minHeight: 42, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#315D30' }, mapButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  checkinActions: { margin: 12, marginTop: 0, padding: 13, borderWidth: 1, borderColor: '#38473A', backgroundColor: '#151B16' }, checkinTitle: { color: '#A8D69C', fontSize: 9, fontWeight: '900', letterSpacing: .7 }, checkinRow: { marginTop: 10, flexDirection: 'row', gap: 8 }, checkinButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#315D30' }, checkinAssist: { backgroundColor: '#8A4428' }, checkinButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: .6 },
  packetEvidence: { padding: 14, borderTopWidth: 1, borderTopColor: '#2A342B' }, evidenceLine: { marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, evidenceLabel: { color: '#727C74', fontSize: 9, fontWeight: '800', letterSpacing: .8 }, evidenceValue: { flex: 1, color: '#D2D8D3', fontSize: 10, textAlign: 'right' }, payloadLabel: { marginTop: 5, color: '#727C74', fontSize: 9, fontWeight: '800', letterSpacing: .8 }, payloadScroll: { marginTop: 7, maxHeight: 220, backgroundColor: '#080A08' }, payload: { padding: 12, color: '#B9C8BC', fontSize: 10, lineHeight: 15 },
  frameLedger: { borderTopWidth: 1, borderTopColor: '#2A342B' }, frameRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#202721' }, frameMarker: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#55C96B' }, frameMarkerError: { backgroundColor: '#E45A54' }, frameCopy: { flex: 1, paddingHorizontal: 11 }, frameName: { color: '#D8DED9', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, frameReason: { marginTop: 2, color: '#737D76', fontSize: 9 }, frameTime: { color: '#737D76', fontSize: 10 },
});
