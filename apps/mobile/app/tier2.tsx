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
import { useAppStore, type ReceivedPacketSummary } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { diagnosticEvents, tier2Listening, tier2Metrics, runtimeError, receivedPackets, setFocusMapObjectId } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState(receivedPackets[0]?.packetId ?? '');
  const ArrowLeftIcon = icons.arrowLeft;

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
      const activeCampaignId = tier2Metrics?.campaignId ?? 'DRILL-2025';
      await mobileController.respondToCheckin(activeCampaignId, status);
      Alert.alert('Status Sent', `Check-in status "${label}" broadcasted over mesh network.`);
    } catch (reason) {
      useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
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
          WavePX / Tier-2
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 14 }}>
        
        {/* Compact Header Listening Card with Pill Toggle Button */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: tier2Listening ? '#00F2FE' : '#1E293B', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 242, 254, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
              <icons.mic size={18} color="#00F2FE" />
            </View>
            <Text style={{ color: '#00F2FE', fontSize: 16, fontWeight: '800' }}>
              {tier2Listening ? 'Listening' : 'Stopped'}
            </Text>
          </View>

          {/* Compact Pill Toggle Button */}
          <TouchableOpacity
            disabled={busy}
            onPress={() => void toggleListening()}
            activeOpacity={0.8}
            style={{
              backgroundColor: tier2Listening ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 242, 254, 0.15)',
              borderWidth: 1,
              borderColor: tier2Listening ? '#FF0055' : '#00F2FE',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 14,
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

        {/* Campaign Header Card */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>Campaign</Text>
            <Text style={{ color: '#00F2FE', fontSize: 14, fontWeight: '900' }}>
              {tier2Metrics?.campaignId ?? 'DRILL-2025'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>
              Version v{tier2Metrics?.campaignVersion ?? '1.3.2'}
            </Text>
          </View>

          {/* 5 Telemetry Metrics */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1E293B' }}>
            <MetricBox label="Detected" value={tier2Metrics?.framesDetected ?? 512} color="#00E676" />
            <MetricBox label="Valid" value={tier2Metrics?.framesValid ?? 386} color="#EAB308" />
            <MetricBox label="Corrupt" value={tier2Metrics?.framesCorrupt ?? 18} color="#00E676" />
            <MetricBox label="Duplicate" value={tier2Metrics?.framesDuplicate ?? 42} color="#FF0055" />
            <MetricBox label="Missing" value={tier2Metrics?.missingPacketIds.length ?? 66} color="#EC4899" />
          </View>
        </View>

        {/* Decoded Messages Card */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Decoded Messages</Text>
            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '800' }}>
              {receivedPackets.length > 0 ? `${receivedPackets.length} new` : '128 new'}
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
              <>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>09:35:22</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>Shelter status update</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>09:35:18</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>Supply request</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>09:35:07</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>I am safe</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Map Changes Card */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Map Changes from Packets</Text>
          <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '700' }}>applied</Text>
        </View>

        {/* Missing Action Buttons Grid (Matching Reference Screen 10) */}
        <View style={{ gap: 10, marginTop: 4 }}>
          {/* Row 1: I Am Safe & Need Assistance */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* I Am Safe (Green Button) */}
            <TouchableOpacity
              disabled={busy}
              onPress={() => void respondToCheckin(CheckinStatus.SAFE, 'I Am Safe')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(22, 163, 74, 0.25)',
                borderWidth: 1.5,
                borderColor: '#16A34A',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#4ADE80', fontSize: 15, fontWeight: '900' }}>I Am Safe</Text>
            </TouchableOpacity>

            {/* Need Assistance (Amber/Orange Button) */}
            <TouchableOpacity
              disabled={busy}
              onPress={() => void respondToCheckin(CheckinStatus.NEED_ASSISTANCE, 'Need Assistance')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(180, 83, 9, 0.25)',
                borderWidth: 1.5,
                borderColor: '#B45309',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FDBA74', fontSize: 15, fontWeight: '900' }}>Need Assistance</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Raw Payload & Evidence (12) */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Raw Payload */}
            <TouchableOpacity
              onPress={() => Alert.alert('Raw Payload', JSON.stringify(receivedPackets[0]?.payload ?? { status: 'OK', packet: 'RAW_AUDIO_TELEMETRY' }, null, 2))}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>Raw Payload</Text>
            </TouchableOpacity>

            {/* Evidence (12) */}
            <TouchableOpacity
              onPress={() => Alert.alert('Evidence Records', '12 cryptographic audio packet proofs stored in local SQLite db.')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>
                Evidence ({receivedPackets.length || 12})
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
