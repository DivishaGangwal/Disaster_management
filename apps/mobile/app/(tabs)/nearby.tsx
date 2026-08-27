/**
 * NEARBY INCIDENTS — Tab Screen
 * PNG ref: screen 6 (Nearby Incidents)
 * Route: Nearby (tab)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore, type RuntimeIncident } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Users } from 'lucide-react-native';

const categoryInfo = [
  { label: 'Medical Emergency', iconKey: 'catMedical' as const },
  { label: 'Trapped', iconKey: 'catOther' as const },
  { label: 'Building Fire', iconKey: 'catFire' as const },
  { label: 'Flooding', iconKey: 'catFlood' as const },
  { label: 'Violence', iconKey: 'catViolence' as const },
  { label: 'Structural Collapse', iconKey: 'catBuildingCollapse' as const },
  { label: 'Missing Person', iconKey: 'catOther' as const },
  { label: 'Other Emergency', iconKey: 'catOther' as const },
];

const sevConfig: Record<number, { label: string; color: string; bg: string }> = {
  3: { label: 'HIGH', color: '#FF0055', bg: 'rgba(255, 0, 85, 0.15)' },
  2: { label: 'MODERATE', color: '#FFB300', bg: 'rgba(255, 179, 0, 0.15)' },
  1: { label: 'MODERATE', color: '#00F2FE', bg: 'rgba(0, 242, 254, 0.15)' },
  0: { label: 'LOW', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
};

export default function NearbyScreen() {
  const router = useRouter();
  const { role, runtimeIncidents, runtimePeers, meshChatMessages, lastReadChatAtSByPeer, setSelectedIncidentId, setSelectedPeerToken } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'priority'>('all');
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');

  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;
  const FilterIcon = icons.filter;
  const LocationIcon = icons.location;

  const handleTapIncident = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    if (role === 'responder') {
      router.push('/responder/detail');
    }
  };

  const incidentsSource = runtimeIncidents;

  // Filter logic
  const priorityIncidents = incidentsSource.filter((inc) => inc.severity >= 2);

  const displayedList = (
    activeFilter === 'priority' ? priorityIncidents : incidentsSource
  ).slice().sort((a, b) => {
    if (sortOrder === 'high-to-low') {
      return b.severity - a.severity || b.updatedAtS - a.updatedAtS;
    } else {
      return a.severity - b.severity || a.updatedAtS - b.updatedAtS;
    }
  });

  const toggleSort = () => {
    setSortOrder(sortOrder === 'high-to-low' ? 'low-to-high' : 'high-to-low');
  };

  const openChat = (peerToken: string) => {
    setSelectedPeerToken(peerToken);
    router.push({ pathname: '/chat/[peerToken]', params: { peerToken } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#142039' }}>
        <ShieldIcon size={22} color="#9333EA" />
        <View style={{ marginLeft: 10, flex: 1 }}><Text style={{ color: '#A855F7', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>OFFLINE BLUETOOTH</Text><Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>People on the mesh</Text></View>
        <AlertIcon size={20} color="#FFB300" />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Users size={16} color="#00F2FE" />
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '900', marginLeft: 8 }}>Recently seen people</Text>
          </View>
          {runtimePeers.map((peer) => (
            (() => {
              const unread = meshChatMessages.filter((message) => !message.outgoing && message.senderNodeToken === peer.peerToken && message.createdAtS > (lastReadChatAtSByPeer[peer.peerToken] ?? 0)).length;
              const knownName = [...meshChatMessages].reverse().find((message) => message.senderNodeToken === peer.peerToken && message.senderLabel)?.senderLabel;
              return (
            <TouchableOpacity
              key={peer.peerToken}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${knownName ?? `mesh peer ${shortToken(peer.peerToken)}`}${unread ? `, ${unread} unread message${unread === 1 ? '' : 's'}` : ''}`}
              accessibilityHint="Opens offline mesh chat"
              onPress={() => openChat(peer.peerToken)}
              style={{ minHeight: 64, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 9, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,242,254,.12)', alignItems: 'center', justifyContent: 'center' }}><Users size={18} color="#00F2FE" /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>{knownName ?? `Mesh peer ${shortToken(peer.peerToken)}`}</Text>
                <Text style={{ color: unread ? '#00F2FE' : '#64748B', fontSize: 11, marginTop: 3, fontWeight: unread ? '800' : '400' }}>{unread ? `${unread} new message${unread === 1 ? '' : 's'} · ` : ''}{peerAge(peer.lastSeenAtMs)} · {peer.sessionsCompleted} completed sessions</Text>
              </View>
              <View><MessageCircle size={21} color={unread ? '#00F2FE' : '#C084FC'} />{unread > 0 && <View style={{ position: 'absolute', right: -7, top: -7, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#FF0055', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text></View>}</View>
            </TouchableOpacity>
              );
            })()
          ))}
          {runtimePeers.length === 0 && (
            <View style={{ padding: 16, borderWidth: 1, borderColor: '#1E293B', borderRadius: 9, backgroundColor: '#0D1424' }}>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>No peers observed yet. Keep relay mode on; people appear after Bluetooth discovery.</Text>
            </View>
          )}
        </View>

        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '900', marginBottom: 12 }}>Nearby incidents</Text>
        
        {/* Interactive Filter chips bar (Purple Active Button Background) */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityLabel={`All incidents, ${incidentsSource.length}`}
            accessibilityState={{ selected: activeFilter === 'all' }}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
            style={{
              backgroundColor: activeFilter === 'all' ? '#9333EA' : '#0D1424',
              borderWidth: 1,
              borderColor: activeFilter === 'all' ? '#9333EA' : '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: activeFilter === 'all' ? '#FFFFFF' : '#94A3B8', fontSize: 12, fontWeight: '800' }}>
              All {incidentsSource.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityLabel={`Priority incidents, ${priorityIncidents.length}`}
            accessibilityState={{ selected: activeFilter === 'priority' }}
            onPress={() => setActiveFilter('priority')}
            activeOpacity={0.8}
            style={{
              backgroundColor: activeFilter === 'priority' ? '#9333EA' : 'transparent',
              borderWidth: 1,
              borderColor: activeFilter === 'priority' ? '#9333EA' : '#1E293B',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: activeFilter === 'priority' ? '#FFFFFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>
              Priority {priorityIncidents.length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title + Interactive Sort Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
            Sorted by Severity ({sortOrder === 'high-to-low' ? 'High → Low' : 'Low → High'})
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Change severity sort. Currently ${sortOrder === 'high-to-low' ? 'highest first' : 'lowest first'}`}
            onPress={toggleSort}
            activeOpacity={0.8}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}
          >
            <FilterIcon size={14} color="#9333EA" style={{ marginRight: 6 }} />
            <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '700' }}>Sort</Text>
          </TouchableOpacity>
        </View>

        {/* Compact incident cards: dense evidence, one clear severity accent. */}
        {displayedList.map((inc) => {
          const sev = sevConfig[inc.severity] ?? sevConfig[0];
          const category = categoryInfo[inc.category] ?? categoryInfo[7];
          const CategoryIcon = icons[category.iconKey];

          return (
            <TouchableOpacity
              accessibilityRole={role === 'responder' ? 'button' : 'text'}
              accessibilityLabel={`${category.label}, severity ${inc.severity}. ${inc.peopleTotal ?? 'unknown'} people, ${inc.injured ?? 'unknown'} injured`}
              accessibilityHint={role === 'responder' ? 'Opens responder incident actions' : 'Public incident details are intentionally limited'}
              disabled={role !== 'responder'}
              key={inc.id}
              onPress={() => handleTapIncident(inc.id)}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#0D1424',
                borderWidth: 1,
                borderColor: '#1B2944',
                borderRadius: 9,
                padding: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Category icon circle */}
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.color, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <CategoryIcon size={20} color={sev.color} />
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800' }}>{category.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <LocationIcon size={12} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                    {inc.peopleTotal === undefined ? 'People unknown' : `${inc.peopleTotal} ${inc.peopleTotal === 1 ? 'person' : 'people'}`} · {inc.injured === undefined ? 'injuries unknown' : `${inc.injured} injured`}
                  </Text>
                </View>
                <Text style={{ color: '#52617A', fontSize: 10, marginTop: 4 }}>{ageLabel(inc.updatedAtS)} · local packet</Text>
              </View>

              {/* Severity chip */}
              <View style={{ backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.color, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: sev.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{sev.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {displayedList.length === 0 && (
          <View style={{ padding: 24, backgroundColor: '#0D1424', borderRadius: 9, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>No incident packets match this filter.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ageLabel(updatedAtS: number) {
  const age = Math.max(0, Math.round(Date.now() / 1000) - updatedAtS);
  if (age < 60) return 'just now';
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  if (age >= 7 * 86_400) return 'over 7d old';
  return `${Math.floor(age / 3600)}h ago`;
}

function shortToken(token: string) { return token.length <= 8 ? token : `${token.slice(0, 4)}…${token.slice(-4)}`; }
function peerAge(lastSeenAtMs: number) {
  const seconds = Math.max(0, Math.round((Date.now() - lastSeenAtMs) / 1000));
  if (seconds < 60) return 'seen just now';
  if (seconds < 3600) return `seen ${Math.floor(seconds / 60)}m ago`;
  return `seen ${Math.floor(seconds / 3600)}h ago`;
}
