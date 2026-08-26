import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

const SOS_SIZE = Math.min(Dimensions.get('window').width * 0.58, 236);

export default function HomeScreen() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const state = useAppStore();
  if (!state.isLoggedIn) return <Redirect href="/login" />;
  if (!state.hasCompletedReadiness) return <Redirect href="/readiness" />;
  if (state.role === 'responder') return <Redirect href="/(tabs)/nearby" />;

  const sendRapidSos = async () => {
    if (sending) return;
    setSending(true);
    try {
      await mobileController.sendRapidSos();
      Alert.alert('SOS saved on this phone', 'Relay will try nearby devices. A stored copy is not rescue confirmation.', [
        { text: 'View delivery status', onPress: () => router.push('/sos/active') },
        { text: 'Stay here', style: 'cancel' },
      ]);
    } catch (reason) {
      Alert.alert('SOS was not saved', reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSending(false);
    }
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
    <View style={{ minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#142039', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View><Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>LOCAL EMERGENCY NODE</Text><Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 1 }}>Home</Text></View>
      <Text style={{ color: state.batteryPercent !== undefined && state.batteryPercent < 20 ? '#FFB300' : '#94A3B8', fontSize: 12, fontWeight: '800' }}>{state.batteryPercent === undefined ? 'BAT —' : `BAT ${state.batteryPercent}%`}</Text>
    </View>

    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
      <View style={{ paddingTop: 22, paddingBottom: 18, alignItems: 'center' }}>
        <View style={{ width: SOS_SIZE + 24, height: SOS_SIZE + 24, borderRadius: (SOS_SIZE + 24) / 2, borderWidth: 1, borderColor: '#5B1530', alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create an urgent SOS immediately" accessibilityHint="Saves the SOS locally and starts nearby Bluetooth relay" accessibilityState={{ busy: sending }} disabled={sending} onPress={() => void sendRapidSos()} activeOpacity={0.72} style={{ width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2, backgroundColor: '#E8174F', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.72 : 1 }}>
            {sending ? <ActivityIndicator color="#FFF4F7" size="large" /> : <><Text style={{ color: '#FFF4F7', fontSize: 50, fontWeight: '900', letterSpacing: -2 }}>SOS</Text><Text style={{ color: '#FFD7E2', fontSize: 11, fontWeight: '900', letterSpacing: 1.8, marginTop: 5 }}>SAVE + RELAY NOW</Text></>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/sos/composer')} style={{ minHeight: 48, marginTop: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: '#C7D2E5', fontSize: 14, fontWeight: '800' }}>Add details before sending</Text><Text style={{ color: '#00F2FE', fontSize: 18 }}>→</Text></TouchableOpacity>
      </View>

      {state.hasActiveSos && <TouchableOpacity accessibilityRole="button" accessibilityLabel="View active SOS delivery status" onPress={() => router.push('/sos/active')} style={{ minHeight: 62, borderWidth: 1, borderColor: '#6D1B37', borderRadius: 10, backgroundColor: '#190A15', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 20 }}><View><Text style={{ color: '#FF7898', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>ACTIVE SOS</Text><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginTop: 2 }}>Check delivery evidence</Text></View><Text style={{ color: '#FF7898', fontSize: 20 }}>→</Text></TouchableOpacity>}

      <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 8 }}>RADIO PICTURE</Text>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <Metric label="RELAY" value={state.relayActive ? 'ON' : 'OFF'} color={state.relayActive ? '#00E676' : '#FFB300'} />
        <Metric label="RADIO" value={state.selectedRadio} color="#38BDF8" />
        <Metric label="PEERS" value={String(state.peersRecentlySeen)} color="#00F2FE" />
        <Metric label="BATTERY" value={state.batteryPercent === undefined ? '—' : `${state.batteryPercent}%`} color={state.batteryPercent !== undefined && state.batteryPercent < 20 ? '#FF456F' : '#EAB308'} />
      </View>
      <View style={{ marginTop: 8, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14 }}>
        <SignalRow label="Transport mode" value={state.transportMode === 'SIMULATED' ? 'SIMULATED' : 'NATIVE'} color="#38BDF8" detail={state.transportMode === 'SIMULATED' ? 'No physical Bluetooth' : 'Android radio bridge'} />
        <SignalRow label="Gateway" value={state.internetState === 'proven gateway' ? 'PROVEN' : state.internetState.toUpperCase()} color={state.internetState === 'proven gateway' ? '#00E676' : '#94A3B8'} detail="Optional; mesh remains local" last />
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open WavePX acoustic receiver" onPress={() => router.push('/tier2')} style={{ minHeight: 82, marginTop: 16, backgroundColor: '#0A1625', borderWidth: 1, borderColor: '#17314A', borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}><icons.mic size={22} color={state.tier2Listening ? '#FF456F' : '#00F2FE'} /><View style={{ flex: 1 }}><Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>WavePX receiver</Text><Text numberOfLines={2} style={{ color: '#7E8CA6', fontSize: 12, marginTop: 3 }}>{state.tier2Listening ? 'Listening through this microphone' : state.tier2Metrics?.campaignId ? `Last campaign ${state.tier2Metrics.campaignId}` : 'No campaign detected on this device'}</Text></View></View><Text style={{ color: '#00F2FE', fontSize: 20 }}>→</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SignalRow({ label, value, color, detail, last = false }: { label: string; value: string; color: string; detail: string; last?: boolean }) {
  return <View style={{ minHeight: 62, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: last ? 0 : 1, borderBottomColor: '#111C31' }}><View><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>{label}</Text><Text style={{ color: '#64748B', fontSize: 11, marginTop: 3 }}>{detail}</Text></View><Text style={{ color, fontSize: 12, fontWeight: '900', letterSpacing: .8 }}>{value}</Text></View>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <View style={{ flex: 1, minHeight: 62, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: '#596882', fontSize: 8, fontWeight: '900', letterSpacing: .7 }}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color, fontSize: 13, fontWeight: '900', marginTop: 4 }}>{value}</Text></View>;
}
