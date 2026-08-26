import { Tabs } from 'expo-router';
import { icons } from '@/constants/icons';
import { View } from 'react-native';
import React from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Tab layout — 4 tabs: Home, Map, Nearby, Profile
 * Restyled for Style 4 — Futuristic Emergency Tech.
 * Glass dark bar with neon pink-cyan active tab indicators.
 * Role-dependent: Home tab is hidden for Responder role.
 */
export default function TabLayout() {
  const role = useAppStore((state) => state.role);
  const HomeIcon = icons.home;
  const MapIcon = icons.map;
  const NearbyIcon = icons.list;
  const ProfileIcon = icons.user;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#080D1A',
          borderTopColor: 'rgba(0, 242, 254, 0.2)',
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00F2FE',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: role === 'responder' ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
              focused && { backgroundColor: 'rgba(0, 242, 254, 0.15)', borderWidth: 1, borderColor: '#00F2FE' },
            ]}>
              <HomeIcon size={20} color={focused ? '#00F2FE' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
              focused && { backgroundColor: 'rgba(0, 242, 254, 0.15)', borderWidth: 1, borderColor: '#00F2FE' },
            ]}>
              <MapIcon size={20} color={focused ? '#00F2FE' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
              focused && { backgroundColor: 'rgba(147, 51, 234, 0.15)', borderWidth: 1, borderColor: '#9333EA' },
            ]}>
              <NearbyIcon size={20} color={focused ? '#C084FC' : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
              focused && { backgroundColor: 'rgba(0, 242, 254, 0.15)', borderWidth: 1, borderColor: '#00F2FE' },
            ]}>
              <ProfileIcon size={20} color={focused ? '#00F2FE' : color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
