import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { mobileController } from '@/src/services/mobile-controller';

/** Required ActiveSos route: keeps local, peer, and responder evidence distinct. */
export default function ActiveSosScreen() {
  const router = useRouter();
  const { activeIncidentId, activeSosSavedAtMs, distinctPeerReceipts, relayActive, internetState, runtimeIncidents } = useAppStore();
  const incident = runtimeIncidents.find((item) => item.id === activeIncidentId);
  const delivery = incident?.delivery;

  const handleCancel = () => {
    Alert.alert('Cancel SOS', 'Create a cancellation packet for this SOS?', [
      { text: 'Keep active', style: 'cancel' },
      {
        text: 'Cancel SOS',
        style: 'destructive',
        onPress: () => {
          void mobileController.cancelSos()
            .then(() => router.back())
            .catch((reason: unknown) => Alert.alert('Cancel failed', reason instanceof Error ? reason.message : String(reason)));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ position: 'absolute', left: 16, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <icons.arrowLeft size={20} color="#00F2FE" />
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900' }}>Active SOS</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={{ backgroundColor: '#190A15', borderWidth: 1, borderColor: '#6D1B37', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#FF456F', fontSize: 22, fontWeight: '900', marginBottom: 6 }}>SOS stored locally</Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 19 }}>Relay is opportunistic. A nearby-device receipt is not rescue confirmation.</Text>
        </View>

        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, padding: 14 }}>
          <TimelineStep completed label="Saved on this phone" detail={`${activeSosSavedAtMs ? new Date(activeSosSavedAtMs).toLocaleString() : 'Stored time unavailable'} · ${activeIncidentId ?? 'Local incident ID unavailable'}`} />
          <TimelineStep completed={distinctPeerReceipts > 0} label={distinctPeerReceipts > 0 ? `${distinctPeerReceipts} distinct peer receipt${distinctPeerReceipts === 1 ? '' : 's'}` : 'No peer receipt observed yet'} detail={distinctPeerReceipts > 0 ? 'A nearby phone reported storing a copy.' : 'The app will continue opportunistic relay while relay mode is active.'} />
          <TimelineStep completed={delivery?.responderSeenAtS !== undefined} label={delivery?.responderSeenAtS ? 'Responder saw this SOS' : 'Responder acknowledgement not observed'} detail={delivery?.responderSeenAtS ? `A responder lifecycle packet returned at ${formatTime(delivery.responderSeenAtS)}.` : 'This remains unknown until a valid responder-state packet is received.'} />
          {incident?.maxResponderHopCount !== undefined && <TimelineStep completed label={incident.maxResponderHopCount >= 2 ? 'Multi-hop responder return observed' : 'Direct or single-hop responder return observed'} detail={incident.maxResponderHopCount >= 2 ? `A responder packet arrived with hop count ${incident.maxResponderHopCount}. This proves relay traversal, but not a complete route history.` : 'The returned responder packet carried one hop or less; no multi-hop path is proven.'} />}
          <TimelineStep completed={delivery?.acceptedAtS !== undefined} label={delivery?.acceptedAtS ? 'Responder accepted' : incident?.state === 'active' && delivery?.assignedAtS ? 'Responder declined; SOS remains open' : 'No responder acceptance observed'} detail={delivery?.acceptedAtS ? `Accepted at ${formatTime(delivery.acceptedAtS)}${incident?.responderRef ? ` · responder ${shortId(incident.responderRef)}` : ''}.` : delivery?.assignedAtS ? 'The assignment returned to the available incident queue.' : 'Acceptance and a nearby-device receipt are separate facts.'} />
          <TimelineStep completed={delivery?.enRouteAtS !== undefined} label={delivery?.enRouteAtS ? 'Responder en route' : 'Responder not marked en route'} detail={delivery?.enRouteAtS ? `En-route update received at ${formatTime(delivery.enRouteAtS)}.` : 'Waiting for an explicit responder update.'} />
          <TimelineStep completed={delivery?.arrivedAtS !== undefined} label={delivery?.arrivedAtS ? 'Responder arrived' : 'Arrival not observed'} detail={delivery?.arrivedAtS ? `Arrival declared at ${formatTime(delivery.arrivedAtS)}.` : 'Arrival is never inferred from message delivery.'} />
          <TimelineStep completed={delivery?.resolvedAtS !== undefined} label={delivery?.resolvedAtS ? 'SOS resolved' : 'Resolution not observed'} detail={delivery?.resolvedAtS ? `Resolution packet received at ${formatTime(delivery.resolvedAtS)}.` : 'The SOS remains active until a valid resolution or cancellation packet arrives.'} />
          <TimelineStep label="Gateway acknowledgement not observed" detail={internetState === 'proven gateway' ? 'A gateway is proven, but this screen has no backend acknowledgement for this SOS.' : 'No proven gateway is available; Bluetooth relay remains independent.'} />
          <TimelineStep label={relayActive ? 'Relay retry is active' : 'Relay is stopped'} detail={relayActive ? 'The phone will retry opportunistically when peers are observed.' : 'Start relay from Relay & Gateway to continue nearby delivery attempts.'} last />
        </View>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Update active SOS details" onPress={() => router.push('/sos/composer')} style={{ minHeight: 52, backgroundColor: '#7C3AED', borderRadius: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 24 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>UPDATE SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel active SOS" onPress={handleCancel} style={{ minHeight: 52, borderWidth: 1, borderColor: '#FF456F', borderRadius: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 10 }}>
          <Text style={{ color: '#FF456F', fontSize: 14, fontWeight: '900' }}>CANCEL SOS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineStep({ completed = false, label, detail, last = false }: { completed?: boolean; label: string; detail: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', minHeight: 86 }}>
      <View style={{ width: 32, alignItems: 'center', marginRight: 14 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: completed ? '#00E676' : '#475569', backgroundColor: completed ? 'rgba(0,230,118,0.18)' : '#141E33', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: completed ? '#00E676' : '#94A3B8', fontSize: 13, fontWeight: '900' }}>{completed ? '✓' : '·'}</Text>
        </View>
        {!last && <View style={{ width: 2, flex: 1, backgroundColor: completed ? '#00E676' : '#334155' }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 18 }}>
        <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 }}>{detail}</Text>
      </View>
    </View>
  );
}

function formatTime(atS: number) { return new Date(atS * 1000).toLocaleString(); }
function shortId(value: string) { return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value; }
