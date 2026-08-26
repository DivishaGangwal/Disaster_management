/**
 * READINESS & ROLE — Replica of Reference Screen 1
 * PNG ref: screen 1 (Readiness & Role)
 * Route: Readiness
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mobileController } from '@/src/services/mobile-controller';

export default function ReadinessScreen() {
  const router = useRouter();
  const {
    role, setRole,
    bluetoothEnabled,
    locationEnabled,
    microphoneEnabled,
    offlinePackVersion,
    selectedRegion,
    setHasCompletedReadiness,
  } = useAppStore();

  const UsersIcon = icons.users;
  const ShieldIcon = icons.shield;
  const CheckIcon = icons.check;
  const BluetoothIcon = icons.bluetoothOn;
  const LocationIcon = icons.location;
  const MicIcon = icons.mic;

  const handleGoHome = () => {
    setHasCompletedReadiness(true);
    if (role === 'responder') {
      router.replace('/(tabs)/nearby');
    } else {
      router.replace('/(tabs)');
    }
  };

  const chooseRole = (nextRole: 'general-public' | 'responder') => {
    setRole(nextRole);
    void mobileController.reconfigureRole(nextRole).catch((reason: unknown) => Alert.alert('Runtime setup failed', reason instanceof Error ? reason.message : String(reason)));
  };

  const requestSystemAccess = async () => {
    try { await mobileController.requestPermissions(); }
    catch (reason) { Alert.alert('Permission request failed', reason instanceof Error ? reason.message : String(reason)); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      {/* Top Header */}
      <View style={{ height: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 242, 254, 0.12)' }}>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
          Readiness & Role
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        
        {/* Section 1: Select your role */}
        <View>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Select your role
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* General Public Card (PURPLE COLORING) */}
            <TouchableOpacity
              onPress={() => chooseRole('general-public')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: role === 'general-public' ? '#9333EA' : '#1E293B',
                backgroundColor: role === 'general-public' ? 'rgba(147, 51, 234, 0.12)' : '#0D1424',
                paddingVertical: 20,
                paddingHorizontal: 12,
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: role === 'general-public' ? 'rgba(147, 51, 234, 0.25)' : '#1E293B', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                <UsersIcon size={24} color={role === 'general-public' ? '#C084FC' : '#64748B'} />
              </View>
              <Text style={{ color: role === 'general-public' ? '#F8FAFC' : '#94A3B8', fontSize: 14, fontWeight: '800' }}>
                General Public
              </Text>
              {role === 'general-public' && (
                <View style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: '#9333EA', justifyContent: 'center', alignItems: 'center' }}>
                  <CheckIcon size={12} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Responder Card (RED COLORING) */}
            <TouchableOpacity
              onPress={() => chooseRole('responder')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: role === 'responder' ? '#E11D48' : '#1E293B',
                backgroundColor: role === 'responder' ? 'rgba(225, 29, 72, 0.12)' : '#0D1424',
                paddingVertical: 20,
                paddingHorizontal: 12,
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: role === 'responder' ? 'rgba(225, 29, 72, 0.25)' : '#1E293B', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                <ShieldIcon size={24} color={role === 'responder' ? '#FB7185' : '#64748B'} />
              </View>
              <Text style={{ color: role === 'responder' ? '#F8FAFC' : '#94A3B8', fontSize: 14, fontWeight: '800' }}>
                Responder
              </Text>
              {role === 'responder' && (
                <View style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E11D48', justifyContent: 'center', alignItems: 'center' }}>
                  <CheckIcon size={12} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Device Permissions (Exact order: Bluetooth -> Location -> Microphone using lucide-react-native icons) */}
        <View>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Device Permissions
          </Text>

          <View style={{ backgroundColor: '#0D1424', borderRadius: 18, borderWidth: 1, borderColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 4 }}>
            
            {/* 1. Bluetooth */}
            <SleekPermissionRow
              IconComponent={BluetoothIcon}
              label="Bluetooth"
              enabled={bluetoothEnabled}
              onPress={() => void requestSystemAccess()}
            />
            <View style={{ height: 1, backgroundColor: '#1E293B' }} />
            
            {/* 2. Location */}
            <SleekPermissionRow
              IconComponent={LocationIcon}
              label="Location"
              enabled={locationEnabled}
              onPress={() => void requestSystemAccess()}
            />
            <View style={{ height: 1, backgroundColor: '#1E293B' }} />
            
            {/* 3. Microphone */}
            <SleekPermissionRow
              IconComponent={MicIcon}
              label="Microphone"
              enabled={microphoneEnabled}
              onPress={() => void requestSystemAccess()}
            />
          </View>
        </View>

        {/* Section 3: Offline Region Pack */}
        <View>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Offline Region Pack
          </Text>

          <View style={{ backgroundColor: '#0D1424', borderRadius: 18, borderWidth: 1, borderColor: '#1E293B', padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>
                {selectedRegion || 'South District Pack'}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: 'rgba(0, 230, 118, 0.15)', borderWidth: 1, borderColor: '#00E676', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14 }}>
                  <Text style={{ color: '#00E676', fontSize: 11, fontWeight: '800' }}>Downloaded</Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 14 }}>›</Text>
              </View>
            </View>

            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Version {offlinePackVersion || '2025.05.12'} · 1.2 GB
            </Text>
          </View>
        </View>

        {/* Bottom Action Button (Purple "Continue to Home") */}
        <View style={{ marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleGoHome}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#9333EA',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              shadowColor: '#9333EA',
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>
              Continue to Home
            </Text>
          </TouchableOpacity>
          <Text style={{ color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            You can change these later in Profile.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SleekPermissionRow({
  IconComponent,
  label,
  enabled,
  onPress,
}: {
  IconComponent: (props: { size?: number | string; color?: string }) => React.ReactNode;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const CheckIcon = icons.check;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconComponent size={18} color="#38BDF8" />
        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>{label}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: enabled ? '#00E676' : '#64748B', fontSize: 14, fontWeight: '700' }}>
          {enabled ? 'On' : 'Off'}
        </Text>
        <CheckIcon size={18} color={enabled ? '#00E676' : '#64748B'} />
      </View>
    </TouchableOpacity>
  );
}
