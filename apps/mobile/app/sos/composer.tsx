/**
 * SOS COMPOSER
 * PNG ref: screen 3 (Create SOS)
 * Route: SosComposer
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

const categories = ['Building Fire', 'Gas Leak', 'Road Accident', 'Medical Emergency', 'Flooding', 'Building Collapse', 'Chemical Leak', 'Violence', 'Other'];
const mobilityOptions = ['Mobile (Can walk)', 'Limited mobility', 'Immobile', 'Trapped', 'Unknown'];
const languages = ['English', 'Hindi', 'Marathi'];

const sevLevels = [
  { label: 'Low', num: '1', bg: 'rgba(100, 116, 139, 0.2)', color: '#64748B' },
  { label: 'Moderate', num: '2', bg: 'rgba(0, 242, 254, 0.2)', color: '#00F2FE' },
  { label: 'High', num: '3', bg: 'rgba(255, 179, 0, 0.2)', color: '#FFB300' },
  { label: 'Critical', num: '4', bg: 'rgba(255, 0, 85, 0.25)', color: '#FF0055' },
];

export default function SosComposerScreen() {
  const router = useRouter();
  const { setHasActiveSos } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [severity, setSeverity] = useState(2);
  const [peopleCount, setPeopleCount] = useState(2);
  const [injuredCount, setInjuredCount] = useState(1);
  const [mobilityIdx, setMobilityIdx] = useState(1);
  const [note, setNote] = useState('');
  const [langIdx, setLangIdx] = useState(0);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showMobilityPicker, setShowMobilityPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const CloseIcon = icons.close;
  const BroadcastIcon = icons.relay;
  const ChevronIcon = icons.chevronDown;

  const handleConfirm = async () => {
    const categoryWire = [2, 7, 7, 0, 3, 5, 7, 4, 7];
    const mobilityWire = [1, 2, 3, 4, 0];
    const languageTags = ['en', 'hi', 'mr', 'as'];
    try {
      await mobileController.saveSos({
        category: categoryWire[selectedCategory] ?? 7,
        severity,
        peopleTotal: peopleCount,
        injured: injuredCount,
        mobility: mobilityWire[mobilityIdx] ?? 0,
        shortNote: note.trim() || undefined,
        language: languageTags[langIdx] ?? 'en',
      });
      setHasActiveSos(true);
      Alert.alert('SOS Broadcasted', 'Saved on this phone and eligible for nearby relay.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (reason) {
      Alert.alert('SOS not saved', reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.15)' }}>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 2 }}>CREATE SOS</Text>
        <BroadcastIcon size={20} color="#FF0055" />
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Category dropdown */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>CATEGORY</Text>
        <TouchableOpacity
          onPress={() => setShowCatPicker(!showCatPicker)}
          style={{ backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCatPicker ? 4 : 20 }}
        >
          <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>{categories[selectedCategory]}</Text>
          <ChevronIcon size={18} color="#00F2FE" />
        </TouchableOpacity>
        {showCatPicker && (
          <View style={{ marginBottom: 20, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', padding: 6 }}>
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                onPress={() => { setSelectedCategory(i); setShowCatPicker(false); }}
                style={{ backgroundColor: i === selectedCategory ? 'rgba(0, 242, 254, 0.1)' : 'transparent', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 }}
              >
                <Text style={{ color: i === selectedCategory ? '#00F2FE' : '#F8FAFC', fontSize: 14 }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Severity — 4 colored blocks */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>SEVERITY</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {sevLevels.map((sev, i) => (
            <TouchableOpacity
              key={sev.label}
              onPress={() => setSeverity(i)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: severity === i ? sev.bg : '#0D1424',
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: severity === i ? sev.color : '#1E293B',
              }}
            >
              <Text style={{ color: severity === i ? sev.color : '#F8FAFC', fontSize: 16, fontWeight: '900' }}>{sev.num}</Text>
              <Text style={{ color: severity === i ? sev.color : '#64748B', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{sev.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* People Involved Stepper */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>PEOPLE INVOLVED</Text>
        <TacticalStepper value={peopleCount} onDecrement={() => setPeopleCount(Math.max(0, peopleCount - 1))} onIncrement={() => setPeopleCount(peopleCount + 1)} color="#F8FAFC" />

        {/* Injured Stepper */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 20 }}>INJURED</Text>
        <TacticalStepper value={injuredCount} onDecrement={() => setInjuredCount(Math.max(0, injuredCount - 1))} onIncrement={() => setInjuredCount(injuredCount + 1)} color="#FF0055" />

        {/* Mobility dropdown */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 20 }}>MOBILITY CONDITION</Text>
        <TouchableOpacity
          onPress={() => setShowMobilityPicker(!showMobilityPicker)}
          style={{ backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showMobilityPicker ? 4 : 20 }}
        >
          <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>{mobilityOptions[mobilityIdx]}</Text>
          <ChevronIcon size={18} color="#00F2FE" />
        </TouchableOpacity>
        {showMobilityPicker && (
          <View style={{ marginBottom: 20, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', padding: 6 }}>
            {mobilityOptions.map((opt, i) => (
              <TouchableOpacity
                key={opt}
                onPress={() => { setMobilityIdx(i); setShowMobilityPicker(false); }}
                style={{ backgroundColor: i === mobilityIdx ? 'rgba(0, 242, 254, 0.1)' : 'transparent', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 }}
              >
                <Text style={{ color: i === mobilityIdx ? '#00F2FE' : '#F8FAFC', fontSize: 14 }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Short Note */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>SHORT NOTE (OPTIONAL)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={64}
          placeholder="Building fire spread to 2nd floor."
          placeholderTextColor="#64748B"
          style={{ backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 14, color: '#F8FAFC', fontSize: 15, marginBottom: 20 }}
        />

        {/* Language dropdown */}
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>LANGUAGE</Text>
        <TouchableOpacity
          onPress={() => setShowLangPicker(!showLangPicker)}
          style={{ backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showLangPicker ? 4 : 20 }}
        >
          <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>{languages[langIdx]}</Text>
          <ChevronIcon size={18} color="#00F2FE" />
        </TouchableOpacity>
        {showLangPicker && (
          <View style={{ marginBottom: 20, backgroundColor: '#0D1424', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', padding: 6 }}>
            {languages.map((lang, i) => (
              <TouchableOpacity
                key={lang}
                onPress={() => { setLangIdx(i); setShowLangPicker(false); }}
                style={{ backgroundColor: i === langIdx ? 'rgba(0, 242, 254, 0.1)' : 'transparent', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 }}
              >
                <Text style={{ color: i === langIdx ? '#00F2FE' : '#F8FAFC', fontSize: 14 }}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={{ padding: 20, backgroundColor: '#050811', borderTopWidth: 1, borderTopColor: 'rgba(0, 242, 254, 0.15)' }}>
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.8}
          style={{ backgroundColor: '#FF0055', paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#FF0055', shadowOpacity: 0.4, shadowRadius: 10 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>CREATE SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TacticalStepper({ value, onDecrement, onIncrement, color }: { value: number; onDecrement: () => void; onIncrement: () => void; color: string }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', backgroundColor: '#0D1424', overflow: 'hidden' }}>
      <TouchableOpacity onPress={onDecrement} style={{ width: 56, height: 50, backgroundColor: '#141E33', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '400' }}>−</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color, fontSize: 20, fontWeight: '900' }}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onIncrement} style={{ width: 56, height: 50, backgroundColor: '#141E33', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '400' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
