/**
 * PROFILE & OFFLINE DATA — Exact Replica of Reference Screen 12
 * PNG ref: screen 12 (Profile & Offline Data)
 * Route: Profile (tab)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

const regions = [
  'South District',
  'Mumbai Operational Region',
  'Mumbai City',
  'Eastern Suburbs',
  'Western Suburbs',
  'Mumbai Coastal Sector',
];

export default function ProfileScreen() {
  const router = useRouter();
  const {
    role,
    userName,
    selectedRegion,
    setSelectedRegion,
    offlinePackVersion,
    offlinePackStatus,
    offlinePackProgress,
    offlinePackBytes,
    setIsLoggedIn,
    setHasCompletedReadiness,
  } = useAppStore();

  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const ShieldIcon = icons.shield;
  const DownloadIcon = icons.download;
  const ChevronIcon = icons.chevronDown;
  const UserIcon = icons.user;
  const RelayIcon = icons.relay;

  useEffect(() => { void mobileController.refreshOfflineMap(); }, []);

  const handleUpdateMap = async () => {
    try {
      await mobileController.downloadOfflineMap();
      Alert.alert('Offline map saved', 'The region basemap is now stored in persistent MapLibre offline storage.');
    } catch (reason) {
      Alert.alert('Map download failed', reason instanceof Error ? reason.message : String(reason));
    }
  };

  const displayName = userName || 'Operative User';

  const handleLogout = () => {
    setIsLoggedIn(false);
    setHasCompletedReadiness(false);
    router.replace('/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Top Header bar */}
      <View style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)' }}>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
          Profile & Offline Data
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 16 }}>
        
        {/* User Profile Card (Matching screen 12 profile.jpeg) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
          {/* Round Red Glowing Avatar */}
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: '#5B121A',
              borderWidth: 1.5,
              borderColor: '#991B1B',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#EF4444',
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <UserIcon size={30} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>
                {displayName}
              </Text>
              
              {/* Role Pill Badge */}
              <View
                style={{
                  backgroundColor: role === 'responder' ? 'rgba(225, 29, 72, 0.2)' : 'rgba(0, 242, 254, 0.15)',
                  borderWidth: 1,
                  borderColor: role === 'responder' ? '#E11D48' : '#00F2FE',
                  paddingHorizontal: 12,
                  paddingVertical: 3,
                  borderRadius: 14,
                }}
              >
                <Text style={{ color: role === 'responder' ? '#E11D48' : '#00F2FE', fontSize: 11, fontWeight: '800' }}>
                  {role === 'responder' ? 'Responder' : 'General Public'}
                </Text>
              </View>
            </View>

            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 3, fontWeight: '600' }}>
              Unit-7 · Operator ID: 7A9183
            </Text>
          </View>
        </View>

        {/* Offline Data Card (Matching screen 12) */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 18, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Offline Data
          </Text>

          {/* Region / District Picker Row */}
          <TouchableOpacity
            onPress={() => setShowRegionPicker(!showRegionPicker)}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Region / District</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{selectedRegion}</Text>
              <Text style={{ color: '#94A3B8', fontSize: 14 }}>›</Text>
            </View>
          </TouchableOpacity>

          {showRegionPicker && (
            <View style={{ marginVertical: 8, backgroundColor: '#141E33', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', padding: 6 }}>
              {regions.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => { setSelectedRegion(r); setShowRegionPicker(false); }}
                  style={{ backgroundColor: selectedRegion === r ? 'rgba(0, 242, 254, 0.1)' : 'transparent', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Text style={{ color: selectedRegion === r ? '#00F2FE' : '#F8FAFC', fontSize: 13, fontWeight: '600' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Offline Map Pack Progress */}
          <View style={{ paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View>
                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>Offline Map Pack</Text>
                <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '600', marginTop: 1 }}>South District Pack</Text>
              </View>
              
              <TouchableOpacity onPress={handleUpdateMap} style={{ padding: 4 }}>
                <DownloadIcon size={18} color="#38BDF8" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 }}>
              <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '800' }}>
                {offlinePackStatus === 'ready' ? '100%' : `${offlinePackProgress || 50}%`}
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                {offlinePackBytes ? formatBytes(offlinePackBytes) : '680 MB'} / 1.2 GB
              </Text>
            </View>

            {/* Green Progress Bar */}
            <View style={{ height: 4, backgroundColor: '#1E293B', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: `${offlinePackStatus === 'ready' ? 100 : (offlinePackProgress || 50)}%`, height: '100%', backgroundColor: '#00E676' }} />
            </View>
          </View>

          {/* Other Content Pack */}
          <View style={{ paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>Other Content Pack</Text>
              <Text style={{ color: '#00E676', fontSize: 12, fontWeight: '800' }}>100%</Text>
            </View>

            <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
              ZOS & Resources
            </Text>

            {/* 100% Green Progress Bar */}
            <View style={{ height: 4, backgroundColor: '#1E293B', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: '100%', height: '100%', backgroundColor: '#00E676' }} />
            </View>
          </View>
        </View>

        {/* Device & Operative Info Card */}
        <View style={{ backgroundColor: '#0D1424', borderRadius: 18, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Device & Operative Info
          </Text>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Device</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>Pixel 7 Pro</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>App Version</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>1.3.2 (1132)</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Role</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>
                {role === 'responder' ? 'Responder' : 'General Public'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Member Since</Text>
              <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>May 12, 2025</Text>
            </View>
          </View>
        </View>

        {/* Quick Links Section — EXACT REPLICA OF ATTACHED IMAGE (4 horizontal tall cards in 1 row) */}
        <View style={{ marginTop: 2 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Quick Links
          </Text>

          {/* 4 Cards Row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            
            {/* Card 1: Readiness */}
            <TouchableOpacity
              onPress={() => router.push('/readiness')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  borderWidth: 1,
                  borderColor: '#9333EA',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <ShieldIcon size={20} color="#C084FC" />
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                Readiness
              </Text>
            </TouchableOpacity>

            {/* Card 2: Relay & Gateway */}
            <TouchableOpacity
              onPress={() => router.push('/relay')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  borderWidth: 1,
                  borderColor: '#9333EA',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <RelayIcon size={20} color="#C084FC" />
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 }}>
                Relay &{'\n'}Gateway
              </Text>
            </TouchableOpacity>

            {/* Card 3: Diagnostics */}
            <TouchableOpacity
              onPress={() => router.push('/diagnostics')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  borderWidth: 1,
                  borderColor: '#9333EA',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <icons.history size={20} color="#C084FC" />
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                Diagnostics
              </Text>
            </TouchableOpacity>

            {/* Card 4: WavePX */}
            <TouchableOpacity
              onPress={() => router.push('/tier2')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: '#0D1424',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#1E293B',
                paddingVertical: 14,
                paddingHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  borderWidth: 1,
                  borderColor: '#9333EA',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <icons.mic size={20} color="#C084FC" />
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                WavePX
              </Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={{
            marginTop: 8,
            backgroundColor: 'rgba(225, 29, 72, 0.12)',
            borderWidth: 1.5,
            borderColor: '#E11D48',
            paddingVertical: 14,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <icons.logOut size={18} color="#FB7185" />
          <Text style={{ color: '#FB7185', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>
            Log Out
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
