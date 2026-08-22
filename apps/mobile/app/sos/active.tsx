/**
 * ACTIVE SOS & DELIVERY TIMELINE
 * PNG ref: screen (2)
 * Route: ActiveSos
 *
 * Per newmd:
 * - Update SOS → buildSosUpdate() → engine.createLocal()
 * - Cancel SOS → buildSosCancel() → engine.createLocal()
 * - Update Location → OS Location API → buildSosUpdate()
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

export default function ActiveSosScreen() {
  const router = useRouter();
  const { setHasActiveSos, activeIncidentId, distinctPeerReceipts } = useAppStore();

  const ShieldIcon = icons.shield;
  const AlertIcon = icons.alert;
  const LocationIcon = icons.location;
  const CheckIcon = icons.check;

  const handleCancel = () => {
    Alert.alert('Cancel SOS', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => { void mobileController.cancelSos().then(() => { setHasActiveSos(false); router.back(); }).catch((reason: unknown) => Alert.alert('Cancel failed', reason instanceof Error ? reason.message : String(reason))); } },
    ]);
  };

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
          <Text style={{ color: '#AEAEB2', fontSize: 14 }}>Stored locally · relay is opportunistic</Text>
        </View>

        {/* Timeline */}
        <View style={{ paddingLeft: 8 }}>
          {/* Step 1 — Saved locally ✓ */}
          <TimelineStep
            completed
            label="Saved locally"
            detail={activeIncidentId ?? 'Local incident ID unavailable'}
            isFirst
          />

          {/* Step 2 — Received by nearby devices ✓ */}
          <TimelineStep
            completed={distinctPeerReceipts > 0}
            label={distinctPeerReceipts > 0 ? `Validated by ${distinctPeerReceipts} nearby phone${distinctPeerReceipts === 1 ? '' : 's'}` : 'No direct peer receipt observed yet'}
            detail={distinctPeerReceipts > 0 ? 'This proves a nearby phone stored a copy, not that help is coming.' : 'The app cannot monitor copies after they leave this phone.'}
          />

          {/* Step 3 — Responder acknowledged — WAITING */}
          <TimelineStep
            label="No responder acknowledgement observed"
            chipLabel="UNKNOWN"
            chipColor="#3A3A3C"
            isLast
          />
        </View>

        {/* Location age */}
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <LocationIcon size={16} color="#AEAEB2" style={{ marginRight: 6 }} />
            <Text style={{ color: '#AEAEB2', fontSize: 14 }}>Location age is carried in each SOS packet when a fix is available.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/sos/composer')}>
            <Text style={{ color: '#a1d494', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>Create an SOS update</Text>
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
          style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#FF3B30', paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>CANCEL SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
      {/* Dot + line */}
      <View style={{ alignItems: 'center', width: dotSize, marginRight: 16 }}>
        {!isFirst && <View style={{ width: 2, height: 20, backgroundColor: lineColor }} />}
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: completed ? '#2D5A27' : '#3A3A3C',
            borderWidth: 2,
            borderColor: completed ? '#a1d494' : '#3A3A3C',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {completed && <Text style={{ color: '#a1d494', fontSize: 16 }}>✓</Text>}
        </View>
        {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: lineColor, minHeight: 20 }} />}
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: 16, justifyContent: 'center' }}>
        <Text style={{ color: completed ? '#FFFFFF' : '#AEAEB2', fontSize: 18, fontWeight: '600' }}>
          {label}
        </Text>
        {detail && (
          <Text style={{ color: '#AEAEB2', fontSize: 13, marginTop: 4 }}>{detail}</Text>
        )}
        {chipLabel && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: chipColor, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{chipLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
