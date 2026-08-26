/**
 * READINESS & ROLE — Replica of Reference Screen 1
 * PNG ref: screen 1 (Readiness & Role)
 * Route: Readiness
 */

import React, { useEffect, useState } from 'react';
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
    offlinePackStatus,
    offlinePackProgress,
    selectedRegion,
    internetState,
    transportMode,
    relayActive,
    tier2Listening,
    setHasCompletedReadiness,
  } = useAppStore();

  const UsersIcon = icons.users;
  const ShieldIcon = icons.shield;
  const CheckIcon = icons.check;
  const BluetoothIcon = icons.bluetoothOn;
  const LocationIcon = icons.location;
  const MicIcon = icons.mic;
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;
    void mobileController.refreshPermissionStatus()
      .catch((reason: unknown) => Alert.alert('Permission status unavailable', reason instanceof Error ? reason.message : String(reason)))
      .finally(() => { if (active) setCheckingAccess(false); });
    void mobileController.refreshOfflineMap();
    return () => { active = false; };
  }, []);

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
    setRequestingAccess(true);
    try { await mobileController.requestPermissions(); }
    catch (reason) { Alert.alert('Permission request failed', reason instanceof Error ? reason.message : String(reason)); }
    finally { setRequestingAccess(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      <View style={{ minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#142039' }}>
        <Text style={{ color: '#A855F7', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>DEVICE ENTRY CHECK</Text>
        <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 1 }}>Readiness & Role</Text>
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
              accessibilityRole="radio"
              accessibilityLabel="General Public role"
              accessibilityState={{ selected: role === 'general-public' }}
              onPress={() => chooseRole('general-public')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: 6,
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
              accessibilityRole="radio"
              accessibilityLabel="Responder role"
              accessibilityState={{ selected: role === 'responder' }}
              onPress={() => chooseRole('responder')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: 6,
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

          <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 }}>
            
            {/* 1. Bluetooth */}
            <PermissionStatusRow
              IconComponent={BluetoothIcon}
              label="Bluetooth"
              enabled={bluetoothEnabled}
              checking={checkingAccess}
            />
            <View style={{ height: 1, backgroundColor: '#1E293B' }} />
            
            {/* 2. Location */}
            <PermissionStatusRow
              IconComponent={LocationIcon}
              label="Location"
              enabled={locationEnabled}
              checking={checkingAccess}
            />
            <View style={{ height: 1, backgroundColor: '#1E293B' }} />
            
            {/* 3. Microphone */}
            <PermissionStatusRow
              IconComponent={MicIcon}
              label="Microphone"
              enabled={microphoneEnabled}
              checking={checkingAccess}
            />
          </View>
          <Text style={{ color: '#94A3B8', fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            Nearby Devices powers Bluetooth relay, location can be attached to SOS packets, and microphone access is only used while WavePX listening is active.
          </Text>
          {!checkingAccess && (!bluetoothEnabled || !locationEnabled || !microphoneEnabled) && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Grant required device access"
              accessibilityState={{ busy: requestingAccess }}
              onPress={() => void requestSystemAccess()}
              disabled={requestingAccess}
              style={{ marginTop: 10, minHeight: 48, borderRadius: 8, backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: '#38BDF8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, opacity: requestingAccess ? 0.65 : 1 }}
            >
              <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '800' }}>{requestingAccess ? 'Checking access…' : 'Grant required access'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section 3: Offline Region Pack */}
        <View>
          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 }}>
            Offline Region Pack
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Offline region pack. ${selectedRegion}. ${offlinePackStatus}`}
            onPress={() => router.push('/(tabs)/profile')}
            style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 15 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>
                {selectedRegion || 'South District Pack'}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: 'rgba(0, 230, 118, 0.15)', borderWidth: 1, borderColor: '#00E676', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14 }}>
                  <Text style={{ color: offlinePackStatus === 'ready' ? '#00E676' : '#94A3B8', fontSize: 11, fontWeight: '800' }}>
                    {offlinePackStatus === 'ready' ? 'Downloaded' : offlinePackStatus === 'downloading' ? `${offlinePackProgress}%` : offlinePackStatus === 'checking' ? 'Checking' : offlinePackStatus === 'error' ? 'Error' : 'Not downloaded'}
                  </Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 14 }}>›</Text>
              </View>
            </View>

            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Version {offlinePackVersion || 'unknown'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, padding: 14, gap: 8 }}>
          <ReadinessFact label="Transport" value={transportMode === 'native' ? 'Native Android Bluetooth' : 'SIMULATED — no real Bluetooth'} />
          <ReadinessFact label="Relay" value={relayActive ? 'Active' : 'Inactive'} />
          <ReadinessFact label="Internet" value={internetState} />
          <ReadinessFact label="Tier 2 listener" value={tier2Listening ? 'Active' : 'Inactive'} />
        </View>

        {/* Bottom Action Button (Purple "Continue to Home") */}
        <View style={{ marginTop: 8 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={role === 'responder' ? 'Continue to nearby incidents' : 'Continue to home'}
            onPress={handleGoHome}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#9333EA',
              paddingVertical: 16,
              borderRadius: 10,
              alignItems: 'center',
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

function PermissionStatusRow({
  IconComponent,
  label,
  enabled,
  checking,
}: {
  IconComponent: (props: { size?: number | string; color?: string }) => React.ReactNode;
  label: string;
  enabled: boolean;
  checking: boolean;
}) {
  const CheckIcon = icons.check;

  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconComponent size={18} color="#38BDF8" />
        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>{label}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: checking ? '#FFB300' : enabled ? '#00E676' : '#64748B', fontSize: 14, fontWeight: '700' }}>
          {checking ? 'Checking' : enabled ? 'On' : 'Off'}
        </Text>
        <CheckIcon size={18} color={checking ? '#FFB300' : enabled ? '#00E676' : '#64748B'} />
      </View>
    </View>
  );
}

function ReadinessFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ color: '#94A3B8', fontSize: 12 }}>{label}</Text>
      <Text style={{ flexShrink: 1, color: '#F8FAFC', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
