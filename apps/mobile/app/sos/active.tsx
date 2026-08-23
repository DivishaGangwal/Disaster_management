/**
 * ACTIVE SOS & DELIVERY TIMELINE
 * PNG ref: screen (2)
 * Route: ActiveSos
 *
 * Wired to the real engine:
 * - Timeline reads DeliveryFacts from engine.incidents.view(activeSosPacketId)
 * - Cancel SOS → buildSosCancel() → engine.createLocal()
 * - Polls every 2 s for live delivery state updates
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildSosCancel, toEpochS } from '@dsm/codec';
import type { DeliveryFacts, IncidentView } from '@dsm/incident';
import { DELIVERY_STATE_COPY } from '@dsm/contracts';

// SOS_CANCEL reason codes (02-... "SOS cancel reasons")
const CancelReason = { SAFE: 0, FALSE_ALARM: 1, EVACUATED: 2 } as const;

export default function ActiveSosScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const {
    setHasActiveSos,
    activeSosPacketId,
    setActiveSosPacketId,
    sosSequence,
    resetSosSequence,
  } = useAppStore();

  const [incident, setIncident] = useState<IncidentView | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;
  const LocationIcon = icons.location;

  // Poll the engine for delivery facts every 2 s.
  useEffect(() => {
    if (!runtime || !activeSosPacketId) return;

    const load = () => {
      const view = runtime.engine.incidents.view(activeSosPacketId);
      if (view) setIncident(view);
    };

    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [runtime, activeSosPacketId]);

  const handleCancel = () => {
    Alert.alert('Cancel SOS', 'Choose a reason:', [
      { text: 'I am safe', onPress: () => doCancel(CancelReason.SAFE) },
      { text: 'False alarm', onPress: () => doCancel(CancelReason.FALSE_ALARM) },
      { text: 'Evacuated', onPress: () => doCancel(CancelReason.EVACUATED) },
      { text: 'Dismiss', style: 'cancel' },
    ]);
  };

  const doCancel = async (reason: number) => {
    if (!activeSosPacketId || cancelling) return;
    setCancelling(true);
    try {
      const encoded = buildSosCancel(
        {
          sourceId: runtime?.engine.localSourceId ?? 'offline-source',
          sourceClass: 1, // GENERAL_PUBLIC
          nowS: toEpochS(Date.now()),
        },
        activeSosPacketId,
        sosSequence + 1,
        reason,
        3600, // retain for 1 hour after cancel
      );
      if (runtime) await runtime.engine.createLocal(encoded, activeSosPacketId);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setCancelling(false);
      setHasActiveSos(false);
      setActiveSosPacketId(null);
      resetSosSequence();
      router.back();
    }
  };

  const d = incident?.delivery;
  const savedAtS = d?.savedLocallyAtS;
  const peerCopies = d?.distinctPeerReceipts ?? 0;
  const responderSeenAtS = d?.responderSeenAtS;
  const backendAtS = d?.backendAcceptedAtS;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8, flex: 1 }}>GUARDIAN</Text>
        <AlertIcon size={20} color="#FF3B30" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Title */}
        <Text style={{ color: '#FF3B30', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>ACTIVE SOS</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', marginRight: 8 }} />
          <Text style={{ color: '#AEAEB2', fontSize: 14 }}>
            {incident ? `State: ${incident.state.toUpperCase()}` : 'Transmitting Data'}
          </Text>
        </View>

        {/* Delivery Timeline — real DeliveryFacts */}
        <View style={{ paddingLeft: 8 }}>
          <TimelineStep
            completed={savedAtS !== undefined}
            label="Saved locally"
            detail={savedAtS ? fmtTime(savedAtS * 1000) : undefined}
            isFirst
          />
          <TimelineStep
            completed={peerCopies > 0}
            label={peerCopies > 0 ? `Received by ${peerCopies} peer${peerCopies > 1 ? 's' : ''}` : 'Waiting for nearby devices'}
            detail={peerCopies > 0 ? `${peerCopies} link receipt${peerCopies > 1 ? 's' : ''}` : undefined}
            chipLabel={peerCopies === 0 ? 'WAITING' : undefined}
            chipColor="#3A3A3C"
          />
          <TimelineStep
            completed={responderSeenAtS !== undefined}
            label={responderSeenAtS ? DELIVERY_STATE_COPY['seen-by-responder'] : 'Responder acknowledged'}
            detail={responderSeenAtS ? fmtTime(responderSeenAtS * 1000) : undefined}
            chipLabel={!responderSeenAtS ? 'WAITING' : undefined}
            chipColor="#3A3A3C"
          />
          <TimelineStep
            completed={backendAtS !== undefined}
            label={backendAtS ? DELIVERY_STATE_COPY['accepted-by-backend'] : 'Gateway / backend'}
            detail={backendAtS ? fmtTime(backendAtS * 1000) : undefined}
            chipLabel={!backendAtS ? 'QUEUED' : undefined}
            chipColor="#3A3A3C"
            isLast
          />
        </View>

        {/* Incident details if available */}
        {incident && (
          <View style={{ marginTop: 32, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16 }}>
            <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>INCIDENT DETAILS</Text>
            <Row label="Incident ID" value={`${incident.incidentId.slice(0, 12)}…`} mono />
            {incident.peopleTotal !== undefined && <Row label="People" value={String(incident.peopleTotal)} />}
            {incident.injured !== undefined && <Row label="Injured" value={String(incident.injured)} />}
            {incident.shortNote && <Row label="Note" value={incident.shortNote} />}
          </View>
        )}

        {/* Location section */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <LocationIcon size={16} color="#AEAEB2" style={{ marginRight: 6 }} />
            <Text style={{ color: '#AEAEB2', fontSize: 14 }}>
              {incident?.locationSource !== undefined ? 'Location attached' : 'No location fix'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Location', 'Add GPS location via SOS Composer → UPDATE SOS.')}>
            <Text style={{ color: '#a1d494', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>
              Update Location
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={{ padding: 20, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#3A3A3C', gap: 8 }}>
        <TouchableOpacity
          onPress={() => router.push('/sos/composer')}
          style={{ backgroundColor: '#2D5A27', paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>UPDATE SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCancel}
          disabled={cancelling}
          style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#FF3B30', paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          {cancelling && <ActivityIndicator size="small" color="#FF3B30" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>CANCEL SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: mono ? 'monospace' : undefined }}>{value}</Text>
    </View>
  );
}

function TimelineStep({
  completed = false,
  label,
  detail,
  chipLabel,
  chipColor,
  isFirst = false,
  isLast = false,
}: {
  completed?: boolean;
  label: string;
  detail?: string;
  chipLabel?: string;
  chipColor?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const dotSize = 32;
  const lineColor = completed ? '#2D5A27' : '#3A3A3C';

  return (
    <View style={{ flexDirection: 'row', minHeight: 72 }}>
      <View style={{ alignItems: 'center', width: dotSize, marginRight: 16 }}>
        {!isFirst && <View style={{ width: 2, height: 20, backgroundColor: lineColor }} />}
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: completed ? '#2D5A27' : '#3A3A3C', borderWidth: 2, borderColor: completed ? '#a1d494' : '#3A3A3C', justifyContent: 'center', alignItems: 'center' }}>
          {completed && <Text style={{ color: '#a1d494', fontSize: 16 }}>✓</Text>}
        </View>
        {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: lineColor, minHeight: 20 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 16, justifyContent: 'center' }}>
        <Text style={{ color: completed ? '#FFFFFF' : '#AEAEB2', fontSize: 18, fontWeight: '600' }}>{label}</Text>
        {detail && <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>{detail}</Text>}
        {chipLabel && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: chipColor, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{chipLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
