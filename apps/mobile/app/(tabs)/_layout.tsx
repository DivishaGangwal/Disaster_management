import { Tabs } from 'expo-router';
import { icons } from '@/constants/icons';
import React from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Tab layout — 4 tabs: Home, Map, Nearby, Profile
 * Tactical navigation: the active state is conveyed by color and label,
 * without wrapping every icon in another decorative pill.
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
          backgroundColor: '#070C16',
          borderTopColor: '#1B2944',
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00F2FE',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: .3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: role === 'responder' ? null : undefined,
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, focused }) => <HomeIcon size={22} color={focused ? '#00F2FE' : color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarAccessibilityLabel: 'Operational map',
          tabBarIcon: ({ color, focused }) => <MapIcon size={22} color={focused ? '#00F2FE' : color} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarAccessibilityLabel: 'Nearby incidents',
          tabBarIcon: ({ color, focused }) => <NearbyIcon size={22} color={focused ? '#C084FC' : color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile and offline data',
          tabBarIcon: ({ color, focused }) => <ProfileIcon size={22} color={focused ? '#00F2FE' : color} />,
        }}
      />
    </Tabs>
  );
}
