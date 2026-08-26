/**
 * LOGIN SCREEN — Exact Replica of Reference Image
 * Enter Name & Mobile Number before Readiness & Role
 */

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
  const [rememberMe, setRememberMe] = useState(true);

  const ShieldIcon = icons.shield;
  const UserIcon = icons.user;
  const PhoneIcon = icons.phone;
  const CheckIcon = icons.check;
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
          
          {/* Brand Header — Round Purple Ring Emblem + Title */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                borderWidth: 2,
                borderColor: '#9333EA',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                shadowColor: '#9333EA',
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <ShieldIcon size={42} color="#C084FC" />
            </View>

            <Text style={{ color: '#C084FC', fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>
              RESCUE MESH NETWORK
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 }}>
              Operative Login
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 }}>
              Secure access to the offline{'\n'}tactical emergency mesh network.
            </Text>
          </View>

          {/* Form Card Container */}
          <View
            style={{
              backgroundColor: '#0D0F1D',
              borderRadius: 22,
              borderWidth: 1,
              borderColor: '#1E1B38',
              padding: 20,
              marginBottom: 24,
            }}
          >
            
            {/* Field 1: FULL NAME */}
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              FULL NAME
            </Text>
            <View style={{ backgroundColor: '#131527', borderRadius: 14, borderWidth: 1, borderColor: '#1E223D', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <UserIcon size={20} color="#C084FC" style={{ marginRight: 12 }} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Joshi"
                placeholderTextColor="#64748B"
                autoCapitalize="words"
                style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}
              />
            </View>

            {/* Field 2: MOBILE NUMBER */}
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
              MOBILE NUMBER
            </Text>
            <View style={{ backgroundColor: '#131527', borderRadius: 14, borderWidth: 1, borderColor: '#1E223D', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <PhoneIcon size={20} color="#C084FC" style={{ marginRight: 12 }} />
              <TextInput
                value={mobile}
                onChangeText={setMobile}
                placeholder="1234567890"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}
              />
            </View>

            {/* Remember Me & Forgot Number Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    backgroundColor: rememberMe ? '#9333EA' : 'transparent',
                    borderWidth: rememberMe ? 0 : 1.5,
                    borderColor: '#64748B',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  {rememberMe && <CheckIcon size={12} color="#FFFFFF" />}
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={{ color: '#C084FC', fontSize: 13, fontWeight: '600' }}>
                  Forgot number?
                </Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Bottom Action Button (Solid Purple Gradient with Right Arrow) */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#7C3AED',
              paddingVertical: 16,
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              shadowColor: '#7C3AED',
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>
              PROCEED TO READINESS & ROLE
            </Text>
            <ArrowRightIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
