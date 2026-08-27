/** Responder incident evidence and monotonic workflow controls. */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type ResponderWorkflowState as Status } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';
import { e7ToFloat } from '@dsm/codec';

export default function ResponderIncidentScreen() {
  const router = useRouter();
  const { runtimeIncidents, mapObjects, selectedIncidentId, responderWorkflow, setResponderWorkflowState, setNavigationDestinationObjectId } = useAppStore();
  const status: Status = selectedIncidentId ? responderWorkflow[selectedIncidentId] ?? 'pending' : 'pending';
  const incident = runtimeIncidents.find((item) => item.id === selectedIncidentId);
  const incidentMapObject = mapObjects.find((item) => item.objectId === selectedIncidentId);
  const [transitioning, setTransitioning] = useState(false);

  const ArrowLeftIcon = icons.arrowLeft;

  const transition = async (next: Exclude<Status, 'pending'>, msg: string) => {
    if (transitioning) return;
    setTransitioning(true);
    try {
      await mobileController.responderTransition(next);
      if (selectedIncidentId) setResponderWorkflowState(selectedIncidentId, next);
      if (next === 'accepted' && incidentMapObject?.latE7 !== undefined && incidentMapObject.lonE7 !== undefined) {
        setNavigationDestinationObjectId(incidentMapObject.objectId);
        router.replace('/(tabs)/map');
      } else {
        Alert.alert('Status saved', `${msg}. The packet was saved locally and is eligible for relay.`);
      }
    } catch (reason) {
      Alert.alert('Status not saved', reason instanceof Error ? reason.message : String(reason));
    } finally { setTransitioning(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Top Header bar */}
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)', position: 'relative' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ position: 'absolute', left: 16, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeftIcon size={20} color="#00F2FE" />
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
          Incident Detail
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        
        <View
          style={{
            backgroundColor: '#0D1424',
            borderWidth: 1,
            borderColor: 'rgba(255, 0, 85, 0.35)',
            borderRadius: 10,
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
                  {incident ? categoryLabel(incident.category) : 'No incident selected'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                  ID: {incident?.id ?? 'Unknown'}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ borderLeftWidth: 2, borderColor: '#FF0055', paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#FF0055', fontSize: 11, fontWeight: '800' }}>{incident ? `Severity ${incident.severity}` : 'Unknown'}</Text>
              </View>
              <Text style={{ color: '#64748B', fontSize: 11, marginTop: 6 }}>{incident ? ageLabel(incident.updatedAtS) : 'No timestamp'}</Text>
            </View>
          </View>

          {/* Info Rows matching reference exact layout */}
          <View style={{ gap: 10, paddingTop: 4 }}>
            
            {/* People Involved */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>People Involved</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>{incident?.peopleTotal ?? 'Unknown'}</Text>
            </View>

            {/* Injured */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Injured</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '900' }}>{incident?.injured ?? 'Unknown'}</Text>
            </View>

            {/* Last Known Location */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Last Known Location</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{incidentMapObject?.latE7 !== undefined && incidentMapObject.lonE7 !== undefined ? 'Packet coordinate available' : 'Not supplied'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: -4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>{coordinateLabel(incidentMapObject?.latE7, incidentMapObject?.lonE7)}</Text>
            </View>

            {/* Status */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Status</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{status}</Text>
            </View>

          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Navigate from my location to this incident using roads"
          onPress={() => {
            if (!incidentMapObject || incidentMapObject.latE7 === undefined || incidentMapObject.lonE7 === undefined) {
              Alert.alert('No coordinate available', 'This incident does not include a usable location.');
              return;
            }
            setNavigationDestinationObjectId(incidentMapObject.objectId);
            router.push('/(tabs)/map');
          }}
          style={{ minHeight: 50, marginBottom: 18, backgroundColor: '#00F2FE', borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          <icons.navigation size={17} color="#050811" />
          <Text style={{ color: '#050811', fontSize: 14, fontWeight: '900' }}>ROUTE TO THIS PERSON</Text>
        </TouchableOpacity>

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
              accessibilityRole="button"
              accessibilityLabel="Accept this incident assignment"
              accessibilityState={{ disabled: transitioning || status !== 'pending', busy: transitioning }}
              onPress={() => void transition('accepted', 'Assignment accepted')}
              disabled={transitioning || status !== 'pending'}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#16A34A',
                paddingVertical: 14,
                borderRadius: 5,
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
              accessibilityRole="button"
              accessibilityLabel="Decline this incident assignment"
              accessibilityState={{ disabled: transitioning || status !== 'pending', busy: transitioning }}
              onPress={() => void transition('declined', 'Assignment declined')}
              disabled={transitioning || status !== 'pending'}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#DC2626',
                paddingVertical: 14,
                borderRadius: 5,
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
            accessibilityRole="button"
            accessibilityLabel="Mark this incident en route"
            accessibilityState={{ disabled: status !== 'accepted' && status !== 'en-route' }}
            onPress={() => void transition('en-route', 'Marked en route')}
            disabled={transitioning || (status !== 'accepted' && status !== 'en-route')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              borderWidth: 1.5,
              borderColor: '#0284C7',
              paddingVertical: 14,
              borderRadius: 5,
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
            accessibilityRole="button"
            accessibilityLabel="Mark arrival at the incident"
            accessibilityState={{ disabled: status !== 'en-route' && status !== 'arrived' }}
            onPress={() => void transition('arrived', 'Marked arrived')}
            disabled={transitioning || (status !== 'en-route' && status !== 'arrived')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(217, 119, 6, 0.15)',
              borderWidth: 1.5,
              borderColor: '#D97706',
              paddingVertical: 14,
              borderRadius: 5,
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
            accessibilityRole="button"
            accessibilityLabel="Resolve this incident"
            accessibilityState={{ disabled: status !== 'arrived' && status !== 'resolved' }}
            onPress={() => void transition('resolved', 'Incident resolved')}
            disabled={transitioning || (status !== 'arrived' && status !== 'resolved')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(13, 148, 136, 0.15)',
              borderWidth: 1.5,
              borderColor: '#0D9488',
              paddingVertical: 14,
              borderRadius: 5,
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
            accessibilityRole="button"
            accessibilityLabel="Send my current responder location"
            accessibilityState={{ disabled: status !== 'accepted' && status !== 'en-route' }}
            onPress={() => void transition('en-route', 'En-route location update saved')}
            disabled={transitioning || (status !== 'accepted' && status !== 'en-route')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(147, 51, 234, 0.15)',
              borderWidth: 1.5,
              borderColor: '#9333EA',
              paddingVertical: 14,
              borderRadius: 5,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              marginTop: 4,
              opacity: status === 'accepted' || status === 'en-route' ? 1 : 0.5,
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

function ageLabel(asOfS: number) { const age = Math.max(0, Math.round(Date.now() / 1000) - asOfS); return age < 60 ? 'just now' : age < 3600 ? `${Math.floor(age / 60)}m ago` : age < 7 * 86_400 ? `${Math.floor(age / 3600)}h ago` : 'over 7d old'; }
function coordinateLabel(latE7?: number, lonE7?: number) { return latE7 === undefined || lonE7 === undefined ? 'No coordinate in the projected packet data' : `${e7ToFloat(latE7).toFixed(4)}, ${e7ToFloat(lonE7).toFixed(4)}`; }

function categoryLabel(value: number) {
  return ['Medical Emergency', 'Trapped', 'Building Fire', 'Flooding', 'Violence', 'Building collapse', 'Missing person', 'Other Emergency'][value] ?? 'Emergency';
}
