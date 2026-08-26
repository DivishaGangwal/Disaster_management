import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

export default function RelayScreen() {
  const router = useRouter();
  const state = useAppStore();
  const [changingRelay, setChangingRelay] = useState(false);
  const [probing, setProbing] = useState(false);

  const changeRelay = async (active: boolean) => {
    if (changingRelay) return;
    setChangingRelay(true);
    try { await mobileController.setRelay(active); }
    catch (reason) { Alert.alert(active ? 'Relay could not start' : 'Relay could not stop', reason instanceof Error ? reason.message : String(reason)); }
    finally { setChangingRelay(false); }
  };
  const probe = async () => {
    if (probing) return;
    setProbing(true);
    try {
      const proven = await mobileController.probeGateway();
      if (!proven) Alert.alert('No configured gateway', 'Mesh relay still works offline. Configure EXPO_PUBLIC_DSM_BACKEND_URL to enable gateway synchronization.');
    } catch (reason) { Alert.alert('Gateway probe failed', reason instanceof Error ? reason.message : String(reason)); }
    finally { setProbing(false); }
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
    <View style={{ minHeight: 64, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#142039', flexDirection: 'row', alignItems: 'center' }}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><icons.arrowLeft size={20} color="#00F2FE" /></TouchableOpacity><View><Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>TRANSPORT CONTROL</Text><Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>Relay & Gateway</Text></View></View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 50 }}>
      <View style={{ minHeight: 78, marginTop: 16, paddingHorizontal: 14, backgroundColor: '#0D1424', borderWidth: 1, borderColor: state.relayActive ? '#136B4B' : '#1B2944', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View><Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '900' }}>Nearby mesh relay</Text><Text style={{ color: state.relayActive ? '#00E676' : '#FFB300', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 }}>{changingRelay ? 'CHANGING…' : state.relayActive ? 'ACTIVE' : 'STOPPED'}</Text></View>{changingRelay ? <ActivityIndicator color="#00F2FE" /> : <Switch accessibilityLabel="Nearby mesh relay" value={state.relayActive} onValueChange={(active) => void changeRelay(active)} trackColor={{ false: '#263249', true: '#00A85A' }} thumbColor="#F8FAFC" />}</View>

      <Text style={section}>LIVE RADIO</Text>
      <View style={card}><Fact label="Selected transport" value={state.selectedRadio} tone="#38BDF8" /><Fact label="Peers observed" value={String(state.peersRecentlySeen)} /><Fact label="Battery" value={state.batteryPercent === undefined ? 'Unavailable' : `${state.batteryPercent}%`} /><Fact label="Battery temperature" value={state.batteryTemperatureC === undefined ? 'Sensor unavailable' : `${state.batteryTemperatureC.toFixed(1)} °C`} last /></View>
      <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 10 }}>{state.peersRecentlySeen ? 'Peers were observed inside the current retention window.' : 'No peer is currently known. This is not proof that no phone is nearby.'}</Text>

      <Text style={section}>CUSTODY QUEUE</Text>
      <View style={[card, { paddingHorizontal: 0, flexDirection: 'row' }]}><Count label="STORED" value={state.storedPackets} /><Count label="WAITING" value={state.relayQueueDepth} /><Count label="SENT" value={state.forwardedPackets} last /></View>
      <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 10 }}>Counts describe this phone only. A forwarded record is not confirmation that help is coming.</Text>

      <Text style={section}>OPTIONAL GATEWAY</Text>
      <View style={[card, { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}><View style={{ flex: 1 }}><Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>{state.internetState === 'proven gateway' ? 'Gateway identity proven' : 'No proven gateway'}</Text><Text style={{ color: '#7E8CA6', fontSize: 12, lineHeight: 17, marginTop: 3 }}>Internet availability alone never counts as a gateway.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Probe configured gateway" accessibilityState={{ busy: probing }} disabled={probing} onPress={() => void probe()} style={{ minWidth: 74, minHeight: 44, borderWidth: 1, borderColor: '#A855F7', borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>{probing ? <ActivityIndicator color="#A855F7" /> : <Text style={{ color: '#C084FC', fontSize: 12, fontWeight: '900' }}>PROBE</Text>}</TouchableOpacity></View>
    </ScrollView>
  </SafeAreaView>;
}

const section = { color: '#64748B', fontSize: 10, fontWeight: '900' as const, letterSpacing: 1.8, marginTop: 25, marginBottom: 8 };
const card = { backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14, overflow: 'hidden' as const };
function Fact({ label, value, tone = '#F8FAFC', last = false }: { label: string; value: string; tone?: string; last?: boolean }) { return <View style={{ minHeight: 48, borderTopWidth: 1, borderBottomWidth: last ? 1 : 0, borderColor: '#17233B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}><Text style={{ color: '#8D9AB2', fontSize: 13 }}>{label}</Text><Text numberOfLines={1} style={{ color: tone, fontSize: 13, fontWeight: '900', flexShrink: 1 }}>{value}</Text></View>; }
function Count({ label, value, last = false }: { label: string; value: number; last?: boolean }) { return <View style={{ flex: 1, minHeight: 74, justifyContent: 'center', paddingLeft: 12, borderRightWidth: last ? 0 : 1, borderRightColor: '#1B2944' }}><Text style={{ color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{label}</Text><Text style={{ color: value ? '#F8FAFC' : '#667085', fontSize: 24, fontWeight: '900', marginTop: 3 }}>{value}</Text></View>; }
