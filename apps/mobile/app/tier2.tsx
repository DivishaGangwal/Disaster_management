/**
 * TIER 2 LISTENING (Radio Broadcast Receiver)
 * PNG ref: screen (14)
 * Route: Tier2Listen
 *
 * Per newmd:
 * - Explicit start/stop controls for the permissioned, time-bounded listener
 * - History of all messages received from gg waves
 * - Active campaign ID and version when detected
 * - Frames: detected / valid / corrupt / duplicate / missing
 * - Packets recovered vs expected manifest
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { mobileController } from '@/src/services/mobile-controller';

export default function Tier2ListenScreen() {
  const router = useRouter();
  const { diagnosticEvents, tier2Listening, tier2Metrics, runtimeError } = useAppStore();
  const [busy, setBusy] = useState(false);
  const tier2Events = diagnosticEvents.filter((event) => event.category === 'tier2' || event.transport === 'tier2-mic' || event.transport === 'tier2-direct');
  const ArrowLeftIcon = icons.arrowLeft;

  useEffect(() => () => { if (useAppStore.getState().tier2Listening) void mobileController.stopWavePxListening(); }, []);

  const start = async () => {
    setBusy(true);
    try { await mobileController.startWavePxListening(); }
    catch (reason) { useAppStore.getState().setRuntimeError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true);
    try { await mobileController.stopWavePxListening(); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={20} color="#a1d494" />
        </TouchableOpacity>
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>Listening Mode</Text>
        <Text style={{ color: '#AEAEB2', fontSize: 22 }}>⚙</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Large radio icon */}
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 2,
            borderColor: '#2D5A27',
            backgroundColor: '#1C1C1E',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#a1d494', fontSize: 48 }}>((•))</Text>
          </View>
          <Text style={{ color: '#a1d494', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginTop: 16 }}>
            {tier2Listening ? 'LISTENING FOR WAVEPX FRAMES' : 'TIER 2 LISTENER INACTIVE'}
          </Text>
          <Text style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 28 }}>
            WavePX receives an authority audio program, validates its disaster packets, and applies accepted map updates through the same path as Bluetooth.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tier2Listening ? 'Stop WavePX listening' : 'Start WavePX listening'}
            disabled={busy}
            onPress={() => void (tier2Listening ? stop() : start())}
            style={{ minHeight: 48, minWidth: 210, justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingHorizontal: 22, backgroundColor: tier2Listening ? '#3A3A3C' : '#2D5A27', opacity: busy ? 0.6 : 1 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{busy ? 'PLEASE WAIT' : tier2Listening ? 'STOP LISTENING' : 'START LISTENING'}</Text>
          </TouchableOpacity>
          {runtimeError && <Text accessibilityRole="alert" style={{ color: '#FF6961', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>{runtimeError}</Text>}
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>WAVEPX SESSION</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 12 }}>
            {[
              ['Detected', tier2Metrics?.framesDetected ?? 0],
              ['Valid', tier2Metrics?.framesValid ?? 0],
              ['Corrupt', tier2Metrics?.framesCorrupt ?? 0],
              ['Duplicate', tier2Metrics?.framesDuplicate ?? 0],
              ['Packets', tier2Metrics?.packetsRecovered ?? 0],
              ['Missing', tier2Metrics?.missingPacketIds.length ?? 0],
            ].map(([label, value]) => <View key={String(label)} style={{ width: '33.333%', paddingVertical: 8 }}><Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{value}</Text><Text style={{ color: '#AEAEB2', fontSize: 11 }}>{label}</Text></View>)}
            {(tier2Metrics?.campaignId || tier2Metrics?.campaignHandle !== undefined) && <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 10, marginTop: 4 }}><Text style={{ color: '#a1d494', fontSize: 12, fontWeight: '700' }}>CAMPAIGN {tier2Metrics.campaignId ?? `HANDLE ${tier2Metrics.campaignHandle}`} · VERSION {tier2Metrics.campaignVersion ?? '—'}</Text></View>}
          </View>
        </View>

        {/* Received signals */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>RECEIVED SIGNALS</Text>
          <View style={{ height: 2, backgroundColor: '#2D5A27', marginBottom: 16 }} />

          {tier2Events.map((event) => (
            <View
              key={`${event.atMs}-${event.packetId ?? event.name}`}
              style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 8 }}
            >
              <View style={{ width: 4, backgroundColor: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#2D5A27' }} />
              <View style={{ flex: 1, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{event.name}</Text>
                  <Text style={{ color: '#AEAEB2', fontSize: 13 }}>{new Date(event.atMs).toLocaleTimeString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#a1d494', marginRight: 8 }} />
                  <Text style={{ color: event.severity === 'warn' || event.severity === 'error' ? '#FF453A' : '#a1d494', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{(event.result ?? event.reason ?? event.severity).toUpperCase()}</Text>
                </View>
              </View>
            </View>
          ))}
          {tier2Events.length === 0 && <Text style={{ color: '#AEAEB2', fontSize: 14 }}>No WavePX frame has been observed on this phone yet. Start listening, then play an approved program from the website on a nearby speaker.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
