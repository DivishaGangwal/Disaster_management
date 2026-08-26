/** Local, offline profile setup before readiness and role selection. */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { icons } from '@/constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const { userName, mobileNumber, setUserName, setMobileNumber, setIsLoggedIn } = useAppStore();

  const [name, setName] = useState(userName || '');
  const [mobile, setMobile] = useState(mobileNumber || '');
  const ShieldIcon = icons.shield;
  const UserIcon = icons.user;
  const PhoneIcon = icons.phone;
  const ArrowRightIcon = icons.arrowRight;

  const handleLogin = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setUserName(name.trim());
    setMobileNumber(mobile.trim());
    setIsLoggedIn(true);

    // Proceed to Readiness & Role screen
    router.replace('/readiness');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#05070D' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
          
          <View style={{ alignItems: 'flex-start', marginBottom: 32 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 5,
                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                borderLeftWidth: 3,
                borderColor: '#9333EA',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <ShieldIcon size={28} color="#C084FC" />
            </View>

            <Text style={{ color: '#C084FC', fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>
              RESCUE MESH NETWORK
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 }}>
              Local Profile
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 8, lineHeight: 20, maxWidth: 330 }}>
              Saved on this device for local packet creation. This is not an online account or identity verification.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: '#0D0F1D',
              borderWidth: 1,
              borderColor: '#1E1B38',
              borderRadius: 10,
              padding: 18,
              marginBottom: 24,
            }}
          >
            
            {/* Field 1: FULL NAME */}
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              FULL NAME
            </Text>
            <View style={{ backgroundColor: '#131527', borderRadius: 5, borderWidth: 1, borderColor: '#1E223D', paddingHorizontal: 14, minHeight: 52, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <UserIcon size={20} color="#C084FC" style={{ marginRight: 12 }} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Joshi"
                placeholderTextColor="#64748B"
                autoCapitalize="words"
                accessibilityLabel="Full name"
                returnKeyType="next"
                style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}
              />
            </View>

            {/* Field 2: MOBILE NUMBER */}
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              MOBILE NUMBER
            </Text>
            <View style={{ backgroundColor: '#131527', borderRadius: 5, borderWidth: 1, borderColor: '#1E223D', paddingHorizontal: 14, minHeight: 52, flexDirection: 'row', alignItems: 'center' }}>
              <PhoneIcon size={20} color="#C084FC" style={{ marginRight: 12 }} />
              <TextInput
                value={mobile}
                onChangeText={setMobile}
                placeholder="1234567890"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                accessibilityLabel="Mobile number"
                maxLength={15}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}
              />
            </View>

          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continue to readiness and role"
            accessibilityHint="Saves this profile only on this device"
            onPress={handleLogin}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#7C3AED',
              paddingVertical: 16,
              paddingHorizontal: 18,
              borderRadius: 5,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={{ flexShrink: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.7, textAlign: 'center' }}
            >
              CONTINUE TO READINESS & ROLE
            </Text>
            <ArrowRightIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
