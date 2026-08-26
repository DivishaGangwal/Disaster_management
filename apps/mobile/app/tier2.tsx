/**
 * TIER-2 / WAVEPX — Replica of Reference Screen 10
 * PNG ref: screen 10 (Tier-2 / WavePX)
 * Route: Tier2
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckinStatus } from '@dsm/contracts';
import { icons } from '@/constants/icons';
import { useAppStore } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { diagnosticEvents, tier2Listening, tier2Metrics, runtimeError, receivedPackets, setFocusMapObjectId } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState(receivedPackets[0]?.packetId ?? '');
  const ArrowLeftIcon = icons.arrowLeft;
  const checkinCampaignId = receivedPackets.find((packet) => packet.typeName === 'CHECKIN_CAMPAIGN' && packet.campaignId)?.campaignId;
  const appliedMapChanges = receivedPackets.reduce((count, packet) => count + packet.impacts.filter((impact) => impact.applied).length, 0);

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

  const respondToCheckin = async (status: number, label: string) => {
    setBusy(true);
    try {
      if (!checkinCampaignId) throw new Error('No decoded check-in campaign is available to answer.');
      await mobileController.respondToCheckin(checkinCampaignId, status);
      Alert.alert('Status saved', `"${label}" was saved locally and queued for Tier 1 Bluetooth relay or a proven gateway.`);
    } catch (reason) {
      useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      <View style={{ minHeight: 64, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#142039' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeftIcon size={20} color="#00F2FE" />
        </TouchableOpacity>
        <View><Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>ACOUSTIC RECEIVE</Text><Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>WavePX / Tier-2</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 14 }}>
        
        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: tier2Listening ? '#00F2FE' : '#1B2944', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <icons.mic size={22} color={tier2Listening ? '#FF456F' : '#00F2FE'} />
            <Text style={{ color: '#00F2FE', fontSize: 16, fontWeight: '800' }}>
              {tier2Listening ? 'Listening' : 'Stopped'}
            </Text>
          </View>

          {/* Compact Pill Toggle Button */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tier2Listening ? 'Stop WavePX listening' : 'Start WavePX listening'}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={() => void toggleListening()}
            activeOpacity={0.8}
            style={{
              backgroundColor: tier2Listening ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 242, 254, 0.15)',
              borderWidth: 1,
              borderColor: tier2Listening ? '#FF0055' : '#00F2FE',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 5,
            }}
          >
            <Text style={{ color: tier2Listening ? '#FF0055' : '#00F2FE', fontSize: 13, fontWeight: '900' }}>
              {busy ? 'WAIT' : tier2Listening ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>

        {runtimeError && (
          <Text style={{ color: '#FF0055', fontSize: 12, paddingHorizontal: 4 }}>{runtimeError}</Text>
        )}

        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>Campaign</Text>
            <Text style={{ color: '#00F2FE', fontSize: 14, fontWeight: '900' }}>
              {tier2Metrics?.campaignId ?? 'None detected'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>
              {tier2Metrics?.campaignVersion === undefined ? 'No version' : `Version v${tier2Metrics.campaignVersion}`}
            </Text>
          </View>

          {/* 5 Telemetry Metrics */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1E293B' }}>
            <MetricBox label="Detected" value={tier2Metrics?.framesDetected ?? 0} color="#00E676" />
            <MetricBox label="Valid" value={tier2Metrics?.framesValid ?? 0} color="#EAB308" />
            <MetricBox label="Corrupt" value={tier2Metrics?.framesCorrupt ?? 0} color="#FF0055" />
            <MetricBox label="Duplicate" value={tier2Metrics?.framesDuplicate ?? 0} color="#EC4899" />
            <MetricBox label="Missing" value={tier2Metrics?.missingPacketIds.length ?? 0} color="#FDBA74" />
          </View>
        </View>

        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Decoded Messages</Text>
            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '800' }}>
              {receivedPackets.length} received
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {receivedPackets.length > 0 ? (
              receivedPackets.slice(0, 3).map((pkt) => (
                <View key={pkt.packetId} style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>
                    {new Date(pkt.receivedAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {pkt.message}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18 }}>No WavePX packets have been decoded on this device yet.</Text>
            )}
          </View>
        </View>

        <View style={{ minHeight: 58, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Map Changes from Packets</Text>
          <Text style={{ color: appliedMapChanges > 0 ? '#00E676' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>{appliedMapChanges} applied</Text>
        </View>

        {/* Missing Action Buttons Grid (Matching Reference Screen 10) */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {/* Row 1: I Am Safe & Need Assistance */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* I Am Safe (Green Button) */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Respond to the current check-in: I am safe"
              disabled={busy || !checkinCampaignId}
              onPress={() => void respondToCheckin(CheckinStatus.SAFE, 'I Am Safe')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(22, 163, 74, 0.25)',
                borderWidth: 1.5,
                borderColor: '#16A34A',
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 5,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: checkinCampaignId ? 1 : 0.45,
              }}
            >
              <Text style={{ color: '#4ADE80', fontSize: 15, fontWeight: '900' }}>I Am Safe</Text>
            </TouchableOpacity>

            {/* Need Assistance (Amber/Orange Button) */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Respond to the current check-in: Need assistance"
              disabled={busy || !checkinCampaignId}
              onPress={() => void respondToCheckin(CheckinStatus.NEED_ASSISTANCE, 'Need Assistance')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(180, 83, 9, 0.25)',
                borderWidth: 1.5,
                borderColor: '#B45309',
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 5,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: checkinCampaignId ? 1 : 0.45,
              }}
            >
              <Text style={{ color: '#FDBA74', fontSize: 15, fontWeight: '900' }}>Need Assistance</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Raw Payload & Evidence (12) */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Raw Payload */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Inspect the latest decoded raw payload"
              onPress={() => Alert.alert('Raw Payload', receivedPackets[0] ? JSON.stringify(receivedPackets[0].payload, null, 2) : 'No decoded packet is available.')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: '#1B2944',
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Raw Payload</Text>
            </TouchableOpacity>

            {/* Evidence (12) */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Inspect received packet evidence. ${receivedPackets.length} packets recorded`}
              onPress={() => Alert.alert(
                'Received packet ledger',
                receivedPackets.length === 0
                  ? 'No recovered WavePX packets are recorded in the app ledger.'
                  : receivedPackets.map((packet) => `${packet.packetId.slice(0, 12)} · ${packet.typeName} · ${packet.outcome}`).join('\n'),
              )}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: '#1B2944',
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>
                Evidence ({receivedPackets.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: '900', marginTop: 2 }}>{value}</Text>
    </View>
  );
}
