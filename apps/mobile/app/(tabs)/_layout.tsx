import { Tabs } from 'expo-router';
import { icons } from '@/constants/icons';
import { View, Text } from 'react-native';
import React from 'react';

/**
 * Tab layout — 4 tabs: Home, Map, Nearby, Profile
 * Matches PNG designs exactly — consistent across ALL pages.
 * Pure black bar, sharp corners, green active tab highlight.
 */
export default function TabLayout() {
  const HomeIcon = icons.home;
  const MapIcon = icons.map;
  const NearbyIcon = icons.list;
  const ProfileIcon = icons.user;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#3A3A3C',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          borderRadius: 0,
        },
        tabBarActiveTintColor: '#a1d494',
        tabBarInactiveTintColor: '#AEAEB2',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          borderRadius: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              { padding: 6, borderRadius: 0 },
              focused && { backgroundColor: '#2D5A27' },
            ]}>
              <HomeIcon size={22} color={color} />
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
              { padding: 6, borderRadius: 0 },
              focused && { backgroundColor: '#2D5A27' },
            ]}>
              <MapIcon size={22} color={color} />
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
              { padding: 6, borderRadius: 0 },
              focused && { backgroundColor: '#2D5A27' },
            ]}>
              <NearbyIcon size={22} color={color} />
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
              { padding: 6, borderRadius: 0 },
              focused && { backgroundColor: '#2D5A27' },
            ]}>
              <ProfileIcon size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
