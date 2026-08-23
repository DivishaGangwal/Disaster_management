/**
 * SOS COMPOSER
 * PNG ref: screen (19)
 * Route: SosComposer
 *
 * Per newmd: All local state. Creates packet via buildSosCreate()/buildSosUpdate() → engine.createLocal()
 * Must work with NO location and NO internet.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { useRuntime } from '@/src/contexts/RuntimeContext';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildSosCreate,
  buildSosUpdate,
  newSourceId,
  toEpochS,
} from '@dsm/codec';
import {
  EmergencyCategory,
  Mobility,
  LocationSource,
  Severity,
  SourceClass,
  ReplyCapability,
} from '@dsm/contracts';

const categories = ['Medical Emergency', 'Fire', 'Flood', 'Earthquake', 'Landslide', 'Cyclone', 'Building Collapse', 'Chemical/Gas', 'Violence', 'Other'];
const mobilityOptions = ['Mobile (Can walk)', 'Limited mobility', 'Immobile', 'Trapped', 'Unknown'];
const languages = ['English', 'Hindi', 'Marathi', 'Assamese'];

const sevLevels = [
  { label: 'INFO', bg: '#3A3A3C', textColor: '#FFFFFF' },
  { label: 'MODERATE', bg: '#FFD60A', textColor: '#000000' },
  { label: 'URGENT', bg: '#C55A11', textColor: '#FFFFFF' },
  { label: 'CRITICAL', bg: '#8B2500', textColor: '#FFFFFF' },
];

export default function SosComposerScreen() {
  const router = useRouter();
  const { runtime } = useRuntime();
  const {
    role,
    setHasActiveSos,
    activeSosPacketId,
    setActiveSosPacketId,
    sosSequence,
    incrementSosSequence,
  } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [severity, setSeverity] = useState(0);
  const [peopleCount, setPeopleCount] = useState(2);
  const [injuredCount, setInjuredCount] = useState(1);
  const [mobilityIdx, setMobilityIdx] = useState(0);
  const [note, setNote] = useState('');
  const [langIdx, setLangIdx] = useState(0);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showMobilityPicker, setShowMobilityPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const [sending, setSending] = useState(false);

  const CloseIcon = icons.close;
  const BroadcastIcon = icons.relay;
  const ChevronIcon = icons.chevronDown;

  const categoryWireValues: Record<number, number> = {
    0: EmergencyCategory.MEDICAL,
    1: EmergencyCategory.FIRE,
    2: EmergencyCategory.FLOOD,
    3: EmergencyCategory.FLOOD,      // Earthquake → FLOOD fallback
    4: EmergencyCategory.FLOOD,      // Landslide
    5: EmergencyCategory.FLOOD,      // Cyclone
    6: EmergencyCategory.STRUCTURAL_COLLAPSE,
    7: EmergencyCategory.OTHER,      // Chemical
    8: EmergencyCategory.VIOLENCE,
    9: EmergencyCategory.OTHER,
  };

  const mobilityWireValues: Record<number, number> = {
    0: Mobility.MOBILE,
    1: Mobility.LIMITED,
    2: Mobility.IMMOBILE,
    3: Mobility.TRAPPED,
    4: Mobility.UNKNOWN,
  };

  const severityWireValues: Record<number, number> = {
    0: Severity.INFO,
    1: Severity.ASSISTANCE,
    2: Severity.URGENT,
    3: Severity.LIFE_CRITICAL,
  };

  const handleConfirm = async () => {
    if (sending) return;
    setSending(true);
    try {
      const nowS = toEpochS(Date.now());
      const buildCtx = {
        sourceId: runtime?.engine.localSourceId ?? 'offline-source',
        sourceClass:
          role === 'responder'
            ? SourceClass.RESPONDER_PROVISIONED
            : SourceClass.GENERAL_PUBLIC,
        nowS,
      };

      let encoded;
      if (activeSosPacketId) {
        // Update existing SOS.
        encoded = buildSosUpdate(
          buildCtx,
          activeSosPacketId,
          sosSequence + 1,
          (severityWireValues[severity] ?? Severity.URGENT) as import('@dsm/contracts').SeverityValue,
          {
            category: categoryWireValues[selectedCategory] ?? EmergencyCategory.OTHER,
            peopleTotal: peopleCount,
            injured: injuredCount,
            mobility: mobilityWireValues[mobilityIdx] ?? Mobility.UNKNOWN,
            shortNote: note.trim() || undefined,
          },
        );
        incrementSosSequence();
      } else {
        // First detailed SOS creation from the composer.
        const incidentId = newSourceId();
        encoded = buildSosCreate(buildCtx, {
          incidentId,
          category: categoryWireValues[selectedCategory] ?? EmergencyCategory.OTHER,
          severity: (severityWireValues[severity] ?? Severity.URGENT) as import('@dsm/contracts').SeverityValue,
          peopleTotal: peopleCount,
          injured: injuredCount,
          mobility: mobilityWireValues[mobilityIdx] ?? Mobility.UNKNOWN,
          location: { source: LocationSource.UNKNOWN },
          replyCapabilities: ReplyCapability.TIER1_BLE,
          shortNote: note.trim() || undefined,
        });
        setActiveSosPacketId(encoded.packetId);
      }

      if (runtime) {
        await runtime.engine.createLocal(encoded, activeSosPacketId ?? encoded.packetId);
      }
      setHasActiveSos(true);

      Alert.alert('SOS Packet Created', 'Saved locally and queued for relay.', [
        { text: 'VIEW TIMELINE', onPress: () => router.replace('/sos/active') },
      ]);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={24} color="#AEAEB2" />
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 2 }}>SOS COMPOSER</Text>
        <BroadcastIcon size={22} color="#AEAEB2" />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Category dropdown */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>CATEGORY</Text>
        <TouchableOpacity
          onPress={() => setShowCatPicker(!showCatPicker)}
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCatPicker ? 4 : 24 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{categories[selectedCategory]}</Text>
          <ChevronIcon size={18} color="#AEAEB2" />
        </TouchableOpacity>
        {showCatPicker && (
          <View style={{ marginBottom: 24 }}>
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                onPress={() => { setSelectedCategory(i); setShowCatPicker(false); }}
                style={{ backgroundColor: i === selectedCategory ? '#1C1C1E' : '#000000', borderWidth: 1, borderColor: i === selectedCategory ? '#2D5A27' : '#3A3A3C', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 2 }}
              >
                <Text style={{ color: i === selectedCategory ? '#a1d494' : '#FFFFFF', fontSize: 14 }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Severity — 4 colored blocks in a row */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>SEVERITY</Text>
        <View style={{ flexDirection: 'row', marginBottom: 24 }}>
          {sevLevels.map((sev, i) => (
            <TouchableOpacity
              key={sev.label}
              onPress={() => setSeverity(i)}
              style={{
                flex: 1,
                backgroundColor: sev.bg,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: severity === i ? 2 : 0,
                borderColor: '#FFFFFF',
              }}
            >
              <Text style={{ color: sev.textColor, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{sev.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* People Count — tactical stepper */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>PEOPLE COUNT</Text>
        <TacticalStepper value={peopleCount} onDecrement={() => setPeopleCount(Math.max(0, peopleCount - 1))} onIncrement={() => setPeopleCount(peopleCount + 1)} color="#FFFFFF" />

        {/* Injured Count — tactical stepper */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>INJURED COUNT</Text>
        <TacticalStepper value={injuredCount} onDecrement={() => setInjuredCount(Math.max(0, injuredCount - 1))} onIncrement={() => setInjuredCount(injuredCount + 1)} color="#FF453A" />

        {/* Mobility dropdown */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 24 }}>MOBILITY</Text>
        <TouchableOpacity
          onPress={() => setShowMobilityPicker(!showMobilityPicker)}
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showMobilityPicker ? 4 : 24 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{mobilityOptions[mobilityIdx]}</Text>
          <ChevronIcon size={18} color="#AEAEB2" />
        </TouchableOpacity>
        {showMobilityPicker && (
          <View style={{ marginBottom: 24 }}>
            {mobilityOptions.map((opt, i) => (
              <TouchableOpacity
                key={opt}
                onPress={() => { setMobilityIdx(i); setShowMobilityPicker(false); }}
                style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: i === mobilityIdx ? '#2D5A27' : '#3A3A3C', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 2 }}
              >
                <Text style={{ color: i === mobilityIdx ? '#a1d494' : '#FFFFFF', fontSize: 14 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Short Note */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>SHORT NOTE (OPTIONAL)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={64}
          placeholder="E.g., Need oxygen, access via north gate"
          placeholderTextColor="#6B7280"
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16, marginBottom: 24, borderRadius: 0 }}
        />

        {/* Language dropdown */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>PRIMARY LANGUAGE</Text>
        <TouchableOpacity
          onPress={() => setShowLangPicker(!showLangPicker)}
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showLangPicker ? 4 : 24 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{languages[langIdx]}</Text>
          <ChevronIcon size={18} color="#AEAEB2" />
        </TouchableOpacity>
        {showLangPicker && (
          <View style={{ marginBottom: 24 }}>
            {languages.map((lang, i) => (
              <TouchableOpacity
                key={lang}
                onPress={() => { setLangIdx(i); setShowLangPicker(false); }}
                style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: i === langIdx ? '#2D5A27' : '#3A3A3C', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 2 }}
              >
                <Text style={{ color: i === langIdx ? '#a1d494' : '#FFFFFF', fontSize: 14 }}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={{ padding: 20, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
        <TouchableOpacity
          onPress={handleConfirm}
          style={{ backgroundColor: '#2D5A27', paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>▷ CONFIRM & UPDATE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TacticalStepper({ value, onDecrement, onIncrement, color }: { value: number; onDecrement: () => void; onIncrement: () => void; color: string }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#3A3A3C' }}>
      <TouchableOpacity onPress={onDecrement} style={{ width: 56, height: 56, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#3A3A3C' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '300' }}>−</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
        <Text style={{ color, fontSize: 24, fontWeight: '700' }}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onIncrement} style={{ width: 56, height: 56, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#3A3A3C' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '300' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
