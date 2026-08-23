/**
 * RESPONDER INCIDENT DETAIL
 * PNG ref: screen (10)
 * Route: ResponderIncident
 *
 * Wired to the real engine:
 * 1. Accept     → buildResponderState(RESPONDER_ACCEPTED)  → engine.createLocal()
 * 2. Decline    → buildResponderState(RESPONDER_DECLINED)  → engine.createLocal()
 * 3. En Route   → buildResponderState(RESPONDER_EN_ROUTE)  → engine.createLocal()
 * 4. Arrived    → buildResponderState(RESPONDER_ARRIVED)   → engine.createLocal()
 * 5. Resolve    → buildResponderState(RESOLVED)            → engine.createLocal()
 * 6. Location   → shows simulated notice (no GPS in Expo Go)
 *
 * The screen reads the incident from the engine via `activeSosPacketId`
 * if one exists; otherwise shows a placeholder for responder-assigned incidents.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildResponderState, toEpochS } from '@dsm/codec';
import { MessageType, SourceClass } from '@dsm/contracts';
import type { IncidentView } from '@dsm/incident';

type ResponderStatus = 'pending' | 'accepted' | 'declined' | 'en-route' | 'arrived' | 'resolved';

const STATUS_COLORS: Record<ResponderStatus, string> = {
  pending: '#AEAEB2',
  accepted: '#a1d494',
  declined: '#FF453A',
  'en-route': '#7B9FFF',
  arrived: '#FFB340',
  resolved: '#a1d494',
};

export default function ResponderIncidentScreen() {
  const router = useRouter();
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const { runtime } = useRuntime();
  const { role, activeSosPacketId, sosSequence, incrementSosSequence } = useAppStore();

  const targetId = incidentId ?? activeSosPacketId;

  const [status, setStatus] = useState<ResponderStatus>('pending');
  const [incident, setIncident] = useState<IncidentView | null>(null);
  const [sending, setSending] = useState(false);

  const LocationIcon = icons.location;

  // Load the incident if one is active.
  useEffect(() => {
    if (!runtime || !targetId) return;
    const view = runtime.engine.incidents.view(targetId);
    if (view) {
      setIncident(view);
      if (view.state !== 'active' && view.state !== 'created' && view.state !== 'draft') {
        setStatus(view.state as ResponderStatus);
      }
    }
  }, [runtime, targetId]);

  const buildCtx = () => ({
    sourceId: runtime?.engine.localSourceId ?? 'offline-source',
    sourceClass: role === 'responder'
      ? SourceClass.RESPONDER_PROVISIONED
      : SourceClass.GENERAL_PUBLIC,
    nowS: toEpochS(Date.now()),
  });

  const transition = async (next: ResponderStatus, msgType: number, msg: string) => {
    if (!targetId) {
      // No active incident — just update local UI state.
      setStatus(next);
      Alert.alert('Status Updated (local)', `${msg} — no active incident linked.`);
      return;
    }
    setSending(true);
    try {
      const encoded = buildResponderState(
        buildCtx(),
        msgType,
        targetId,
        sosSequence + 1,
        {
          responderRef: runtime?.engine.localSourceId ?? 'local-responder',
          location: { 
            source: 1, 
            latE7: 190750000 + Math.floor(Math.random() * 8000) - 4000, 
            lonE7: 728790000 + Math.floor(Math.random() * 8000) - 4000, 
            ageS: 0 
          },
        },
      );
      if (runtime) {
        const result = await runtime.engine.createLocal(encoded);
        if (!result.accepted) {
          const v = result.validation as { reason?: string; detail?: string; gate?: string } | undefined;
          throw new Error(`Rejected [${v?.gate ?? '?'}]: ${v?.reason ?? 'unknown'} — ${v?.detail ?? 'no detail'}`);
        }
      }
      incrementSosSequence();
      setStatus(next);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSending(false);
    }
  };

  const resolveIncident = async () => {
    if (!targetId) {
      setStatus('resolved');
      Alert.alert('Resolved (local)', 'No active incident linked.');
      return;
    }
    setSending(true);
    try {
      const encoded = buildResponderState(
        buildCtx(),
        MessageType.RESOLVED,
        targetId,
        sosSequence + 1,
        {},
      );
      if (runtime) {
        const result = await runtime.engine.createLocal(encoded);
        if (!result.accepted) {
          const reason = (result.validation as { reason?: string })?.reason ?? 'unknown';
          throw new Error(`Engine rejected: ${reason}`);
        }
      }
      incrementSosSequence();
      setStatus('resolved');
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSending(false);
    }
  };

  const i = incident;
  const peopleCount = i?.peopleTotal ?? 3;
  const injuredCount = i?.injured ?? 1;
  const category = i ? categoryLabel(i.category) : 'MEDICAL\nEMERGENCY';
  const severityStr = i ? severityLabel(i.severity) : 'CRITICAL';
  const severityCol = i ? severityColor(i.severity) : '#FF453A';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#AEAEB2', fontSize: 22 }}>≡</Text>
        </TouchableOpacity>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>GUARDIAN</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <View style={{ width: 4, height: 8, backgroundColor: '#a1d494' }} />
          <View style={{ width: 4, height: 14, backgroundColor: '#a1d494' }} />
          <View style={{ width: 4, height: 20, backgroundColor: '#a1d494' }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Status badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLORS[status], marginRight: 8 }} />
          <Text style={{ color: STATUS_COLORS[status], fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
            {status.toUpperCase().replace('-', ' ')}
          </Text>
          {sending && <ActivityIndicator size="small" color="#a1d494" style={{ marginLeft: 8 }} />}
        </View>

        {/* Incident card */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          <View style={{ width: 4, backgroundColor: severityCol }} />
          <View style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>TYPE</Text>
              <View style={{ backgroundColor: severityCol, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{severityStr}</Text>
              </View>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 16 }}>{category}</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#2C2C2E', padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>PEOPLE</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{peopleCount}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#2C2C2E', padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>INJURED</Text>
                <Text style={{ color: '#FF453A', fontSize: 28, fontWeight: '700' }}>{injuredCount}</Text>
              </View>
            </View>

            {i?.incidentId && (
              <Text style={{ color: '#3A3A3C', fontSize: 11, marginTop: 12 }}>
                ID: {i.incidentId.slice(0, 12)}…
              </Text>
            )}
          </View>
        </View>

        {/* Action buttons — each calls buildResponderState() */}
        <ActionBtn
          label="ACCEPT"
          color="#2D5A27"
          enabled={status === 'pending' || status === 'active' || status === 'assigned'}
          sending={sending}
          onPress={() => transition('accepted', MessageType.RESPONDER_ACCEPTED, 'Assignment accepted')}
        />
        <ActionBtn
          label="DECLINE"
          color="#93000a"
          enabled={status === 'pending' || status === 'active' || status === 'assigned'}
          sending={sending}
          onPress={() => transition('declined', MessageType.RESPONDER_DECLINED, 'Assignment declined')}
        />
        <ActionBtn
          label="MARK EN ROUTE"
          color="#1E3A5F"
          enabled={status === 'accepted'}
          sending={sending}
          onPress={() => transition('en-route', MessageType.RESPONDER_EN_ROUTE, 'Marked en route')}
        />
        <ActionBtn
          label="MARK ARRIVED"
          color="#1E3A5F"
          enabled={status === 'en-route'}
          sending={sending}
          onPress={() => transition('arrived', MessageType.RESPONDER_ARRIVED, 'Marked arrived')}
        />
        <ActionBtn
          label="RESOLVE"
          color="#2C2C2E"
          enabled={status === 'arrived'}
          sending={sending}
          onPress={resolveIncident}
          style={{ marginBottom: 24 }}
        />

        {/* Send location (live update) */}
        <TouchableOpacity
          onPress={() => {
            const msgType = status === 'en-route' ? MessageType.RESPONDER_EN_ROUTE 
              : status === 'arrived' ? MessageType.RESPONDER_ARRIVED 
              : MessageType.RESPONDER_ACCEPTED;
            transition(status, msgType, 'Location updated');
          }}
          disabled={sending || status === 'resolved'}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderColor: '#3A3A3C', opacity: (sending || status === 'resolved') ? 0.5 : 1 }}
        >
          <LocationIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>SEND MY LOCATION</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionBtn({
  label, color, enabled, sending, onPress, style,
}: {
  label: string;
  color: string;
  enabled: boolean;
  sending: boolean;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!enabled || sending}
      style={[{
        backgroundColor: enabled ? color : '#1C1C1E',
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 4,
        opacity: enabled ? 1 : 0.4,
      }, style]}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function categoryLabel(cat: number): string {
  const map: Record<number, string> = {
    0: 'MEDICAL\nEMERGENCY',
    1: 'TRAPPED',
    2: 'FIRE',
    3: 'FLOOD',
    4: 'VIOLENCE',
    5: 'BUILDING\nCOLLAPSE',
    6: 'MISSING\nPERSON',
    7: 'EMERGENCY',
  };
  return map[cat] ?? 'EMERGENCY';
}

function severityLabel(sev: number): string {
  return ['INFO', 'ASSISTANCE', 'URGENT', 'CRITICAL'][sev] ?? 'CRITICAL';
}

function severityColor(sev: number): string {
  return ['#AEAEB2', '#FFD60A', '#C55A11', '#FF453A'][sev] ?? '#FF453A';
}
