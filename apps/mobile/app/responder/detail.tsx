/**
 * RESPONDER INCIDENT DETAIL — Replica of Reference Screen 7
 * PNG ref: screen 7 (Responder Incident)
 * Route: ResponderIncident
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

  const ArrowLeftIcon = icons.arrowLeft;

  const transition = async (next: Exclude<Status, 'pending'>, msg: string) => {
    try {
      await mobileController.responderTransition(next);
      setStatus(next);
      Alert.alert('Status saved', `${msg}. The packet was saved locally and is eligible for relay.`);
    } catch (reason) {
      Alert.alert('Status not saved', reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Top Header bar */}
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)', position: 'relative' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 16, padding: 4 }}>
          <ArrowLeftIcon size={20} color="#00F2FE" />
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
          Incident Detail
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        
        {/* Incident Info Card (Matching reference design) */}
        <View
          style={{
            backgroundColor: '#0D1424',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(255, 0, 85, 0.35)',
            padding: 16,
            marginBottom: 20,
          }}
        >
          {/* Header Row: Flame Icon + Title + High Badge + Subtitle */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 0, 85, 0.2)', borderWidth: 1, borderColor: '#FF0055', justifyContent: 'center', alignItems: 'center' }}>
                <icons.flame size={22} color="#FF0055" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900' }}>
                  {incident ? categoryLabel(incident.category) : 'Building Fire'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                  ID: {incident?.id ?? 'SOS-7C91'}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ backgroundColor: 'rgba(255, 0, 85, 0.15)', borderWidth: 1, borderColor: '#FF0055', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ color: '#FF0055', fontSize: 11, fontWeight: '800' }}>High</Text>
              </View>
              <Text style={{ color: '#64748B', fontSize: 11, marginTop: 6 }}>2 min ago</Text>
            </View>
          </View>

          {/* Info Rows matching reference exact layout */}
          <View style={{ gap: 10, paddingTop: 4 }}>
            
            {/* People Involved */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>People Involved</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>{incident?.peopleTotal ?? 12}</Text>
            </View>

            {/* Injured */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Injured</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>{incident?.injured ?? 3}</Text>
            </View>

            {/* Last Known Location */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Last Known Location</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>0.8 km NE</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: -4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>Lat 19.2187, Lon 72.9781</Text>
            </View>

            {/* Notes */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Notes</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '600', maxWidth: '65%', textAlign: 'right' }}>
                Building fire spread to 2nd floor.
              </Text>
            </View>

            {/* Status */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Status</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>Assigned to Unit-7</Text>
            </View>

          </View>
        </View>

        {/* Section Title */}
        <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginBottom: 12 }}>
          Your Actions
        </Text>

        {/* Button Stack (Matching reference PNG style 7) */}
        <View style={{ gap: 10 }}>
          
          {/* Accept / Decline Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Accept Button (Solid Green) */}
            <TouchableOpacity
              onPress={() => void transition('accepted', 'Assignment accepted')}
              disabled={status !== 'pending'}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#16A34A',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                opacity: status === 'pending' || status === 'accepted' ? 1 : 0.5,
              }}
            >
              <icons.check size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Accept</Text>
            </TouchableOpacity>

            {/* Decline Button (Solid Crimson Red) */}
            <TouchableOpacity
              onPress={() => void transition('declined', 'Assignment declined')}
              disabled={status !== 'pending'}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#DC2626',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                opacity: status === 'pending' || status === 'declined' ? 1 : 0.5,
              }}
            >
              <icons.close size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Decline</Text>
            </TouchableOpacity>
          </View>

          {/* Mark En Route (Outlined Teal/Blue) */}
          <TouchableOpacity
            onPress={() => void transition('en-route', 'Marked en route')}
            disabled={status !== 'accepted' && status !== 'en-route'}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              borderWidth: 1.5,
              borderColor: '#0284C7',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: status === 'accepted' || status === 'en-route' ? 1 : 0.5,
            }}
          >
            <icons.navigation size={14} color="#38BDF8" />
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Mark En Route</Text>
          </TouchableOpacity>

          {/* Arrived at Scene (Outlined Gold/Amber) */}
          <TouchableOpacity
            onPress={() => void transition('arrived', 'Marked arrived')}
            disabled={status !== 'en-route' && status !== 'arrived'}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(217, 119, 6, 0.15)',
              borderWidth: 1.5,
              borderColor: '#D97706',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: status === 'en-route' || status === 'arrived' ? 1 : 0.5,
            }}
          >
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Arrived at Scene</Text>
          </TouchableOpacity>

          {/* Resolve Incident (Outlined Green) */}
          <TouchableOpacity
            onPress={() => void transition('resolved', 'Incident resolved')}
            disabled={status !== 'arrived' && status !== 'resolved'}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(13, 148, 136, 0.15)',
              borderWidth: 1.5,
              borderColor: '#0D9488',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: status === 'arrived' || status === 'resolved' ? 1 : 0.5,
            }}
          >
            <Text style={{ color: '#2DD4BF', fontSize: 14, fontWeight: '800' }}>Resolve Incident</Text>
          </TouchableOpacity>

          {/* Send My Location (Outlined Purple/Magenta) */}
          <TouchableOpacity
            onPress={() => void transition('en-route', 'En-route location update saved')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(147, 51, 234, 0.15)',
              borderWidth: 1.5,
              borderColor: '#9333EA',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              marginTop: 4,
            }}
          >
            <icons.relay size={18} color="#C084FC" />
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Send My Location</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function categoryLabel(value: number) {
  return ['Medical Emergency', 'Trapped', 'Building Fire', 'Flooding', 'Violence', 'Building collapse', 'Missing person', 'Other Emergency'][value] ?? 'Emergency';
}
