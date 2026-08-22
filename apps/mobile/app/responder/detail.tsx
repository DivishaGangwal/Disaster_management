/**
 * RESPONDER INCIDENT DETAIL
 * PNG ref: screen (10)
 * Route: ResponderIncident
 *
 * Per newmd:
 * 1. Accept → buildResponderState(RESPONDER_ACCEPTED) → engine.createLocal()
 * 2. Decline → buildResponderState(RESPONDER_DECLINED) → engine.createLocal()
 * 3. Mark En Route → buildResponderState(RESPONDER_EN_ROUTE) → engine.createLocal()
 * 4. Mark Arrived → buildResponderState(RESPONDER_ARRIVED) → engine.createLocal()
 * 5. Resolve → buildResponderState(RESPONDER_RESOLVED) → engine.createLocal()
 * 6. Send My Location → buildResponderState(...) with geo → engine.createLocal()
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

type Status = 'pending' | 'accepted' | 'declined' | 'en-route' | 'arrived' | 'resolved';

export default function ResponderIncidentScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pending');
  const { runtimeIncidents, selectedIncidentId } = useAppStore();
  const incident = runtimeIncidents.find((item) => item.id === selectedIncidentId);

  const LocationIcon = icons.location;

  const transition = async (next: Exclude<Status, 'pending'>, msg: string) => {
    try {
      await mobileController.responderTransition(next);
      setStatus(next);
      Alert.alert('Status saved', `${msg}. The packet was saved locally and is eligible for relay.`);
    } catch (reason) { Alert.alert('Status not saved', reason instanceof Error ? reason.message : String(reason)); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <Text style={{ color: '#AEAEB2', fontSize: 22 }}>≡</Text>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>GUARDIAN</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <View style={{ width: 4, height: 8, backgroundColor: '#a1d494' }} />
          <View style={{ width: 4, height: 14, backgroundColor: '#a1d494' }} />
          <View style={{ width: 4, height: 20, backgroundColor: '#a1d494' }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Incident card with red left bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 24 }}>
          <View style={{ width: 4, backgroundColor: '#FF453A' }} />
          <View style={{ flex: 1, padding: 20 }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>TYPE</Text>
              <View style={{ backgroundColor: '#FF453A', paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>CRITICAL</Text>
              </View>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 16 }}>{incident ? `${categoryLabel(incident.category).toUpperCase()}\nEMERGENCY` : 'NO INCIDENT SELECTED'}</Text>

            {/* Stats blocks */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#2C2C2E', padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>PEOPLE</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{incident?.peopleTotal ?? '—'}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#2C2C2E', padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>INJURED</Text>
                <Text style={{ color: '#FF453A', fontSize: 28, fontWeight: '700' }}>{incident?.injured ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action buttons — exact order from newmd */}
        {/* 1. Accept */}
        <TouchableOpacity
          onPress={() => void transition('accepted', 'Assignment accepted')}
          disabled={status !== 'pending'}
          style={{ backgroundColor: status === 'pending' ? '#2D5A27' : '#1C1C1E', paddingVertical: 18, alignItems: 'center', marginBottom: 4, opacity: status === 'pending' ? 1 : 0.4 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>ACCEPT</Text>
        </TouchableOpacity>

        {/* 2. Decline */}
        <TouchableOpacity
          onPress={() => void transition('declined', 'Assignment declined')}
          disabled={status !== 'pending'}
          style={{ backgroundColor: status === 'pending' ? '#93000a' : '#1C1C1E', paddingVertical: 18, alignItems: 'center', marginBottom: 4, opacity: status === 'pending' ? 1 : 0.4 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>DECLINE</Text>
        </TouchableOpacity>

        {/* 3. Mark En Route */}
        <TouchableOpacity
          onPress={() => void transition('en-route', 'Marked en route')}
          disabled={status !== 'accepted'}
          style={{ backgroundColor: status === 'accepted' ? '#1E3A5F' : '#1C1C1E', paddingVertical: 18, alignItems: 'center', marginBottom: 4, opacity: status === 'accepted' ? 1 : 0.4 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>MARK EN ROUTE</Text>
        </TouchableOpacity>

        {/* 4. Mark Arrived */}
        <TouchableOpacity
          onPress={() => void transition('arrived', 'Marked arrived')}
          disabled={status !== 'en-route'}
          style={{ backgroundColor: status === 'en-route' ? '#1E3A5F' : '#1C1C1E', paddingVertical: 18, alignItems: 'center', marginBottom: 4, opacity: status === 'en-route' ? 1 : 0.4 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>MARK ARRIVED</Text>
        </TouchableOpacity>

        {/* 5. Resolve */}
        <TouchableOpacity
          onPress={() => void transition('resolved', 'Incident resolved')}
          disabled={status !== 'arrived'}
          style={{ backgroundColor: status === 'arrived' ? '#2C2C2E' : '#1C1C1E', paddingVertical: 18, alignItems: 'center', marginBottom: 24, opacity: status === 'arrived' ? 1 : 0.4 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>RESOLVE</Text>
        </TouchableOpacity>

        {/* 6. Send My Location */}
        <TouchableOpacity
          onPress={() => void transition('en-route', 'En-route location update saved')}
          style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderColor: '#3A3A3C' }}
        >
          <LocationIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>SEND MY LOCATION</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function categoryLabel(value: number) {
  return ['Medical', 'Trapped', 'Fire', 'Flood', 'Violence', 'Building collapse', 'Missing person', 'Other'][value] ?? 'Other';
}
