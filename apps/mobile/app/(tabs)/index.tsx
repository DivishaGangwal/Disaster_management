/**
 * PROFILE — Tab Screen
 * PNG ref: screen (16)
 * Route: Profile (tab)
 *
 * Per newmd:
 * - Select District/Region → local state
 * - Update Offline Map → gateway HTTP (when internet exists)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const regions = [
  'NORTH DISTRICT',
  'SOUTH DISTRICT',
  'EAST DISTRICT',
  'WEST DISTRICT',
  'CENTRAL DISTRICT',
];

export default function ProfileScreen() {
  const router = useRouter();
  const {
    role,
    setRole,
    selectedRegion,
    setSelectedRegion,
    offlinePackVersion,
    offlinePackStatus,
    setOfflinePackStatus,
    backendUrl,
    setBackendUrl,
  } = useAppStore();

  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(backendUrl);

  const ShieldIcon = icons.shield;
  const CheckIcon = icons.check;
  const DownloadIcon = icons.download;
  const ChevronIcon = icons.chevronDown;

  const handleUpdateMap = () => {
    if (offlinePackStatus === 'downloading') return;
    setOfflinePackStatus('downloading');
    setTimeout(() => {
      setOfflinePackStatus('downloaded');
      Alert.alert('Map Updated', `Offline map for ${selectedRegion} downloaded.`);
    }, 3000);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2D5A27' }}>
        <ShieldIcon size={20} color="#a1d494" />
        <Text style={{ color: '#a1d494', fontSize: 20, fontWeight: '800', letterSpacing: 2, marginLeft: 8 }}>GUARDIAN</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginBottom: 24 }}>PROFILE</Text>

        {/* Role Selector */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>IDENTITY / ROLE</Text>
        <View style={{ flexDirection: 'row', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', borderRadius: 8, marginBottom: 24, padding: 4 }}>
          <TouchableOpacity
            onPress={() => setRole('general-public')}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: role === 'general-public' ? '#2D5A27' : 'transparent', borderRadius: 6 }}
          >
            <Text style={{ color: role === 'general-public' ? '#FFFFFF' : '#AEAEB2', fontSize: 14, fontWeight: '700' }}>PUBLIC</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole('responder')}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: role === 'responder' ? '#2D5A27' : 'transparent', borderRadius: 6 }}
          >
            <Text style={{ color: role === 'responder' ? '#FFFFFF' : '#AEAEB2', fontSize: 14, fontWeight: '700' }}>RESPONDER</Text>
          </TouchableOpacity>
        </View>

        {/* District / Region */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DISTRICT / REGION</Text>
        <TouchableOpacity
          onPress={() => setShowRegionPicker(!showRegionPicker)}
          style={{ backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{selectedRegion.toUpperCase()}</Text>
          <ChevronIcon size={18} color="#AEAEB2" />
        </TouchableOpacity>

        {showRegionPicker && (
          <View style={{ marginBottom: 16 }}>
            {regions.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => { setSelectedRegion(r); setShowRegionPicker(false); setOfflinePackStatus('not-downloaded'); }}
                style={{ backgroundColor: selectedRegion === r ? '#1C1C1E' : '#000000', borderWidth: 1, borderColor: selectedRegion === r ? '#2D5A27' : '#3A3A3C', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 }}
              >
                <Text style={{ color: selectedRegion === r ? '#a1d494' : '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Offline map version */}
        <View style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#2D5A27', backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 }}>
          <CheckIcon size={18} color="#a1d494" style={{ marginRight: 12 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 }}>
            OFFLINE MAP: {selectedRegion} V{offlinePackVersion.replace(/\./g, '.')} ({offlinePackStatus === 'downloaded' ? '✓' : '...'})
          </Text>
        </View>

        {/* Update button */}
        <TouchableOpacity
          onPress={handleUpdateMap}
          disabled={offlinePackStatus === 'downloading'}
          style={{
            backgroundColor: offlinePackStatus === 'downloading' ? '#3A3A3C' : '#2D5A27',
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: offlinePackStatus === 'downloading' ? '#3A3A3C' : '#2D5A27',
            marginBottom: 32,
          }}
        >
          <DownloadIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>
            {offlinePackStatus === 'downloading' ? 'DOWNLOADING...' : 'UPDATE OFFLINE MAP'}
          </Text>
        </TouchableOpacity>

        {/* Operative Data */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>OPERATIVE DATA</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: '#3A3A3C' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>CALLSIGN</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>ECHO-ACTUAL</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' }}>
            <Text style={{ color: '#AEAEB2', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>SYS. STATUS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, backgroundColor: '#a1d494', marginRight: 8 }} />
              <Text style={{ color: '#a1d494', fontSize: 13, fontWeight: '600' }}>SECURE</Text>
            </View>
          </View>
        </View>

        {/* Command Centre URL — connects phone to laptop backend */}
        <Text style={{ color: '#AEAEB2', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 32, marginBottom: 8 }}>COMMAND CENTRE</Text>
        <View style={{ backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#3A3A3C', padding: 16, marginBottom: 8 }}>
          <Text style={{ color: '#AEAEB2', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>BACKEND SERVER URL</Text>
          {editingUrl ? (
            <TextInput
              value={urlDraft}
              onChangeText={setUrlDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#2D5A27', padding: 10, backgroundColor: '#000000', marginBottom: 8 }}
              placeholder="http://192.168.x.x:8787"
              placeholderTextColor="#555"
            />
          ) : (
            <Text style={{ color: '#a1d494', fontSize: 14, fontFamily: 'monospace', marginBottom: 8 }}>{backendUrl}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              if (editingUrl) {
                setBackendUrl(urlDraft.trim());
                setEditingUrl(false);
                Alert.alert('Saved', 'Restart the app to apply the new server URL.');
              } else {
                setUrlDraft(backendUrl);
                setEditingUrl(true);
              }
            }}
            style={{ backgroundColor: editingUrl ? '#2D5A27' : '#2C2C2E', paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: editingUrl ? '#2D5A27' : '#3A3A3C' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
              {editingUrl ? 'SAVE URL' : 'CHANGE SERVER'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#555', fontSize: 11, marginBottom: 32, paddingHorizontal: 4 }}>
          Open http://&lt;server-ip&gt;:8787/dashboard in your browser for the operations dashboard.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
